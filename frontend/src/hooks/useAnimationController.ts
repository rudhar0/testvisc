// frontend/src/hooks/useAnimationController.ts - DEBUG VERSION

import { useEffect, useCallback } from 'react';
import Konva from 'konva';
import AnimationEngine from '@/animations/AnimationEngine';
import type { AnimationSequence } from '../types/animation.types';

export const useAnimationController = (stage: Konva.Stage | null, layer: Konva.Layer | null) => {
  // Initialize AnimationEngine with the Konva stage and layer
  useEffect(() => {
    if (stage && layer) {
      console.log('[useAnimationController] 🎬 Initializing AnimationEngine with stage and layer');
      AnimationEngine.initialize(stage, layer);
    }
  }, [stage, layer]);

  const addAnimationSequence = useCallback((animations: AnimationSequence) => {
    console.log('[useAnimationController] 🎭 addAnimationSequence called with:', animations.length, 'animations');
    
    if (animations.length > 0) {
      console.log('[useAnimationController] 📋 Animation details:', animations.map(a => ({
        type: a.type,
        target: a.target,
        duration: a.duration,
        hasKonvaObject: !!a.konvaObject
      })));
      
      console.log('[useAnimationController] ⚙️ Creating sequence timeline...');
      const sequenceTimeline = AnimationEngine.createSequence(animations);
      
      console.log('[useAnimationController] ✅ Timeline created, adding to engine');
      AnimationEngine.addSequence(sequenceTimeline);
      
      console.log('[useAnimationController] 🎯 Sequence added to AnimationEngine');
    } else {
      console.warn('[useAnimationController] ⚠️ No animations to add (empty array)');
    }
  }, []);

  const pauseAnimations = useCallback(() => {
    console.log('[useAnimationController] ⏸️ Pausing animations');
    AnimationEngine.pause();
  }, []);
  
  const resumeAnimations = useCallback(() => {
    console.log('[useAnimationController] ▶️ Resuming animations');
    AnimationEngine.resume();
  }, []);
  
  const clearAnimations = useCallback(() => {
    console.log('[useAnimationController] 🗑️ Clearing animations');
    AnimationEngine.clear();
  }, []);
  
  const skipCurrentAnimation = useCallback(() => {
    console.log('[useAnimationController] ⏭️ Skipping current animation');
    AnimationEngine.skipCurrent();
  }, []);
  
  const getAnimationStatus = useCallback(() => {
    const status = AnimationEngine.getStatus();
    console.log('[useAnimationController] 📊 Animation status:', status);
    return status;
  }, []);

  return {
    addAnimationSequence,
    pauseAnimations,
    resumeAnimations,
    clearAnimations,
    skipCurrentAnimation,
    getAnimationStatus,
  };
};