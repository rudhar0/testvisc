// frontend/src/hooks/useAnimationController.ts

import { useEffect, useCallback } from 'react';
import Konva from 'konva';
import AnimationEngine from '@/animations/AnimationEngine';
import type { AnimationSequence } from '../types/animation.types';

export const useAnimationController = (stage: Konva.Stage | null, layer: Konva.Layer | null) => {
  // Initialize AnimationEngine with the Konva stage and layer
  useEffect(() => {
    if (stage && layer) {
      AnimationEngine.initialize(stage, layer);
    }
  }, [stage, layer]);

  const addAnimationSequence = useCallback((animations: AnimationSequence) => {
    if (animations.length > 0) {
      const sequenceTimeline = AnimationEngine.createSequence(animations);
      AnimationEngine.addSequence(sequenceTimeline);
    }
  }, []);

  const pauseAnimations = useCallback(() => AnimationEngine.pause(), []);
  const resumeAnimations = useCallback(() => AnimationEngine.resume(), []);
  const clearAnimations = useCallback(() => AnimationEngine.clear(), []);
  const skipCurrentAnimation = useCallback(() => AnimationEngine.skipCurrent(), []);
  const getAnimationStatus = useCallback(() => AnimationEngine.getStatus(), []);

  return {
    addAnimationSequence,
    pauseAnimations,
    resumeAnimations,
    clearAnimations,
    skipCurrentAnimation,
    getAnimationStatus,
  };
};
