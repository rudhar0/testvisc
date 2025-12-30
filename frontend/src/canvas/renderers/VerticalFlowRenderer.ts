// frontend/src/canvas/renderers/VerticalFlowRenderer.ts
/**
 * VerticalFlowRenderer - Renders execution flow top-to-bottom
 * 
 * This renderer implements the new execution model:
 * - Main function as root container
 * - Elements flow vertically inside parents
 * - Global panel on the right side
 * - Parent-child containment hierarchy
 */

import { ExecutionStep } from '@types/index';
import Konva from 'konva';
import { ProgramRoot } from '../elements/ProgramRoot';
import { MainFunction } from '../elements/MainFunction';
import { GlobalPanel } from '../elements/GlobalPanel';
import { Variable } from '../elements/Variable';
import { CanvasArray } from '../elements/CanvasArray';
import { Pointer } from '../elements/Pointer';
import { Loop } from '../elements/Loop';
import { Condition } from '../elements/Condition';
import { Output } from '../elements/Output';
import { Input } from '../elements/Input';
import { VerticalFlowLayout } from '../managers/VerticalFlowLayout';
import { CanvasElement } from '../core/CanvasElement';
import { Animation, AnimationSequence } from '../../types/animation.types';

const elementFactory: Record<string, any> = {
  variable_declaration: Variable,
  array_declaration: CanvasArray,
  pointer_declaration: Pointer,
  loop_start: Loop,
  conditional_start: Condition,
  output: Output,
  input_request: Input,
};

export interface CanvasState {
  root: CanvasElement | null;
  mainFunction: CanvasElement | null;
  globalPanel: CanvasElement | null;
  elements: Map<string, CanvasElement>;
  currentStep: number;
}

export class VerticalFlowRenderer {
  private layer: Konva.Layer;
  private state: CanvasState;

  constructor(layer: Konva.Layer) {
    this.layer = layer;
    this.state = {
      root: null,
      mainFunction: null,
      globalPanel: null,
      elements: new Map(),
      currentStep: -1,
    };
  }

  /**
   * Initialize root elements (ProgramRoot, MainFunction, GlobalPanel)
   */
  public initialize(): void {
    if (this.state.root) {
      return; // Already initialized
    }

    console.log('[VerticalFlowRenderer] Initializing root elements...');

    // Create root container
    const root = new ProgramRoot(this.layer);
    this.state.root = root;
    this.state.elements.set(root.id, root);

    // Create main function container (left side, vertical flow)
    const main = new MainFunction(root.id, this.layer);
    VerticalFlowLayout.place(main, root);
    root.addChild(main);
    this.state.mainFunction = main;
    this.state.elements.set(main.id, main);

    // Create global panel (right side)
    const globals = new GlobalPanel(root.id, this.layer);
    globals.container.position({ x: 720, y: 40 }); // Right side position
    globals.layout = {
      x: 720,
      y: 40,
      width: 300,
      height: 0,
      cursorY: 60,
    };
    root.addChild(globals);
    this.state.globalPanel = globals;
    this.state.elements.set(globals.id, globals);

    console.log('[VerticalFlowRenderer] Root elements initialized');
  }

  /**
   * Rebuild canvas state up to a specific step
   */
  public async rebuildToStep(executionTrace: ExecutionStep[], targetStep: number): Promise<void> {
    console.log(`[VerticalFlowRenderer] Rebuilding canvas to step ${targetStep}`);

    // Ensure initialized
    if (!this.state.root) {
      this.initialize();
    }

    // Clear all elements except root elements
    this.clearNonRootElements();

    // Process each step from 0 to targetStep
    for (let stepIndex = 0; stepIndex <= targetStep && stepIndex < executionTrace.length; stepIndex++) {
      const step = executionTrace[stepIndex];
      // During rebuild, we don't want animations, so processStep with animate: false
      await this.processStep(step, false); 
    }

    this.state.currentStep = targetStep;
    this.layer.draw();
    console.log(`[VerticalFlowRenderer] Canvas rebuilt to step ${targetStep}`);
  }

  /**
   * Process a single step
   */
  public async processStep(step: ExecutionStep, animate: boolean = true): Promise<AnimationSequence | void> {
    if (!this.state.root || !this.state.mainFunction) {
      this.initialize();
    }

    const { type, ...payload } = step;
    const parent = this.getParentForStep(step);
    const animations: AnimationSequence = [];

    if (!parent) {
      console.warn(`[VerticalFlowRenderer] No parent found for step ${step.id}`);
      return;
    }

    // Handle element creation
    const ElementClass = elementFactory[type];
    if (ElementClass) {
      let elementId: string;

      // Determine ID based on element type
      if (type === 'variable_declaration' || type === 'array_declaration' || type === 'pointer_declaration') {
        elementId = `var-${(payload as any).address || step.id}`;
      } else if (type === 'output') {
        elementId = `output-${step.id}`;
      } else if (type === 'input_request') {
        elementId = `input-${step.id}`;
      } else {
        elementId = `step-${step.id}`;
      }

      // Skip if element already exists (this can happen during rebuilds where element was already processed)
      if (this.state.elements.has(elementId)) {
        return;
      }

      const newElement = new ElementClass(elementId, parent.id, this.layer, payload);

      // Place element using vertical flow layout
      VerticalFlowLayout.place(newElement, parent);
      parent.addChild(newElement);
      this.state.elements.set(elementId, newElement);

      if (!animate) {
        newElement.create(payload); // Call non-animating create
        this.layer.draw(); // Force immediate render
        return;
      }
      
      // If animating, get animation description
      const createAnimation = newElement.getCreateAnimation(payload);
      if (createAnimation) {
          animations.push(createAnimation);
      }

      // Update parent layout (non-animating visual update)
      VerticalFlowLayout.updateParentSize(parent);
    }
    // Handle element updates (e.g., assignments)
    else if (type === 'assignment') {
      const varName = (payload as any).name;
      // We need to find the specific element related to the assignment
      // This assumes 'Variable' elements have an id like 'var-address' or contain the varName
      const elementToUpdate = Array.from(this.state.elements.values()).find(
        el => el.elementType === 'Variable' && 
              ((payload as any).address && el.id === `var-${(payload as any).address}`) || 
              (el.subType === varName) // Fallback if id isn't address based
      );

      if (elementToUpdate) {
        if (!animate) {
            elementToUpdate.update(payload); // Call non-animating update
            this.layer.draw();
            return;
        }

        // If animating, get animation description
        const updateAnimation = elementToUpdate.getUpdateAnimation(payload);
        if (updateAnimation) {
            animations.push(updateAnimation);
        }
      }
    }

    this.state.currentStep = step.id;
    if (animate) {
        return animations;
    }
  }

  /**
   * Get parent element for a step based on execution context
   */
  private getParentForStep(step: ExecutionStep): CanvasElement | null {
    // For now, always use main function as parent
    // TODO: Implement proper parent detection based on call stack
    return this.state.mainFunction;
  }

  /**
   * Clear all elements except root elements
   */
  private clearNonRootElements(): void {
    const rootIds = ['program-root', 'main-function', 'global-panel'];
    const elementsToRemove: string[] = [];

    this.state.elements.forEach((element, id) => {
      if (!rootIds.includes(id)) {
        elementsToRemove.push(id);
      }
    });

    elementsToRemove.forEach(id => {
      const element = this.state.elements.get(id);
      if (element) {
        // Remove from parent
        const parent = this.state.elements.get(element.parentId || '');
        if (parent) {
          parent.children = parent.children.filter(child => child.id !== id);
          element.container.destroy();
        }
        this.state.elements.delete(id);
      }
    });

    // Reset cursors
    if (this.state.mainFunction) {
      this.state.mainFunction.layout.cursorY = 60;
    }
    if (this.state.globalPanel) {
      this.state.globalPanel.layout.cursorY = 60;
    }

    this.layer.draw();
  }

  /**
   * Get element by ID
   */
  public getElement(id: string): CanvasElement | undefined {
    return this.state.elements.get(id);
  }

  /**
   * Get input element that's waiting for input
   */
  public getWaitingInput(): Input | null {
    for (const element of this.state.elements.values()) {
      if (element.elementType === 'Input') {
        const inputElement = element as Input;
        if (inputElement.isWaiting) {
          return inputElement;
        }
      }
    }
    return null;
  }
}

