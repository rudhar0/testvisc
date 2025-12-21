/**
 * Socket Service
 * Manages Socket.io connection and events
 */

import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '@config/api.config';
import { SOCKET_EVENTS } from '@constants/index';
import type { ExecutionTrace, GCCStatus } from '@types/index';

export type SocketEventCallback = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventListeners: Map<string, SocketEventCallback[]> = new Map();
  private isConnectedFlag = false;

  /**
   * Connect to Socket.io server
   */
  connect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.socket);
        return;
      }

      console.log('🔌 Connecting to Socket.io server...');

      this.socket = io(API_CONFIG.socketURL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      // Connection successful
      this.socket.on('connect', () => {
        console.log('✅ Socket.io connected:', this.socket?.id);
        this.reconnectAttempts = 0;
        this.isConnectedFlag = true;
        this.emit('connection:state', { connected: true });
        resolve(this.socket!);
      });

      // Connection error
      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket.io connection error:', error);
        this.reconnectAttempts++;
        this.isConnectedFlag = false;
        this.emit('connection:state', { connected: false });
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Failed to connect after maximum attempts'));
        }
      });

      // Disconnection
      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Socket.io disconnected:', reason);
        this.isConnectedFlag = false;
        this.emit('connection:state', { connected: false });
      });

      // Reconnection attempt
      this.socket.on('reconnect_attempt', (attempt) => {
        console.log(`🔄 Reconnection attempt ${attempt}/${this.maxReconnectAttempts}`);
      });

      // Setup event listeners
      this.setupEventListeners();
    });
  }

  /**
   * Disconnect from Socket.io server
   */
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting from Socket.io server...');
      this.socket.disconnect();
      this.socket = null;
      this.eventListeners.clear();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    // GCC Events
    this.socket.on(SOCKET_EVENTS.GCC_STATUS, (data: GCCStatus) => {
      this.emit('gcc:status', data);
    });

    this.socket.on(SOCKET_EVENTS.GCC_DOWNLOAD_PROGRESS, (data) => {
      this.emit('gcc:download:progress', data);
    });

    this.socket.on(SOCKET_EVENTS.GCC_DOWNLOAD_COMPLETE, (data) => {
      this.emit('gcc:download:complete', data);
    });

    this.socket.on(SOCKET_EVENTS.GCC_DOWNLOAD_ERROR, (data) => {
      this.emit('gcc:download:error', data);
    });

    // Code Analysis Events
    this.socket.on(SOCKET_EVENTS.CODE_SYNTAX_RESULT, (data) => {
      this.emit('code:syntax:result', data);
    });

    this.socket.on(SOCKET_EVENTS.CODE_SYNTAX_ERROR, (data) => {
      this.emit('code:syntax:error', data);
    });

    // Trace Events
    this.socket.on(SOCKET_EVENTS.CODE_TRACE_PROGRESS, (data) => {
      this.emit('code:trace:progress', data);
    });

    this.socket.on(SOCKET_EVENTS.CODE_TRACE_CHUNK, (data) => {
      this.emit('code:trace:chunk', data);
    });

    this.socket.on(SOCKET_EVENTS.CODE_TRACE_COMPLETE, (data) => {
      this.emit('code:trace:complete', data);
    });

    this.socket.on(SOCKET_EVENTS.CODE_TRACE_ERROR, (data) => {
      this.emit('code:trace:error', data);
    });

    // Execution Events
    this.socket.on(SOCKET_EVENTS.EXECUTION_INPUT_RECEIVED, (data) => {
      this.emit('execution:input:received', data);
    });

    this.socket.on(SOCKET_EVENTS.EXECUTION_PAUSED, () => {
      this.emit('execution:paused', {});
    });

    this.socket.on(SOCKET_EVENTS.EXECUTION_RESUMED, () => {
      this.emit('execution:resumed', {});
    });
  }

  /**
   * Emit custom event to listeners
   */
  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Subscribe to event
   */
  on(event: string, callback: SocketEventCallback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from event
   */
  off(event: string, callback: SocketEventCallback) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // ============================================
  // EMIT METHODS (Send to Server)
  // ============================================

  /**
   * Request GCC status
   */
  requestGCCStatus() {
    this.socket?.emit(SOCKET_EVENTS.GCC_STATUS_REQUEST);
  }

  /**
   * Start GCC download
   */
  startGCCDownload() {
    this.socket?.emit(SOCKET_EVENTS.GCC_DOWNLOAD_START);
  }

  /**
   * Analyze code syntax
   */
  analyzeSyntax(code: string, language: string) {
    this.socket?.emit(SOCKET_EVENTS.CODE_ANALYZE_SYNTAX, {
      code,
      language
    });
  }

  /**
   * Generate execution trace (Socket.io - for large code)
   */
  generateTrace(code: string, language: string, inputs: any[] = []) {
    this.socket?.emit(SOCKET_EVENTS.CODE_TRACE_GENERATE, {
      code,
      language,
      inputs
    });
  }

  /**
   * Send code chunk (for large files)
   */
  sendCodeChunk(chunkId: number, totalChunks: number, code: string, language: string) {
    this.socket?.emit(SOCKET_EVENTS.CODE_ANALYZE_CHUNK, {
      chunkId,
      totalChunks,
      code,
      language
    });
  }

  /**
   * Provide user input (for scanf/cin)
   */
  provideInput(stepId: number, values: any[]) {
    this.socket?.emit(SOCKET_EVENTS.EXECUTION_INPUT_PROVIDE, {
      stepId,
      values
    });
  }

  /**
   * Pause execution
   */
  pauseExecution() {
    this.socket?.emit(SOCKET_EVENTS.EXECUTION_PAUSE);
  }

  /**
   * Resume execution
   */
  resumeExecution() {
    this.socket?.emit(SOCKET_EVENTS.EXECUTION_RESUME);
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;