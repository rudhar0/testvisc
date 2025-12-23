import clangAnalyzerService from '../services/clang-analyzer.service.js';
import TraceService from '../services/trace-simple.service.js';
import ASTWalker from '../parsers/ast-walker.js';
import { chunkService } from '../services/chunk.service.js';
import { traceCompressor } from '../middleware/trace-compression.middleware.js';
import { SOCKET_EVENTS } from '../constants/events.js';

/**
 * Setup Socket.io event handlers with Clang + LibTooling
 * Clang is system-built and requires no download
 */
export function setupSocketHandlers(io) {
  const traceService = new TraceService();

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Send initial status - Clang is always available
    socket.emit(SOCKET_EVENTS.COMPILER_STATUS, {
      compiler: 'clang',
      available: true,
      ready: true,
      message: 'Clang + LibTooling ready'
    });

    /**
     * Request Clang status
     */
    socket.on(SOCKET_EVENTS.COMPILER_STATUS_REQUEST, () => {
      socket.emit(SOCKET_EVENTS.COMPILER_STATUS, {
        compiler: 'clang',
        available: true,
        ready: true,
        message: 'Clang + LibTooling ready'
      });
    });

    /**
     * Handle code chunks with advanced semantic analysis
     */
    socket.on(SOCKET_EVENTS.CODE_ANALYZE_CHUNK, async (data) => {
      try {
        const result = chunkService.handleChunk(socket.id, data);

        if (result.complete) {
          // All chunks received, proceed with analysis
          const { code } = result;
          const language = data.language || 'c';
          const inputs = data.inputs || [];

          // Send progress update
          socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
            stage: 'semantic_analysis',
            progress: 10
          });

          // Extract semantic visualization info
          socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
            stage: 'analyzing',
            progress: 50
          });

          // Generate execution trace (includes validation with fallback)
          const trace = await traceService.generateTrace(code, language, inputs);
          
          socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
            stage: 'compressing',
            progress: 80
          });

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
            totalSteps: trace.length || 0
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
     * Analyze code syntax with Clang semantic checking
     */
    socket.on(SOCKET_EVENTS.CODE_ANALYZE_SYNTAX, async (data) => {
      try {
        const { code, language = 'c' } = data;

        // Try Clang validation first, fallback to tree-sitter
        let valid = false;
        let errors = [];
        let analyzer = 'unknown';

        try {
          const result = await clangAnalyzerService.validateCode(code, language);
          valid = result.valid;
          errors = result.errors;
          analyzer = 'clang+libtooling';
        } catch (clangError) {
          // Clang not available, try tree-sitter
          try {
            const walker = new ASTWalker(language);
            walker.parse(code);
            valid = true;
            errors = [];
            analyzer = 'tree-sitter';
          } catch (tsError) {
            valid = false;
            errors = [{ message: tsError.message }];
            analyzer = 'tree-sitter';
          }
        }
        
        socket.emit(SOCKET_EVENTS.CODE_SYNTAX_RESULT, {
          valid,
          errors,
          language,
          analyzer
        });
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

        // Validate first
        const validationResult = await clangAnalyzerService.validateCode(code, language);
        if (!validationResult.valid) {
          socket.emit(SOCKET_EVENTS.CODE_SYNTAX_ERROR, {
            errors: validationResult.errors
          });
          return;
        }

        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'analyzing',
          progress: 50
        });

        // Generate trace
        const trace = await traceService.generateTrace(code, language, inputs);

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
          totalSteps: trace.length || 0
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

  // Clang is always available - no need for download broadcasting
}

export default setupSocketHandlers;