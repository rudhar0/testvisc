/**
 * useSocket Hook - IMMUTABLE & BACKEND-AGNOSTIC VERSION
 * 
 * CRITICAL FIXES:
 * 1. NEVER mutates backend objects (they are READ-ONLY)
 * 2. Deep clones all steps before processing
 * 3. Normalizes backend step types to semantic types
 * 4. Handles global scope, constructors, loops correctly
 * 5. Works with LLDB now, GDB later, any debugger future
 */

import { useEffect, useState, useCallback } from 'react';
import { socketService, type SocketEventCallback } from '@services/socket.service';
import { useExecutionStore } from '@store/slices/executionSlice';
import { useGCCStore } from '@store/slices/gccSlice';
import toast from 'react-hot-toast';
import { ExecutionTrace, ExecutionStep, Variable } from '@types/index';

// ============================================================================
// HELPER FUNCTIONS - IMMUTABILITY & NORMALIZATION
// ============================================================================

/**
 * Deep clone a step to ensure immutability
 * ALSO: Transform backend property names to frontend property names
 * 
 * BACKEND → FRONTEND MAPPING:
 *   eventType → type (instrumentation backend uses eventType)
 *   stdout → value (for output events)
 * 
 * WHY: Backend objects can be frozen/read-only (from Zustand, Object.freeze, etc.)
 * SOLUTION: Always work on a deep copy, never mutate originals
 */
const cloneStep = (step: ExecutionStep): ExecutionStep => {
  if (!step) return {} as ExecutionStep;
  
  try {
    // JSON stringify/parse is simple and effective for plain data objects
    const cloned = JSON.parse(JSON.stringify(step));
    
    // ===================================================================
    // BACKEND → FRONTEND PROPERTY MAPPING
    // ===================================================================
    
      // Map backend eventType → frontend type (instrumentation tracer uses eventType)
      if ((cloned as any).eventType && !cloned.type) {
        cloned.type = (cloned as any).eventType;
      }
      // Preserve original event type for downstream components (e.g., VariableLifetime) to infer primitive types
      if ((cloned as any).eventType) {
        (cloned as any).originalEventType = (cloned as any).eventType;
      }
    
    // Map backend stdout → frontend value for output events
    if ((cloned as any).stdout && cloned.type === 'output') {
      cloned.value = (cloned as any).stdout;
    }
    
    return cloned as ExecutionStep;
  } catch (error) {
    console.error('[cloneStep] Failed to clone step:', error, step);
    return {} as ExecutionStep;
  }
};

/**
 * Normalize backend step types to semantic frontend types
 * 
 * WHY: Backend debuggers (LLDB, GDB) use different keywords
 * GOAL: Frontend uses semantic types independent of debugger
 * 
 * SEMANTIC TYPE SYSTEM:
 * - program_start: execution begins
 * - program_end: execution completes
 * - func_enter: entering function (NEW: instrumentation backend)
 * - func_exit: leaving function (NEW: instrumentation backend)
 * - var: variable trace event (NEW: instrumentation backend)
 * - heap_alloc: heap memory allocated (NEW: instrumentation backend)
 * - heap_free: heap memory freed (NEW: instrumentation backend)
 * - line_execution: generic line step
 * - variable_declaration: new variable created
 * - assignment: variable value changed
 * - object_creation: C++ object constructed
 * - object_destruction: C++ object destructed
 * - function_call: entering function
 * - function_return: leaving function
 * - loop_start: entering loop
 * - loop_iteration: loop iteration
 * - loop_end: exiting loop
 * - array_access: array element accessed
 * - pointer_deref: pointer dereferenced
 */
const normalizeStepType = (type: string): string => {
  if (!type) return 'line_execution';
  
  const lowerType = type.toLowerCase().trim();
  
  // Direct mapping table
  const typeMapping: Record<string, string> = {
    // ===================================================================
    // NEW INSTRUMENTATION BACKEND TYPES (2026-01-18)
    // Map to semantic frontend StepTypes
    // ===================================================================
    'func_enter': 'func_enter',
    'func_exit': 'func_exit',
    'var': 'var',
    'heap_alloc': 'heap_allocation',
    'heap_free': 'heap_free',
    'program_end': 'program_end',
    'stdout': 'output',
    'print': 'output',
    
    // LLDB types
    'step_in': 'function_call',
    'step_out': 'function_return',
    'step_over': 'line_execution',
    
    // Semantic types (already normalized)
    'program_start': 'program_start',
    'line_execution': 'line_execution',
    'variable_declaration': 'variable_declaration',
    'pointer_declaration': 'variable_declaration',
    'array_declaration': 'variable_declaration',
    'assignment': 'assignment',
    'object_creation': 'object_creation',
    'object_destruction': 'object_destruction',
    'function_call': 'function_call',
    'function_return': 'function_return',
    'loop_start': 'loop_start',
    'loop_iteration': 'loop_iteration',
    'loop_end': 'loop_end',
    'conditional_start': 'conditional_start',
    'conditional_branch': 'conditional_branch',
    'array_access': 'array_access',
    'pointer_deref': 'pointer_deref',
    'heap_allocation': 'heap_allocation',
    'output': 'output',
    'input_request': 'input_request',
    // Backend emitted primitive/type names (map them to variable events)
    'int': 'var',
    'double': 'var',
    'float': 'var',
    'char': 'var',
    'bool': 'var',
    'long': 'var',
    'short': 'var',
    'string': 'var',
    'variable': 'var',
    'variable_assignment': 'assignment',
    'variable_change': 'assignment',
    
    // GDB types (future-proofing)
    'next': 'line_execution',
    'step': 'function_call',
    'finish': 'function_return',
  };
  
  const normalized = typeMapping[lowerType];
  if (normalized) {
    return normalized;
  }
  
  // Unknown type - log warning but don't crash
  console.warn(`[normalizeStepType] Unknown step type: "${type}". Defaulting to "line_execution".`);
  return 'line_execution';
};

/**
 * Normalize call stack - handle missing/invalid call stacks
 * 
 * WHY: Backend might not send callStack for:
 * - Global scope execution (before main)
 * - Static initializers
 * - Destructor cleanup (after main)
 * 
 * SOLUTION: Provide a valid default representing global scope
 */
const normalizeCallStack = (
  callStack: ExecutionStep['state']['callStack']
): NonNullable<ExecutionStep['state']['callStack']> => {
  // If valid call stack exists, return it (cloned via cloneStep)
  if (callStack && Array.isArray(callStack) && callStack.length > 0) {
    return callStack;
  }
  
  // Provide default global scope frame
  return [{
    function: '(global scope)',
    file: 'unknown',
    line: 0,
    locals: {},
  }];
};

/**
 * Ensure locals is an object, not an array
 * 
 * WHY: Legacy backend versions sent locals as array
 * SOLUTION: Convert array to object by variable name
 */
const normalizeLocals = (locals: any): Record<string, Variable> => {
  if (!locals) return {};
  
  // Already an object
  if (!Array.isArray(locals)) {
    return locals as Record<string, Variable>;
  }
  
  // Convert array to object
  const localsObj: Record<string, Variable> = {};
  (locals as Variable[]).forEach((v: any) => {
    if (v && v.name) {
      localsObj[v.name] = v;
    }
  });
  
  return localsObj;
};

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const { setTrace, setAnalysisProgress, setAnalyzing } = useExecutionStore();
  const { setGCCStatus } = useGCCStore();

  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;
    setIsConnecting(true);
    try {
      await socketService.connect();
      setIsConnected(true);
      toast.success('Connected to server');
      socketService.requestCompilerStatus();
    } catch (error) {
      console.error('Failed to connect:', error);
      toast.error('Failed to connect to server');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected, isConnecting]);

  const disconnect = useCallback(() => {
    socketService.disconnect();
    setIsConnected(false);
    toast.success('Disconnected from server');
  }, []);

  useEffect(() => {
    // Event handlers
    const handleConnectionState: SocketEventCallback = (data) => 
      setIsConnected(data.connected);
    
    const handleGCCStatus: SocketEventCallback = (data) => 
      setGCCStatus(data);
    
    const handleSyntaxError: SocketEventCallback = (data) => {
      const errorMessage = Array.isArray(data.errors)
        ? data.errors.map((e: any) => (typeof e === 'string' ? e : e.message)).join('; ')
        : data.message || 'Syntax error';
      toast.error(`Error: ${errorMessage}`);
      setAnalyzing(false);
    };
    
    const handleTraceProgress: SocketEventCallback = (data) => {
      console.log(`📊 Progress: ${data.stage} - ${data.progress}%`);
      setAnalysisProgress(data.progress, data.stage);
    };

    let receivedChunks: any[] = [];
    
    const handleTraceChunk: SocketEventCallback = (chunk) => {
      console.log(`📦 Chunk ${chunk.chunkId + 1}/${chunk.totalChunks}: ${chunk.steps?.length || 0} steps`);
      receivedChunks.push(chunk);
    };

    /**
     * CRITICAL HANDLER - Process trace with full immutability
     */
    const handleTraceComplete: SocketEventCallback = (data) => {
      console.log(`✅ Trace complete: ${data.totalSteps} total steps`);
      
      try {
        // ===================================================================
        // STEP 1: Collect and expand all raw steps from chunks
        // ===================================================================
        if (receivedChunks.length === 0) {
          if (data && data.steps) {
            receivedChunks.push(data);
          } else {
            throw new Error('No trace data received');
          }
        }

        const allRawSteps: any[] = receivedChunks.flatMap(chunk => chunk.steps || []);

        const expandedSteps: any[] = [];
        allRawSteps.forEach(step => {
            const { internalEvents, ...mainStep } = step;
            expandedSteps.push(mainStep);
            if (internalEvents) {
                internalEvents.forEach((internal: any) => {
                    const expandedStep = { ...mainStep, ...internal };
                    if (expandedStep.type && !expandedStep.eventType) {
                        expandedStep.eventType = expandedStep.type;
                    }
                    expandedSteps.push(expandedStep);
                });
            }
        });

        if (expandedSteps.length === 0) {
          throw new Error('No steps found in received trace data.');
        }

        console.log(`📋 Processing ${expandedSteps.length} raw steps from backend`, expandedSteps);

        // ===================================================================
        // STEP 2: Process steps and build state immutably
        // ===================================================================
        let currentMemoryState: MemoryState = {
            globals: {},
            stack: [],
            heap: {},
            callStack: [],
            stdout: ""
        };
        const variableBirthStepMap = new Map<string, number>();
        const processedSteps: ExecutionStep[] = [];

        expandedSteps.forEach((originalStep: any, index: number) => {
          const step = cloneStep(originalStep);
          const nextMemoryState: MemoryState = JSON.parse(JSON.stringify(currentMemoryState));
          
          const originalType = step.type;
          step.type = normalizeStepType(step.type);

          const functionName = (step.function || "").trim().replace(/\r/g, '');
          
          switch (step.type) {
            case 'func_enter':
              nextMemoryState.callStack.push({
                function: functionName,
                line: step.line,
                locals: {},
              });
              break;
            case 'func_exit':
              if (nextMemoryState.callStack.length > 0) {
                nextMemoryState.callStack.pop();
              }
              break;
                  case 'var': {
                    const currentFrame = nextMemoryState.callStack[nextMemoryState.callStack.length - 1];
                    // Determine the variable's declared type: backend may provide varType or we can fallback to the original event type (e.g., "int", "double")
                    const declaredType = (step as any).varType || (step as any).eventType || originalType;
                    if (currentFrame) {
                      const varName = step.name;
                      if (varName) {
                        const existingVar = currentFrame.locals[varName];
                        if (!existingVar) {
                          const newVar: Variable = {
                            name: varName,
                            value: step.value,
                            type: declaredType,
                            primitive: declaredType,
                            address: step.addr,
                            scope: 'local',
                            isInitialized: true,
                            isAlive: true,
                            birthStep: index,
                          };
                          currentFrame.locals[varName] = newVar;
                          variableBirthStepMap.set(varName, index);
                        } else {
                          existingVar.value = step.value;
                        }
                      }
                    } else {
                      // No active function call, assume global scope
                      const varName = step.name;
                      if (varName) {
                        const existingVar = nextMemoryState.globals[varName];
                        if (!existingVar) {
                          const newVar: Variable = {
                            name: varName,
                            value: step.value,
                            type: declaredType,
                            primitive: declaredType,
                            address: step.addr,
                            scope: 'global',
                            isInitialized: true,
                            isAlive: true,
                            birthStep: index,
                          };
                          nextMemoryState.globals[varName] = newVar;
                          variableBirthStepMap.set(varName, index);
                        } else {
                          existingVar.value = step.value;
                        }
                      }
                    }
                    break;
                  }
            case 'output':
              nextMemoryState.stdout = (nextMemoryState.stdout || "") + step.value;
              break;
          }
          
          step.state = nextMemoryState;
          step.id = index;
          if (!step.explanation) {
            step.explanation = `Executing ${step.type} at line ${step.line}`;
          }

          processedSteps.push(step as ExecutionStep);
          currentMemoryState = nextMemoryState;
        });

        // ===================================================================
        // STEP 3: Final processing and store update
        // ===================================================================
        const validSteps = processedSteps.filter(step => step.id !== undefined);

        if (validSteps.length === 0) {
          throw new Error('No valid steps after processing.');
        }

        console.log(`✅ Processed ${validSteps.length} valid steps`);
        
        const trace: ExecutionTrace = {
          steps: validSteps,
          totalSteps: validSteps.length,
          globals: receivedChunks[0]?.globals || [],
          functions: receivedChunks[0]?.functions || [],
          metadata: receivedChunks[0]?.metadata || { debugger: 'unknown', hasSemanticInfo: true },
        };

        setTrace(trace);
        setAnalyzing(false);
        toast.success(`✅ Generated ${validSteps.length} execution steps`);
        
        receivedChunks = [];

      } catch (error: any) {
        console.error('❌ Failed to process trace:', error);
        toast.error(`Failed to process trace: ${error.message}`);
        setAnalyzing(false);
        receivedChunks = [];
      }
    };

    const handleTraceError: SocketEventCallback = (data) => {
      console.error('❌ Trace error:', data);
      toast.error(`Execution failed: ${data.message || 'Unknown error'}`);
      setAnalyzing(false);
    };

    const handleInputRequired: SocketEventCallback = (data) => {
      console.log('📥 Input required:', data);
      // Input handling is done in VisualizationCanvas
    };

    // Subscribe to events
    socketService.on('connection:state', handleConnectionState);
    socketService.on('compiler:status', handleGCCStatus);
    socketService.on('code:syntax:error', handleSyntaxError);
    socketService.on('code:trace:progress', handleTraceProgress);
    socketService.on('code:trace:chunk', handleTraceChunk);
    socketService.on('code:trace:complete', handleTraceComplete);
    socketService.on('code:trace:error', handleTraceError);
    socketService.on('execution:input_required', handleInputRequired);

    return () => {
      socketService.off('connection:state', handleConnectionState);
      socketService.off('compiler:status', handleGCCStatus);
      socketService.off('code:syntax:error', handleSyntaxError);
      socketService.off('code:trace:progress', handleTraceProgress);
      socketService.off('code:trace:chunk', handleTraceChunk);
      socketService.off('code:trace:complete', handleTraceComplete);
      socketService.off('code:trace:error', handleTraceError);
      socketService.off('execution:input_required', handleInputRequired);
    };
  }, [setTrace, setAnalyzing, setAnalysisProgress, setGCCStatus]);

  const generateTrace = useCallback((code: string, language: string) => {
    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }
    console.log('🚀 Requesting trace generation...');
    setAnalyzing(true);
    socketService.generateTrace(code, language);
  }, [isConnected, setAnalyzing]);

  const requestGCCStatus = useCallback(() => {
    if (!isConnected) return;
    socketService.requestCompilerStatus();
  }, [isConnected]);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    generateTrace,
    requestGCCStatus,
  };
}

export default useSocket;