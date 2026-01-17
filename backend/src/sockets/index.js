import hybridDebugger from '../services/hybrid-debugger.service.js';
import { SOCKET_EVENTS } from '../constants/events.js';
import inputManagerService from '../services/input-manager.service.js';

/**
 * Setup Socket.io event handlers with Hybrid Clang+LLDB Debugger
 */
export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Send initial status
    socket.emit(SOCKET_EVENTS.COMPILER_STATUS, {
      compiler: 'hybrid-clang-lldb',
      available: true,
      ready: true,
      message: 'Hybrid Clang+LLDB debugger ready'
    });

    /**
     * Request Compiler status
     */
    socket.on(SOCKET_EVENTS.COMPILER_STATUS_REQUEST, () => {
      socket.emit(SOCKET_EVENTS.COMPILER_STATUS, {
        compiler: 'hybrid-clang-lldb',
        available: true,
        ready: true,
        message: 'Hybrid Clang+LLDB debugger ready'
      });
    });

    /**
     * Generate execution trace using Hybrid Debugger
     */
    socket.on(SOCKET_EVENTS.CODE_TRACE_GENERATE, async (data) => {
      try {
        const { code, language = 'cpp', inputs = [] } = data;

        if (!code || !code.trim()) {
          socket.emit(SOCKET_EVENTS.CODE_TRACE_ERROR, {
            message: 'No code provided'
          });
          return;
        }

        console.log(`📝 Generating trace for ${language.toUpperCase()} code (${code.length} bytes)`);

        // Progress: Analyzing
        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'analyzing',
          progress: 10,
          message: 'Analyzing code structure with Clang...'
        });

        // Progress: Compiling
        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'compiling',
          progress: 30,
          message: 'Compiling code...'
        });

        // Progress: Debugging
        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'debugging',
          progress: 50,
          message: 'Generating execution trace with LLDB...'
        });

        // Generate trace
        const traceResult = await hybridDebugger.generateTrace(code, language);

        if (!traceResult || !traceResult.steps || traceResult.steps.length === 0) {
          throw new Error('No trace generated - execution may have failed');
        }

        console.log(`✅ Generated ${traceResult.totalSteps} execution steps`);

        // Progress: Formatting
        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'formatting',
          progress: 90,
          message: 'Formatting trace data...'
        });

        // Send in single chunk
        socket.emit(SOCKET_EVENTS.CODE_TRACE_CHUNK, {
          chunkId: 0,
          totalChunks: 1,
          steps: traceResult.steps,
          totalSteps: traceResult.totalSteps,
          globals: traceResult.globals,
          functions: traceResult.functions,
          metadata: traceResult.metadata
        });

        // Send completion
        socket.emit(SOCKET_EVENTS.CODE_TRACE_COMPLETE, {
          totalChunks: 1,
          totalSteps: traceResult.totalSteps
        });

        console.log(`✅ Trace sent successfully`);

      } catch (error) {
        console.error('❌ Trace generation error:', error);
        
        socket.emit(SOCKET_EVENTS.CODE_TRACE_ERROR, {
          message: error.message || 'Failed to generate trace',
          details: error.stack
        });
      }
    });

    /**
     * Provide user input (for scanf/cin)
     */
    socket.on(SOCKET_EVENTS.EXECUTION_INPUT_PROVIDE, (data) => {
      const { values } = data;
      console.log(`📥 Received input:`, values);
      inputManagerService.provideInput(values);
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}

export default setupSocketHandlers;