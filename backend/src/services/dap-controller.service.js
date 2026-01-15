import { spawn } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import dapConfig from '../config/dap.config.js';

class DAPController extends EventEmitter {
  constructor() {
    super();
    this.adapterProcess = null;
    this.buffer = '';
    this.nextSeq = 1;
    this.pendingRequests = new Map();
  }

  async start() {
    return new Promise((resolve, reject) => {
        if (!existsSync(dapConfig.dapAdapterPath)) {
            const err = new Error(`Debug adapter not found at: ${dapConfig.dapAdapterPath}`);
            logger.error(err.message);
            return reject(err);
        }

        this.adapterProcess = spawn(dapConfig.dapAdapterPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

        this.adapterProcess.stdout.on('data', (data) => this.handleAdapterOutput(data));
        this.adapterProcess.stderr.on('data', (data) => logger.error({ data: data.toString() }, 'DAP Adapter Stderr'));
        this.adapterProcess.on('exit', (code) => {
            logger.warn(`DAP Adapter exited with code ${code}`);
            this.emit('terminated');
        });
        this.adapterProcess.on('error', (err) => {
            logger.error({ err }, 'Failed to start DAP Adapter process.');
            reject(err);
        });

        this.sendRequest('initialize', {
            adapterID: 'cppdbg',
            linesStartAt1: true,
            columnsStartAt1: true,
            pathFormat: 'path',
        }).then(response => {
            logger.info('DAP adapter initialized.');
            this.emit('initialized');
            resolve(response);
        }).catch(reject);
    });
  }

  async launch(code, language = 'cpp', launchArgs = {}) {
    const { executable, sourceFile } = await this.compile(code, language);

    const response = await this.sendRequest('launch', {
      program: executable,
      MIMode: 'gdb',
      miDebuggerPath: dapConfig.gdbPath,
      setupCommands: [{ text: '-enable-pretty-printing', ignoreFailures: true }],
      externalConsole: false,
      stopAtEntry: true,
      ...launchArgs,
    });
    
    // After launch, the adapter sends an 'initialized' event.
    // We must send a 'configurationDone' request to tell it to continue.
    await this.sendRequest('configurationDone', {});

    return { response, executable, sourceFile };
  }
    // ... (rest of the file is unchanged)

  // --- Core Communication ---

  sendRequest(command, args = {}) {
    return new Promise((resolve, reject) => {
      const seq = this.nextSeq++;
      const request = { seq, type: 'request', command, arguments: args };
      this.pendingRequests.set(seq, { resolve, reject, request });

      const json = JSON.stringify(request);
      const message = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
      
      logger.info({ request: json }, 'DAP -> Adapter');
      this.adapterProcess.stdin.write(message);
    });
  }

  handleAdapterOutput(data) {
    this.buffer += data.toString();
    while (true) {
      const match = this.buffer.match(/Content-Length: (\d+)\r\n\r\n/);
      if (!match) break;

      const contentLength = parseInt(match[1], 10);
      const messageStartIndex = match.index + match[0].length;
      
      if (this.buffer.length < messageStartIndex + contentLength) break;

      const messageJson = this.buffer.substring(messageStartIndex, messageStartIndex + contentLength);
      this.buffer = this.buffer.substring(messageStartIndex + contentLength);

      try {
        const message = JSON.parse(messageJson);
        this.handleMessage(message);
      } catch (e) {
        logger.error({ error: e, json: messageJson }, 'Error parsing DAP message');
      }
    }
  }

  handleMessage(message) {
      logger.info({ response: JSON.stringify(message) }, 'Adapter -> DAP');
      if (message.type === 'response') {
          const promise = this.pendingRequests.get(message.request_seq);
          if (promise) {
              if (message.success) {
                  promise.resolve(message);
              } else {
                  promise.reject(new Error(message.message || 'DAP Request Failed'));
              }
              this.pendingRequests.delete(message.request_seq);
          }
      } else if (message.type === 'event') {
          this.emit(message.event, message.body);
          this.emit('event', message);
      } else {
          logger.warn({ message }, 'Unhandled DAP message type');
      }
  }
  
  // --- Debug Actions ---
  
  async setBreakpoints(sourceFile, breakpoints) {
      return this.sendRequest('setBreakpoints', { source: { path: sourceFile }, breakpoints });
  }

  async continue(threadId) {
      return this.sendRequest('continue', { threadId });
  }
  
  async next(threadId) {
    return this.sendRequest('next', { threadId });
  }

  async stepIn(threadId) {
    return this.sendRequest('stepIn', { threadId });
  }

  async stepOut(threadId) {
    return this.sendRequest('stepOut', { threadId });
  }
  
  async getStackTrace(threadId) {
    const response = await this.sendRequest('stackTrace', { threadId, startFrame: 0, levels: 20 });
    return response.body.stackFrames;
  }
  
  async getScopes(frameId) {
    const response = await this.sendRequest('scopes', { frameId });
    return response.body.scopes;
  }
  
  async getVariables(variablesReference) {
    const response = await this.sendRequest('variables', { variablesReference });
    return response.body.variables;
  }

  async getVariableDetails(variablesReference) {
    const variables = await this.getVariables(variablesReference);
    for (const variable of variables) {
      if (variable.variablesReference > 0) {
        variable.children = await this.getVariableDetails(variable.variablesReference);
      }
    }
    return variables;
  }

  async evaluate(expression, frameId) {
    const response = await this.sendRequest('evaluate', { expression, frameId });
    return response.body;
  }

  async disconnect() {
    await this.sendRequest('disconnect', {});
    if (this.adapterProcess) {
      this.adapterProcess.kill();
    }
  }

  // --- Utility ---

  async compile(code, language) {
    // This is the same compile function from before
    const tempDir = path.join(process.cwd(), 'temp');
    logger.info('🔨 Compiling code for DAP session...');
    const sessionId = uuidv4();
    const ext = language === 'cpp' ? 'cpp' : 'c';
    const compiler = language === 'cpp' ? 'g++' : 'gcc';

    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    const sourceFile = path.join(tempDir, `${sessionId}.${ext}`);
    const executable = path.join(tempDir, `${sessionId}.out`);

    await writeFile(sourceFile, code, 'utf-8');
    logger.info('📝 Source file written:', sourceFile);

    return new Promise((resolve, reject) => {
      const args = ['-g', '-O0', '-std=c++17', sourceFile, '-o', executable];
      const compilation = spawn(compiler, args);
      let stderr = '';

      compilation.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      compilation.on('close', (code) => {
        if (code !== 0) {
          logger.error('❌ Compilation failed:', stderr);
          reject(new Error(`Compilation failed: ${stderr}`));
        } else {
          logger.info('✅ Compilation successful');
          resolve({ executable, sourceFile });
        }
      });

      compilation.on('error', (err) => {
        logger.error('❌ Compilation process error:', err);
        reject(err);
      });
    });
  }
}

export default DAPController;
