/**
 * LayoutEngine - Calculates positions for all elements in the canvas
 * 
 * This engine implements the top-to-bottom flow model:
 * - Main function as root container (left side)
 * - Elements flow vertically inside parents
 * - Global panel on the right side
 * - Parent-child containment hierarchy
 */

import { MemoryState, ExecutionStep } from '@types/index';
import { ElementTypeDetector, ElementSubtype } from '@types/element.types';

export interface LayoutElement {
  id: string;
  type: 'main' | 'variable' | 'array' | 'pointer' | 'loop' | 'condition' | 'output' | 'input' | 'global' | 'function';
  subtype?: ElementSubtype; // Subtype for detailed element classification
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
  children?: LayoutElement[];
  data?: any;
  stepId?: number; // Track which step created this element
  metadata?: {
    isMultiple?: boolean; // For multiple variable declarations
    relatedElements?: string[]; // Related element IDs (e.g., pointer arrows)
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
const MAIN_FUNCTION_X = 40;
const MAIN_FUNCTION_Y = 40;
const MAIN_FUNCTION_WIDTH = 600;
const GLOBAL_PANEL_X = 720;
const GLOBAL_PANEL_Y = 40;
const GLOBAL_PANEL_WIDTH = 300;

export class LayoutEngine {
  private static elementHistory: Map<string, LayoutElement> = new Map();
  private static parentStack: LayoutElement[] = [];

  /**
   * Calculate layout based on execution trace up to current step
   */
  public static calculateLayout(
    executionTrace: ExecutionStep[],
    currentStepIndex: number,
    canvasWidth: number,
    canvasHeight: number,
    previousLayout: Layout | null
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
      },
      globalPanel: {
        id: 'global-panel',
        type: 'global',
        x: GLOBAL_PANEL_X,
        y: GLOBAL_PANEL_Y,
        width: GLOBAL_PANEL_WIDTH,
        height: 60,
        children: [],
      },
      elements: [],
      width: canvasWidth,
      height: canvasHeight,
    };

    // Reset state
    this.elementHistory.clear();
    this.parentStack = [layout.mainFunction];

    // Process steps up to current step
    for (let i = 0; i <= currentStepIndex && i < executionTrace.length; i++) {
      const step = executionTrace[i];
      this.processStep(step, layout);
    }

    // Update container heights
    this.updateContainerHeights(layout);

    // Debug logging
    console.log('[LayoutEngine] Layout calculated:', {
      currentStep: currentStepIndex,
      mainFunctionChildren: layout.mainFunction.children?.length || 0,
      totalElements: layout.elements.length,
      mainHeight: layout.mainFunction.height,
      elements: layout.elements.map(el => ({ id: el.id, type: el.type, x: el.x, y: el.y }))
    });

    return layout;
  }

  /**
   * Process a single execution step
   */
  private static processStep(step: ExecutionStep, layout: Layout): void {
    const { type, state, id } = step;
    const currentParent = this.parentStack[this.parentStack.length - 1];
    
    console.log(`[LayoutEngine] Processing step ${id}: type=${type}, hasState=${!!state}, hasCallStack=${!!state?.callStack}, localsCount=${state?.callStack?.[0]?.locals ? Object.keys(state.callStack[0].locals).length : 0}`);

    switch (type) {
      case 'function_call':
        if (step.state?.callStack && step.state.callStack.length > 0) {
          const frame = step.state.callStack[step.state.callStack.length - 1];
          const isMain = frame.function === 'main';
          const isInMain = currentParent.id === 'main-function';
          
          // Don't create nested function element for main() - main IS the container
          if (isMain && isInMain) {
            // Main function call - don't create nested element, just use main as parent
            console.log(`[LayoutEngine] Main function call detected, using main as parent`);
            // Don't push to parentStack, keep main as current parent
          } else {
            // Other function calls - determine if function is global or nested
            const isGlobalFunction = !isInMain || frame.function !== 'main';
            const subtype = ElementTypeDetector.detectFunctionSubtype(step, frame, isInMain);
            
            // If global function, add to global panel instead
            if (isGlobalFunction && subtype === 'function_body_global') {
              const globalParent = layout.globalPanel;
              const functionElement: LayoutElement = {
                id: `func-${frame.function}-${id}`,
                type: 'function',
                subtype,
                x: globalParent.x + 10,
                y: this.getNextCursorY(globalParent),
                width: globalParent.width - 20,
                height: 60,
                parentId: globalParent.id,
                stepId: id,
                data: frame,
                children: [],
              };
              globalParent.children!.push(functionElement);
              layout.elements.push(functionElement);
              this.parentStack.push(functionElement);
            } else {
              // Nested function inside main
              const functionElement: LayoutElement = {
                id: `func-${frame.function}-${id}`,
                type: 'function',
                subtype,
                x: currentParent.x + INDENT_SIZE,
                y: this.getNextCursorY(currentParent),
                width: currentParent.width - (INDENT_SIZE * 2),
                height: 60,
                parentId: currentParent.id,
                stepId: id,
                data: frame,
                children: [],
              };
              currentParent.children!.push(functionElement);
              layout.elements.push(functionElement);
              this.parentStack.push(functionElement);
            }
            console.log(`[LayoutEngine] Created function ${frame.function} with subtype: ${subtype}`);
          }
        }
        break;

      case 'function_return':
        if (this.parentStack.length > 1) {
          this.parentStack.pop();
        }
        break;

      case 'variable_declaration':
        if (state?.callStack && state.callStack.length > 0) {
          const frame = state.callStack[0];
          if (frame.locals) {
            const variables = Object.values(frame.locals);
            const newVariables = variables.filter((v: any) => !this.elementHistory.has(`var-${(v as any).address}`));
            const isMultiple = newVariables.length > 1 || step.declarationType === 'multiple';
            
            newVariables.forEach((variable: any, index: number) => {
              const previousVar = this.elementHistory.get(`var-${variable.address}`);
              const subtype = ElementTypeDetector.detectVariableSubtype(step, variable, previousVar);
              
              const nextY = this.getNextCursorY(currentParent);
              const varElement: LayoutElement = {
                id: `var-${variable.address}`,
                type: 'variable',
                subtype,
                x: currentParent.x + INDENT_SIZE,
                y: nextY,
                width: currentParent.width - (INDENT_SIZE * 2),
                height: 70,
                parentId: currentParent.id,
                stepId: id,
                data: variable,
                metadata: {
                  isMultiple,
                  indexInGroup: isMultiple ? index : undefined,
                },
              };
              currentParent.children!.push(varElement);
              layout.elements.push(varElement);
              this.elementHistory.set(varElement.id, varElement);
              console.log(`[LayoutEngine] Created variable ${variable.name} with subtype: ${subtype}`);
            });
          }
        }
        break;

      case 'array_declaration':
        if (state?.callStack && state.callStack.length > 0) {
          const frame = state.callStack[0];
          // Find arrays - check if primitive is 'array' or type contains []
          const arrays = Object.values(frame.locals || {}).filter(
            (v: any) => (v.primitive === 'array' || v.type?.includes('[')) && 
                       !this.elementHistory.has(`array-${v.address}`)
          );
          arrays.forEach((array: any) => {
            const subtype = ElementTypeDetector.detectArraySubtype(step);
            console.log(`[LayoutEngine] Creating array: ${array.name}, subtype: ${subtype}`);
            const arrayElement: LayoutElement = {
              id: `array-${array.address}`,
              type: 'array',
              subtype,
              x: currentParent.x + INDENT_SIZE,
              y: this.getNextCursorY(currentParent),
              width: currentParent.width - (INDENT_SIZE * 2),
              height: 120,
              parentId: currentParent.id,
              stepId: id,
              data: {
                ...array,
                values: array.values || []
              },
            };
            currentParent.children!.push(arrayElement);
            layout.elements.push(arrayElement);
            this.elementHistory.set(arrayElement.id, arrayElement);
          });
        }
        break;

      case 'pointer_declaration':
      case 'pointer_deref':
        if (state?.callStack && state.callStack.length > 0) {
          const frame = state.callStack[0];
          const pointers = Object.values(frame.locals || {}).filter(
            (v: any) => (v.primitive === 'pointer' || v.type?.includes('*')) && 
                       (v.birthStep === id || !this.elementHistory.has(`pointer-${v.address}`))
          );
          pointers.forEach((pointer: any) => {
            const existingPointer = this.elementHistory.get(`pointer-${pointer.address}`);
            const subtype = ElementTypeDetector.detectPointerSubtype(step, existingPointer);
            console.log(`[LayoutEngine] Processing pointer: ${pointer.name}, subtype: ${subtype}`);
            
            if (!existingPointer) {
              // New pointer
              const pointerElement: LayoutElement = {
                id: `pointer-${pointer.address}`,
                type: 'pointer',
                subtype,
                x: currentParent.x + INDENT_SIZE,
                y: this.getNextCursorY(currentParent),
                width: currentParent.width - (INDENT_SIZE * 2),
                height: 70,
                parentId: currentParent.id,
                stepId: id,
                data: pointer,
                metadata: {
                  pointsTo: pointer.pointsTo,
                  showArrow: subtype === 'pointer_arrow' || subtype === 'pointer_dereference',
                },
              };
              currentParent.children!.push(pointerElement);
              layout.elements.push(pointerElement);
              this.elementHistory.set(pointerElement.id, pointerElement);
            } else {
              // Update existing pointer
              const existingIndex = layout.elements.findIndex(el => el.id === `pointer-${pointer.address}`);
              if (existingIndex >= 0) {
                layout.elements[existingIndex].data = pointer;
                layout.elements[existingIndex].subtype = subtype;
                layout.elements[existingIndex].stepId = id;
                layout.elements[existingIndex].metadata = {
                  ...layout.elements[existingIndex].metadata,
                  pointsTo: pointer.pointsTo,
                  showArrow: subtype === 'pointer_arrow' || subtype === 'pointer_dereference',
                };
                
                // Update in parent's children array
                const parentChildrenIndex = currentParent.children?.findIndex(child => child.id === `pointer-${pointer.address}`);
                if (parentChildrenIndex !== undefined && parentChildrenIndex >= 0 && currentParent.children) {
                  currentParent.children[parentChildrenIndex].data = pointer;
                  currentParent.children[parentChildrenIndex].subtype = subtype;
                  currentParent.children[parentChildrenIndex].stepId = id;
                }
              }
            }
          });
        }
        break;

      case 'output':
        // Check both step.stdout and state.stdout
        const outputValue = step.stdout || state?.stdout || step.explanation || '';
        const outputSubtype = ElementTypeDetector.detectOutputSubtype(step);
        console.log(`[LayoutEngine] Creating output element: ${outputValue}, subtype: ${outputSubtype}`);
        const outputElement: LayoutElement = {
          id: `output-${id}`,
          type: 'output',
          subtype: outputSubtype,
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - (INDENT_SIZE * 2),
          height: 50,
          parentId: currentParent.id,
          stepId: id,
          data: { value: outputValue },
        };
        currentParent.children!.push(outputElement);
        layout.elements.push(outputElement);
        break;

      case 'input_request':
        const inputSubtype = ElementTypeDetector.detectInputSubtype(step);
        console.log(`[LayoutEngine] Creating input element, subtype: ${inputSubtype}`);
        const inputElement: LayoutElement = {
          id: `input-${id}`,
          type: 'input',
          subtype: inputSubtype,
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - (INDENT_SIZE * 2),
          height: 60,
          parentId: currentParent.id,
          stepId: id,
          data: {
            ...step.inputRequest,
            value: undefined, // Will be set when user provides input
            isWaiting: true,
          },
        };
        currentParent.children!.push(inputElement);
        layout.elements.push(inputElement);
        break;

      case 'assignment':
        // Update existing variable value OR create if it doesn't exist (for variables declared in assignment)
        if (state?.callStack && state.callStack.length > 0) {
          const frame = state.callStack[0];
          if (frame.locals) {
            Object.values(frame.locals).forEach((variable: any) => {
              const existingVar = this.elementHistory.get(`var-${variable.address}`);
              if (!existingVar) {
                // Variable doesn't exist yet - create it (might be declared in assignment)
                const subtype = ElementTypeDetector.detectVariableSubtype(step, variable);
                console.log(`[LayoutEngine] Creating variable from assignment: ${variable.name} = ${variable.value}, subtype: ${subtype}`);
                const nextY = this.getNextCursorY(currentParent);
                const varElement: LayoutElement = {
                  id: `var-${variable.address}`,
                  type: 'variable',
                  subtype,
                  x: currentParent.x + INDENT_SIZE,
                  y: nextY,
                  width: currentParent.width - (INDENT_SIZE * 2),
                  height: 70,
                  parentId: currentParent.id,
                  stepId: id,
                  data: variable,
                };
                currentParent.children!.push(varElement);
                layout.elements.push(varElement);
                this.elementHistory.set(varElement.id, varElement);
              } else {
                // Update existing variable - change subtype to value_change
                const existingIndex = layout.elements.findIndex(el => el.id === `var-${variable.address}`);
                if (existingIndex >= 0) {
                  const oldData = layout.elements[existingIndex].data;
                  layout.elements[existingIndex].data = variable;
                  layout.elements[existingIndex].subtype = 'variable_value_change';
                  layout.elements[existingIndex].stepId = id; // Mark as updated
                  
                  // Also update in parent's children array
                  const parentChildrenIndex = currentParent.children?.findIndex(child => child.id === `var-${variable.address}`);
                  if (parentChildrenIndex !== undefined && parentChildrenIndex >= 0 && currentParent.children) {
                    currentParent.children[parentChildrenIndex].data = variable;
                    currentParent.children[parentChildrenIndex].subtype = 'variable_value_change';
                    currentParent.children[parentChildrenIndex].stepId = id;
                  }
                  
                  console.log(`[LayoutEngine] Updating variable ${variable.name}: ${oldData?.value} -> ${variable.value}`);
                }
              }
            });
          }
        }
        break;

      case 'loop_start':
        console.log(`[LayoutEngine] Creating loop element`);
        const loopElement: LayoutElement = {
          id: `loop-${id}`,
          type: 'loop',
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - (INDENT_SIZE * 2),
          height: 60,
          parentId: currentParent.id,
          stepId: id,
          data: { ...step, condition: step.explanation || 'loop' },
          children: [],
        };
        currentParent.children!.push(loopElement);
        layout.elements.push(loopElement);
        this.parentStack.push(loopElement);
        break;

      case 'loop_end':
        if (this.parentStack.length > 1 && this.parentStack[this.parentStack.length - 1].type === 'loop') {
          this.parentStack.pop();
        }
        break;

      case 'conditional_start':
      case 'conditional_branch':
        // Determine condition subtype from explanation
        let conditionSubtype: ElementSubtype = 'condition_if';
        if (step.explanation?.toLowerCase().includes('else if')) {
          conditionSubtype = 'condition_elseif';
        } else if (step.explanation?.toLowerCase().includes('else')) {
          conditionSubtype = 'condition_else';
        } else if (step.explanation?.toLowerCase().includes('switch')) {
          conditionSubtype = 'condition_switch';
        }
        
        // Only create on conditional_start, not on each branch
        if (type === 'conditional_start') {
          console.log(`[LayoutEngine] Creating condition element, subtype: ${conditionSubtype}`);
          const conditionElement: LayoutElement = {
            id: `condition-${id}`,
            type: 'condition',
            subtype: conditionSubtype,
            x: currentParent.x + INDENT_SIZE,
            y: this.getNextCursorY(currentParent),
            width: currentParent.width - (INDENT_SIZE * 2),
            height: 60,
            parentId: currentParent.id,
            stepId: id,
            data: step,
            children: [],
          };
          currentParent.children!.push(conditionElement);
          layout.elements.push(conditionElement);
          this.parentStack.push(conditionElement);
        }
        break;

      case 'heap_allocation':
      case 'heap_free':
        const heapSubtype = type === 'heap_allocation' ? 'heap_malloc' : 'heap_free';
        console.log(`[LayoutEngine] Creating heap element, subtype: ${heapSubtype}`);
        const heapElement: LayoutElement = {
          id: `heap-${id}`,
          type: 'heap',
          subtype: heapSubtype,
          x: currentParent.x + INDENT_SIZE,
          y: this.getNextCursorY(currentParent),
          width: currentParent.width - (INDENT_SIZE * 2),
          height: 80,
          parentId: currentParent.id,
          stepId: id,
          data: step,
        };
        currentParent.children!.push(heapElement);
        layout.elements.push(heapElement);
        break;
    }

    // Update globals
    if (state?.globals) {
      this.updateGlobals(state.globals, layout);
    }
  }

  /**
   * Update global panel with current globals
   */
  private static updateGlobals(globals: Record<string, any>, layout: Layout): void {
    layout.globalPanel.children = [];
    let globalCursorY = GLOBAL_PANEL_Y + 60;

    Object.values(globals).forEach((variable: any) => {
      const globalElement: LayoutElement = {
        id: `global-${variable.address}`,
        type: 'global',
        x: GLOBAL_PANEL_X + 10,
        y: globalCursorY,
        width: GLOBAL_PANEL_WIDTH - 20,
        height: 70,
        parentId: 'global-panel',
        data: variable,
      };
      layout.globalPanel.children!.push(globalElement);
      
      // Update if exists, otherwise add
      const existingIndex = layout.elements.findIndex(el => el.id === globalElement.id);
      if (existingIndex >= 0) {
        layout.elements[existingIndex] = globalElement;
      } else {
        layout.elements.push(globalElement);
      }
      
      globalCursorY += 70 + ELEMENT_SPACING;
    });
  }

  /**
   * Get next cursor Y position for a parent
   */
  private static getNextCursorY(parent: LayoutElement): number {
    if (!parent.children || parent.children.length === 0) {
      // Start below header (40px header + 20px padding)
      return parent.y + 60;
    }
    const lastChild = parent.children[parent.children.length - 1];
    // Calculate relative to parent's top
    const lastChildBottom = lastChild.y + lastChild.height;
    const nextY = lastChildBottom + ELEMENT_SPACING;
    console.log(`[LayoutEngine] getNextCursorY for ${parent.id}:`, {
      lastChildY: lastChild.y,
      lastChildHeight: lastChild.height,
      nextY
    });
    return nextY;
  }

  /**
   * Update container heights based on children
   */
  private static updateContainerHeights(layout: Layout): void {
    const updateHeight = (element: LayoutElement): number => {
      if (!element.children || element.children.length === 0) {
        return element.height;
      }

      let maxY = element.y + 60; // Header height
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

  /**
   * Detect changes between layouts for animation
   */
  public static detectChanges(
    currentLayout: Layout,
    previousLayout: Layout | null
  ): {
    newElements: LayoutElement[];
    updatedElements: LayoutElement[];
    removedElements: LayoutElement[];
  } {
    if (!previousLayout) {
    return {
        newElements: currentLayout.elements,
        updatedElements: [],
        removedElements: [],
      };
    }

    const currentIds = new Set(currentLayout.elements.map(el => el.id));
    const previousIds = new Set(previousLayout.elements.map(el => el.id));

    const newElements = currentLayout.elements.filter(el => !previousIds.has(el.id));
    const removedElements = previousLayout.elements.filter(el => !currentIds.has(el.id));

    const updatedElements = currentLayout.elements.filter(el => {
      if (!previousIds.has(el.id)) return false;
      const prevEl = previousLayout.elements.find(p => p.id === el.id);
      if (!prevEl) return false;
      
      // Check if position or data changed
      return (
        prevEl.x !== el.x ||
        prevEl.y !== el.y ||
        JSON.stringify(prevEl.data) !== JSON.stringify(el.data)
      );
    });

    return { newElements, updatedElements, removedElements };
  }
}
