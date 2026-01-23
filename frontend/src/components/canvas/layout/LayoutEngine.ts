// frontend/src/components/canvas/layout/LayoutEngine.ts
/**
 * LayoutEngine - OPTIMIZED WITH MULTI-DIMENSIONAL ARRAY SUPPORT
 * 
 * FIXES:
 * 1. Cached array positions (no recalculation lag)
 * 2. Progressive array value tracking (no re-renders)
 * 3. 2D/3D array support
 * 4. Array variable references in stack
 */

import { 
  MemoryState, 
  ExecutionStep, 
  Variable, 
  ExecutionTrace,
} from '@types/index';

export interface LayoutElement {
  id: string;
  type: 'main' | 'variable' | 'array' | 'pointer' | 'loop' | 'condition' | 'output' | 'input' | 'global' | 'function' | 'struct' | 'class' | 'array_panel' | 'array_reference';
  subtype?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
  children?: LayoutElement[];
  data?: any;
  stepId?: number;
  metadata?: {
    isMultiple?: boolean;
    relatedElements?: string[];
    referencesArray?: string;
    [key: string]: any;
  };
}

export interface Layout {
  mainFunction: LayoutElement;
  globalPanel: LayoutElement;
  arrayPanel: LayoutElement | null;
  elements: LayoutElement[];
  arrayReferences: LayoutElement[];
  updateArrows: LayoutElement[];
  width: number;
  height: number;
}

const ELEMENT_SPACING = 16;
const INDENT_SIZE = 20;
const HEADER_HEIGHT = 40;
const MAIN_FUNCTION_X = 40;
const MAIN_FUNCTION_Y = 40;
const MAIN_FUNCTION_WIDTH = 600;
const GLOBAL_PANEL_WIDTH = 300;
const PANEL_GAP = 40;

// ============================================
// PROGRESSIVE ARRAY VALUE TRACKER - ENHANCED
// ============================================
class ProgressiveArrayTracker {
  private arrays: Map<string, {
    name: string;
    baseType: string;
    dimensions: number[];
    address: string;
    owner: string;
    birthStep: number;
    values: Map<string, any>;
    lastUpdateStep: number;
  }> = new Map();

  // Cache for computed states
  private stateCache: Map<string, any> = new Map();

  createArray(name: string, baseType: string, dimensions: number[], address: string, owner: string, stepIndex: number) {
    this.arrays.set(name, {
      name,
      baseType,
      dimensions,
      address,
      owner,
      birthStep: stepIndex,
      values: new Map(),
      lastUpdateStep: stepIndex
    });
    this.invalidateCache(name);
  }

  initializeArray(name: string, values: any[], stepIndex: number) {
    const arr = this.arrays.get(name);
    if (!arr) return;

    values.forEach((val, idx) => {
      arr.values.set(String(idx), val);
    });
    arr.lastUpdateStep = stepIndex;
    this.invalidateCache(name);
  }

  updateArrayElement(name: string, indices: number[], value: any, stepIndex: number) {
    const arr = this.arrays.get(name);
    if (!arr) return;

    const key = indices.join(',');
    arr.values.set(key, value);
    arr.lastUpdateStep = stepIndex;
    this.invalidateCache(name);
  }

  private invalidateCache(name: string) {
    // Clear cache for this array
    for (const key of this.stateCache.keys()) {
      if (key.startsWith(name + '-')) {
        this.stateCache.delete(key);
      }
    }
  }

  getArrayState(name: string, upToStep: number) {
    const cacheKey = `${name}-${upToStep}`;
    
    // Return cached if available
    if (this.stateCache.has(cacheKey)) {
      return this.stateCache.get(cacheKey);
    }

    const arr = this.arrays.get(name);
    if (!arr || arr.birthStep > upToStep) return null;

    const totalSize = arr.dimensions.reduce((a, b) => a * b, 1);
    const progressiveValues: any[] = new Array(totalSize).fill(null);

    arr.values.forEach((value, key) => {
      const indices = key.split(',').map(Number);
      const flatIdx = this.calculateFlatIndex(indices, arr.dimensions);

      if (flatIdx >= 0 && flatIdx < totalSize) {
        progressiveValues[flatIdx] = value;
      }
    });

    const state = {
      ...arr,
      values: progressiveValues
    };

    // Cache result
    this.stateCache.set(cacheKey, state);
    return state;
  }

  getAllArrays(upToStep: number) {
    const result: any[] = [];
    this.arrays.forEach((arr, name) => {
      const state = this.getArrayState(name, upToStep);
      if (state) {
        result.push(state);
      }
    });
    return result;
  }

  getUpdatedIndices(name: string, currentStep: number): number[][] {
    const arr = this.arrays.get(name);
    if (!arr || arr.lastUpdateStep !== currentStep) return [];
    
    // Track which indices were updated in this step
    const updated: number[][] = [];
    arr.values.forEach((value, key) => {
      const indices = key.split(',').map(Number);
      // Simple heuristic: if this is the current step, assume it was just updated
      // In production, you'd track this more explicitly
      updated.push(indices);
    });
    
    return updated;
  }

  private calculateFlatIndex(indices: number[], dimensions: number[]): number {
    if (dimensions.length === 1) {
      return indices[0];
    }
    if (dimensions.length === 2) {
      const [i, j] = indices;
      return i * dimensions[1] + j;
    }
    if (dimensions.length === 3) {
      const [i, j, k] = indices;
      return i * dimensions[1] * dimensions[2] + j * dimensions[2] + k;
    }
    // N-dimensional support
    let flatIdx = 0;
    let multiplier = 1;
    for (let d = dimensions.length - 1; d >= 0; d--) {
      flatIdx += indices[d] * multiplier;
      multiplier *= dimensions[d];
    }
    return flatIdx;
  }
}

// ============================================
// POSITION CACHE - PREVENT LAG
// ============================================
class PositionCache {
  private cache: Map<string, { x: number; y: number }> = new Map();

  set(id: string, x: number, y: number) {
    this.cache.set(id, { x, y });
  }

  get(id: string): { x: number; y: number } | null {
    return this.cache.get(id) || null;
  }

  has(id: string): boolean {
    return this.cache.has(id);
  }

  clear() {
    this.cache.clear();
  }
}

export class LayoutEngine {
  private static elementHistory: Map<string, LayoutElement> = new Map();
  private static arrayTracker = new ProgressiveArrayTracker();
  private static parentStack: LayoutElement[] = [];
  private static createdInStep: Map<string, number> = new Map();
  private static updateArrows: Map<number, LayoutElement[]> = new Map();
  private static positionCache = new PositionCache();

  public static calculateLayout(
    executionTrace: ExecutionTrace,
    currentStepIndex: number,
    canvasWidth: number,
    canvasHeight: number
  ): Layout {
    const layout: Layout = {
      mainFunction: { 
        id: 'main-function', 
        type: 'main', 
        x: MAIN_FUNCTION_X, 
        y: MAIN_FUNCTION_Y, 
        width: MAIN_FUNCTION_WIDTH, 
        height: 80, 
        children: [], 
        stepId: 0 
      },
      globalPanel: { 
        id: 'global-panel', 
        type: 'global', 
        x: 0,
        y: 0,
        width: GLOBAL_PANEL_WIDTH, 
        height: 60, 
        children: [], 
        stepId: 0 
      },
      arrayPanel: null,
      elements: [],
      arrayReferences: [],
      updateArrows: [],
      width: canvasWidth,
      height: canvasHeight,
    };

    this.elementHistory.clear();
    this.arrayTracker = new ProgressiveArrayTracker();
    this.createdInStep.clear();
    this.updateArrows.clear();
    // Keep position cache across steps for stability
    this.parentStack = [layout.mainFunction];

    // Process all steps up to current
    for (let i = 0; i <= currentStepIndex && i < executionTrace.steps.length; i++) {
      const step = executionTrace.steps[i];
      this.processStep(step, layout, i, currentStepIndex);
    }
    
    this.updateAllElementsToCurrentState(executionTrace.steps[currentStepIndex], layout);
    this.createArrayPanel(layout, currentStepIndex);
    this.positionGlobalPanel(layout);
    this.createArrayReferences(layout, currentStepIndex);
    this.createUpdateArrows(layout, currentStepIndex);
    this.updateContainerHeights(layout);

    return layout;
  }

  private static processStep(step: ExecutionStep, layout: Layout, stepIndex: number, currentStep: number): void {
    const stepType: string = (step as any).eventType || (step as any).type;
    const { state, id } = step;
    const currentParent = this.parentStack[this.parentStack.length - 1];

    // ===================================================================
    // ARRAY EVENTS - WITH MULTI-DIMENSIONAL SUPPORT
    // ===================================================================
    
    if (stepType === 'array_create' || stepType === 'array_declaration') {
      const { name, baseType, dimensions, address } = step as any;
      const owner = (step as any).function || 'main';
      
      this.arrayTracker.createArray(name, baseType, dimensions, address || '0x0', owner, stepIndex);
      
      // Create array REFERENCE variable in stack
      const varId = `var-${currentParent.id}-${name}`;
      if (!this.elementHistory.has(varId)) {
        const arrayRefVar: any = {
          name: name,
          value: `→ array[${dimensions.join('][')}]`,
          type: `${baseType}[]`,
          primitive: `${baseType}[]`,
          address: address,
          scope: 'local',
          isInitialized: true,
          isAlive: true,
          birthStep: stepIndex,
          isArrayReference: true,
          arrayName: name
        };

        const varElement: LayoutElement = {
          id: varId,
          type: 'variable',
          subtype: 'array_reference',
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - (INDENT_SIZE * 2),
          height: 70,
          parentId: currentParent.id,
          stepId: stepIndex,
          data: arrayRefVar,
          metadata: {
            referencesArray: name
          }
        };

        currentParent.children!.push(varElement);
        layout.elements.push(varElement);
        this.elementHistory.set(varId, varElement);
        this.createdInStep.set(varId, stepIndex);
      }
      
      return;
    }

    if (stepType === 'array_init' || stepType === 'array_initialization') {
      const { name, values } = step as any;
      this.arrayTracker.initializeArray(name, values, stepIndex);
      return;
    }

    if (stepType === 'array_index_assign' || stepType === 'array_assignment') {
      const { name, indices, value } = step as any;
      this.arrayTracker.updateArrayElement(name, indices, value, stepIndex);
      
      // Create update arrow for this step
      if (stepIndex === currentStep) {
        this.createArrayUpdateArrow(layout, name, indices, stepIndex);
      }
      return;
    }

    // ===================================================================
    // EXISTING VARIABLE/FUNCTION LOGIC (UNCHANGED)
    // ===================================================================
    
    switch (stepType) {
      case 'declare': {
        if (!step.name) break;
        const varId = `var-${currentParent.id}-${step.name}`;
        if (this.elementHistory.has(varId)) break;

        const variable: any = {
          name: step.name,
          value: null,
          type: (step as any).varType || 'int',
          primitive: (step as any).varType || 'int',
          address: step.addr || '0x0',
          scope: 'local',
          isInitialized: false,
          isAlive: true,
          birthStep: stepIndex,
        };

        const varElement: LayoutElement = {
          id: varId,
          type: 'variable',
          subtype: 'variable_declaration',
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - (INDENT_SIZE * 2),
          height: 70,
          parentId: currentParent.id,
          stepId: stepIndex,
          data: variable,
        };

        currentParent.children!.push(varElement);
        layout.elements.push(varElement);
        this.elementHistory.set(varId, varElement);
        this.createdInStep.set(varId, stepIndex);
        break;
      }

      case 'assign': {
        if (!step.name) break;
        const varId = `var-${currentParent.id}-${step.name}`;
        
        if (this.elementHistory.has(varId)) {
          const existingElement = this.elementHistory.get(varId)!;
          existingElement.data = {
            ...existingElement.data,
            value: step.value,
            isInitialized: true,
          };
          existingElement.metadata = {
            ...(existingElement.metadata || {}),
            updatedStep: stepIndex,
          };
        } else {
          const variable: any = {
            name: step.name,
            value: step.value,
            type: (step as any).varType || 'int',
            primitive: (step as any).varType || 'int',
            address: step.addr || '0x0',
            scope: 'local',
            isInitialized: true,
            isAlive: true,
            birthStep: stepIndex,
          };

          const varElement: LayoutElement = {
            id: varId,
            type: 'variable',
            subtype: 'variable_initialization',
            x: currentParent.x + INDENT_SIZE,
            y: this.getNextCursorY(currentParent),
            width: currentParent.width - (INDENT_SIZE * 2),
            height: 70,
            parentId: currentParent.id,
            stepId: stepIndex,
            data: variable,
          };

          currentParent.children!.push(varElement);
          layout.elements.push(varElement);
          this.elementHistory.set(varId, varElement);
          this.createdInStep.set(varId, stepIndex);
        }
        break;
      }

      case 'output': {
        const outputId = `output-${stepIndex}`;
        if (this.elementHistory.has(outputId)) break;

        const outputElement: LayoutElement = {
          id: outputId,
          type: 'output',
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - (INDENT_SIZE * 2),
          height: 60,
          parentId: currentParent.id,
          stepId: stepIndex,
          data: {
            text: step.text || (step as any).rawText,
            rawText: (step as any).rawText,
            escapeInfo: (step as any).escapeInfo || [],
          },
        };

        currentParent.children!.push(outputElement);
        layout.elements.push(outputElement);
        this.elementHistory.set(outputId, outputElement);
        this.createdInStep.set(outputId, stepIndex);
        break;
      }

      case 'func_enter':
      case 'function_call': {
        if (!state?.callStack || state.callStack.length === 0) break;
        const frame = state.callStack[state.callStack.length - 1];
        
        const parentFrame = this.parentStack[this.parentStack.length - 1];
        if (parentFrame.data?.function === frame.function) break;
        
        const funcId = `func-${frame.function}-${step.line}`;
        if(this.elementHistory.has(funcId)) break;

        const functionElement: LayoutElement = {
          id: funcId,
          type: 'function',
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - (INDENT_SIZE * 2),
          height: 60,
          parentId: currentParent.id,
          stepId: stepIndex,
          data: frame,
          children: [],
        };

        currentParent.children!.push(functionElement);
        layout.elements.push(functionElement);
        this.elementHistory.set(funcId, functionElement);
        this.createdInStep.set(funcId, stepIndex);
        this.parentStack.push(functionElement);
        break;
      }
      
      case 'func_exit':
      case 'function_return': {
        if (this.parentStack.length > 1) {
          this.parentStack.pop();
        }
        break;
      }

      case 'program_start':
      case 'program_end':
      case 'line_execution':
        break;
    }

    if (state?.globals) {
      this.updateGlobals(state.globals, layout, stepIndex);
    }
  }

  private static createArrayPanel(layout: Layout, currentStep: number): void {
    const arrays = this.arrayTracker.getAllArrays(currentStep);
    
    if (arrays.length === 0) {
      layout.arrayPanel = null;
      return;
    }

    const arrayPanelX = MAIN_FUNCTION_X + MAIN_FUNCTION_WIDTH + PANEL_GAP;
    const arrayPanelY = MAIN_FUNCTION_Y;

    // Use cached position if available
    const cachedPos = this.positionCache.get('array-panel');
    const finalX = cachedPos ? cachedPos.x : arrayPanelX;
    const finalY = cachedPos ? cachedPos.y : arrayPanelY;

    layout.arrayPanel = {
      id: 'array-panel',
      type: 'array_panel',
      x: finalX,
      y: finalY,
      width: 400,
      height: 200,
      children: [],
      data: { arrays },
      stepId: 0
    };

    // Cache position
    this.positionCache.set('array-panel', finalX, finalY);
  }

  private static createArrayUpdateArrow(layout: Layout, arrayName: string, indices: number[], stepIndex: number): void {
    if (!layout.arrayPanel) return;

    const arrow: LayoutElement = {
      id: `arrow-${arrayName}-${stepIndex}`,
      type: 'array_reference',
      subtype: 'update_arrow',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      stepId: stepIndex,
      data: {
        arrayName,
        indices,
        fromX: MAIN_FUNCTION_X + MAIN_FUNCTION_WIDTH,
        fromY: MAIN_FUNCTION_Y + 100,
        toX: layout.arrayPanel.x,
        toY: layout.arrayPanel.y + 100,
      }
    };

    if (!this.updateArrows.has(stepIndex)) {
      this.updateArrows.set(stepIndex, []);
    }
    this.updateArrows.get(stepIndex)!.push(arrow);
  }

  private static createUpdateArrows(layout: Layout, currentStep: number): void {
    layout.updateArrows = this.updateArrows.get(currentStep) || [];
  }

  private static positionGlobalPanel(layout: Layout): void {
    if (layout.arrayPanel) {
      layout.globalPanel.x = layout.arrayPanel.x;
      layout.globalPanel.y = layout.arrayPanel.y + layout.arrayPanel.height + PANEL_GAP;
    } else {
      layout.globalPanel.x = MAIN_FUNCTION_X + MAIN_FUNCTION_WIDTH + PANEL_GAP;
      layout.globalPanel.y = MAIN_FUNCTION_Y;
    }
  }

  private static createArrayReferences(layout: Layout, currentStep: number): void {
    if (!layout.arrayPanel) return;

    // Find all array reference variables in stack
    const arrayRefVars = layout.elements.filter(el => 
      el.metadata?.referencesArray && el.stepId !== undefined && el.stepId <= currentStep
    );

    arrayRefVars.forEach(refVar => {
      const arrayName = refVar.metadata!.referencesArray!;
      const array = layout.arrayPanel!.data?.arrays?.find((arr: any) => arr.name === arrayName);
      
      if (array) {
        const refArrow: LayoutElement = {
          id: `ref-${refVar.id}-${arrayName}`,
          type: 'array_reference',
          subtype: 'reference_arrow',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          stepId: refVar.stepId,
          data: {
            fromElement: refVar.id,
            toArray: array.id || arrayName,
            variableName: refVar.data.name,
            arrayName: arrayName,
            fromX: refVar.x + refVar.width,
            fromY: refVar.y + refVar.height / 2,
            toX: layout.arrayPanel!.x,
            toY: layout.arrayPanel!.y + 100
          }
        };

        layout.arrayReferences.push(refArrow);
      }
    });
  }

  private static updateAllElementsToCurrentState(currentStep: ExecutionStep, layout: Layout): void {
    if (!currentStep || !currentStep.state) return;

    const { callStack, globals } = currentStep.state;
    const allLocals: Record<string, Variable> = {};
    
    callStack.forEach(frame => {
        Object.assign(allLocals, frame.locals);
    });

    layout.elements.forEach(el => {
        let updatedVar: Variable | undefined;

        if (el.type === 'variable' || el.type === 'pointer') {
            updatedVar = allLocals[el.data.name] || globals[el.data.name];
        }

        if (updatedVar) {
            el.data = { ...el.data, ...updatedVar };
        }
    });
  }

  private static updateGlobals(globals: Record<string, Variable>, layout: Layout, stepIndex: number): void {
    Object.values(globals).forEach((variable: Variable) => {
      if (variable.birthStep !== undefined && variable.birthStep > stepIndex) return;
      const globalId = `global-${variable.address}`;
      
      if (!this.elementHistory.has(globalId)) {
        const isInitialized = variable.value !== undefined;
        const globalElement: LayoutElement = {
          id: globalId,
          type: 'global',
          x: layout.globalPanel.x + 10,
          y: layout.globalPanel.y + HEADER_HEIGHT + (layout.globalPanel.children!.length * (70 + ELEMENT_SPACING)),
          width: GLOBAL_PANEL_WIDTH - 20,
          height: 70,
          parentId: 'global-panel',
          stepId: variable.birthStep ?? stepIndex,
          data: { ...variable, state: isInitialized ? 'initialized' : 'declared' },
        };
        layout.globalPanel.children!.push(globalElement);
        layout.elements.push(globalElement);
        this.elementHistory.set(globalId, globalElement);
        this.createdInStep.set(globalId, variable.birthStep ?? stepIndex);
      }
    });
  }

  private static getNextCursorY(parent: LayoutElement): number {
    if (!parent.children || parent.children.length === 0) {
      return parent.y + HEADER_HEIGHT;
    }
    const lastChild = parent.children[parent.children.length - 1];
    return lastChild.y + lastChild.height + ELEMENT_SPACING;
  }

  private static updateContainerHeights(layout: Layout): void {
    const updateHeight = (element: LayoutElement): number => {
      if (!element.children || element.children.length === 0) {
        return element.y + element.height;
      }
      let maxY = element.y + HEADER_HEIGHT;
      element.children.forEach(child => {
        const childBottom = updateHeight(child);
        maxY = Math.max(maxY, childBottom);
      });
      element.height = maxY - element.y + ELEMENT_SPACING;
      return maxY + ELEMENT_SPACING;
    };
    updateHeight(layout.mainFunction);
    updateHeight(layout.globalPanel);
    if (layout.arrayPanel) {
      updateHeight(layout.arrayPanel);
    }
  }
}