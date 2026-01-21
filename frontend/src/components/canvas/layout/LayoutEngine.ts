/**
 * LayoutEngine - ENHANCED WITH ARRAY SUPPORT
 * 
 * Calculates positions for all elements including arrays in separate panel
 * Arrays are NEVER rendered inside stack frames - they get their own panel
 */

import { 
  MemoryState, 
  ExecutionStep, 
  Variable, 
  ExecutionTrace,
} from '@types/index';
import { 
  isArray, 
  createArrayInfo, 
  detectUpdatedIndices,
  ArrayInfo 
} from '../../../utils/arrayUtils';

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
    referencesArray?: string; // For pointer -> array connections
    [key: string]: any;
  };
}

export interface Layout {
  mainFunction: LayoutElement;
  globalPanel: LayoutElement;
  arrayPanel: LayoutElement | null; // NEW: Array container
  elements: LayoutElement[];
  arrayReferences: LayoutElement[]; // NEW: Arrows from vars to arrays
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
const PANEL_GAP = 40; // Space between panels

export class LayoutEngine {
  private static elementHistory: Map<string, LayoutElement> = new Map();
  private static arrayHistory: Map<string, ArrayInfo> = new Map();
  private static parentStack: LayoutElement[] = [];
  private static createdInStep: Map<string, number> = new Map();

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
        x: 0, // Will be calculated
        y: 0, // Will be calculated
        width: GLOBAL_PANEL_WIDTH, 
        height: 60, 
        children: [], 
        stepId: 0 
      },
      arrayPanel: null, // Will be created if arrays exist
      elements: [],
      arrayReferences: [],
      width: canvasWidth,
      height: canvasHeight,
    };

    this.elementHistory.clear();
    this.arrayHistory.clear();
    this.createdInStep.clear();
    this.parentStack = [layout.mainFunction];

    // Process all steps up to current
    for (let i = 0; i <= currentStepIndex && i < executionTrace.steps.length; i++) {
      const step = executionTrace.steps[i];
      this.processStep(step, layout, i);
    }
    
    this.updateAllElementsToCurrentState(executionTrace.steps[currentStepIndex], layout);
    
    // Create array panel if arrays exist
    this.createArrayPanel(layout);
    
    // Position global panel (after array panel if it exists)
    this.positionGlobalPanel(layout);
    
    // Create array references (arrows from pointers to arrays)
    this.createArrayReferences(layout);
    
    this.updateContainerHeights(layout);

    return layout;
  }

  private static processStep(step: ExecutionStep, layout: Layout, stepIndex: number): void {
    const stepType: string = (step as any).eventType || (step as any).type;
    const { state, id } = step;
    const currentParent = this.parentStack[this.parentStack.length - 1];

    switch (stepType) {
      case 'declare': {
        if (!step.name) break;
        const varId = `var-${currentParent.id}-${step.name}`;
        if (this.elementHistory.has(varId)) break;

        const variable: any = {
          name: step.name,
          value: null,
          type: step.varType || 'int',
          primitive: step.varType || 'int',
          address: step.addr || '0x0',
          scope: 'local',
          isInitialized: false,
          isAlive: true,
          birthStep: stepIndex,
        };

        // Check if this is an array
        if (isArray(variable)) {
          this.handleArrayDeclaration(variable, 'main', stepIndex, layout);
        } else {
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
        }
        break;
      }

      case 'assign': {
        if (!step.name) break;
        const varId = `var-${currentParent.id}-${step.name}`;
        
        // Check if this is an array element assignment
        const arrayMatch = step.name.match(/^(\w+)\[/);
        if (arrayMatch) {
          this.handleArrayElementUpdate(step, stepIndex, layout);
          break;
        }
        
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
          // Create variable
          const variable: any = {
            name: step.name,
            value: step.value,
            type: 'int',
            primitive: 'int',
            address: step.addr || '0x0',
            scope: 'local',
            isInitialized: true,
            isAlive: true,
            birthStep: stepIndex,
          };

          if (isArray(variable)) {
            this.handleArrayDeclaration(variable, 'main', stepIndex, layout);
          } else {
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
            text: step.text || step.rawText,
            rawText: step.rawText,
            escapeInfo: step.escapeInfo || [],
          },
        };

        currentParent.children!.push(outputElement);
        layout.elements.push(outputElement);
        this.elementHistory.set(outputId, outputElement);
        this.createdInStep.set(outputId, stepIndex);
        break;
      }

      case 'variable_declaration': {
        if (!state?.callStack || state.callStack.length === 0) break;
        const frame = state.callStack[0];
        if (!frame.locals) break;

        Object.values(frame.locals).forEach((variable: Variable) => {
          if (variable.birthStep !== undefined && variable.birthStep !== stepIndex) return;

          const varId = `var-${variable.address}`;
          if (this.elementHistory.has(varId)) return;

          // Check if array
          if (isArray(variable)) {
            this.handleArrayDeclaration(variable, 'main', stepIndex, layout);
            return;
          }
          
          if (variable.primitive === 'class' || variable.primitive === 'struct') return;

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
        });
        break;
      }

      case 'function_call': {
        if (!state?.callStack || state.callStack.length === 0) break;
        const frame = state.callStack[0];
        
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
      
      case 'function_return': {
        if (this.parentStack.length > 1) {
          this.parentStack.pop();
        }
        break;
      }

      case 'program_start':
        break;

      case 'program_end':
        break;
        
      case 'line_execution':
        break;
    }

    if (state?.globals) {
      this.updateGlobals(state.globals, layout, stepIndex);
    }
  }

  // ============================================
  // ARRAY HANDLING
  // ============================================

  private static handleArrayDeclaration(
    variable: Variable,
    owner: string,
    stepIndex: number,
    layout: Layout
  ): void {
    const arrayInfo = createArrayInfo(variable, owner, stepIndex);
    if (!arrayInfo) return;

    // Store in array history
    this.arrayHistory.set(arrayInfo.id, arrayInfo);
    this.createdInStep.set(arrayInfo.id, stepIndex);

    console.log(`[LayoutEngine] Array declared: ${arrayInfo.name}`, arrayInfo);
  }

  private static handleArrayElementUpdate(
    step: ExecutionStep,
    stepIndex: number,
    layout: Layout
  ): void {
    // Parse array name and index from step.name (e.g., "arr[0]", "mat[1][2]")
    const match = step.name?.match(/^(\w+)\[(.+)\]$/);
    if (!match) return;

    const arrayName = match[1];
    const indexStr = match[2];
    const indices = indexStr.split('][').map(i => parseInt(i.trim(), 10));

    // Find the array in history
    const arrayId = `array-${arrayName}`;
    let arrayInfo = this.arrayHistory.get(arrayId);
    
    if (arrayInfo) {
      // Update the array's values
      const flatIndex = this.multiIndexToFlat(indices, arrayInfo.dimensions);
      if (flatIndex >= 0 && flatIndex < arrayInfo.values.length) {
        const oldValues = [...arrayInfo.values];
        arrayInfo.values[flatIndex] = step.value;
        arrayInfo.updatedIndices = [[...indices]];
        
        console.log(`[LayoutEngine] Array updated: ${arrayName}[${indices.join('][')}] = ${step.value}`);
      }
    }
  }

  private static createArrayPanel(layout: Layout): void {
    const arrays = Array.from(this.arrayHistory.values());
    
    if (arrays.length === 0) {
      layout.arrayPanel = null;
      return;
    }

    // Position: right of main function
    const arrayPanelX = MAIN_FUNCTION_X + MAIN_FUNCTION_WIDTH + PANEL_GAP;
    const arrayPanelY = MAIN_FUNCTION_Y;

    layout.arrayPanel = {
      id: 'array-panel',
      type: 'array_panel',
      x: arrayPanelX,
      y: arrayPanelY,
      width: 400, // Will be calculated dynamically
      height: 200, // Will be calculated dynamically
      children: [],
      data: { arrays },
      stepId: 0
    };
  }

  private static positionGlobalPanel(layout: Layout): void {
    if (layout.arrayPanel) {
      // Position below array panel
      layout.globalPanel.x = layout.arrayPanel.x;
      layout.globalPanel.y = layout.arrayPanel.y + layout.arrayPanel.height + PANEL_GAP;
    } else {
      // Position right of main
      layout.globalPanel.x = MAIN_FUNCTION_X + MAIN_FUNCTION_WIDTH + PANEL_GAP;
      layout.globalPanel.y = MAIN_FUNCTION_Y;
    }
  }

  private static createArrayReferences(layout: Layout): void {
    // Find all pointer variables that reference arrays
    layout.elements.forEach(el => {
      if (el.type === 'variable' && el.data) {
        const isPointer = el.data.type?.includes('*') || el.data.primitive?.includes('*');
        if (isPointer) {
          // Check if it points to an array
          const referencedArray = this.findReferencedArray(el.data.value);
          if (referencedArray) {
            const refElement: LayoutElement = {
              id: `ref-${el.id}-${referencedArray.id}`,
              type: 'array_reference',
              x: el.x + el.width,
              y: el.y + el.height / 2,
              width: 0,
              height: 0,
              data: {
                fromElement: el.id,
                toArray: referencedArray.id,
                variableName: el.data.name,
                arrayName: referencedArray.name
              },
              stepId: el.stepId
            };
            layout.arrayReferences.push(refElement);
          }
        }
      }
    });
  }

  private static findReferencedArray(address: any): ArrayInfo | null {
    for (const [_, arrayInfo] of this.arrayHistory) {
      if (arrayInfo.address === address) {
        return arrayInfo;
      }
    }
    return null;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private static multiIndexToFlat(indices: number[], dimensions: number[]): number {
    if (indices.length === 1) {
      return indices[0];
    }
    if (indices.length === 2) {
      const [i, j] = indices;
      return i * dimensions[1] + j;
    }
    if (indices.length === 3) {
      const [i, j, k] = indices;
      return i * dimensions[1] * dimensions[2] + j * dimensions[2] + k;
    }
    return indices[0];
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
        // Check if array
        if (isArray(variable)) {
          this.handleArrayDeclaration(variable, 'global', stepIndex, layout);
          return;
        }

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