# Architecture Overview

This document outlines the architecture of the C/C++ code visualizer.

## Components

The system is composed of the following main components:

- **Frontend**: A React-based single-page application that provides the user interface for code editing, visualization, and debugging.
- **Backend**: A Node.js application that manages user sessions, debugging, and communication with the frontend.
- **Workers**: A pool of Docker containers that execute the C/C++ code in an isolated environment using a DAP-compliant debugger.
- **Redis**: An in-memory data store used for session management and caching.

## Backend Services

The backend is built using a service-oriented architecture. Here are the key services:

- **Session Manager**: Manages user sessions, storing session metadata in Redis.
- **Worker Pool Manager**: Manages the pool of Docker workers, including scaling and health checks.
- **DAP Debugger Service**: Communicates with the debugger in the worker containers using the Debug Adapter Protocol (DAP).
- **Loop Analyzer Service**: Analyzes the user's code to detect loops and suggest slicing strategies.
- **Data Security Service**: Handles encryption and compression of the debug trace data.
- **Chunk Streamer Service**: Streams the debug trace data to the frontend in chunks.

## Data Flow

1. The user writes C/C++ code in the frontend editor and clicks "Visualize".
2. The frontend sends the code to the backend via a WebSocket connection.
3. The backend creates a new session and acquires a worker from the pool.
4. The code is sent to the worker, which compiles it.
5. The Loop Analyzer service inspects the code for loops.
6. The DAP Debugger service starts a debugging session in the worker.
7. As the code is executed, the debugger generates a trace.
8. The trace is compressed, encrypted, and chunked by the backend services.
9. The chunks are streamed to the frontend.
10. The frontend decrypts and decompresses the chunks, and uses the data to render the visualization.

## Security

- All communication between the frontend and backend is over a secure WebSocket connection (WSS).
- Debug trace data is encrypted at rest (in the backend) and in transit (to the frontend).
- Workers run in isolated Docker containers with resource limits and security restrictions.

## Scalability

- The worker pool can be scaled horizontally to support multiple concurrent users.
- The system is designed to be stateless where possible, with session state managed in Redis.
