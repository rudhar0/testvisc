import { logger } from '../utils/logger.js';

class MemoryMapperService {
  /**
   * Transforms raw GDB data into the structured `MemoryState` the frontend expects.
   * @param {Array} gdbVariables - Variables from GDB's `-stack-list-variables`.
   * @param {Array} gdbStack - Stack frames from GDB's `-stack-list-frames`.
   * @returns {object} A `MemoryState` object.
   */
  createMemoryState(gdbVariables, gdbStack) {
    const globals = this.extractGlobals(gdbVariables);
    const { stack, callStack } = this.createStackAndCallStack(gdbStack, gdbVariables);
    const heap = {}; // Placeholder for now

    const memoryState = {
      globals,
      stack,
      heap,
      callStack,
    };

    logger.debug('Created Memory State:', JSON.stringify(memoryState, null, 2));
    return memoryState;
  }

  /**
   * Extracts global variables.
   * GDB's `-stack-list-variables` doesn't differentiate scopes well without addresses.
   * We will have to make assumptions or improve variable fetching later.
   * For now, we'll treat variables not found in any stack frame as globals (crude).
   */
  extractGlobals(gdbVariables) {
    const globals = {};
    // This is a placeholder. A more robust solution needs address checking.
    // Let's assume no globals for now to avoid misplacing variables.
    return globals;
  }

  /**
   * Creates the `stack` and `callStack` arrays for the frontend.
   * @param {Array} gdbStack - GDB stack frames.
   * @param {Array} gdbVariables - GDB variables.
   */
  createStackAndCallStack(gdbStack, gdbVariables) {
    const stack = [];
    const callStack = [];

    if (!gdbStack || !gdbVariables) {
      return { stack, callStack };
    }

    // GDB returns stack frames from top (current) to bottom (main).
    for (const frame of gdbStack) {
      const frameId = frame.level; // Use level as a unique ID for the frame
      const functionName = frame.func || 'unknown';
      const locals = {};

      // Find variables belonging to this frame
      for (const v of gdbVariables) {
        if (v.frame === frameId) {
          locals[v.name] = {
            name: v.name,
            type: v.type,
            value: v.value,
            address: v.addr || '0x0', // GDB might not provide an address
            scope: 'local',
            isInitialized: v.value !== undefined,
            isAlive: true, // Assume alive if present
          };
        }
      }

      const stackFrame = {
        frameId: frameId,
        function: functionName,
        returnType: '?', // Not easily available
        locals: locals,
        returnAddress: frame.addr,
      };
      stack.push(stackFrame);

      const callFrame = {
        function: functionName,
        returnType: '?',
        params: {}, // We can't distinguish params from locals easily yet
        locals: locals,
        frameId: frameId,
        returnAddress: frame.addr,
        isActive: frame.level === '0', // The top frame is active
      };
      callStack.push(callFrame);
    }

    return { stack, callStack };
  }
}

const memoryMapperService = new MemoryMapperService();
export default memoryMapperService;
