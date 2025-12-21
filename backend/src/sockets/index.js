import { gccService } from '../services/gcc.service.js';
import { analyzeService } from '../services/analyze.service.js';
import { chunkService } from '../services/chunk.service.js';
import { traceCompressor } from '../middleware/trace-compression.middleware.js';
import { SOCKET_EVENTS } from '../constants/events.js';

/**
 * Setup Socket.io event handlers with compression
 */
export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Send initial status
    socket.emit(SOCKET_EVENTS.GCC_STATUS, gccService.getStatus());

    /**
     * Request GCC status
     */
    socket.on(SOCKET_EVENTS.GCC_STATUS_REQUEST, () => {
      socket.emit(SOCKET_EVENTS.GCC_STATUS, gccService.getStatus());
    });

    /**
     * Start GCC download
     */
    socket.on(SOCKET_EVENTS.GCC_DOWNLOAD_START, async () => {
      try {
        if (gccService.isAvailable()) {
          socket.emit(SOCKET_EVENTS.GCC_DOWNLOAD_COMPLETE, {
            message: 'GCC already available'
          });
          return;
        }

        if (gccService.downloading) {
          socket.emit(SOCKET_EVENTS.GCC_DOWNLOAD_ERROR, {
            message: 'Download already in progress'
          });
          return;
        }

        await gccService.downloadGCC((progress, stage) => {
          socket.emit(SOCKET_EVENTS.GCC_DOWNLOAD_PROGRESS, { progress, stage });
        });

        socket.emit(SOCKET_EVENTS.GCC_DOWNLOAD_COMPLETE, {
          message: 'GCC installed successfully'
        });

      } catch (error) {
        socket.emit(SOCKET_EVENTS.GCC_DOWNLOAD_ERROR, {
          message: error.message
        });
      }
    });

    /**
     * Handle code chunks (for large files)
     */
    socket.on(SOCKET_EVENTS.CODE_ANALYZE_CHUNK, async (data) => {
      try {
        const result = chunkService.handleChunk(socket.id, data);

        if (result.complete) {
          // All chunks received, proceed with analysis
          const { code } = result;
          const language = data.language || 'c';

          // Send progress update
          socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
            stage: 'parsing',
            progress: 10
          });

          // Validate syntax first
          let syntaxValid = true;
          let syntaxErrors = [];
          
          if (gccService.isAvailable()) {
            const gccResult = await gccService.compileCode(code, language);
            syntaxValid = gccResult.success;
            if (!syntaxValid) {
              syntaxErrors = [gccResult.errors || 'Syntax error'];
            }
          } else {
            const parseResult = await analyzeService.validateSyntax({ code, language });
            syntaxValid = parseResult.valid;
            syntaxErrors = parseResult.errors || [];
          }

          if (!syntaxValid) {
            socket.emit(SOCKET_EVENTS.CODE_SYNTAX_ERROR, {
              errors: syntaxErrors
            });
            return;
          }

          // Generate trace
          socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
            stage: 'analyzing',
            progress: 50
          });

          const analyzeResult = await analyzeService.analyze({ code, language, inputs: data.inputs || [] });
          if (!analyzeResult.success) {
            socket.emit(SOCKET_EVENTS.CODE_TRACE_ERROR, {
              message: analyzeResult.error
            });
            return;
          }
          const trace = analyzeResult.trace;

          // Compress and chunk the trace
          console.log(`📊 Original trace size: ${traceCompressor.estimateSize(trace)} bytes`);
          const chunks = traceCompressor.chunkTrace(trace);
          console.log(`📦 Compressed into ${chunks.length} chunks`);

          // Send chunks one by one
          for (const chunk of chunks) {
            socket.emit(SOCKET_EVENTS.CODE_TRACE_CHUNK, chunk);
            
            // Small delay between chunks to avoid overwhelming
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          // Send completion signal
          socket.emit(SOCKET_EVENTS.CODE_TRACE_COMPLETE, {
            totalChunks: chunks.length,
            totalSteps: trace.totalSteps || trace.steps.length
          });

        } else {
          // Still waiting for more chunks
          console.log(`⏳ Chunk progress: ${result.progress.toFixed(2)}%`);
        }

      } catch (error) {
        console.error('Chunk processing error:', error);
        socket.emit(SOCKET_EVENTS.CODE_TRACE_ERROR, {
          message: error.message
        });
      }
    });

    /**
     * Analyze code syntax
     */
    socket.on(SOCKET_EVENTS.CODE_ANALYZE_SYNTAX, async (data) => {
      try {
        const { code, language = 'c' } = data;

        let result;
        if (gccService.isAvailable()) {
          result = await gccService.compileCode(code, language);
          socket.emit(SOCKET_EVENTS.CODE_SYNTAX_RESULT, {
            valid: result.success,
            errors: result.errors,
            warnings: result.warnings,
            language: language,
            method: 'gcc'
          });
        } else {
          result = await analyzeService.validateSyntax({ code, language });
          socket.emit(SOCKET_EVENTS.CODE_SYNTAX_RESULT, {
            valid: result.valid,
            errors: result.errors,
            language: language,
            method: 'parser'
          });
        }
      } catch (error) {
        socket.emit(SOCKET_EVENTS.CODE_SYNTAX_ERROR, {
          message: error.message
        });
      }
    });

    /**
     * Generate execution trace (with compression)
     */
    socket.on(SOCKET_EVENTS.CODE_TRACE_GENERATE, async (data) => {
      try {
        const { code, language = 'c', inputs = [] } = data;

        console.log(`📝 Generating trace for ${language.toUpperCase()} code (${code.length} bytes)`);

        // Emit progress updates
        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'parsing',
          progress: 25
        });

        const result = await analyzeService.analyze({ code, language, inputs });
        if (!result.success) {
          console.error(`❌ Analysis failed: ${result.error}`);
          socket.emit(SOCKET_EVENTS.CODE_TRACE_ERROR, {
            message: result.error
          });
          return;
        }
        const trace = result.trace;

        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'compressing',
          progress: 80
        });

        // Compress and chunk the trace
        console.log(`📊 Original trace size: ${traceCompressor.estimateSize(trace)} bytes`);
        const chunks = traceCompressor.chunkTrace(trace);
        console.log(`📦 Compressed into ${chunks.length} chunks`);

        // Send chunks
        for (const chunk of chunks) {
          socket.emit(SOCKET_EVENTS.CODE_TRACE_CHUNK, chunk);
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        socket.emit(SOCKET_EVENTS.CODE_TRACE_COMPLETE, {
          totalChunks: chunks.length,
          totalSteps: trace.totalSteps || trace.steps.length
        });

      } catch (error) {
        socket.emit(SOCKET_EVENTS.CODE_TRACE_ERROR, {
          message: error.message
        });
      }
    });

    /**
     * Request user input (for scanf/cin)
     */
    socket.on(SOCKET_EVENTS.EXECUTION_INPUT_PROVIDE, (data) => {
      const { stepId, values } = data;
      socket.emit(SOCKET_EVENTS.EXECUTION_INPUT_RECEIVED, {
        stepId,
        values
      });
    });

    /**
     * Pause execution
     */
    socket.on(SOCKET_EVENTS.EXECUTION_PAUSE, () => {
      socket.emit(SOCKET_EVENTS.EXECUTION_PAUSED);
    });

    /**
     * Resume execution
     */
    socket.on(SOCKET_EVENTS.EXECUTION_RESUME, () => {
      socket.emit(SOCKET_EVENTS.EXECUTION_RESUMED);
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      chunkService.handleDisconnect(socket.id);
    });
  });

  // Broadcast GCC download progress to all clients
  setInterval(() => {
    if (gccService.downloading) {
      io.emit(SOCKET_EVENTS.GCC_DOWNLOAD_PROGRESS, {
        progress: gccService.downloadProgress,
        stage: gccService.downloadStage
      });
    }
  }, 1000);
}

export default setupSocketHandlers;