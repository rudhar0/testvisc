// frontend/src/components/canvas/layout/LayoutEngine.ts
// ✅ COMPLETE FIX - Corrected Map syntax

import type {
  MemoryState,
  ExecutionStep,
  Variable,
  ExecutionTrace,
} from "@types/index";

export interface LayoutElement {
  id: string;
  type:
    | "main"
    | "variable"
    | "array"
    | "pointer"
    | "heap_pointer"
    | "loop"
    | "condition"
    | "output"
    | "input"
    | "global"
    | "function"
    | "function_call"
    | "struct"
    | "class"
    | "array_panel"
    | "array_reference";
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
    firstCellX?: number;
    firstCellY?: number;
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
  functionArrows: LayoutElement[];
  width: number;
  height: number;
}

const ELEMENT_SPACING = 8;
const INDENT_SIZE = 10;
const HEADER_HEIGHT = 50;
const MAIN_FUNCTION_X = 40;
const MAIN_FUNCTION_Y = 40;
const MAIN_FUNCTION_WIDTH = 400;
const GLOBAL_PANEL_WIDTH = 400;
const PANEL_GAP = 40;
const VARIABLE_HEIGHT = 70;
const FUNCTION_BOX_WIDTH = 400;
const FUNCTION_VERTICAL_SPACING = 100;

interface ArrayTrackerData {
  name: string;
  baseType: string;
  dimensions: number[];
  address: string;
  owner: string;
  birthStep: number;
  values: Map<string, any>;
  lastUpdateStep: number;
}

class ProgressiveArrayTracker {
  private arrays: Map<string, ArrayTrackerData> = new Map();
  private stateCache: Map<string, any> = new Map();

  createArray(
    name: string,
    baseType: string,
    dimensions: number[],
    address: string,
    owner: string,
    stepIndex: number,
    initializerValues?: any[]
  ) {
    if (!Array.isArray(dimensions) || dimensions.length === 0) {
      dimensions = [1];
    }

    const totalSize = dimensions.reduce((a, b) => a * b, 1);
    const valuesMap = new Map<string, any>();

    if (initializerValues && Array.isArray(initializerValues)) {
      initializerValues.forEach((val, flatIdx) => {
        if (flatIdx >= totalSize) return;
        const indices = this.flatIndexToIndices(flatIdx, dimensions);
        const key = indices.join(',');
        valuesMap.set(key, val);
      });
    }

    this.arrays.set(name, {
      name,
      baseType,
      dimensions,
      address,
      owner,
      birthStep: stepIndex,
      values: valuesMap,
      lastUpdateStep: stepIndex,
    });
    this.invalidateCache(name);
  }

  private flatIndexToIndices(flatIdx: number, dimensions: number[]): number[] {
    const indices: number[] = new Array(dimensions.length).fill(0);
    let remainder = flatIdx;
    for (let d = dimensions.length - 1; d >= 0; d--) {
      const dimSize = dimensions[d];
      indices[d] = remainder % dimSize;
      remainder = Math.floor(remainder / dimSize);
    }
    return indices;
  }

  updateArrayElement(
    name: string,
    indices: number[],
    value: any,
    stepIndex: number,
  ) {
    const arr = this.arrays.get(name);
    if (!arr) {
      console.warn(`Array ${name} not found, creating it...`);
      const dimensions = indices.map((idx) => idx + 1);
      this.createArray(name, 'int', dimensions, '0x0', 'main', stepIndex);
      const newArr = this.arrays.get(name);
      if (!newArr) return;
      
      const key = indices.join(",");
      newArr.values.set(key, value);
      newArr.lastUpdateStep = stepIndex;
      this.invalidateCache(name);
      return;
    }

    const key = indices.join(",");
    arr.values.set(key, value);
    arr.lastUpdateStep = stepIndex;
    this.invalidateCache(name);
  }

  private invalidateCache(name: string) {
    for (const key of this.stateCache.keys()) {
      if (key.startsWith(name + "-")) {
        this.stateCache.delete(key);
      }
    }
  }

  getArrayState(name: string, upToStep: number) {
    const cacheKey = `${name}-${upToStep}`;

    if (this.stateCache.has(cacheKey)) {
      return this.stateCache.get(cacheKey);
    }

    const arr = this.arrays.get(name);
    if (!arr || arr.birthStep > upToStep) return null;

    const totalSize = arr.dimensions.reduce((a, b) => a * b, 1);
    const progressiveValues: any[] = new Array(totalSize).fill(null);

    arr.values.forEach((value, key) => {
      const indices = key.split(",").map(Number);
      const flatIdx = this.calculateFlatIndex(indices, arr.dimensions);

      if (flatIdx >= 0 && flatIdx < totalSize) {
        progressiveValues[flatIdx] = value;
      }
    });

    const state = {
      ...arr,
      values: progressiveValues,
    };

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

    let flatIdx = 0;
    let multiplier = 1;
    for (let d = dimensions.length - 1; d >= 0; d--) {
      flatIdx += indices[d] * multiplier;
      multiplier *= dimensions[d];
    }
    return flatIdx;
  }
}

interface FunctionCallStackEntry {
  element: LayoutElement;
  depth: number;
}

export class LayoutEngine {
  private static elementHistory: Map<string, LayoutElement> = new Map();
  private static arrayTracker = new ProgressiveArrayTracker();
  private static parentStack: LayoutElement[] = [];
  private static createdInStep: Map<string, number> = new Map();
  private static updateArrows: Map<number, LayoutElement[]> = new Map();
  private static functionCallStack: Map<string, FunctionCallStackEntry[]> = new Map();
  private static functionArrows: LayoutElement[] = [];

  public static calculateLayout(
    executionTrace: ExecutionTrace,
    currentStepIndex: number,
    canvasWidth: number,
    canvasHeight: number,
  ): Layout {
    const layout: Layout = {
      mainFunction: {
        id: "main-function",
        type: "main",
        x: MAIN_FUNCTION_X,
        y: MAIN_FUNCTION_Y,
        width: MAIN_FUNCTION_WIDTH,
        height: 80,
        children: [],
        stepId: 0,
      },
      globalPanel: {
        id: "global-panel",
        type: "global",
        x: 0,
        y: 0,
        width: GLOBAL_PANEL_WIDTH,
        height: 60,
        children: [],
        stepId: 0,
      },
      arrayPanel: null,
      elements: [],
      arrayReferences: [],
      updateArrows: [],
      functionArrows: [],
      width: canvasWidth,
      height: canvasHeight,
    };

    this.elementHistory.clear();
    this.arrayTracker = new ProgressiveArrayTracker();
    this.createdInStep.clear();
    this.updateArrows.clear();
    this.functionCallStack.clear();
    this.functionArrows = [];
    this.parentStack = [layout.mainFunction];

    for (
      let i = 0;
      i <= currentStepIndex && i < executionTrace.steps.length;
      i++
    ) {
      const step = executionTrace.steps[i];
      this.processStep(step, layout, i, currentStepIndex);
    }

    this.createArrayPanel(layout, currentStepIndex);
    this.positionGlobalPanel(layout);
    this.createArrayReferences(layout, currentStepIndex);
    this.createUpdateArrows(layout, currentStepIndex);
    this.updateContainerHeights(layout);
    layout.functionArrows = this.functionArrows;

    return layout;
  }

  private static processStep(
    step: ExecutionStep,
    layout: Layout,
    stepIndex: number,
    currentStep: number,
  ): void {
    const stepType: string = (step as any).eventType || (step as any).type;
    const currentParent = this.parentStack[this.parentStack.length - 1];

    // ✅ HANDLE function_call (detect by function change)
    if (stepType === "var_declare" && (step as any).function !== "main") {
      const functionName = (step as any).function;
      
      // Check if this is a new function call
      if (!this.functionCallStack.has(functionName) || 
          this.functionCallStack.get(functionName)!.length === 0) {
        
        const depth = this.functionCallStack.get(functionName)?.length || 0;
        const isRecursive = depth > 0;
        
        // Calculate position
        const funcX = MAIN_FUNCTION_X + MAIN_FUNCTION_WIDTH + PANEL_GAP;
        const existingFunctions = Array.from(this.functionCallStack.values()).flat();
        const funcY = MAIN_FUNCTION_Y + existingFunctions.length * FUNCTION_VERTICAL_SPACING;
        
        const functionElement: LayoutElement = {
          id: `function-${functionName}-${stepIndex}`,
          type: "function_call",
          x: funcX,
          y: funcY,
          width: FUNCTION_BOX_WIDTH,
          height: 150,
          children: [],
          stepId: stepIndex,
          data: {
            functionName: functionName,
            returnType: "int",
            isRecursive: isRecursive,
            depth: depth,
            calledFrom: "main",
            parameters: [],
            localVarCount: 0,
            isActive: true,
            isReturning: false,
          },
        };

        layout.elements.push(functionElement);
        this.elementHistory.set(functionElement.id, functionElement);
        
        if (!this.functionCallStack.has(functionName)) {
          this.functionCallStack.set(functionName, []);
        }
        this.functionCallStack.get(functionName)!.push({ element: functionElement, depth });
        
        // Create arrow from main to function
        const arrow: LayoutElement = {
          id: `arrow-main-to-${functionName}-${stepIndex}`,
          type: "array_reference",
          subtype: "function_arrow",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          stepId: stepIndex,
          data: {
            fromX: MAIN_FUNCTION_X + MAIN_FUNCTION_WIDTH,
            fromY: MAIN_FUNCTION_Y + 60,
            toX: funcX,
            toY: funcY + 75,
            label: `call ${functionName}()`,
            isRecursive: isRecursive,
          },
        };
        
        this.functionArrows.push(arrow);
        this.parentStack.push(functionElement);
      }
    }

    // ✅ HANDLE var_assign
    if (stepType === "var_assign") {
      const { name, value, symbol } = step as any;
      const varName = name || symbol;

      if (!varName) return;

      const varId = `var-${currentParent.id}-${varName}`;

      if (!this.elementHistory.has(varId)) {
        const variable: any = {
          name: varName,
          value: value,
          type: "int",
          primitive: "int",
          address: "0x0",
          scope: "local",
          isInitialized: true,
          isAlive: true,
          birthStep: stepIndex,
        };

        const varElement: LayoutElement = {
          id: varId,
          type: "variable",
          subtype: "variable_initialization",
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - INDENT_SIZE * 2,
          height: VARIABLE_HEIGHT,
          parentId: currentParent.id,
          stepId: stepIndex,
          data: variable,
        };

        currentParent.children!.push(varElement);
        layout.elements.push(varElement);
        this.elementHistory.set(varId, varElement);
        this.createdInStep.set(varId, stepIndex);
      } else {
        const existingElement = this.elementHistory.get(varId)!;
        existingElement.data = {
          ...existingElement.data,
          value: value,
        };
      }
      return;
    }

    // ✅ HANDLE pointer_alias
    if (stepType === "pointer_alias") {
      const { name, symbol, aliasOf, decayedFromArray, pointsTo } = step as any;
      const ptrName = name || symbol;

      if (!ptrName) return;

      const ptrId = `ptr-${currentParent.id}-${ptrName}`;

      if (!this.elementHistory.has(ptrId)) {
        const pointerData: any = {
          name: ptrName,
          value: aliasOf ? `→ ${aliasOf}` : '→ unresolved',
          type: decayedFromArray ? `int*` : `void*`,
          primitive: "pointer",
          address: pointsTo?.address || "0x0",
          scope: "local",
          isInitialized: true,
          isAlive: true,
          birthStep: stepIndex,
          isPointer: true,
          pointsTo: pointsTo,
          decayedFromArray: decayedFromArray,
          aliasOf: aliasOf,
        };

        const ptrElement: LayoutElement = {
          id: ptrId,
          type: "heap_pointer",
          subtype: decayedFromArray ? "array_alias" : "pointer",
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - INDENT_SIZE * 2,
          height: VARIABLE_HEIGHT,
          parentId: currentParent.id,
          stepId: stepIndex,
          data: pointerData,
          metadata: {
            referencesArray: aliasOf,
          },
        };

        currentParent.children!.push(ptrElement);
        layout.elements.push(ptrElement);
        this.elementHistory.set(ptrId, ptrElement);
        this.createdInStep.set(ptrId, stepIndex);
      }
      return;
    }

    // ✅ HANDLE array_create
    if (stepType === "array_create" || stepType === "array_declaration") {
      const { 
        name, 
        symbol, 
        baseType, 
        dimensions, 
        isInitializer, 
        initializerValues 
      } = step as any;
      const arrayName = name || symbol;
      const owner = (step as any).function || "main";
      const address = (step as any).address || "0x0";

      this.arrayTracker.createArray(
        arrayName,
        baseType,
        dimensions,
        address,
        owner,
        stepIndex,
        isInitializer ? initializerValues : undefined
      );

      const varId = `var-${currentParent.id}-${arrayName}`;
      if (!this.elementHistory.has(varId)) {
        const arrayRefVar: any = {
          name: arrayName,
          value: `→ array[${dimensions.join("][")}]`,
          type: `${baseType}[]`,
          primitive: `${baseType}[]`,
          address: address,
          scope: "local",
          isInitialized: true,
          isAlive: true,
          birthStep: stepIndex,
          isArrayReference: true,
          arrayName: arrayName,
          dimensions: dimensions,
        };

        const varElement: LayoutElement = {
          id: varId,
          type: "variable",
          subtype: "array_reference",
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - INDENT_SIZE * 2,
          height: VARIABLE_HEIGHT,
          parentId: currentParent.id,
          stepId: stepIndex,
          data: arrayRefVar,
          metadata: {
            referencesArray: arrayName,
          },
        };

        currentParent.children!.push(varElement);
        layout.elements.push(varElement);
        this.elementHistory.set(varId, varElement);
        this.createdInStep.set(varId, stepIndex);
      }

      return;
    }

    if (stepType === "array_index_assign" || stepType === "array_assignment") {
      const { name, symbol, indices, value } = step as any;
      const arrayName = name || symbol;
      this.arrayTracker.updateArrayElement(arrayName, indices, value, stepIndex);

      if (stepIndex === currentStep) {
        this.createArrayUpdateArrow(layout, arrayName, indices, stepIndex);
      }
      return;
    }

    switch (stepType) {
      case "output": {
        const outputId = `output-${stepIndex}`;
        if (this.elementHistory.has(outputId)) break;

        const outputElement: LayoutElement = {
          id: outputId,
          type: "output",
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - INDENT_SIZE * 2,
          height: 60,
          parentId: currentParent.id,
          stepId: stepIndex,
          data: {
            text: step.text || (step as any).rawText,
            rawText: (step as any).rawText,
          },
        };

        currentParent.children!.push(outputElement);
        layout.elements.push(outputElement);
        this.elementHistory.set(outputId, outputElement);
        break;
      }

      case "program_start":
      case "program_end":
        break;
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

    layout.arrayPanel = {
      id: "array-panel",
      type: "array_panel",
      x: arrayPanelX,
      y: arrayPanelY,
      width: 400,
      height: 200,
      children: [],
      data: { arrays },
      stepId: 0,
    };
  }

  private static createArrayUpdateArrow(
    layout: Layout,
    arrayName: string,
    indices: number[],
    stepIndex: number,
  ): void {
    if (!layout.arrayPanel) return;

    let varElement: LayoutElement | undefined;

    const searchForVariable = (children: LayoutElement[] | undefined): void => {
      if (!children) return;
      for (const child of children) {
        if (
          (child.type === "variable" || child.type === "heap_pointer") &&
          (child.data?.name === arrayName || child.data?.aliasOf === arrayName)
        ) {
          varElement = child;
          return;
        }
        if (child.children) {
          searchForVariable(child.children);
        }
      }
    };

    searchForVariable(layout.mainFunction.children);

    const fromX = varElement
      ? varElement.x + varElement.width
      : MAIN_FUNCTION_X + MAIN_FUNCTION_WIDTH;
    const fromY = varElement
      ? varElement.y + varElement.height / 2
      : MAIN_FUNCTION_Y + 100;

    const ARRAY_PANEL_HEADER = 50;
    const ARRAY_BOX_HEADER = 50;
    const ARRAY_BOX_PADDING = 12;
    const CELL_WIDTH = 60;
    const CELL_HEIGHT = 50;

    const firstCellX = layout.arrayPanel.x + ARRAY_BOX_PADDING + CELL_WIDTH / 2;
    const firstCellY = layout.arrayPanel.y + ARRAY_PANEL_HEADER + ARRAY_BOX_HEADER + ARRAY_BOX_PADDING + CELL_HEIGHT / 2;

    const arrow: LayoutElement = {
      id: `arrow-${arrayName}-${stepIndex}`,
      type: "array_reference",
      subtype: "update_arrow",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      stepId: stepIndex,
      data: {
        arrayName,
        indices,
        fromX,
        fromY,
        toX: firstCellX,
        toY: firstCellY,
      },
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
      layout.globalPanel.y =
        layout.arrayPanel.y + layout.arrayPanel.height + PANEL_GAP;
    } else {
      layout.globalPanel.x = MAIN_FUNCTION_X + MAIN_FUNCTION_WIDTH + PANEL_GAP;
      layout.globalPanel.y = MAIN_FUNCTION_Y;
    }
  }

  private static createArrayReferences(
    layout: Layout,
    currentStep: number,
  ): void {
    if (!layout.arrayPanel) return;

    const arrayRefVars = layout.elements.filter(
      (el) =>
        (el.metadata?.referencesArray || el.data?.aliasOf) &&
        el.stepId !== undefined &&
        el.stepId <= currentStep
    );

    const ARRAY_PANEL_HEADER = 50;
    const ARRAY_BOX_HEADER = 50;
    const ARRAY_BOX_PADDING = 12;
    const CELL_WIDTH = 60;
    const CELL_HEIGHT = 50;

    arrayRefVars.forEach((refVar) => {
      const arrayName = refVar.metadata?.referencesArray || refVar.data?.aliasOf;
      const array = layout.arrayPanel!.data?.arrays?.find(
        (arr: any) => arr.name === arrayName,
      );

      if (array) {
        const firstCellX = layout.arrayPanel!.x + ARRAY_BOX_PADDING + CELL_WIDTH / 2;
        const firstCellY = layout.arrayPanel!.y + ARRAY_PANEL_HEADER + ARRAY_BOX_HEADER + ARRAY_BOX_PADDING + CELL_HEIGHT / 2;

        const refArrow: LayoutElement = {
          id: `ref-${refVar.id}-${arrayName}`,
          type: "array_reference",
          subtype: "reference_arrow",
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
            toX: firstCellX,
            toY: firstCellY,
          },
        };

        layout.arrayReferences.push(refArrow);
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

      let maxChildBottom = element.y + HEADER_HEIGHT;

      element.children.forEach((child) => {
        const childBottom = updateHeight(child);
        maxChildBottom = Math.max(maxChildBottom, childBottom);
      });

      element.height = Math.max(
        80,
        maxChildBottom - element.y + ELEMENT_SPACING
      );

      return element.y + element.height;
    };

    updateHeight(layout.mainFunction);
    updateHeight(layout.globalPanel);
    if (layout.arrayPanel) {
      updateHeight(layout.arrayPanel);
    }
  }
}