import fs from 'fs-extra';
import path from 'path';
import { config } from '../config/index.js';

/**
 * Simple logger utility
 * (Simplified version - can be upgraded to Winston if needed)
 */

class Logger {
  constructor() {
    this.logsDir = config.logsDir;
    this.ensureLogsDir();
  }

  async ensureLogsDir() {
    await fs.ensureDir(this.logsDir);
  }

  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    // Console output
    const color = this.getColor(level);
    console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}\x1b[0m`);

    // File output (async, non-blocking)
    this.writeToFile(level, logEntry);
  }

  getColor(level) {
    const colors = {
      info: '\x1b[36m',    // Cyan
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      debug: '\x1b[35m',   // Magenta
      success: '\x1b[32m'  // Green
    };
    return colors[level] || '\x1b[37m'; // Default white
  }

  async writeToFile(level, logEntry) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logsDir, `${date}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      await fs.appendFile(logFile, logLine);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  debug(message, meta) {
    if (config.env === 'development') {
      this.log('debug', message, meta);
    }
  }

  success(message, meta) {
    this.log('success', message, meta);
  }
}

export const logger = new Logger();