import { EventEmitter } from 'events';
import DAPController from './dap-controller.service.js';
import logger from '../utils/logger.js';
import memoryMapperService from './memory-mapper.service.js';
import ChunkStreamerService from './chunk-streamer.service.js';

class DebuggerService extends EventEmitter {
  constructor(sessionId) {
    super();
    this.sessionId = sessionId;
    this.dapController = new DAPController();
    this.chunkStreamer = new ChunkStreamerService(sessionId);
    this.stepId = 0;
    this.previousState = null;
    this.threads = new Set();
    this.currentThreadId = null;

    // Bubble up events from the underlying services
    this.dapController.on('stopped', (body) => this.handleStop(body));
    this.dapController.on('thread', (body) => this.handleThreadEvent(body));
    this.dapController.on('terminated', () => {
        logger.info({ sessionId: this.sessionId }, 'Debug session terminated.');
        this.stop(); // Ensure cleanup and flushing
        this.emit('terminated');
    });
    this.dapController.on('output', (body) => this.emit('output', body));
    
    this.chunkStreamer.on('chunk:ready', (payload) => this.emit('chunk:ready', payload));
    this.chunkStreamer.on('chunk:progress', (progress) => this.emit('chunk:progress', progress));
    this.chunkStreamer.on('chunk:complete', (summary) => this.emit('chunk:complete', summary));
    this.chunkStreamer.on('error', (error) => this.emit('error', error));
  }

  async start(code, language) {
    try {
      logger.info({ sessionId: this.sessionId }, 'Starting DAP debug session...');
      await this.dapController.start();
      
      const { executable, sourceFile } = await this.dapController.launch(code, language);
      logger.info({ sessionId: this.sessionId, executable }, 'Launch request successful.');
      
      // Setting breakpoints and configurationDone is handled in the DAPController now.
      
    } catch (error) {
      logger.error({ sessionId: this.sessionId, err: error }, 'Failed to start debugger service.');
      this.emit('error', error);
      throw error;
    }
  }

  async handleStop(body) {
    try {
      const { threadId, reason, description } = body;
      this.currentThreadId = threadId;
      logger.info({ sessionId: this.sessionId, reason, threadId }, 'Debugger stopped.');

      if (reason === 'exception') {
          logger.error({ sessionId: this.sessionId, description }, 'Execution hit an exception.');
          this.emit('error', new Error(`Execution failed: ${description}`));
          await this.stop();
          return;
      }
      
      const stackFrames = await this.dapController.getStackTrace(threadId);
      if (!stackFrames || stackFrames.length === 0) {
        logger.warn({ sessionId: this.sessionId }, 'No stack frames found, continuing execution.');
        this.continue();
        return;
      }
      
      const variablesByFrame = {};
      for (const frame of stackFrames) {
        const scopes = await this.dapController.getScopes(frame.id);
        const variablesByScope = await Promise.all(
            scopes.map(scope => this.dapController.getVariableDetails(scope.variablesReference))
        );
        variablesByFrame[frame.id] = variablesByScope.flat();
      }
      
      const currentState = await memoryMapperService.createStateFromDAP(stackFrames, variablesByFrame, this.dapController);
      
      const step = {
        id: this.stepId++,
        line: stackFrames[0].line,
        explanation: `Stopped at line ${stackFrames[0].line} (reason: ${reason})`,
        state: currentState,
        changes: this.compareStates(this.previousState, currentState)
      };

      this.previousState = currentState;
      await this.chunkStreamer.addStep(step);

    } catch (error) {
      logger.error({ sessionId: this.sessionId, err: error }, 'Error handling stop event.');
      this.emit('error', error);
    }
  }

  handleThreadEvent(body) {
    logger.info({ threadEvent: body }, 'Thread event received.');
    if (body.reason === 'started') {
      this.threads.add(body.threadId);
    } else if (body.reason === 'exited') {
      this.threads.delete(body.threadId);
    }
  }
  
  flattenVariables(callStack) {
    const allVars = [];
    const seen = new Set();

    function recurse(variables) {
      if (!variables) return;
      for (const v of Object.values(variables)) {
        if (!seen.has(v.uniqueId)) {
          seen.add(v.uniqueId);
          allVars.push(v);
          if (v.children) {
            recurse(v.children);
          }
        }
      }
    }

    if (callStack) {
        callStack.forEach(frame => recurse(frame.locals));
    }
    
    return allVars;
  }
  
  compareStates(oldState, newState) {
    if (!oldState) {
        return { added: this.flattenVariables(newState.callStack), modified: [], removed: [] };
    }
    
    const changes = { added: [], modified: [], removed: [] };
    const oldVars = new Map(this.flattenVariables(oldState.callStack).map(v => [v.uniqueId, v]));
    const newVars = new Map(this.flattenVariables(newState.callStack).map(v => [v.uniqueId, v]));
    
    for (const [id, newVar] of newVars.entries()) {
        if (!oldVars.has(id)) {
            changes.added.push(newVar);
        } else {
            const oldVar = oldVars.get(id);
            if (oldVar.value !== newVar.value || oldVar.type !== newVar.type) {
                changes.modified.push({ ...newVar, oldValue: oldVar.value, oldType: oldVar.type });
            }
        }
    }

    for (const [id, oldVar] of oldVars.entries()) {
        if (!newVars.has(id)) {
            changes.removed.push(oldVar);
        }
    }
    
    return changes;
  }
  
  async next() {
    await this.dapController.next(this.currentThreadId);
  }

  async stepIn() {
    await this.dapController.stepIn(this.currentThreadId);
  }

  async stepOut() {
    await this.dapController.stepOut(this.currentThreadId);
  }
  
  async continue() {
    await this.dapController.continue({ threadId: this.currentThreadId });
  }

  async stop() {
    logger.info({ sessionId: this.sessionId }, 'Stopping debugger service...');
    await this.chunkStreamer.flush();
    await this.dapController.disconnect();
  }
}



// I am renaming dap-debugger.service.js to dap-controller.service.js
// And this new file will be the new dap-debugger.service.js
// This seems to be causing confusion.
// Let's stick to the user's file structure.
// The file I'm writing is backend/src/services/debugger.service.js
// The DAPController should be in a separate file, e.g. dap-controller.js
// I will rename the dap-debugger.service.js to dap-controller.service.js
// And create a new debugger.service.js that uses it.
// I have already written the content of dap-controller.service.js
// I will now rename the file.

export default DebuggerService;