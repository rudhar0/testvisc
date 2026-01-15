import GdbDebugger from '../services/gdb-debugger.service.js';
import DapDebugger from '../services/dap-debugger.service.js';
import compileService from '../services/compiler.service.js';
import { chunkService } from '../services/chunk.service.js';
import { SOCKET_EVENTS } from '../constants/events.js';
import inputManagerService from '../services/input-manager.service.js';

console.log('✅ GdbDebugger imported:', typeof GdbDebugger);

/**
 * Setup Socket.io event handlers with GDB Integration
 */
export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Send initial status
    const adapterAvailable = !!process.env.DAP_ADAPTER_PATH;
    const compilerName = adapterAvailable ? 'dap' : 'gdb';
    socket.emit(SOCKET_EVENTS.COMPILER_STATUS, {
      compiler: compilerName,
      available: true,
      ready: true,
      message: adapterAvailable ? 'DAP adapter ready' : 'GDB debugger ready'
    });

    /**
     * Request Compiler status
     */
    socket.on(SOCKET_EVENTS.COMPILER_STATUS_REQUEST, () => {
      socket.emit(SOCKET_EVENTS.COMPILER_STATUS, {
        compiler: compilerName,
        available: true,
        ready: true,
        message: adapterAvailable ? 'DAP adapter ready' : 'GDB debugger ready'
      });
    });

    /**
     * Generate execution trace using GDB
     */
    socket.on(SOCKET_EVENTS.CODE_TRACE_GENERATE, async (data) => {
      let debuggerInstance = null;
      
      try {
        const { code, language = 'c', inputs = [] } = data;

        if (!code || !code.trim()) {
          socket.emit(SOCKET_EVENTS.CODE_TRACE_ERROR, {
            message: 'No code provided'
          });
          return;
        }

        console.log(`📝 Generating trace for ${language.toUpperCase()} code (${code.length} bytes)`);

        // Progress: Starting
        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'initializing',
          progress: 5
        });

        // Progress: Compiling
        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'compiling',
          progress: 15
        });

        // Compile code once using shared compiler service
        const { sourceFile, executable } = await compileService.compile(code, language);

        // Prefer DAP adapter if configured, otherwise fallback to GDB service
        const dapAdapter = process.env.DAP_ADAPTER_PATH;
        let trace;
        if (dapAdapter) {
          console.log('Using DAP adapter:', dapAdapter);
          socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, { stage: 'starting_debugger', progress: 30 });
          const dap = new DapDebugger(dapAdapter);
          trace = await dap.generateTrace(executable, 500);
          // ensure adapter cleaned up
          try { await dap.disconnect(); } catch (e) {}
        } else {
          // Fallback to existing GDB debugger instance (uses socket for input)
          debuggerInstance = new GdbDebugger(socket);
          // Inject compiled artifacts so GdbDebugger doesn't recompile
          debuggerInstance.sourceFile = sourceFile;
          debuggerInstance.executable = executable;
          debuggerInstance.sourceCode = code;
          // Let input manager scan code
          try { debuggerInstance.inputManager.scanCode(code); } catch (e) {}

          socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, { stage: 'starting_debugger', progress: 30 });
          await debuggerInstance.start();
          socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, { stage: 'executing', progress: 50 });
          trace = await debuggerInstance.generateTrace(inputs);
        }

        if (!trace || trace.length === 0) {
          throw new Error('No trace generated - execution may have failed');
        }

        console.log(`✅ Generated ${trace.length} execution steps`);

        // Progress: Formatting
        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'formatting',
          progress: 80
        });

        // Format trace for frontend (match expected format)
        const formattedTrace = {
          steps: trace,
          totalSteps: trace.length,
          globals: extractGlobals(trace),
          functions: extractFunctions(trace)
        };

        // Progress: Sending
        socket.emit(SOCKET_EVENTS.CODE_TRACE_PROGRESS, {
          stage: 'sending',
          progress: 90
        });

        // Send in single chunk (no compression for now)
        socket.emit(SOCKET_EVENTS.CODE_TRACE_CHUNK, {
          chunkId: 0,
          totalChunks: 1,
          steps: formattedTrace.steps,
          totalSteps: formattedTrace.totalSteps,
          globals: formattedTrace.globals,
          functions: formattedTrace.functions,
          metadata: {
            compressed: false,
            debugger: 'gdb'
          }
        });

        // Send completion
        socket.emit(SOCKET_EVENTS.CODE_TRACE_COMPLETE, {
          totalChunks: 1,
          totalSteps: formattedTrace.totalSteps
        });

        console.log(`✅ Trace sent successfully`);

      } catch (error) {
        console.error('❌ Trace generation error:', error);
        
        socket.emit(SOCKET_EVENTS.CODE_TRACE_ERROR, {
          message: error.message || 'Failed to generate trace',
          details: error.stack
        });
      } finally {
        // Cleanup
        if (debuggerInstance) {
          try {
            await debuggerInstance.stop();
          } catch (e) {
            console.error('Cleanup error:', e);
          }
        }
      }
    });

    /**
     * Provide user input (for scanf/cin)
     */
    socket.on(SOCKET_EVENTS.EXECUTION_INPUT_PROVIDE, (data) => {
      const { values } = data;
      console.log(`📥 Received input:`, values);
      
      // Pass the received input to the manager to resolve the pending promise
      inputManagerService.provideInput(values);
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      chunkService.handleDisconnect(socket.id);
    });
  });
}

/**
 * Extract global variables from trace
 */
function extractGlobals(trace) {
  const globals = [];
  const seen = new Set();

  for (const step of trace) {
    if (step.type === 'global_declaration' && step.variable) {
      if (!seen.has(step.variable)) {
        globals.push({
          name: step.variable,
          type: step.dataType || 'int',
          value: step.value
        });
        seen.add(step.variable);
      }
    }
  }

  return globals;
}

/**
 * Extract function information from trace
 */
function extractFunctions(trace) {
  const functions = [];
  const seen = new Set();

  for (const step of trace) {
    if (step.type === 'function_call' && step.function) {
      if (!seen.has(step.function)) {
        functions.push({
          name: step.function,
          returnType: step.returnType || 'int',
          line: step.line
        });
        seen.add(step.function);
      }
    }
  }

  return functions;
}

export default setupSocketHandlers;