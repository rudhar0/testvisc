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
   */
  extractGlobals(gdbVariables) {
    const globals = {};
    return globals;
  }

  /**
   * Parses a GDB variable and extracts detailed information.
   * @param {object} v - A variable object from GDB.
   * @returns {object} A structured variable object for the frontend.
   */
  _parseVariable(v) {
    const baseInfo = {
      name: v.name,
      type: v.type,
      value: v.value,
      address: v.addr || '0x0',
      scope: 'local',
      isInitialized: v.value !== undefined,
      isAlive: true,
    };

    // Array parsing
    if (v.type && v.type.includes('[') && v.type.includes(']')) {
      const match = v.type.match(/(.*)\[(\d+)\]/);
      if (match) {
        const baseType = match[1].trim();
        const size = parseInt(match[2], 10);
        let elements = [];

        if (v.value && v.value.startsWith('{') && v.value.endsWith('}')) {
          elements = v.value.substring(1, v.value.length - 1).split(',').map(e => e.trim());
        }

        return {
          ...baseInfo,
          isArray: true,
          baseType,
          size,
          elements,
        };
      }
    }
    
    // Pointer parsing
    if (v.type && v.type.includes('*')) {
        return {
            ...baseInfo,
            isPointer: true,
            pointsTo: v.value, // The value of a pointer is the address it points to
        };
    }

    return { ...baseInfo, isArray: false, isPointer: false };
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

    for (const frame of gdbStack) {
      const frameId = frame.level;
      const functionName = frame.func || 'unknown';
      const locals = {};

      for (const v of gdbVariables) {
        if (v.frame === frameId) {
          locals[v.name] = this._parseVariable(v);
        }
      }

      const stackFrame = {
        frameId: frameId,
        function: functionName,
        returnType: '?',
        locals: locals,
        returnAddress: frame.addr,
      };
      stack.push(stackFrame);

      const callFrame = {
        function: functionName,
        returnType: '?',
        params: {},
        locals: locals,
        frameId: frameId,
        returnAddress: frame.addr,
        isActive: frame.level === '0',
      };
      callStack.push(callFrame);
    }

    return { stack, callStack };
  }
}

const memoryMapperService = new MemoryMapperService();
export default memoryMapperService;
