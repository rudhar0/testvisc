import { useEffect } from 'react';
import { socketService } from '../api/socket.service';
import { useExecutionStore } from '../store/slices/executionSlice';
import { ExecutionTrace, SocketIOError } from '../types';
import { SOCKET_EVENTS } from '../constants/events';
import toast from 'react-hot-toast';

export const useExecutionTrace = () => {
  const {
    setTrace,
    clearTrace,
    setAnalyzing,
    setAnalysisProgress,
    startAnalysis,
    executionTrace,
    getCurrentStep
  } = useExecutionStore();

  useEffect(() => {
    const handleTraceProgress = (data: { progress: number; stage: string }) => {
      console.log(`Frontend: Analysis progress: ${data.stage} (${data.progress}%)`);
      setAnalysisProgress(data.progress, data.stage);
    };

    const handleTraceChunk = (trace: ExecutionTrace) => {
      console.log('Frontend: Received execution trace chunk', trace);
      if (trace.steps && trace.steps.length > 0) {
        setTrace(trace);
      } else {
        // Handle gracefully the case with very few steps, which indicates an issue.
        console.error('Frontend: Received trace with insufficient steps, indicating a possible compilation or runtime error.');
        clearTrace();
        setAnalyzing(false);
        // Display an error message to the user
        toast.error('Failed to generate a valid execution trace. The code may have issues or not produce any executable steps.');
      }
    };

    const handleTraceComplete = (data: { totalSteps: number }) => {
      console.log(`Frontend: Trace generation complete. Total steps: ${data.totalSteps}`);
      setAnalysisProgress(100, 'complete');
      setAnalyzing(false);
    };

    const handleTraceError = (error: SocketIOError) => {
      console.error('Frontend: Execution Error', error);
      clearTrace();
      setAnalyzing(false);
      // Optionally display error message to user
      toast.error(`An error occurred during trace generation: ${error.message}`);
    };

    // Subscribe to events
    socketService.on(SOCKET_EVENTS.CODE_TRACE_PROGRESS, handleTraceProgress);
    socketService.on(SOCKET_EVENTS.CODE_TRACE_CHUNK, handleTraceChunk);
    socketService.on(SOCKET_EVENTS.CODE_TRACE_COMPLETE, handleTraceComplete);
    socketService.on(SOCKET_EVENTS.CODE_TRACE_ERROR, handleTraceError);

    // No need for startAnalysis here, it is triggered by UI interaction

    // Cleanup on unmount
    return () => {
      socketService.off(SOCKET_EVENTS.CODE_TRACE_PROGRESS, handleTraceProgress);
      socketService.off(SOCKET_EVENTS.CODE_TRACE_CHUNK, handleTraceChunk);
      socketService.off(SOCKET_EVENTS.CODE_TRACE_COMPLETE, handleTraceComplete);
      socketService.off(SOCKET_EVENTS.CODE_TRACE_ERROR, handleTraceError);
    };
  }, [setTrace, clearTrace, setAnalyzing, setAnalysisProgress]);

  return {
    executionTrace,
    currentStep: getCurrentStep(),
  };
};
