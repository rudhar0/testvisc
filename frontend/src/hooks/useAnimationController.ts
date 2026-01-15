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
import type { MemoryState } from '../types/index';

export const useAnimationController = (stage: Konva.Stage | null) => {
  const previousStepRef = useRef<number>(-1);
  const previousMemoryStateRef = useRef<MemoryState | null>(null);

  // Use separate selectors to avoid creating new object references on every render
  // This prevents the "getSnapshot should be cached" warning and infinite loops
  const currentStep = useExecutionStore((state) => state.currentStep);
  const currentState = useExecutionStore((state) => state.currentState);

  // Initialize AnimationEngine with the Konva stage
  useEffect(() => {
    if (stage) {
      AnimationEngine.initialize(stage);
    }
  }, [stage]);

  /**
   * Effect to trigger animations when the current step changes.
   *
   * NOTE: Keep the dependency array as small as possible to avoid
   * accidental render/update loops. We intentionally *do not* depend
   * on `executionTrace` or `totalSteps` – the trace is effectively
   * immutable after it is set, and we only care about the current
   * step index + memory state.
   */
  useEffect(() => {
    if (!stage || currentStep === previousStepRef.current) {
      return;
    }

    // Get execution trace directly from store (not subscribed, accessed only when needed)
    // This prevents re-renders when the trace array reference changes
    const executionTrace = useExecutionStore.getState().executionTrace;

    // Basic safety guards – avoid accessing out‑of‑bounds indices
    if (
      !Array.isArray(executionTrace) ||
      currentStep < 0 ||
      currentStep >= executionTrace.length
    ) {
      previousStepRef.current = currentStep;
      previousMemoryStateRef.current = currentState;
      return;
    }

    const animations: AnimationSequence = [];
    const currentExecutionStep = executionTrace[currentStep];

    if (!currentExecutionStep || !currentState) {
      previousStepRef.current = currentStep;
      previousMemoryStateRef.current = currentState;
      return;
    }

    console.log(`[AnimationController] Processing step ${currentStep}:`, currentExecutionStep.type);

    // --- Detect Variable Creations / Updates ---
    // Check globals and current call stack frame
    const currentGlobals = currentState.globals || {};
    const currentCallFrame = currentState.callStack && currentState.callStack.length > 0 
      ? currentState.callStack[0] 
      : null;
    const currentLocals = currentCallFrame?.locals || {};
    const currentScopeVariables = { ...currentGlobals, ...currentLocals };
    
    const previousGlobals = previousMemoryStateRef.current?.globals || {};
    const previousCallFrame = previousMemoryStateRef.current?.callStack && previousMemoryStateRef.current.callStack.length > 0
      ? previousMemoryStateRef.current.callStack[0]
      : null;
    const previousLocals = previousCallFrame?.locals || {};
    const previousScopeVariables = { ...previousGlobals, ...previousLocals };

      for (const varName in currentScopeVariables) {
        const currentVar = currentScopeVariables[varName];
        const previousVar = previousScopeVariables[varName];

        if (!previousVar) {
          // Variable created
          console.log(`[AnimationController] Detected variable creation: ${currentVar.name}`);
          animations.push({
            type: 'variable_create',
            target: `var-${currentVar.address}`, // Assuming ID format
            duration: 500, // ms
          } as VariableCreateAnimation);
        } else if (currentVar.value !== previousVar.value) {
          // Variable updated
          console.log(`[AnimationController] Detected variable update: ${currentVar.name} from ${previousVar.value} to ${currentVar.value}`);

          const varBoxGroup = stage.findOne<Konva.Group>(`#var-${currentVar.address}`);
          if (varBoxGroup) {
            const valueTextNode = varBoxGroup.findOne<Konva.Text>('.variable-value');
            const backgroundRect = varBoxGroup.findOne<Konva.Rect>('.box-bg');

            if (valueTextNode && backgroundRect) {
              animations.push({
                type: 'variable_update',
                target: `var-${currentVar.address}`,
                duration: 1000, // ms
                from: previousVar.value,
                to: currentVar.value,
                konvaContainer: varBoxGroup,
                valueTextNode: valueTextNode,
                backgroundRect: backgroundRect,
              } as VariableUpdateAnimation);
            } else {
                console.warn(`[AnimationController] Could not find valueTextNode or backgroundRect for variable ${currentVar.name}`);
            }
          } else {
              console.warn(`[AnimationController] Could not find Konva group for variable ${currentVar.name} with ID #var-${currentVar.address}`);
          }
        }
      }

    // --- Detect Element Destruction (e.g., variables going out of scope) ---
    // This logic might need to be more sophisticated for nested scopes/functions
    if (previousMemoryStateRef.current) {
      const prevGlobals = previousMemoryStateRef.current.globals || {};
      const prevCallFrame = previousMemoryStateRef.current.callStack && previousMemoryStateRef.current.callStack.length > 0
        ? previousMemoryStateRef.current.callStack[0]
        : null;
      const prevLocals = prevCallFrame?.locals || {};
      const previousScopeVariables = { ...prevGlobals, ...prevLocals };
      
      const currGlobals = currentState.globals || {};
      const currCallFrame = currentState.callStack && currentState.callStack.length > 0
        ? currentState.callStack[0]
        : null;
      const currLocals = currCallFrame?.locals || {};
      const currentScopeVariables = { ...currGlobals, ...currLocals };

      for (const varName in previousScopeVariables) {
        const previousVar = previousScopeVariables[varName];
        if (!currentScopeVariables[varName]) {
          // Variable no longer exists in current scope (e.g., out of scope)
          console.log(`[AnimationController] Detected variable destruction: ${previousVar.name}`);
          animations.push({
            type: 'element_destroy',
            target: `var-${previousVar.address}`,
            duration: 500, // ms
          } as ElementDestroyAnimation);
        }
      }
    }


    // Add other animation types based on currentExecutionStep.type
    // For example:
    // if (currentExecutionStep.type === 'function_call') { ... }
    // if (currentExecutionStep.type === 'array_access') { ... }

    if (animations.length > 0) {
      const sequenceTimeline = AnimationEngine.createSequence(animations);
      AnimationEngine.addSequence(sequenceTimeline);
    }

    previousStepRef.current = currentStep;
    previousMemoryStateRef.current = currentState;

  }, [currentStep, currentState, stage]);
};
