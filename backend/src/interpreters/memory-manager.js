/**
 * Memory Manager
 * Manages virtual memory: stack frames, heap allocations, and pointers
 */

export default class MemoryManager {
  constructor() {
    this.stack = [];
    this.heap = new Map();
    this.globals = new Map();
    this.nextHeapAddress = 0x1000;
    this.stepCounter = 0;
  }

  /**
   * Push a new stack frame
   */
  pushFrame(functionName, line) {
    const frame = {
      id: `frame_${this.stack.length}`,
      function: functionName,
      line: line,
      variables: new Map(),
      returnAddress: null
    };
    this.stack.push(frame);
    return frame;
  }

  /**
   * Pop the top stack frame
   */
  popFrame() {
    if (this.stack.length === 0) {
      throw new Error('Stack underflow');
    }
    return this.stack.pop();
  }

  /**
   * Get current frame
   */
  getCurrentFrame() {
    return this.stack[this.stack.length - 1];
  }

  /**
   * Declare a variable in current scope
   */
  declareVariable(name, type, value = null, isGlobal = false) {
    const variable = {
      name,
      type,
      value,
      address: this._generateAddress(),
      scope: isGlobal ? 'global' : 'local',
      isInitialized: value !== null
    };

    if (isGlobal) {
      this.globals.set(name, variable);
    } else {
      const frame = this.getCurrentFrame();
      if (!frame) {
        throw new Error('No active stack frame');
      }
      frame.variables.set(name, variable);
    }

    return variable;
  }

  /**
   * Set variable value
   */
  setVariable(name, value) {
    let variable = this._findVariable(name);
    if (!variable) {
      throw new Error(`Variable '${name}' not found`);
    }
    variable.value = value;
    variable.isInitialized = true;
    return variable;
  }

  /**
   * Get variable value
   */
  getVariable(name) {
    const variable = this._findVariable(name);
    if (!variable) {
      throw new Error(`Variable '${name}' not found`);
    }
    if (!variable.isInitialized) {
      throw new Error(`Variable '${name}' used before initialization`);
    }
    return variable;
  }

  /**
   * Allocate heap memory
   */
  malloc(size, type = 'void*') {
    const address = this.nextHeapAddress;
    const block = {
      address,
      size,
      type,
      data: new Array(size).fill(0),
      allocated: true
    };
    this.heap.set(address, block);
    this.nextHeapAddress += size;
    return address;
  }

  /**
   * Free heap memory
   */
  free(address) {
    const block = this.heap.get(address);
    if (!block) {
      throw new Error(`Invalid free: address ${address.toString(16)} not found`);
    }
    if (!block.allocated) {
      throw new Error(`Double free: address ${address.toString(16)}`);
    }
    block.allocated = false;
    return block;
  }

  /**
   * Get heap block
   */
  getHeapBlock(address) {
    return this.heap.get(address);
  }

  /**
   * Write to heap
   */
  writeHeap(address, index, value) {
    const block = this.heap.get(address);
    if (!block) {
      throw new Error(`Invalid memory access: ${address.toString(16)}`);
    }
    if (!block.allocated) {
      throw new Error(`Access to freed memory: ${address.toString(16)}`);
    }
    if (index < 0 || index >= block.size) {
      throw new Error(`Heap buffer overflow: index ${index} out of bounds`);
    }
    block.data[index] = value;
  }

  /**
   * Read from heap
   */
  readHeap(address, index) {
    const block = this.heap.get(address);
    if (!block) {
      throw new Error(`Invalid memory access: ${address.toString(16)}`);
    }
    if (!block.allocated) {
      throw new Error(`Access to freed memory: ${address.toString(16)}`);
    }
    if (index < 0 || index >= block.size) {
      throw new Error(`Heap buffer overflow: index ${index} out of bounds`);
    }
    return block.data[index];
  }

  /**
   * Create memory snapshot for execution step
   */
  snapshot() {
    return {
      globals: Array.from(this.globals.values()).map(v => this._serializeVariable(v)),
      stack: this.stack.map(frame => ({
        id: frame.id,
        function: frame.function,
        line: frame.line,
        variables: Array.from(frame.variables.values()).map(v => this._serializeVariable(v))
      })),
      heap: Array.from(this.heap.values())
        .filter(block => block.allocated)
        .map(block => ({
          address: `0x${block.address.toString(16)}`,
          size: block.size,
          type: block.type,
          data: [...block.data]
        })),
      pointers: this._extractPointers()
    };
  }

  /**
   * Find variable in current scope or global
   */
  _findVariable(name) {
    // Check current frame
    const frame = this.getCurrentFrame();
    if (frame && frame.variables.has(name)) {
      return frame.variables.get(name);
    }

    // Check globals
    if (this.globals.has(name)) {
      return this.globals.get(name);
    }

    return null;
  }

  /**
   * Generate unique address
   */
  _generateAddress() {
    return `0x${(0x7fff0000 + this.stepCounter++ * 8).toString(16)}`;
  }

  /**
   * Serialize variable for snapshot
   */
  _serializeVariable(variable) {
    return {
      name: variable.name,
      type: variable.type,
      value: this._formatValue(variable.value, variable.type),
      address: variable.address,
      scope: variable.scope
    };
  }

  /**
   * Format value based on type
   */
  _formatValue(value, type) {
    if (value === null || value === undefined) {
      return 'uninitialized';
    }
    if (type.includes('*')) {
      return typeof value === 'number' ? `0x${value.toString(16)}` : value;
    }
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  }

  /**
   * Extract pointer relationships
   */
  _extractPointers() {
    const pointers = [];

    // Check globals
    this.globals.forEach((variable) => {
      if (variable.type.includes('*') && variable.value !== null) {
        pointers.push({
          from: variable.address,
          to: typeof variable.value === 'number' ? `0x${variable.value.toString(16)}` : variable.value,
          name: variable.name
        });
      }
    });

    // Check stack frames
    this.stack.forEach((frame) => {
      frame.variables.forEach((variable) => {
        if (variable.type.includes('*') && variable.value !== null) {
          pointers.push({
            from: variable.address,
            to: typeof variable.value === 'number' ? `0x${variable.value.toString(16)}` : variable.value,
            name: variable.name
          });
        }
      });
    });

    return pointers;
  }

  /**
   * Reset memory manager
   */
  reset() {
    this.stack = [];
    this.heap.clear();
    this.globals.clear();
    this.nextHeapAddress = 0x1000;
    this.stepCounter = 0;
  }
}