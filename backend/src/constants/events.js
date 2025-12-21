/**
 * Socket.io event name constants
 * Keep in sync with frontend constants
 */

export const SOCKET_EVENTS = {
  // Client → Server
  GCC_STATUS_REQUEST: 'gcc:status:request',
  GCC_DOWNLOAD_START: 'gcc:download:start',
  
  CODE_ANALYZE_SYNTAX: 'code:analyze:syntax',
  CODE_ANALYZE_CHUNK: 'code:analyze:chunk',
  CODE_TRACE_GENERATE: 'code:trace:generate',
  
  EXECUTION_INPUT_PROVIDE: 'execution:input:provide',
  EXECUTION_PAUSE: 'execution:pause',
  EXECUTION_RESUME: 'execution:resume',
  
  // Server → Client
  GCC_STATUS: 'gcc:status',
  GCC_DOWNLOAD_PROGRESS: 'gcc:download:progress',
  GCC_DOWNLOAD_COMPLETE: 'gcc:download:complete',
  GCC_DOWNLOAD_ERROR: 'gcc:download:error',
  
  CODE_SYNTAX_RESULT: 'code:analyze:syntax:result',
  CODE_SYNTAX_ERROR: 'code:analyze:syntax:error',
  
  CODE_TRACE_PROGRESS: 'code:trace:progress',
  CODE_TRACE_CHUNK: 'code:trace:chunk', // Chunked trace data
  CODE_TRACE_COMPLETE: 'code:trace:complete', // All chunks sent
  CODE_TRACE_ERROR: 'code:trace:error',
  
  EXECUTION_INPUT_RECEIVED: 'execution:input:received',
  EXECUTION_PAUSED: 'execution:paused',
  EXECUTION_RESUMED: 'execution:resumed',
};

export default SOCKET_EVENTS;