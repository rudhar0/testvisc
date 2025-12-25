import { LayoutResult, VariableData, StackFrameData, ArrayData, HeapBlockData, PointerArrowData } from '../types';

export class LayoutEngine {
  private static readonly CONFIG = {
    padding: 40,
    sectionGap: 100,
    columnGap: 120,
    
    // Variable dimensions
    varWidth: 180,
    varHeight: 85,
    varGap: 15,
    
    // Stack frame dimensions
    framePadding: 20,
    frameHeaderHeight: 60,
    frameGap: 25,
    maxVarsPerRow: 2,
    
    // Array dimensions
    arrayCellWidth: 55,
    arrayCellHeight: 55,
    arrayGap: 5,
    arrayLabelHeight: 30,
    
    // Heap dimensions
    heapBlockMinWidth: 100,
    heapBlockHeight: 90,
    heapGap: 15,
    
    // Output dimensions
    outputWidth: 500,
    outputHeight: 120,
    outputBottomMargin: 20,
  };

  static calculateLayout(
    state: any,
    canvasWidth: number,
    canvasHeight: number,
    prevLayout?: LayoutResult
  ): LayoutResult {
    const layout: LayoutResult = {
      globals: [],
      arrays: [],
      stack: [],
      heap: [],
      pointers: [],
      output: null,
      loopIndicators: [],
      bounds: { minX: 0, minY: 0, maxX: canvasWidth, maxY: 0 }
    };

    // Track positions
    let globalY = this.CONFIG.padding;
    let stackY = this.CONFIG.padding;
    let heapY = this.CONFIG.padding;

    // Column X positions
    const globalX = this.CONFIG.padding;
    const stackX = globalX + this.CONFIG.varWidth + this.CONFIG.columnGap;
    const heapX = stackX + 500 + this.CONFIG.columnGap;

    // 1. GLOBAL VARIABLES (Left column)
    layout.globals = this.layoutGlobalVariables(state, globalX, globalY, prevLayout);
    
    if (layout.globals.length > 0) {
      globalY = Math.max(...layout.globals.map(v => v.y + v.height)) + this.CONFIG.sectionGap;
    }

    // 2. GLOBAL ARRAYS (Below globals)
    const globalArrays = this.layoutGlobalArrays(state, globalX, globalY, prevLayout);
    layout.arrays.push(...globalArrays);
    
    if (globalArrays.length > 0) {
      globalY = Math.max(...globalArrays.map(a => a.y + a.cellHeight + this.CONFIG.arrayLabelHeight)) + this.CONFIG.sectionGap;
    }

    // 3. STACK FRAMES (Middle column)
    const stackResult = this.layoutStack(state, stackX, stackY, prevLayout);
    layout.stack = stackResult.frames;
    layout.arrays.push(...stackResult.arrays);
    
    if (layout.stack.length > 0) {
      stackY = Math.max(...layout.stack.map(f => f.y + f.height)) + this.CONFIG.frameGap;
    }

    // 4. HEAP (Right column)
    layout.heap = this.layoutHeap(state, heapX, heapY, prevLayout);
    
    if (layout.heap.length > 0) {
      heapY = Math.max(...layout.heap.map(h => h.y + h.height)) + this.CONFIG.heapGap;
    }

    // 5. POINTERS (Calculate after all elements positioned)
    layout.pointers = this.calculatePointers(layout);

    // 6. OUTPUT (Bottom of canvas)
    if (state?.stdout && state.stdout.trim()) {
      layout.output = {
        x: this.CONFIG.padding,
        y: canvasHeight - this.CONFIG.outputHeight - this.CONFIG.outputBottomMargin,
        width: Math.min(this.CONFIG.outputWidth, canvasWidth - 2 * this.CONFIG.padding),
        height: this.CONFIG.outputHeight,
        content: state.stdout
      };
    }

    // 7. LOOP INDICATORS
    layout.loopIndicators = this.calculateLoopIndicators(state, stackX);

    // Calculate bounds
    layout.bounds = this.calculateBounds(layout, canvasWidth, canvasHeight);

    return layout;
  }

  private static layoutGlobalVariables(
    state: any,
    startX: number,
    startY: number,
    prevLayout?: LayoutResult
  ): VariableData[] {
    if (!state?.globals) return [];

    const variables: VariableData[] = [];
    let currentY = startY;

    Object.entries(state.globals).forEach(([name, data]: [string, any], index) => {
      if (Array.isArray(data.value)) return; // Skip arrays

      const id = `global-${name}`;
      const prevVar = prevLayout?.globals.find(v => v.id === id);
      
      variables.push({
        id,
        name,
        type: data.type || 'int',
        value: data.value,
        address: data.address || `0x${(0x1000 + index * 8).toString(16)}`,
        x: startX,
        y: currentY,
        width: this.CONFIG.varWidth,
        height: this.CONFIG.varHeight,
        section: 'global',
        isNew: !prevVar,
        isUpdated: prevVar && prevVar.value !== data.value,
        previousValue: prevVar?.value,
        expression: data.expression
      });

      currentY += this.CONFIG.varHeight + this.CONFIG.varGap;
    });

    return variables;
  }

  private static layoutGlobalArrays(
    state: any,
    startX: number,
    startY: number,
    prevLayout?: LayoutResult
  ): ArrayData[] {
    if (!state?.globals) return [];

    const arrays: ArrayData[] = [];
    let currentY = startY;

    Object.entries(state.globals).forEach(([name, data]: [string, any]) => {
      if (!Array.isArray(data.value)) return;

      const id = `global-array-${name}`;
      const prevArray = prevLayout?.arrays.find(a => a.id === id);

      const cells = (data.value as any[]).map((val, idx) => ({
        index: idx,
        value: val,
        address: `${data.address || '0x2000'}+${idx * 4}`,
        isUpdated: prevArray?.cells[idx]?.value !== val,
        previousValue: prevArray?.cells[idx]?.value
      }));

      arrays.push({
        id,
        name,
        type: data.type || 'int[]',
        cells,
        x: startX,
        y: currentY,
        cellWidth: this.CONFIG.arrayCellWidth,
        cellHeight: this.CONFIG.arrayCellHeight,
        section: 'global'
      });

      currentY += this.CONFIG.arrayCellHeight + this.CONFIG.arrayLabelHeight + this.CONFIG.sectionGap;
    });

    return arrays;
  }

  private static layoutStack(
    state: any,
    startX: number,
    startY: number,
    prevLayout?: LayoutResult
  ): { frames: StackFrameData[]; arrays: ArrayData[] } {
    if (!state?.callStack || state.callStack.length === 0) {
      return { frames: [], arrays: [] };
    }

    const frames: StackFrameData[] = [];
    const arrays: ArrayData[] = [];
    let currentY = startY;

    state.callStack.forEach((frame: any, frameIndex: number) => {
      const frameId = `frame-${frameIndex}`;
      const prevFrame = prevLayout?.stack.find(f => f.id === frameId);

      const localVars: VariableData[] = [];
      const localArrays: ArrayData[] = [];
      
      // Separate variables and arrays
      Object.entries(frame.locals || {}).forEach(([name, data]: [string, any], varIndex) => {
        if (Array.isArray(data.value)) {
          // Array
          const arrayId = `local-array-${frameIndex}-${name}`;
          const prevArray = prevLayout?.arrays.find(a => a.id === arrayId);

          const cells = (data.value as any[]).map((val: any, idx: number) => ({
            index: idx,
            value: val,
            address: `${data.address || '0x7fff0000'}+${idx * 4}`,
            isUpdated: prevArray?.cells[idx]?.value !== val,
            previousValue: prevArray?.cells[idx]?.value
          }));

          localArrays.push({
            id: arrayId,
            name,
            type: data.type || 'int[]',
            cells,
            x: 0, // Set below
            y: 0,
            cellWidth: this.CONFIG.arrayCellWidth,
            cellHeight: this.CONFIG.arrayCellHeight,
            section: 'stack'
          });
        } else {
          // Variable
          const varId = `local-${frameIndex}-${name}`;
          const prevVar = prevFrame?.locals.find(v => v.id === varId);

          localVars.push({
            id: varId,
            name,
            type: data.type || 'int',
            value: data.value,
            address: data.address || `0x${(0x7fff0000 + varIndex * 8).toString(16)}`,
            x: 0, // Set below
            y: 0,
            width: this.CONFIG.varWidth,
            height: this.CONFIG.varHeight,
            section: 'stack',
            isNew: !prevVar,
            isUpdated: prevVar && prevVar.value !== data.value,
            previousValue: prevVar?.value,
            expression: data.expression
          });
        }
      });

      // Calculate frame dimensions
      const varRows = Math.ceil(localVars.length / this.CONFIG.maxVarsPerRow);
      const frameWidth = Math.max(
        450,
        this.CONFIG.maxVarsPerRow * (this.CONFIG.varWidth + this.CONFIG.varGap) + 2 * this.CONFIG.framePadding
      );

      let contentHeight = this.CONFIG.framePadding;

      // Position local variables
      localVars.forEach((variable, idx) => {
        const col = idx % this.CONFIG.maxVarsPerRow;
        const row = Math.floor(idx / this.CONFIG.maxVarsPerRow);
        variable.x = startX + this.CONFIG.framePadding + col * (this.CONFIG.varWidth + this.CONFIG.varGap);
        variable.y = currentY + this.CONFIG.frameHeaderHeight + row * (this.CONFIG.varHeight + this.CONFIG.varGap);
      });

      if (localVars.length > 0) {
        contentHeight += varRows * (this.CONFIG.varHeight + this.CONFIG.varGap) + this.CONFIG.varGap;
      }

      // Position local arrays
      localArrays.forEach((array) => {
        array.x = startX + this.CONFIG.framePadding;
        array.y = currentY + this.CONFIG.frameHeaderHeight + contentHeight;
        contentHeight += array.cellHeight + this.CONFIG.arrayLabelHeight + this.CONFIG.varGap;
        arrays.push(array);
      });

      const frameHeight = this.CONFIG.frameHeaderHeight + contentHeight + this.CONFIG.framePadding;

      frames.push({
        id: frameId,
        function: frame.function,
        returnType: frame.returnType || 'int',
        isActive: frameIndex === state.callStack.length - 1,
        x: startX,
        y: currentY,
        width: frameWidth,
        height: frameHeight,
        locals: localVars
      });

      currentY += frameHeight + this.CONFIG.frameGap;
    });

    return { frames, arrays };
  }

  private static layoutHeap(
    state: any,
    startX: number,
    startY: number,
    prevLayout?: LayoutResult
  ): HeapBlockData[] {
    if (!state?.heap || Object.keys(state.heap).length === 0) {
      return [];
    }

    const blocks: HeapBlockData[] = [];
    let currentY = startY;

    Object.entries(state.heap).forEach(([address, data]: [string, any]) => {
      const id = `heap-${address}`;
      const prevBlock = prevLayout?.heap.find(h => h.id === id);

      blocks.push({
        id,
        address,
        size: data.size || 4,
        type: data.type || 'void*',
        value: data.value,
        x: startX,
        y: currentY,
        width: Math.max(this.CONFIG.heapBlockMinWidth, this.CONFIG.varWidth),
        height: this.CONFIG.heapBlockHeight,
        allocated: data.allocated !== false
      });

      currentY += this.CONFIG.heapBlockHeight + this.CONFIG.heapGap;
    });

    return blocks;
  }

  private static calculatePointers(layout: LayoutResult): PointerArrowData[] {
    const pointers: PointerArrowData[] = [];
    const allElements = [
      ...layout.globals,
      ...layout.stack.flatMap(f => f.locals),
      ...layout.heap
    ];

    // Find pointer variables
    allElements.forEach((element) => {
      const isPointer = element.type?.includes('*') || element.type?.includes('ptr');
      
      if (isPointer && element.value) {
        // Try to find target by address
        const targetAddress = String(element.value);
        const target = allElements.find(e => e.address === targetAddress);

        if (target) {
          pointers.push({
            id: `pointer-${element.id}-${target.id}`,
            from: {
              x: element.x + element.width,
              y: element.y + element.height / 2
            },
            to: {
              x: target.x,
              y: target.y + target.height / 2
            },
            color: '#F59E0B',
            fromVar: element.name,
            toVar: target.name
          });
        }
      }
    });

    return pointers;
  }

  private static calculateLoopIndicators(state: any, stackX: number): LoopIndicatorData[] {
    // Extract loop info from current step if available
    if (state?.currentLoop) {
      return [{
        id: 'loop-indicator-0',
        iteration: state.currentLoop.iteration,
        total: state.currentLoop.total,
        x: stackX - 60,
        y: 100
      }];
    }
    return [];
  }

  private static calculateBounds(
    layout: LayoutResult,
    canvasWidth: number,
    canvasHeight: number
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    const allX = [
      ...layout.globals.map(v => [v.x, v.x + v.width]),
      ...layout.stack.map(f => [f.x, f.x + f.width]),
      ...layout.heap.map(h => [h.x, h.x + h.width]),
      ...layout.arrays.map(a => [a.x, a.x + a.cells.length * (a.cellWidth + this.CONFIG.arrayGap)])
    ].flat();

    const allY = [
      ...layout.globals.map(v => [v.y, v.y + v.height]),
      ...layout.stack.map(f => [f.y, f.y + f.height]),
      ...layout.heap.map(h => [h.y, h.y + h.height]),
      ...layout.arrays.map(a => [a.y, a.y + a.cellHeight + this.CONFIG.arrayLabelHeight])
    ].flat();

    return {
      minX: Math.min(0, ...allX) - this.CONFIG.padding,
      minY: Math.min(0, ...allY) - this.CONFIG.padding,
      maxX: Math.max(canvasWidth, ...allX) + this.CONFIG.padding,
      maxY: Math.max(canvasHeight, ...allY) + this.CONFIG.padding * 2
    };
  }
}

