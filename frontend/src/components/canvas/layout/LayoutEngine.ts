/**
 * LayoutEngine - Calculates positions for all elements in the canvas
 * 
 * Processes execution steps to generate a visual layout for rendering.
 * Supports C++ features like classes, objects, and pointers.
 */

import { 
  MemoryState, 
  ExecutionStep, 
  Variable, 
  ClassMember,
  CallFrame,
  ExecutionTrace,
} from '@types/index';

export interface LayoutElement {
  id: string;
  type: 'main' | 'variable' | 'array' | 'pointer' | 'loop' | 'condition' | 'output' | 'input' | 'global' | 'function' | 'struct' | 'class';
  subtype?: ElementSubtype;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
  children?: LayoutElement[];
  data?: any;
  stepId?: number; // The step when this element was FIRST CREATED
  metadata?: {
    isMultiple?: boolean;
    relatedElements?: string[];
    [key: string]: any;
  };
}

export interface Layout {
  mainFunction: LayoutElement;
  globalPanel: LayoutElement;
  elements: LayoutElement[];
  width: number;
  height: number;
}

const ELEMENT_SPACING = 16;
const INDENT_SIZE = 20;
const HEADER_HEIGHT = 40;
const MAIN_FUNCTION_X = 40;
const MAIN_FUNCTION_Y = 40;
const MAIN_FUNCTION_WIDTH = 600;
const GLOBAL_PANEL_X = 720;
const GLOBAL_PANEL_Y = 40;
const GLOBAL_PANEL_WIDTH = 300;

export class LayoutEngine {
  private static elementHistory: Map<string, LayoutElement> = new Map();
  private static parentStack: LayoutElement[] = [];
  private static createdInStep: Map<string, number> = new Map();

  public static calculateLayout(
    executionTrace: ExecutionTrace,
    currentStepIndex: number,
    canvasWidth: number,
    canvasHeight: number
  ): Layout {
    const layout: Layout = {
      mainFunction: { id: 'main-function', type: 'main', x: MAIN_FUNCTION_X, y: MAIN_FUNCTION_Y, width: MAIN_FUNCTION_WIDTH, height: 80, children: [], stepId: 0 },
      globalPanel: { id: 'global-panel', type: 'global', x: GLOBAL_PANEL_X, y: GLOBAL_PANEL_Y, width: GLOBAL_PANEL_WIDTH, height: 60, children: [], stepId: 0 },
      elements: [],
      width: canvasWidth,
      height: canvasHeight,
    };

    this.elementHistory.clear();
    this.createdInStep.clear();
    this.parentStack = [layout.mainFunction];

    for (let i = 0; i <= currentStepIndex && i < executionTrace.steps.length; i++) {
      const step = executionTrace.steps[i];
      this.processStep(step, layout, i);
    }
    
    // Final pass to update data for all visible elements at the current step
    this.updateAllElementsToCurrentState(executionTrace.steps[currentStepIndex], layout);

    this.updateContainerHeights(layout);

    return layout;
  }

  private static processStep(step: ExecutionStep, layout: Layout, stepIndex: number): void {
    const { type, state, id } = step;
    const currentParent = this.parentStack[this.parentStack.length - 1];

    switch (type) {
      case 'object_creation': {
        if (step.birthStep && step.birthStep > stepIndex) return;

        const classId = `class-${step.address}`;
        if (this.elementHistory.has(classId)) return;

        console.log(`[LayoutEngine] Creating new class: ${step.objectName}`);
        const classElement: LayoutElement = {
          id: classId,
          type: 'class',
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - (INDENT_SIZE * 2),
          height: 80, // initial height
          parentId: currentParent.id,
          stepId: stepIndex,
          data: {
            name: step.objectName,
            type: step.className,
            ...step,
          },
          children: [],
        };

        currentParent.children!.push(classElement);
        layout.elements.push(classElement);
        this.elementHistory.set(classId, classElement);
        this.createdInStep.set(classId, stepIndex);

        this.parentStack.push(classElement);

        if (Array.isArray(step.value)) {
          step.value.forEach((member: ClassMember) => {
            const memberId = `var-${member.address}`;
            if (!this.elementHistory.has(memberId)) {
              const memberElement: LayoutElement = {
                id: memberId,
                type: 'variable',
                x: classElement.x + INDENT_SIZE,
                y: this.getNextCursorY(classElement),
                width: classElement.width - (INDENT_SIZE * 2),
                height: 70,
                parentId: classId,
                stepId: stepIndex,
                data: member,
              };
              classElement.children!.push(memberElement);
              layout.elements.push(memberElement);
              this.elementHistory.set(memberId, memberElement);
              this.createdInStep.set(memberId, stepIndex);
            }
          });
        }
        this.parentStack.pop();
        break;
      }
      
      case 'variable_declaration': {
        if (!state?.callStack || state.callStack.length === 0) break;
        const frame = state.callStack[0];
        if (!frame.locals) break;

        Object.values(frame.locals).forEach((variable: Variable) => {
          if (variable.birthStep !== undefined && variable.birthStep > stepIndex) return;
          if (variable.birthStep !== stepIndex) return; // Process declaration only at birth step

          const varId = `var-${variable.address}`;
          if (this.elementHistory.has(varId)) return;
          
          // Defer class creation to object_creation step
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
        
        // Check if we are entering a new function
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
        // Pop if not in main
        if (this.parentStack.length > 1) {
          this.parentStack.pop();
        }
        break;
      }

      // --- Add other new cases here ---
      case 'object_destruction':
        console.log(`[LayoutEngine] Step ${stepIndex}: object_destruction not yet implemented visually.`);
        break;
      case 'line_execution':
        // This usually doesn't create a new element, just highlights a line of code.
        break;
      case 'pointer_deref':
        console.log(`[LayoutEngine] Step ${stepIndex}: pointer_deref needs visual representation.`);
        break;

      // NOTE: Other cases from the old implementation can be brought here and adapted as needed.
      // For now, focusing on the core new requirements.
    }

    if (state?.globals) {
      this.updateGlobals(state.globals, layout, stepIndex);
    }
  }

  private static updateAllElementsToCurrentState(currentStep: ExecutionStep, layout: Layout): void {
      if (!currentStep || !currentStep.state) return;
  
      const { callStack, globals } = currentStep.state;
      const allLocals: Record<string, Variable> = {};
      
      // Flatten all locals from the call stack for easy lookup
      callStack.forEach(frame => {
          Object.assign(allLocals, frame.locals);
      });
  
      layout.elements.forEach(el => {
          let updatedVar: Variable | undefined;
  
          if (el.type === 'variable' || el.type === 'pointer' || el.type === 'array') {
              updatedVar = allLocals[el.data.name] || globals[el.data.name];
          } else if (el.type === 'class' || el.type === 'struct') {
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
          x: GLOBAL_PANEL_X + 10,
          y: GLOBAL_PANEL_Y + HEADER_HEIGHT + (layout.globalPanel.children!.length * (70 + ELEMENT_SPACING)),
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
  }
}
