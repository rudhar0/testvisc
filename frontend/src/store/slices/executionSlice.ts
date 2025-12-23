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
  
  // Playback interval
  playbackInterval: NodeJS.Timeout | null;
  
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
    playbackInterval: null,

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
        
        console.log('✅ Trace loaded:', {
          totalSteps: trace.totalSteps,
          firstStep: trace.steps[0],
          hasState: !!trace.steps[0]?.state,
          hasCallStack: !!trace.steps[0]?.state?.callStack
        });
      }),

    setCurrentStep: (step: number) =>
      set((state) => {
        const validStep = Math.max(0, Math.min(step, state.totalSteps - 1));
        state.currentStep = validStep;
        
        // Update current state
        if (state.executionTrace[validStep]) {
          state.currentState = state.executionTrace[validStep].state;
          
          console.log('📍 Step updated:', {
            step: validStep,
            type: state.executionTrace[validStep].type,
            hasState: !!state.executionTrace[validStep].state,
            callStackLength: state.executionTrace[validStep].state?.callStack?.length || 0
          });
          
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
            
            console.log('➡️ Step forward:', state.currentStep);
            
            // Check if this step requires input pause
            if (state.executionTrace[state.currentStep].pauseExecution) {
              state.isPaused = true;
              state.isPlaying = false;
            }
          }
        } else {
          // Reached end, stop playing
          state.isPlaying = false;
          if (state.playbackInterval) {
            clearInterval(state.playbackInterval);
            state.playbackInterval = null;
          }
          console.log('⏸️ Reached end of trace');
        }
      }),

    stepBackward: () =>
      set((state) => {
        if (state.currentStep > 0) {
          state.currentStep--;
          
          // Update current state
          if (state.executionTrace[state.currentStep]) {
            state.currentState = state.executionTrace[state.currentStep].state;
            console.log('⬅️ Step backward:', state.currentStep);
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
          console.log('⏭️ Jumped to step:', validStep);
        }
      }),

    play: () =>
      set((state) => {
        console.log('▶️ Starting playback at step:', state.currentStep);
        state.isPlaying = true;
        state.isPaused = false;
        
        // Clear any existing interval
        if (state.playbackInterval) {
          clearInterval(state.playbackInterval);
        }
        
        // Calculate delay based on speed (1x = 1000ms, 2x = 500ms, etc.)
        const delay = 1000 / state.speed;
        
        // Start playback interval
        state.playbackInterval = setInterval(() => {
          const current = get();
          
          if (current.currentStep < current.totalSteps - 1) {
            get().stepForward();
          } else {
            // End of trace
            get().pause();
          }
        }, delay);
      }),

    pause: () =>
      set((state) => {
        console.log('⏸️ Pausing playback');
        state.isPlaying = false;
        state.isPaused = true;
        
        // Clear interval
        if (state.playbackInterval) {
          clearInterval(state.playbackInterval);
          state.playbackInterval = null;
        }
      }),

    reset: () =>
      set((state) => {
        console.log('⏮️ Resetting to start');
        state.currentStep = 0;
        state.isPlaying = false;
        state.isPaused = false;
        
        // Clear interval
        if (state.playbackInterval) {
          clearInterval(state.playbackInterval);
          state.playbackInterval = null;
        }
        
        // Reset to initial state
        if (state.executionTrace.length > 0) {
          state.currentState = state.executionTrace[0].state;
        }
      }),

    setSpeed: (speed: number) =>
      set((state) => {
        console.log('⚡ Speed changed to:', speed);
        state.speed = speed;
        
        // If currently playing, restart interval with new speed
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