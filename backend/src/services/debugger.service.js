import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { gccService } from './gcc.service.js';
import GdbMiParser from '../parsers/gdb-mi-parser.js';
import memoryMapperService from './memory-mapper.service.js';
import inputManager from './input-manager.service.js';
import { logger } from '../utils/logger.js';
import codeValidatorService from '../validators/code-validator.service.js';
import traceVisualizerService from '../visualizers/trace-visualizer.service.js';

// Global tracker to ensure only one GDB instance runs at a time across all service instances
let activeGdbSession = null;

class DebuggerService {
  constructor(io) {
    this.io = io;
    this.gdb = null;
    this.parser = new GdbMiParser();
    this.memoryMapper = memoryMapperService; // Use the singleton instance
    this.traceVisualizer = traceVisualizerService;
    this.stepCounter = 0;
    this.buffer = '';
    this.responseEmitter = new EventEmitter();
    inputManager.setSocket(io);
    this.currentRunId = 0;
  }

  async start(code, language) {
    try {
      if (this.gdb) {
        logger.info('Cleaning up previous GDB session');
        this.gdb.stdout.removeAllListeners();
        this.gdb.stderr.removeAllListeners();
        this.gdb.removeAllListeners();
        this.gdb.kill();
        this.gdb = null;
      }

      // Global cleanup: Kill any running GDB process from ANY instance
      if (activeGdbSession) {
        logger.info('Cleaning up global active GDB session');
        if (activeGdbSession.process) {
          // Remove listeners to prevent 'close' events from triggering 'execution:ended' for the old run
          activeGdbSession.process.removeAllListeners();
          activeGdbSession.process.stdout.removeAllListeners();
          activeGdbSession.process.stderr.removeAllListeners();
          try { activeGdbSession.process.kill(); } catch (e) { /* ignore */ }
        }
        activeGdbSession = null;
      }
      // Clear any pending event listeners from previous runs to prevent leaks
      this.responseEmitter.removeAllListeners();

      this.io.emit('execution:started');
      // 0. Scan for input requirements
      if (!code) throw new Error("Code is empty");
      inputManager.scanCode(code);

      // 0.5. Validate code
      logger.info('🔬 Validating code...');
      const syntaxErrors = await codeValidatorService.checkSyntax(code, language);
      if (syntaxErrors.length > 0) {
        // For critical syntax errors, we might want to stop immediately.
        const errorMsg = syntaxErrors.map(e => `L${e.line}: ${e.message}`).join('\n');
        throw new Error(`Syntax errors found:\n${errorMsg}`);
      }
      
      const staticAnalysisIssues = await codeValidatorService.analyzeWithTidy(code, language);
      const validationIssues = [...syntaxErrors, ...staticAnalysisIssues];

      if (validationIssues.length > 0) {
        // Emitting a warning or non-fatal error event might be better here
        // For now, we'll throw, which is a hard stop.
        const errorMsg = validationIssues.map(e => `L${e.line}: [${e.type}] ${e.message}`).join('\n');
        throw new Error(`Code validation issues found:\n${errorMsg}`);
      }
      logger.info('✅ Code validation passed.');

      // 1. Compile the code with debugging symbols
      const compileResult = await gccService.compile(code, language, ['-g']);

      if (!compileResult.success) {
        throw new Error(`Compilation failed: ${compileResult.errors || compileResult.stderr || 'Unknown error'}`);
      }

      const executablePath = compileResult.executablePath;

      // 2. Start GDB in MI mode
      this.gdb = spawn('gdb', ['--interpreter=mi', executablePath]);
      activeGdbSession = { process: this.gdb }; // Track globally
      
      this.gdb.on('error', (err) => {
        logger.error('Failed to spawn GDB:', err);
        this.io.emit('gdb-error', `Failed to start GDB: ${err.message}. Is GDB installed?`);
      });

      this.stepCounter = 0;
      this.buffer = '';
      this.currentRunId++;
      const runId = this.currentRunId;
      this.hasHitMain = false;

      this.gdb.stdout.on('data', async (data) => {
        this.buffer += data.toString();
        const lines = this.buffer.split('\n');
        if (this.buffer.endsWith('\n')) {
          this.buffer = '';
        } else {
          this.buffer = lines.pop();
        }

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = this.parser.parse(line);
            this.io.emit('gdb-output', parsed);
            for (const record of parsed) {
              this.responseEmitter.emit('record', record);
              if (record.type === 'stopped') {
                logger.info('🛑 GDB Stopped, triggering handleStop');
                this.handleStop(record.payload, runId).catch(e => logger.error('Error in handleStop', e));
              }
            }
          } catch (err) {
            logger.error('Error processing GDB output:', err);
          }
        }
      });

      this.gdb.stderr.on('data', (data) => {
        this.io.emit('gdb-error', data.toString());
        logger.error('GDB stderr:', data.toString());
      });

      this.gdb.on('close', (code) => {
        this.io.emit('gdb-close', code);
        this.io.emit('execution:ended');
        this.gdb = null;
        if (activeGdbSession && activeGdbSession.process === this.gdb) activeGdbSession = null;
      });

      // Set a breakpoint at the main function
      this.sendCommand('-break-insert main');
      
      // Set breakpoints at detected input lines
      for (const line of inputManager.inputLines.keys()) {
          this.sendCommand(`-break-insert ${line}`);
      }

      this.sendCommand('-exec-run');
    } catch (error) {
      logger.error(`Debugger start failed: ${error.message}`, error);
      this.io.emit('execution:error', { message: error.message });
      throw error;
    }
  }

  async handleStop(payload, runId) {
    // Prevent zombie execution steps from previous runs
    if (runId && runId !== this.currentRunId) {
      logger.warn(`🛑 Ignoring handleStop for old runId ${runId} (current: ${this.currentRunId})`);
      return;
    }

    const { reason, frame } = payload;
    logger.info(`🛑 handleStop processing. Reason: ${reason}`, { frame });

    // Handle runtime errors like segfaults
    if (reason === 'signal-received') {
      const signalName = payload['signal-name'] || 'UNKNOWN';
      const signalMeaning = payload['signal-meaning'] || 'Unknown error';
      const line = frame ? frame.line : 'unknown';
      const errorMessage = `Runtime Error at line ${line}: ${signalMeaning} (${signalName}).`;
      
      logger.error(errorMessage, payload);
      this.io.emit('execution:error', { message: errorMessage });
      this.stop();
      return;
    }
    
    let line = frame && frame.line ? parseInt(frame.line, 10) : 0;

    // Filter out setup steps before main to prevent noise and duplicate IDs
    if (!this.hasHitMain) {
      if (reason === 'breakpoint-hit' && frame && frame.function === 'main') {
        this.hasHitMain = true;
        this.stepCounter = 0;
      } else {
        logger.info('Skipping setup step before main, continuing execution...');
        this.continue();
        return;
      }
    }

    if (reason === 'breakpoint-hit' && inputManager.isInputLine(line)) {
      // Handle input request
      const info = inputManager.getInputInfo(line);
      try {
        const value = await inputManager.requestInput({ line, ...info });
        logger.info(`Received input "${value}" for ${info.varName} at line ${line}`);
        
        // This is a simplification. For scanf, we can't easily set the variable like this.
        // For this project, we'll assume setting the variable is sufficient.
        this.sendCommand(`-gdb-set var ${info.varName}=${JSON.stringify(value)}`);
        this.sendCommand('-exec-continue');

      } catch (error) {
        logger.error('Error handling input request:', error);
        this.stop(); // Stop debugger on error
      }
    } else {
      // Handle normal step/breakpoint
      try {
        let variables = [];
        let stack = [];
        
        try { 
          logger.info('⏳ Fetching variables...');
          variables = await this.getVariables(); 
          logger.info(`✅ Got ${variables.length} variables`);
        } catch (e) { logger.warn('Failed to get variables', e); }

        try { 
          logger.info('⏳ Fetching stack...');
          stack = await this.getStack(); 
          logger.info('✅ Got stack');

          // Fallback: If line is 0, try to get it from the top stack frame
          if (line === 0 && stack && stack.length > 0) {
            for (const s of stack) {
              const f = s.frame || s;
              if (f && f.line) {
                line = parseInt(f.line, 10);
                logger.info(`⚠️ Recovered line number ${line} from stack frame depth`);
                break;
              }
            }
          }
        } catch (e) { logger.warn('Failed to get stack', e); }

        // Create the structured memory state using the new mapper
        const memoryState = this.memoryMapper.createMemoryState(variables, stack);

        // Generate visualization steps
        const visualizationSteps = this.traceVisualizer.generateVisualizationSteps(memoryState);
        
        const executionStep = {
          id: ++this.stepCounter,
          line: line,
          explanation: `Stopped at line ${line} (reason: ${reason})`,
        };
        
        logger.info(`Backend: Emitting execution step:`, executionStep);
        this.io.emit('execution:step', executionStep);

        if (visualizationSteps.length > 0) {
          logger.info(`Backend: Emitting ${visualizationSteps.length} visualization steps.`);
          this.io.emit('execution:visualize', visualizationSteps);
        }

      } catch(error) {
        // If the run was cancelled/replaced, don't emit error
        if (runId && runId !== this.currentRunId) return;

        logger.error('Error getting state from GDB:', error);
        // Emit error but don't block UI
        this.io.emit('execution:error', { message: 'Failed to retrieve debug state' });
      }
    }
  }

  sendCommand(command) {
    if (this.gdb) {
      logger.info(`GDB < ${command}`);
      this.gdb.stdin.write(`${command}\n`);
    }
  }

  stop() {
    if (this.gdb) {
      this.gdb.kill();
    }
  }

  next() {
    this.sendCommand('-exec-next');
  }

  step() {
    this.sendCommand('-exec-step');
  }

  continue() {
    this.sendCommand('-exec-continue');
  }

  getVariables() {
    return new Promise((resolve, reject) => {
      const command = '-stack-list-variables --thread 1 --frame 0 --all-values'; // Specify thread and frame for more reliable results
      logger.info(`➡️ Sending: ${command}`);
      const timeout = setTimeout(() => {
        this.responseEmitter.off('record', handler);
        reject(new Error('Timeout waiting for variables'));
      }, 2000);

      const handler = (record) => {
        if (record.type === 'done' && record.payload.variables) {
          clearTimeout(timeout);
          logger.info('⬅️ Received variables');
          this.responseEmitter.off('record', handler);
          resolve(record.payload.variables);
        } else if (record.type === 'error') {
          clearTimeout(timeout);
          logger.error('⬅️ Received variables error', record.payload);
          this.responseEmitter.off('record', handler);
          reject(new Error(record.payload.msg));
        }
      };
      this.responseEmitter.on('record', handler);
      this.sendCommand(command);
    });
  }

  getStack() {
    return new Promise((resolve, reject) => {
      const command = '-stack-list-frames';
      logger.info(`➡️ Sending: ${command}`);
      const timeout = setTimeout(() => {
        this.responseEmitter.off('record', handler);
        reject(new Error('Timeout waiting for stack'));
      }, 2000);

      const handler = (record) => {
        if (record.type === 'done' && record.payload.stack) {
          clearTimeout(timeout);
          logger.info('⬅️ Received stack');
          this.responseEmitter.off('record', handler);
          resolve(record.payload.stack);
        } else if (record.type === 'error') {
          clearTimeout(timeout);
          logger.error('⬅️ Received stack error', record.payload);
          this.responseEmitter.off('record', handler);
          reject(new Error(record.payload.msg));
        }
      };
      this.responseEmitter.on('record', handler);
      this.sendCommand(command);
    });
  }

  async getMemoryDump(address, count = 100) {
    return new Promise((resolve, reject) => {
      const command = `-data-read-memory-bytes "${address}" ${count}`; // Address needs to be quoted for GDB sometimes
      logger.info(`➡️ Sending: ${command}`);
      const timeout = setTimeout(() => {
        this.responseEmitter.off('record', handler);
        reject(new Error('Timeout waiting for memory dump'));
      }, 2000);

      const handler = (record) => {
        if (record.type === 'done' && record.payload.memory) {
          clearTimeout(timeout);
          logger.info('⬅️ Received memory dump');
          this.responseEmitter.off('record', handler);
          resolve(record.payload.memory);
        } else if (record.type === 'error') {
          clearTimeout(timeout);
          logger.error('⬅️ Received memory dump error', record.payload);
          this.responseEmitter.off('record', handler);
          reject(new Error(record.payload.msg));
        }
      };
      this.responseEmitter.on('record', handler);
      this.sendCommand(command);
    });
  }
}

export default DebuggerService;
