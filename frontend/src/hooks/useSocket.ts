/**
 * useSocket Hook
 * React hook for Socket.io integration
 */

import { useEffect, useState, useCallback } from 'react';
import { socketService, type SocketEventCallback } from '@services/socket.service';
import { useExecutionStore } from '@store/slices/executionSlice';
import { useGCCStore } from '@store/slices/gccSlice';
import { traceDecompressor } from '@utils/traceDecompressor';
import toast from 'react-hot-toast';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Store actions
  const { setTrace, setAnalysisProgress, setAnalyzing } = useExecutionStore();
  const { setGCCStatus, setProgress, setStage, setDownloadError } = useGCCStore();

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
      
      // Request initial compiler status
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
   * Disconnect from Socket.io server
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
    // Listen for connection state changes
    const handleConnectionState: SocketEventCallback = (data) => {
      setIsConnected(data.connected);
      if (!data.connected) {
        console.log('⚠️ Disconnected from server');
      }
    };

    // Compiler Status
    const handleGCCStatus: SocketEventCallback = (data) => {
      setGCCStatus(data);
    };

    // Code Syntax Result
    const handleSyntaxResult: SocketEventCallback = (data) => {
      if (!data.valid && data.errors) {
        let errorMessages = '';
        if (Array.isArray(data.errors)) {
          errorMessages = data.errors
            .map((err: any) => {
              if (typeof err === 'string') return err;
              if (err.message) {
                return err.details ? `${err.message} - ${err.details}` : err.message;
              }
              return JSON.stringify(err);
            })
            .join('; ');
        } else if (typeof data.errors === 'string') {
          errorMessages = data.errors;
        }
        toast.error(`Syntax errors found: ${errorMessages}`);
      }
    };

    // Code Syntax Error
    const handleSyntaxError: SocketEventCallback = (data) => {
      let errorMessage = 'Unknown syntax error';
      
      if (Array.isArray(data.errors)) {
        // Handle array of error objects from Clang
        errorMessage = data.errors
          .map((err: any) => {
            if (typeof err === 'string') return err;
            if (err.message) {
              return err.details ? `${err.message} - ${err.details}` : err.message;
            }
            return JSON.stringify(err);
          })
          .join('; ');
      } else if (typeof data.errors === 'string') {
        errorMessage = data.errors;
      } else if (data.message) {
        errorMessage = data.message;
      }
      
      toast.error(`Syntax error: ${errorMessage}`);
      setAnalyzing(false);
    };

    // Trace Progress
    const handleTraceProgress: SocketEventCallback = (data) => {
      setAnalysisProgress(data.progress, data.stage);
    };

    // Trace Chunk Received
    const chunks: any[] = [];
    
    const handleTraceChunk: SocketEventCallback = (chunk) => {
      chunks.push(chunk);
      console.log(`📦 Received chunk ${chunk.chunkId + 1}`);
    };

    // Trace Complete
    const handleTraceComplete: SocketEventCallback = (data) => {
      console.log(`✅ Trace complete: ${chunks.length} chunks received`);
      
      try {
        // Decompress and reconstruct trace
        const decompressedTrace = traceDecompressor.decompressChunks(chunks);
        
        setTrace({
          steps: decompressedTrace,
          totalSteps: data.totalSteps,
          globals: chunks[0]?.globals || [],
          functions: chunks[0]?.functions || []
        });
        
        setAnalyzing(false);
        toast.success(`Trace generated: ${data.totalSteps} steps`);
        
        // Clear chunks
        chunks.length = 0;
      } catch (error) {
        console.error('Failed to decompress trace:', error);
        toast.error('Failed to process execution trace');
        setAnalyzing(false);
      }
    };

    // Trace Error
    const handleTraceError: SocketEventCallback = (data) => {
      toast.error(`Analysis failed: ${data.message}`);
      setAnalyzing(false);
    };

    // Register listeners
    socketService.on('connection:state', handleConnectionState);
    socketService.on('compiler:status', handleGCCStatus);
    socketService.on('code:syntax:result', handleSyntaxResult);
    socketService.on('code:syntax:error', handleSyntaxError);
    socketService.on('code:trace:progress', handleTraceProgress);
    socketService.on('code:trace:chunk', handleTraceChunk);
    socketService.on('code:trace:complete', handleTraceComplete);
    socketService.on('code:trace:error', handleTraceError);

    // Cleanup
    return () => {
      socketService.off('connection:state', handleConnectionState);
      socketService.off('compiler:status', handleGCCStatus);
      socketService.off('code:syntax:error', handleSyntaxError);
      socketService.off('code:syntax:result', handleSyntaxResult);
      socketService.off('code:trace:progress', handleTraceProgress);
      socketService.off('code:trace:chunk', handleTraceChunk);
      socketService.off('code:trace:complete', handleTraceComplete);
      socketService.off('code:trace:error', handleTraceError);
    };
  }, [setTrace, setAnalyzing, setAnalysisProgress, setGCCStatus, setProgress, setStage, setDownloadError]);

  /**
   * Generate execution trace
   */
  const generateTrace = useCallback((code: string, language: string) => {
    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }

    setAnalyzing(true);
    socketService.generateTrace(code, language);
  }, [isConnected, setAnalyzing]);

  /**
   * Analyze syntax
   */
  const analyzeSyntax = useCallback((code: string, language: string) => {
    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }

    socketService.analyzeSyntax(code, language);
  }, [isConnected]);

  /**
   * Request GCC status
   */
  const requestGCCStatus = useCallback(() => {
    if (!isConnected) return;
    socketService.requestGCCStatus();
  }, [isConnected]);

  /**
   * Start GCC download
   */
  const startGCCDownload = useCallback(() => {
    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }

    socketService.startGCCDownload();
  }, [isConnected]);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    generateTrace,
    analyzeSyntax,
    requestGCCStatus,
    startGCCDownload,
  };
}

export default useSocket;