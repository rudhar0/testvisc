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
    // Direct pass-through (already semantic)
    // ===================================================================
    'func_enter': 'func_enter',
    'func_exit': 'func_exit',
    'var': 'var',
    'heap_alloc': 'heap_alloc',
    'heap_free': 'heap_free',
    'program_end': 'program_end',
    'stdout': 'output',           // Alternative name for output (printf, cout, puts, etc.)
    'print': 'output',            // Direct print calls
    
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
        // STEP 1: Collect all raw steps from chunks
        // ===================================================================
        if (receivedChunks.length === 0) {
          if (data && data.steps) {
            receivedChunks.push(data);
          } else {
            throw new Error('No trace data received');
          }
        }

        const allSteps: ExecutionStep[] = receivedChunks.flatMap(chunk => chunk.steps || []);
        
        if (allSteps.length === 0) {
          throw new Error('No steps found in received trace data.');
        }

        console.log(`📋 Processing ${allSteps.length} raw steps from backend`);

        // ===================================================================
        // STEP 2: Build birthStep map (FIRST PASS - read-only)
        // ===================================================================
        const variableBirthStepMap = new Map<string, number>();
        
        allSteps.forEach((step, index) => {
          const findBirths = (variables: Record<string, Variable> | Variable[] | undefined) => {
            if (!variables) return;
            
            const varList = Array.isArray(variables) 
              ? variables 
              : Object.values(variables);
            
            for (const variable of varList) {
              if (variable && variable.name && !variableBirthStepMap.has(variable.name)) {
                // Mark this step as birth step for this variable
                variableBirthStepMap.set(variable.name, index);
              }
            }
          };

          // Scan all scopes for variables
          step.state?.callStack?.forEach(frame => findBirths(frame.locals));
          findBirths(step.state?.globals);
        });

        console.log(`📊 Found ${variableBirthStepMap.size} unique variables with birth steps`);

        // ===================================================================
        // STEP 3: Process steps IMMUTABLY (SECOND PASS - clone & normalize)
        // ===================================================================
        const processedSteps = allSteps.map((originalStep: ExecutionStep, index: number) => {
          // 🔒 CRITICAL: Deep clone FIRST - originalStep is READ-ONLY
          const step = cloneStep(originalStep);
          
          // Ensure step has basic structure
          if (!step.state) {
            step.state = {
              callStack: [],
              globals: {},
              heap: {},
              stack: [],
            };
          }

          // Normalize step type (backend-agnostic)
          step.type = normalizeStepType(step.type);

          // Normalize call stack (handle global scope)
          step.state.callStack = normalizeCallStack(step.state.callStack);

          // Normalize locals in each frame
          step.state.callStack = step.state.callStack.map(frame => ({
            ...frame,
            locals: normalizeLocals(frame.locals),
          }));

          // ===============================================================
          // STEP 4: Assign birth steps to variables
          // ===============================================================
          const assignBirthSteps = (variables: Record<string, Variable> | undefined) => {
            if (!variables) return;
            
            Object.values(variables).forEach((variable: Variable) => {
              if (variable && variable.name && variableBirthStepMap.has(variable.name)) {
                // Safe mutation - we're working on a clone
                variable.birthStep = variableBirthStepMap.get(variable.name);
              }
            });
          };

          // Assign birth steps to locals
          step.state.callStack.forEach(frame => {
            assignBirthSteps(frame.locals);
          });

          // Assign birth steps to globals
          assignBirthSteps(step.state.globals);

          // ===============================================================
          // STEP 5: Add semantic metadata
          // ===============================================================
          
          // Ensure step has required fields
          if (step.id === undefined) {
            step.id = index;
          }
          
          if (!step.explanation) {
            step.explanation = `Executing ${step.type} at line ${step.line}`;
          }

          return step;
        });

        // ===================================================================
        // STEP 6: Filter and validate processed steps
        // ===================================================================
        const validSteps = processedSteps.filter(step => {
          // Must have numeric ID
          if (typeof step.id !== 'number') return false;
          
          // Must have valid type
          if (!step.type) return false;
          
          // Must have state
          if (!step.state) return false;
          
          return true;
        });

        if (validSteps.length === 0) {
          throw new Error('No valid steps after processing - execution may have failed.');
        }

        // ===================================================================
        // STEP 7: Log processing results
        // ===================================================================
        console.log(`✅ Processed ${validSteps.length} valid steps`);
        console.log('📋 First step:', validSteps[0]);
        console.log('📋 Last step:', validSteps[validSteps.length - 1]);
        
        // Log step type distribution
        const stepTypes = validSteps.reduce((acc: Record<string, number>, step: ExecutionStep) => {
          acc[step.type] = (acc[step.type] || 0) + 1;
          return acc;
        }, {});
        console.log('📊 Step type distribution:', stepTypes);

        // ===================================================================
        // STEP 8: Create trace object and update store
        // ===================================================================
        const trace: ExecutionTrace = {
          steps: validSteps,
          totalSteps: validSteps.length,
          globals: receivedChunks[0]?.globals || [],
          functions: receivedChunks[0]?.functions || [],
          metadata: receivedChunks[0]?.metadata || {
            debugger: 'unknown',
            timestamp: Date.now(),
          },
        };

        setTrace(trace);
        setAnalyzing(false);
        toast.success(`✅ Generated ${validSteps.length} execution steps`);
        
        // Clear chunks for next run
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