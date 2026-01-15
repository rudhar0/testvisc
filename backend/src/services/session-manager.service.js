import { v4 as uuidv4 } from 'uuid';
import { createRedis } from '../config/redis.config.js';
import securityConfig from '../config/security.config.js';
import logger from '../utils/logger.js';

class SessionManager {
  constructor() {
    this.redis = createRedis();
    this.prefix = 'session:';
    this.workerSessionIndex = 'worker-session-index:';

    // Periodically run cleanup
    setInterval(this.cleanupExpiredSessions.bind(this), securityConfig.session.ttl * 1000);
    logger.info('SessionManager initialized and cleanup job scheduled.');
  }

  /**
   * Creates a new session.
   * @param {string} userId - The ID of the user.
   * @param {string} codeHash - A hash of the user's code.
   * @param {string} language - The programming language.
   * @returns {object} The created session object.
   */
  async createSession(userId, codeHash, language) {
    const sessionId = uuidv4();
    const session = {
      sessionId,
      userId,
      workerId: null,
      status: 'pending', // Status can be: pending, active, recovery, failed
      createdAt: Date.now(),
      lastActivity: Date.now(),
      codeHash,
      language,
    };

    const sessionKey = `${this.prefix}${sessionId}`;
    await this.redis.set(sessionKey, JSON.stringify(session), 'EX', securityConfig.session.ttl);
    logger.info({ sessionId, userId }, 'Session created.');
    return session;
  }

  /**
   * Retrieves a session by its ID.
   * @param {string} sessionId - The ID of the session.
   * @returns {object|null} The session object or null if not found.
   */
  async getSession(sessionId) {
    const sessionData = await this.redis.get(`${this.prefix}${sessionId}`);
    if (!sessionData) {
      logger.warn({ sessionId }, 'Session not found.');
      return null;
    }
    return JSON.parse(sessionData);
  }

  /**
   * Updates a session.
   * @param {string} sessionId - The ID of the session.
   * @param {object} updates - The fields to update.
   * @returns {object|null} The updated session object.
   */
  async updateSession(sessionId, updates) {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const previousWorkerId = session.workerId;
    const updatedSession = { ...session, ...updates, lastActivity: Date.now() };

    await this.redis.set(`${this.prefix}${sessionId}`, JSON.stringify(updatedSession), 'EX', securityConfig.session.ttl);
    logger.info({ sessionId, updates }, 'Session updated.');

    // Update worker-session index if workerId changes
    if (updates.workerId && updates.workerId !== previousWorkerId) {
      if (previousWorkerId) {
        await this.redis.del(`${this.workerSessionIndex}${previousWorkerId}`);
      }
      await this.redis.set(`${this.workerSessionIndex}${updates.workerId}`, sessionId);
    }

    return updatedSession;
  }

  /**
   * Deletes a session.
   * @param {string} sessionId - The ID of the session.
   */
  async deleteSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (session && session.workerId) {
      await this.redis.del(`${this.workerSessionIndex}${session.workerId}`);
    }
    await this.redis.del(`${this.prefix}${sessionId}`);
    logger.info({ sessionId }, 'Session deleted.');
  }

  /**
   * Finds a session associated with a worker.
   * @param {string} workerId - The ID of the worker.
   * @returns {object|null} The session object or null if not found.
   */
  async findSessionByWorkerId(workerId) {
    const sessionId = await this.redis.get(`${this.workerSessionIndex}${workerId}`);
    if (!sessionId) {
      logger.warn({ workerId }, 'No session found for this worker.');
      return null;
    }
    return this.getSession(sessionId);
  }

  /**
   * Handles the failure of a worker.
   * @param {string} workerId - The ID of the failed worker.
   */
  async handleWorkerFailure(workerId) {
    logger.warn({ workerId }, 'Handling worker failure.');
    const session = await this.findSessionByWorkerId(workerId);
    if (session) {
      logger.info({ sessionId: session.sessionId, workerId }, 'Found session associated with failed worker. Marking for recovery.');
      await this.updateSession(session.sessionId, { workerId: null, status: 'recovery' });
      // Here you might emit an event to a recovery service or notify the user
    } else {
      logger.warn({ workerId }, 'No active session found for the failed worker.');
    }
     await this.redis.del(`${this.workerSessionIndex}${workerId}`);
  }


  /**
   * Cleans up expired sessions and related resources.
   * Redis handles the TTL of the session key automatically.
   * This method is for cleaning up any other resources associated with sessions.
   */
  async cleanupExpiredSessions() {
    logger.info('Running periodic session cleanup...');
    // In a real implementation, you might scan for sessions that are about to expire
    // and clean up related resources that are not automatically handled by Redis TTL.
    // For example, if there were files stored on disk for a session.
    // For now, we will just log that the job is running.
  }
}

export default new SessionManager();