# Migration Guide

This guide provides step-by-step instructions for migrating the C/C++ code visualizer from the old architecture to the new one.

## Phase 1: Basic Infrastructure

1. **Set up Redis and Docker**: Install Docker and Docker Compose. No specific Redis installation is needed if using the `docker-compose.yml` file, as it includes a Redis service.
2. **Create worker pool manager**: The `worker-pool.service.js` is created to manage Docker containers for debugging.
3. **Create session manager**: The `session-manager.service.js` is created to handle user sessions with Redis.
4. **Test with single worker**: The initial `docker-compose.yml` is configured for multiple workers, but can be tested with one.

## Phase 2: DAP Integration

1. **Replace GDB service with DAP service**: The old GDB/MI service is replaced by `dap-debugger.service.js`, which is based on the Debug Adapter Protocol.
2. **Update socket handlers to use DAP**: The `debug-session.handler.js` is updated to orchestrate the new DAP-based debugging flow.
3. **Test debugging features**: Basic debugging features like breakpoints and stepping should be tested.
4. **Ensure variable tracking works**: Variable inspection should be verified.

## Phase 3: Chunking & Compression

1. **Implement chunk streamer**: The `chunk-streamer.service.js` is created to split the debug trace into smaller chunks.
2. **Add compression service**: The `data-security.service.js` now includes gzip compression.
3. **Add encryption service**: The `data-security.service.js` also includes AES-256 encryption for trace data.
4. **Test with large traces**: The system should be tested with large programs that generate a lot of debug information.

## Phase 4: Frontend Updates

1. **Add protocol adapter**: A `protocol-adapter.ts` is created on the frontend to handle the new chunked and encrypted data format.
2. **Add chunk manager**: The `chunk-manager.ts` is responsible for reassembling, decrypting, and decompressing the chunks.
3. **Update state management**: The Redux store (`debugSlice.ts`) is updated to handle chunked data.
4. **Test visualization**: The frontend visualization should work as before, with the new protocol being transparent to the UI components.

## Phase 5: Loop Slicing

1. **Implement loop analyzer**: The `loop-analyzer.service.js` is created to detect loops in the user's code.
2. **Integrate with DAP service**: The loop analysis results are used to set smart breakpoints in the DAP service.
3. **Add UI controls for slice customization** (Future work): The frontend can be extended to allow users to customize the loop slicing strategy.
4. **Test with nested loops**: The loop analyzer should be tested with various loop structures.
