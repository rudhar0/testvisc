/**
 * useSocket Hook - Refactored for Immutability and Backend Agnosticism
 * This version ensures safe handling of potentially read-only trace objects from the backend,
 * normalizes step types and call stacks, and correctly processes variables' birth steps.
 */

import { useEffect, useState, useCallback } from 'react';
import { socketService, type SocketEventCallback } from '@services/socket.service';
import { useExecutionStore } from '@store/slices/executionSlice';
import { useGCCStore } from '@store/slices/gccSlice';
import toast from 'react-hot-toast';
import { ExecutionTrace, ExecutionStep, Variable } from '@types/index';

// --- HELPER FUNCTIONS ---

/**
 * Performs a deep clone of a step object to ensure immutability.
 * WHY: Objects from the backend or state manager (like Zustand) can be frozen (read-only).
 * Attempting to modify them directly causes runtime errors. Cloning creates a safe, mutable copy.
 * JSON stringify/parse is a simple and effective method for deep-cloning plain data objects.
 */
const cloneStep = (step: ExecutionStep): ExecutionStep => {
  if (!step) return {} as ExecutionStep;
  try {
    return JSON.parse(JSON.stringify(step));
  } catch (error) {
    console.error('Failed to clone step:', error, step);
    return {} as ExecutionStep;
  }
};

/**
 * Normalizes backend step types to a consistent set of semantic types for the frontend.
 * WHY: This decouples the frontend from specific backend/debugger implementations (LLDB, GDB, etc.),
 * making the visualizer more robust and adaptable to future backend changes without requiring frontend code modifications.
 */
const normalizeStepType = (type: string): string => {
  if (!type) return 'line_execution';
  const lowerType = type.toLowerCase();

  const typeMapping: Record<string, string> = {
    'step_in': 'function_call',
    'step_out': 'function_return',
    'variable_declaration': 'variable_declaration',
    'pointer_declaration': 'variable_declaration',
    'array_declaration': 'variable_declaration',
    'assignment': 'assignment',
    'object_creation': 'object_creation',
    'object_destruction': 'object_destruction',
    'line_execution': 'line_execution',
    'program_start': 'program_start',
    'program_end': 'program_end',
  };
  
  const normalized = typeMapping[lowerType];
  if (normalized) {
    return normalized;
  }

  console.warn(`Unknown step type: "${type}". Defaulting to "line_execution".`);
  return 'line_execution';
};

/**
 * Ensures a valid call stack exists, providing a default for global scope execution.
 * WHY: The backend might not send a `callStack` for steps in the global scope (before main).
 * This function prevents crashes and provides a clear representation for such cases.
 */
const normalizeCallStack = (callStack: ExecutionStep['state']['callStack']): NonNullable<ExecutionStep['state']['callStack']> => {
  if (callStack && callStack.length > 0) {
    return callStack;
  }
  // Provide a default frame to represent the global execution scope.
  return [{ function: '(global scope)', file: 'unknown', line: 0, locals: {} }];
};


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
    const handleConnectionState: SocketEventCallback = (data) => setIsConnected(data.connected);
    const handleGCCStatus: SocketEventCallback = (data) => setGCCStatus(data);
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

    const handleTraceComplete: SocketEventCallback = (data) => {
      console.log(`✅ Trace complete: ${data.totalSteps} total steps`);
      
      try {
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

        // --- IMMUTABLE TRACE PROCESSING ---

        // Pass 1: Find the birth step for every unique variable name.
        // This is done first to avoid stateful checks inside the main mapping function.
        const variableBirthStepMap = new Map<string, number>();
        allSteps.forEach((step, index) => {
          const findBirths = (variables: Record<string, Variable> | Variable[] | undefined) => {
            if (!variables) return;
            const varList = Array.isArray(variables) ? variables : Object.values(variables);
            for (const variable of varList) {
              if (variable && variable.name && !variableBirthStepMap.has(variable.name)) {
                variableBirthStepMap.set(variable.name, index);
              }
            }
          };
          step.state?.callStack?.forEach(frame => findBirths(frame.locals));
          findBirths(step.state?.globals);
        });

        // Pass 2: Create the new, processed steps immutably.
        const processedSteps = allSteps.map((originalStep: ExecutionStep) => {
          // WHY: DEEP CLONE FIRST. The originalStep is potentially read-only.
          // All modifications MUST be on a deep copy to prevent runtime errors.
          const step = cloneStep(originalStep);

          // Normalize the step type and call stack for frontend consistency.
          step.type = normalizeStepType(step.type);
          if (!step.state) step.state = { callStack: [], globals: {}, heap: {}, stack: [] };
          step.state.callStack = normalizeCallStack(step.state.callStack);

          // Safely assign birth steps using the pre-computed map.
          const assignBirths = (variables: Record<string, Variable> | Variable[] | undefined) => {
            if (!variables) return;
            const varList = Array.isArray(variables) ? variables : Object.values(variables);
            for (const variable of varList) {
              if (variable && variable.name && variableBirthStepMap.has(variable.name)) {
                // This mutation is SAFE because `step` is a deep clone.
                variable.birthStep = variableBirthStepMap.get(variable.name);
              }
            }
          };
          
          step.state.callStack.forEach(frame => {
            // Handle legacy array-based locals format for backward compatibility.
            if (Array.isArray(frame.locals)) {
              const localsObj: Record<string, Variable> = {};
              frame.locals.forEach((v: any) => { if(v.name) localsObj[v.name] = v; });
              frame.locals = localsObj;
            }
            assignBirths(frame.locals);
          });
          assignBirths(step.state.globals);

          return step;
        });

        const validSteps = processedSteps.filter(step => step && typeof step.id === 'number' && step.type);
        if (validSteps.length === 0) {
          throw new Error('No valid steps after processing - execution may have failed.');
        }

        console.log(`✅ Processed ${validSteps.length} valid steps`);
        console.log('📋 First step:', validSteps[0]);
        const stepTypes = validSteps.reduce((acc: Record<string, number>, step: ExecutionStep) => {
          acc[step.type] = (acc[step.type] || 0) + 1;
          return acc;
        }, {});
        console.log('📊 Step type distribution:', stepTypes);

        setTrace({
          steps: validSteps,
          totalSteps: validSteps.length,
          globals: receivedChunks[0]?.globals || [],
          functions: receivedChunks[0]?.functions || [],
          metadata: receivedChunks[0]?.metadata
        });
        
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
    };

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