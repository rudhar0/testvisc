import { useEffect, useState, useCallback } from 'react';
import { socketService, type SocketEventCallback } from '@services/socket.service';
import { useExecutionStore } from '@store/slices/executionSlice';
import { useGCCStore } from '@store/slices/gccSlice';
import toast from 'react-hot-toast';
import { SOCKET_EVENTS } from '@constants/events';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Store actions
  const { addStep, addVisualizationSteps, setAnalysisProgress, setAnalyzing, clearTrace } = useExecutionStore();
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

    const handleExecutionStep: SocketEventCallback = (step) => {
      addStep(step);
    };

    const handleVisualization: SocketEventCallback = (steps) => {
      addVisualizationSteps(steps);
    };

    const handleTraceComplete: SocketEventCallback = (data) => {
      console.log(`✅ Trace complete: ${data.totalSteps} total steps`);
      setAnalyzing(false);
      toast.success(`✅ Generated ${data.totalSteps} execution steps`);
    };

    const handleTraceError: SocketEventCallback = (data) => {
      console.error('❌ Trace error:', data);
      toast.error(`Execution failed: ${data.message || 'Unknown error'}`);
      setAnalyzing(false);
    };

    const handleInputRequired: SocketEventCallback = (data) => {
      console.log('📥 Input required:', data);
    };

    // Register listeners
    socketService.on('connection:state', handleConnectionState);
    socketService.on(SOCKET_EVENTS.COMPILER_STATUS, handleGCCStatus);
    socketService.on(SOCKET_EVENTS.CODE_SYNTAX_ERROR, handleSyntaxError);
    socketService.on(SOCKET_EVENTS.EXECUTION_STEP, handleExecutionStep);
    socketService.on(SOCKET_EVENTS.EXECUTION_VISUALIZE, handleVisualization);
    socketService.on(SOCKET_EVENTS.CODE_TRACE_COMPLETE, handleTraceComplete);
    socketService.on(SOCKET_EVENTS.CODE_TRACE_ERROR, handleTraceError);
    socketService.on('execution:input_required', handleInputRequired);

    // Cleanup
    return () => {
      socketService.off('connection:state', handleConnectionState);
      socketService.off(SOCKET_EVENTS.COMPILER_STATUS, handleGCCStatus);
      socketService.off(SOCKET_EVENTS.CODE_SYNTAX_ERROR, handleSyntaxError);
      socketService.off(SOCKET_EVENTS.EXECUTION_STEP, handleExecutionStep);
      socketService.off(SOCKET_EVENTS.EXECUTION_VISUALIZE, handleVisualization);
      socketService.off(SOCKET_EVENTS.CODE_TRACE_COMPLETE, handleTraceComplete);
      socketService.off(SOCKET_EVENTS.CODE_TRACE_ERROR, handleTraceError);
      socketService.off('execution:input_required', handleInputRequired);
    };
  }, [addStep, addVisualizationSteps, setAnalyzing, setAnalysisProgress, setGCCStatus]);

  const generateTrace = useCallback((code: string, language: string) => {
    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }
    console.log('🚀 Requesting trace generation...');
    clearTrace();
    setAnalyzing(true);
    socketService.generateTrace(code, language);
  }, [isConnected, setAnalyzing, clearTrace]);

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