/**
 * useSocket Hook - FIXED for GDB backend
 * No decompression needed - GDB sends direct format
 */

import { useEffect, useState, useCallback } from 'react';
import { socketService, type SocketEventCallback } from '@services/socket.service';
import { useExecutionStore } from '@store/slices/executionSlice';
import { useGCCStore } from '@store/slices/gccSlice';
import toast from 'react-hot-toast';
import { ExecutionTrace } from '@types/index';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Store actions
  const { setTrace, setAnalysisProgress, setAnalyzing } = useExecutionStore();
  const { setGCCStatus } = useGCCStore();

  /**
   * Connect to Socket.io server
   */
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

  /**
   * Disconnect
   */
  const disconnect = useCallback(() => {
    socketService.disconnect();
    setIsConnected(false);
    toast.success('Disconnected from server');
  }, []);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    const handleConnectionState: SocketEventCallback = (data) => {
      setIsConnected(data.connected);
    };

    const handleGCCStatus: SocketEventCallback = (data) => {
      setGCCStatus(data);
    };

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
        // With the new backend, the entire trace might come in a single chunk.
        // Or it might be sent on the 'data' of the complete event.
        // For now, we assume it's in chunks.
        if (receivedChunks.length === 0) {
          // Fallback for if the trace is sent in the complete event data
           if (data && data.steps) {
             receivedChunks.push(data);
           } else {
            throw new Error('No trace data received');
           }
        }

        // The new backend sends a single trace object, so we get it from the first chunk.
        const traceData: ExecutionTrace = receivedChunks[0];

        const allSteps = traceData.steps || [];
        const globals = traceData.globals || [];
        const functions = traceData.functions || [];
        const metadata = traceData.metadata;

        // Validate steps - new backend has steps without state, so we relax the validation.
        // A valid step must have an id and a type.
        const validSteps = allSteps.filter(step => 
          step && 
          typeof step.id === 'number' && 
          step.type
        );

        if (validSteps.length === 0) {
          throw new Error('No valid steps in trace - execution may have failed or code is empty.');
        }

        console.log(`✅ Processed ${validSteps.length} valid steps`);
        console.log('📋 First step:', validSteps[0]);
        console.log('📋 Last step:', validSteps[validSteps.length - 1]);

        // Set trace in the store
        setTrace({
          steps: validSteps,
          totalSteps: validSteps.length,
          globals,
          functions,
          metadata
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
      // Input will be handled by VisualizationCanvas component
    };

    // Register listeners
    socketService.on('connection:state', handleConnectionState);
    socketService.on('compiler:status', handleGCCStatus);
    socketService.on('code:syntax:error', handleSyntaxError);
    socketService.on('code:trace:progress', handleTraceProgress);
    socketService.on('code:trace:chunk', handleTraceChunk);
    socketService.on('code:trace:complete', handleTraceComplete);
    socketService.on('code:trace:error', handleTraceError);
    socketService.on('execution:input_required', handleInputRequired);

    // Cleanup
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

  /**
   * Generate execution trace
   */
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