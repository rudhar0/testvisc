// frontend/src/hooks/useAnimationController.ts

import { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useExecutionStore } from '@store/slices/executionSlice';
import AnimationEngine from '@/animations/AnimationEngine';
import type {
  AnimationSequence,
  VariableCreateAnimation,
  VariableUpdateAnimation,
  ElementDestroyAnimation,
} from '../types/animation.types';
import type { MemoryState, Variable, ExecutionStep } from '../types';

/**
 * Finds a variable by name in the current memory state (globals or top stack frame).
 * @param state The memory state.
 * @param varName The name of the variable to find.
 * @returns The variable object or undefined if not found.
 */
function findVarInState(state: MemoryState, varName: string): Variable | undefined {
  const topFrame = state.callStack?.[0];
  if (topFrame?.locals?.[varName]) {
      return topFrame.locals[varName];
  }
  if (state.globals?.[varName]) {
      return state.globals[varName];
  }
  // This part is a fallback, ideally the scope is known from the step
  for (const frame of state.callStack) {
    if (frame.locals?.[varName]) {
      return frame.locals[varName];
    }
  }
  return undefined;
}


export const useAnimationController = (stage: Konva.Stage | null) => {
  const previousStepRef = useRef<number>(-1);
  const previousMemoryStateRef = useRef<MemoryState | null>(null);

  const currentStep = useExecutionStore((state) => state.currentStep);
  const executionTrace = useExecutionStore((state) => state.executionTrace);

  useEffect(() => {
    if (stage) {
      AnimationEngine.initialize(stage);
    }
  }, [stage]);

  useEffect(() => {
    if (!stage || !executionTrace || currentStep === previousStepRef.current) {
      return;
    }

    const currentExecutionStep = executionTrace[currentStep] as ExecutionStep | undefined;
    if (!currentExecutionStep) return;

    const previousState = previousMemoryStateRef.current;
    const currentState = currentExecutionStep.state;
    const animations: AnimationSequence = [];

    console.log(`[AnimationController] Processing step ${currentStep}:`, currentExecutionStep.type);

    // New logic: switch based on the step type
    switch (currentExecutionStep.type) {
      case 'variable_declaration':
      case 'object_creation':
      case 'pointer_declaration':
      case 'array_declaration': {
        const varName = currentExecutionStep.variable || currentExecutionStep.objectName;
        if (varName) {
          const newVar = findVarInState(currentState, varName);
          if (newVar) {
            console.log(`[AnimationController] Detected creation: ${varName}`);
            animations.push({
              type: 'variable_create',
              target: `var-${newVar.address}`,
              duration: 500,
            } as VariableCreateAnimation);
          }
        }
        break;
      }

      case 'assignment': {
        const varName = currentExecutionStep.variable;
        if (varName && previousState) {
          const updatedVar = findVarInState(currentState, varName);
          const previousVar = findVarInState(previousState, varName);

          if (updatedVar && previousVar && JSON.stringify(updatedVar.value) !== JSON.stringify(previousVar.value)) {
            console.log(`[AnimationController] Detected update: ${varName}`);
            const varBoxGroup = stage.findOne<Konva.Group>(`#var-${updatedVar.address}`);
            if (varBoxGroup) {
              const valueTextNode = varBoxGroup.findOne<Konva.Text>('.variable-value');
              const backgroundRect = varBoxGroup.findOne<Konva.Rect>('.box-bg');
              if (valueTextNode && backgroundRect) {
                animations.push({
                  type: 'variable_update',
                  target: `var-${updatedVar.address}`,
                  duration: 1000,
                  from: previousVar.value,
                  to: updatedVar.value,
                  konvaContainer: varBoxGroup,
                  valueTextNode: valueTextNode,
                  backgroundRect: backgroundRect,
                } as VariableUpdateAnimation);
              }
            }
          }
        }
        break;
      }
      
      case 'object_destruction':
      case 'heap_free': {
        const address = currentExecutionStep.address;
        if (address) {
          const id = currentExecutionStep.type === 'heap_free' ? `heap-${address}`: `var-${address}`;
          console.log(`[AnimationController] Detected destruction for ${id}`);
          animations.push({
            type: 'element_destroy',
            target: id,
            duration: 500,
          } as ElementDestroyAnimation);
        }
        break;
      }

      case 'pointer_deref': {
        const varName = currentExecutionStep.variable;
        if (varName) {
            const ptrVar = findVarInState(currentState, varName);
            if(ptrVar) {
                console.log(`[AnimationController] Detected pointer dereference: ${varName}`);
                animations.push({
                    type: 'variable_access',
                    target: `var-${ptrVar.address}`,
                    duration: 500,
                });
            }
        }
        break;
      }

      case 'function_call': {
        const funcName = currentExecutionStep.function;
        if (funcName) {
            console.log(`[AnimationController] Detected function call: ${funcName}`);
            // Assuming the new stack frame has an ID related to the function name.
            // This might need adjustment based on the rendering logic.
            const frameId = `frame-${funcName}`;
            animations.push({
                type: 'function_call',
                target: frameId,
                duration: 600,
            });
        }
        break;
      }

      case 'function_return': {
        const funcName = currentExecutionStep.function;
        if (funcName) {
            console.log(`[AnimationController] Detected function return: ${funcName}`);
            const frameId = `frame-${funcName}`;
            animations.push({
                type: 'function_return',
                target: frameId,
                duration: 600,
            });
        }
        break;
      }

      case 'heap_allocation': {
        const address = currentExecutionStep.address;
        if (address) {
            console.log(`[AnimationController] Detected heap allocation at: ${address}`);
            animations.push({
                type: 'memory_allocation',
                target: `heap-${address}`,
                duration: 500,
            });
        }
        break;
      }

      case 'line_execution':
      case 'loop_start':
      case 'loop_end':
      case 'conditional_start':
      case 'conditional_branch':
        // For line-based events, we can trigger a line execution animation.
        // The target would be the ID of the line in the code editor component.
        // This requires coordination with the editor component, which is outside of the canvas.
        // For now, we just log it.
        console.log(`[AnimationController] Line execution event: ${currentExecutionStep.type} at line ${currentExecutionStep.line}`);
        break;

      case 'output':
        console.log(`[Program Output] ${currentExecutionStep.value}`);
        break;

      case 'input_request':
      case 'program_end':
        // These events do not have visual animations on the canvas.
        console.log(`[AnimationController] Non-visual event: ${currentExecutionStep.type}`);
        break;

      default:
        // This is a safety net for any unhandled step types.
        // The `currentExecutionStep.type` should be narrowed by the switch, but TS might complain.
        const unhandled: never = currentExecutionStep.type;
        console.warn(`[AnimationController] Unknown or unhandled step type: ${unhandled}`);
    }

    if (animations.length > 0) {
      const sequenceTimeline = AnimationEngine.createSequence(animations);
      AnimationEngine.addSequence(sequenceTimeline);
    }

    previousStepRef.current = currentStep;
    previousMemoryStateRef.current = currentState;

  }, [currentStep, executionTrace, stage]);
};
