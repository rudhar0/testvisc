import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ExecutionStep, ExecutionTrace, MemoryState } from '@types/index';
import { DEFAULTS } from '@constants/index';
import AnimationEngine from '../../animations/AnimationEngine';

export interface ExecutionState {
  // Trace data
  executionTrace: ExecutionStep[];
  visualizationSteps: any[];
  totalSteps: number;
  currentStep: number;
  
  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  isAnalyzing: boolean;
  speed: number;
  
  // Current state
  currentState: MemoryState | null;
  
  // Analysis progress
  analysisProgress: number;
  analysisStage: string;
  
  // Playback interval
  playbackInterval: NodeJS.Timeout | null;
  
  // Canvas rebuild flag (set to true when jumping to a step)
  needsCanvasRebuild: boolean;
  
  // Actions
  setTrace: (trace: ExecutionTrace) => void;
  addStep: (step: ExecutionStep) => void;
  addVisualizationSteps: (steps: any[]) => void;
  clearTrace: () => void;
  setCurrentStep: (step: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToStep: (step: number) => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
  setAnalysisProgress: (progress: number, stage: string) => void;
  startAnalysis: () => void;
  markCanvasRebuildComplete: () => void;
  
  // Computed
  getCurrentStep: () => ExecutionStep | null;
  canStepForward: () => boolean;
  canStepBackward: () => boolean;
}

export const useExecutionStore = create<ExecutionState>()(
  immer((set, get) => ({
    // Initial state
    executionTrace: [],
    visualizationSteps: [],
    totalSteps: 0,
    currentStep: 0,
    isPlaying: false,
    isPaused: false,
    isAnalyzing: false,
    speed: DEFAULTS.PLAYBACK_SPEED,
    currentState: null,
    analysisProgress: 0,
    analysisStage: 'idle',
    playbackInterval: null,
    needsCanvasRebuild: false,

    // Actions
    setTrace: (trace: ExecutionTrace) =>
      set((state) => {
        // This is now used for setting the initial trace, but steps will be added dynamically
        state.executionTrace = trace.steps;
        state.totalSteps = trace.totalSteps;
        state.currentStep = 0;
        state.isAnalyzing = false;
        state.analysisProgress = 100;
        state.analysisStage = 'complete';
        state.needsCanvasRebuild = true;
        if (trace.steps.length > 0) {
          state.currentState = trace.steps[0].state;
        }
      }),

    addStep: (step: ExecutionStep) => set(state => {
      state.executionTrace.push(step);
      state.totalSteps = state.executionTrace.length;
      state.currentStep = state.totalSteps - 1;
      state.currentState = step.state;
    }),

    addVisualizationSteps: (steps: any[]) => set(state => {
      state.visualizationSteps.push(...steps);
    }),

    clearTrace: () => set(state => {
      state.executionTrace = [];
      state.visualizationSteps = [];
      state.totalSteps = 0;
      state.currentStep = 0;
      state.currentState = null;
      state.isAnalyzing = false;
      state.isPlaying = false;
      state.isPaused = false;
    }),

    setCurrentStep: (step: number) =>
      set((state) => {
        const validStep = Math.max(0, Math.min(step, state.totalSteps - 1));
        state.currentStep = validStep;
        
        if (state.executionTrace[validStep]) {
          state.currentState = state.executionTrace[validStep].state;
        }
      }),

    stepForward: () =>
      set((state) => {
        if (state.currentStep < state.totalSteps - 1) {
          state.currentStep++;
          if (state.executionTrace[state.currentStep]) {
            state.currentState = state.executionTrace[state.currentStep].state;
          }
        } else {
          state.isPlaying = false;
          if (state.playbackInterval) {
            clearInterval(state.playbackInterval);
            state.playbackInterval = null;
          }
        }
      }),

    stepBackward: () =>
  set((state) => {
    if (state.currentStep > 0) {
      state.currentStep--;
      state.needsCanvasRebuild = true; 
      if (state.executionTrace[state.currentStep]) {
        state.currentState = state.executionTrace[state.currentStep].state;
      }
      if (state.isPlaying) {
        state.isPlaying = false;
        state.isPaused = true;
        if (state.playbackInterval) {
          clearInterval(state.playbackInterval);
          state.playbackInterval = null;
        }
      }
    }
  }),

    jumpToStep: (step: number) =>
      set((state) => {
        const validStep = Math.max(0, Math.min(step, state.totalSteps - 1));
        const previousStep = state.currentStep;
        
        if (validStep < previousStep || validStep > previousStep + 1) {
          state.needsCanvasRebuild = true;
        }
        
        state.currentStep = validStep;
        
        if (state.executionTrace[validStep]) {
          state.currentState = state.executionTrace[validStep].state;
        }
        
        if (state.isPlaying) {
          state.isPlaying = false;
          state.isPaused = true;
          if (state.playbackInterval) {
            clearInterval(state.playbackInterval);
            state.playbackInterval = null;
          }
        }
      }),

    play: () =>
      set((state) => {
        state.isPlaying = true;
        state.isPaused = false;
        
        AnimationEngine.resume();
        
        if (state.playbackInterval) {
          clearInterval(state.playbackInterval);
        }
        
        const delay = 1000 / state.speed;
        
        state.playbackInterval = setInterval(() => {
          const current = get();
          
          if (current.currentStep < current.totalSteps - 1) {
            get().stepForward();
          } else {
            get().pause();
          }
        }, delay);
      }),

    pause: () =>
      set((state) => {
        state.isPlaying = false;
        state.isPaused = true;
        
        if (state.playbackInterval) {
          clearInterval(state.playbackInterval);
          state.playbackInterval = null;
        }
        
        AnimationEngine.pause();
      }),

    reset: () =>
      set((state) => {
        state.currentStep = 0;
        state.isPlaying = false;
        state.isPaused = false;
        state.needsCanvasRebuild = true; 
        
        if (state.playbackInterval) {
          clearInterval(state.playbackInterval);
          state.playbackInterval = null;
        }
        
        if (state.executionTrace.length > 0) {
          state.currentState = state.executionTrace[0].state;
        }
      }),

    setSpeed: (speed: number) =>
      set((state) => {
        state.speed = speed;
        
        if (state.isPlaying) {
          if (state.playbackInterval) {
            clearInterval(state.playbackInterval);
          }
          
          const delay = 1000 / speed;
          state.playbackInterval = setInterval(() => {
            const current = get();
            if (current.currentStep < current.totalSteps - 1) {
              get().stepForward();
            } else {
              get().pause();
            }
          }, delay);
        }
      }),

    setAnalyzing: (isAnalyzing: boolean) =>
      set((state) => {
        state.isAnalyzing = isAnalyzing;
        if (isAnalyzing) {
          state.analysisProgress = 0;
          state.analysisStage = 'starting';
        }
      }),

    setAnalysisProgress: (progress: number, stage: string) =>
      set((state) => {
        state.analysisProgress = progress;
        state.analysisStage = stage;
      }),

    startAnalysis: () =>
      set((state) => {
        state.isAnalyzing = true;
        state.analysisProgress = 0;
        state.analysisStage = 'parsing';
        state.executionTrace = [];
        state.visualizationSteps = [];
        state.totalSteps = 0;
        state.currentStep = 0;
        state.currentState = null;
      }),

    // Computed getters
    getCurrentStep: () => {
      const state = get();
      return state.executionTrace[state.currentStep] || null;
    },

    canStepForward: () => {
      const state = get();
      return state.currentStep < state.totalSteps - 1;
    },

    canStepBackward: () => {
      const state = get();
      return state.currentStep > 0;
    },

    markCanvasRebuildComplete: () =>
      set((state) => {
        state.needsCanvasRebuild = false;
      }),
  }))
);