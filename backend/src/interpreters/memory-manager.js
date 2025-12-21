/**
 * Memory Manager
 * Simulates stack, heap, and global memory
 */

export class MemoryManager {
  constructor() {
    this.globals = new Map();
    this.stack = [];
    this.heap = new Map();
    this.callStack = [];
    this.nextAddress = 0x1000;
  }

  /**
   * Declare global variable
   */
  declareGlobal(name, type, value) {
    const address = this.allocateAddress();
    this.globals.set(name, {
      name,
      type,
      value,
      address,
      scope: 'global',
      isAlive: true
    });
  }

  /**
   * Declare local variable
   */
  declareLocal(name, type, value) {
    if (this.callStack.length === 0) {
      throw new Error('No active stack frame');
    }

    const currentFrame = this.callStack[this.callStack.length - 1];
    const address = this.allocateAddress();
    
    currentFrame.locals[name] = {
      name,
      type,
      value,
      address,
      scope: 'local',
      isAlive: true
    };
  }

  /**
   * Declare array
   */
  declareArray(name, type, size, values = []) {
    const baseAddress = this.allocateAddress();
    const cells = [];

    for (let i = 0; i < size; i++) {
      const cellAddress = this.allocateAddress();
      cells.push({
        index: i,
        value: values[i] !== undefined ? values[i] : 0,
        address: cellAddress
      });
    }

    const arrayVar = {
      name,
      type: `${type}[]`,
      size,
      baseAddress,
      values: cells,
      scope: this.callStack.length > 0 ? 'local' : 'global',
      isAlive: true
    };

    if (this.callStack.length > 0) {
      const currentFrame = this.callStack[this.callStack.length - 1];
      currentFrame.locals[name] = arrayVar;
    } else {
      this.globals.set(name, arrayVar);
    }
  }

  /**
   * Set variable value
   */
  setValue(name, value) {
    // Check local scope first
    if (this.callStack.length > 0) {
      const currentFrame = this.callStack[this.callStack.length - 1];
      if (currentFrame.locals[name]) {
        currentFrame.locals[name].value = value;
        return;
      }
    }

    // Check global scope
    if (this.globals.has(name)) {
      const globalVar = this.globals.get(name);
      globalVar.value = value;
      this.globals.set(name, globalVar);
      return;
    }

    throw new Error(`Variable ${name} not found`);
  }

  /**
   * Get variable value
   */
  getValue(name) {
    // Check local scope first
    if (this.callStack.length > 0) {
      const currentFrame = this.callStack[this.callStack.length - 1];
      if (currentFrame.locals[name]) {
        return currentFrame.locals[name].value;
      }
    }

    // Check global scope
    if (this.globals.has(name)) {
      return this.globals.get(name).value;
    }

    return undefined;
  }

  /**
   * Check if variable is global
   */
  isGlobal(name) {
    return this.globals.has(name);
  }

  /**
   * Push stack frame
   */
  pushStackFrame(functionName, params = {}) {
    const frameId = `frame_${this.callStack.length}`;
    const frame = {
      function: functionName,
      returnType: 'int',
      params,
      locals: {},
      frameId,
      returnAddress: this.callStack.length > 0 ? this.callStack[this.callStack.length - 1].frameId : null,
      isActive: true
    };

    this.callStack.push(frame);
    return frameId;
  }

  /**
   * Pop stack frame
   */
  popStackFrame() {
    if (this.callStack.length === 0) {
      throw new Error('Cannot pop from empty call stack');
    }

    const frame = this.callStack.pop();
    
    // Mark local variables as dead
    for (const varName in frame.locals) {
      frame.locals[varName].isAlive = false;
    }

    return frame;
  }

  /**
   * Allocate heap memory
   */
  allocateHeap(size, type = 'int') {
    const address = this.allocateAddress();
    this.heap.set(address, {
      address,
      size,
      type,
      allocated: true,
      values: Array(size).fill(0)
    });
    return address;
  }

  /**
   * Free heap memory
   */
  freeHeap(address) {
    if (this.heap.has(address)) {
      const block = this.heap.get(address);
      block.allocated = false;
      this.heap.set(address, block);
    }
  }

  /**
   * Allocate memory address
   */
  allocateAddress() {
    const address = `0x${this.nextAddress.toString(16).toUpperCase()}`;
    this.nextAddress += 4; // 4 bytes per address
    return address;
  }

  /**
   * Get memory snapshot for current state
   */
  getSnapshot() {
    // Convert Map to plain object
    const globalsObj = {};
    this.globals.forEach((value, key) => {
      globalsObj[key] = value;
    });

    const heapObj = {};
    this.heap.forEach((value, key) => {
      heapObj[key] = value;
    });

    return {
      globals: globalsObj,
      stack: this.stack,
      heap: heapObj,
      callStack: JSON.parse(JSON.stringify(this.callStack)) // Deep clone
    };
  }

  /**
   * Reset memory
   */
  reset() {
    this.globals.clear();
    this.stack = [];
    this.heap.clear();
    this.callStack = [];
    this.nextAddress = 0x1000;
  }
}

export default MemoryManager;