import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ExecutionStep, ExecutionTrace, MemoryState } from '@types/index';
import { DEFAULTS } from '@constants/index';

export interface ExecutionState {
  // Trace data
  executionTrace: ExecutionStep[];
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
  
  // Actions
  setTrace: (trace: ExecutionTrace) => void;
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
  
  // Computed
  getCurrentStep: () => ExecutionStep | null;
  canStepForward: () => boolean;
  canStepBackward: () => boolean;
}

export const useExecutionStore = create<ExecutionState>()(
  immer((set, get) => ({
    // Initial state
    executionTrace: [],
    totalSteps: 0,
    currentStep: 0,
    isPlaying: false,
    isPaused: false,
    isAnalyzing: false,
    speed: DEFAULTS.PLAYBACK_SPEED,
    currentState: null,
    analysisProgress: 0,
    analysisStage: 'idle',

    // Actions
    setTrace: (trace: ExecutionTrace) =>
      set((state) => {
        state.executionTrace = trace.steps;
        state.totalSteps = trace.totalSteps;
        state.currentStep = 0;
        state.isAnalyzing = false;
        state.analysisProgress = 100;
        state.analysisStage = 'complete';
        
        // Set initial state
        if (trace.steps.length > 0) {
          state.currentState = trace.steps[0].state;
        }
      }),

    setCurrentStep: (step: number) =>
      set((state) => {
        const validStep = Math.max(0, Math.min(step, state.totalSteps - 1));
        state.currentStep = validStep;
        
        // Update current state
        if (state.executionTrace[validStep]) {
          state.currentState = state.executionTrace[validStep].state;
          
          // Check if this step requires input pause
          if (state.executionTrace[validStep].pauseExecution) {
            state.isPaused = true;
            state.isPlaying = false;
          }
        }
      }),

    stepForward: () =>
      set((state) => {
        if (state.currentStep < state.totalSteps - 1) {
          state.currentStep++;
          
          // Update current state
          if (state.executionTrace[state.currentStep]) {
            state.currentState = state.executionTrace[state.currentStep].state;
            
            // Check if this step requires input pause
            if (state.executionTrace[state.currentStep].pauseExecution) {
              state.isPaused = true;
              state.isPlaying = false;
            }
          }
        } else {
          // Reached end, stop playing
          state.isPlaying = false;
        }
      }),

    stepBackward: () =>
      set((state) => {
        if (state.currentStep > 0) {
          state.currentStep--;
          
          // Update current state
          if (state.executionTrace[state.currentStep]) {
            state.currentState = state.executionTrace[state.currentStep].state;
          }
        }
      }),

    jumpToStep: (step: number) =>
      set((state) => {
        const validStep = Math.max(0, Math.min(step, state.totalSteps - 1));
        state.currentStep = validStep;
        
        // Update current state
        if (state.executionTrace[validStep]) {
          state.currentState = state.executionTrace[validStep].state;
        }
      }),

    play: () =>
      set((state) => {
        state.isPlaying = true;
        state.isPaused = false;
      }),

    pause: () =>
      set((state) => {
        state.isPlaying = false;
        state.isPaused = true;
      }),

    reset: () =>
      set((state) => {
        state.currentStep = 0;
        state.isPlaying = false;
        state.isPaused = false;
        
        // Reset to initial state
        if (state.executionTrace.length > 0) {
          state.currentState = state.executionTrace[0].state;
        }
      }),

    setSpeed: (speed: number) =>
      set((state) => {
        state.speed = speed;
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
  }))
);