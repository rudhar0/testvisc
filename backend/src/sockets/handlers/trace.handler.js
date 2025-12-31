import DebuggerService from '../../services/debugger.service.js';
import { logger } from '../../utils/logger.js';
import { codePreprocessorService } from '../../services/code-preprocessor.service.js';

let debuggerInstance = null;

export const handleTrace = (socket, io) => {
  socket.on('code:trace:generate', async ({ code, language }) => {
    logger.info(`Received code trace generation request for language: ${language}`);

    if (debuggerInstance) {
      logger.info('Stopping existing debugger instance.');
      debuggerInstance.stop();
    }

    // The debugger service needs io for communication
    debuggerInstance = new DebuggerService(io); 

    try {
      const processedCode = codePreprocessorService.preprocess(code);
      await debuggerInstance.start(processedCode, language);
      socket.emit('code:trace:started', { message: 'Debugger started successfully.' });
    } catch (error) {
      logger.error('Error starting debugger:', error);
      socket.emit('code:trace:error', { message: error.message || 'Failed to start debugger.' });
    }
  });

  socket.on('debug:step', () => {
    if (debuggerInstance) {
      logger.info('Executing debug step.');
      debuggerInstance.step();
    }
  });

  socket.on('debug:continue', () => {
    if (debuggerInstance) {
      logger.info('Executing debug continue.');
      debuggerInstance.continue();
    }
  });

  socket.on('debug:stop', () => {
    if (debuggerInstance) {
      logger.info('Stopping debugger.');
      debuggerInstance.stop();
      debuggerInstance = null;
    }
  });
};