# API Documentation

This document describes the WebSocket API for the C/C++ code visualizer.

## Events

### Client to Server

- `debug:start`
  - **Payload**: `{ code: string, language: 'c' | 'cpp', userId: string, codeHash: string }`
  - **Description**: Starts a new debugging session.

### Server to Client

- `session:created`
  - **Payload**: `{ sessionId: string, ... }`
  - **Description**: Acknowledges that a session has been created.

- `session:error`
  - **Payload**: `{ error: string }`
  - **Description**: Indicates that an error occurred during the session.

- `loops:analyzed`
  - **Payload**: `[{ line: number, type: string, ... }]`
  - **Description**: Provides the results of the loop analysis.

- `chunk:ready`
  - **Payload**: `{ chunkId: number, iv: string, encryptedData: string, authTag: string }`
  - **Description**: Sends a chunk of the debug trace to the frontend.

- `chunk:progress`
  - **Payload**: `{ loaded: number, total: number }`
  - **Description**: Provides progress information on chunk loading.

- `chunk:complete`
  - **Description**: Indicates that all chunks have been sent.
