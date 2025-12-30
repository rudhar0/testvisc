import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ExecutionStep, ExecutionTrace, MemoryState } from '@types/index';
import { DEFAULTS } from '@constants/index';
import AnimationEngine from '../../animations/AnimationEngine';

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
  
  // Canvas rebuild flag (set to true when jumping to a step)
  needsCanvasRebuild: boolean;
  
  // Actions
  setTrace: (trace: ExecutionTrace) => void;
  addStep: (step: ExecutionStep) => void;
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
    state.executionTrace = trace.steps;
    state.totalSteps = trace.totalSteps;
    
    // Find first meaningful step (skip GDB setup steps)
    const firstMeaningfulStep = trace.steps.findIndex(step => 
      step.type !== 'program_start' || step.line > 0
    );
    
    state.currentStep = Math.max(0, firstMeaningfulStep);
    state.isAnalyzing = false;
    state.analysisProgress = 100;
    state.analysisStage = 'complete';
    state.needsCanvasRebuild = true; // Rebuild canvas when trace is loaded
    
    // Set initial state to first meaningful step
    if (trace.steps.length > 0) {
      state.currentState = trace.steps[state.currentStep].state;
    }
    
    console.log('✅ Trace loaded:', {
      totalSteps: trace.totalSteps,
      startingAtStep: state.currentStep,
      firstStep: trace.steps[state.currentStep],
      hasState: !!trace.steps[state.currentStep]?.state,
      hasCallStack: !!trace.steps[state.currentStep]?.state?.callStack
    });
  }),


    addStep: (step: ExecutionStep) => set(state => {
      state.executionTrace.push(step);
      state.totalSteps = state.executionTrace.length;
      state.currentStep = state.totalSteps - 1;
      state.currentState = step.state;
    }),

    clearTrace: () => set(state => {
      state.executionTrace = [];
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
            
            console.log('➡️ Step forward:', state.currentStep, {
              type: state.executionTrace[state.currentStep].type,
              line: state.executionTrace[state.currentStep].line,
              pauseExecution: state.executionTrace[state.currentStep].pauseExecution,
            });
            
            // Check if this step requires input pause
            if (state.executionTrace[state.currentStep].pauseExecution) {
              state.isPaused = true;
              state.isPlaying = false;
              console.log('⏸️ Playback paused due to pauseExecution flag on step:', state.currentStep);
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
      state.needsCanvasRebuild = true; // Rebuild when going backward
      
      // Update current state
      if (state.executionTrace[state.currentStep]) {
        state.currentState = state.executionTrace[state.currentStep].state;
        console.log('⬅️ Step backward:', {
          step: state.currentStep,
          type: state.executionTrace[state.currentStep].type,
          line: state.executionTrace[state.currentStep].line
        });
      }
      
      // Pause playback when stepping backward manually
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
        
        // If jumping backwards or more than 1 step forward, we need to rebuild canvas
        if (validStep < previousStep || validStep > previousStep + 1) {
          state.needsCanvasRebuild = true;
          console.log(`⏭️ Jumping to step ${validStep} (from ${previousStep}) - canvas rebuild required`);
        }
        
        state.currentStep = validStep;
        
        // Update current state
        if (state.executionTrace[validStep]) {
          state.currentState = state.executionTrace[validStep].state;
          console.log('⏭️ Jumped to step:', validStep);
        }
        
        // Pause playback when jumping
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
        console.log('▶️ Starting playback at step:', state.currentStep);
        state.isPlaying = true;
        state.isPaused = false;
        
        // Resume animations if paused
        AnimationEngine.resume();
        
        // Clear any existing interval
        if (state.playbackInterval) {
          clearInterval(state.playbackInterval);
        }
        
        // Calculate delay based on speed (1x = 1000ms, 2x = 500ms, etc.)
        const delay = 1000 / state.speed;
        console.log('⏱️ Playback interval delay:', delay, 'ms');
        
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
        
        // Pause animations
        AnimationEngine.pause();
      }),

    reset: () =>
      set((state) => {
        console.log('⏮️ Resetting to start');
        state.currentStep = 0;
        state.isPlaying = false;
        state.isPaused = false;
        state.needsCanvasRebuild = true; // Rebuild canvas on reset
        
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
          
          const delay = 1000 / speed; // Corrected delay calculation
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

    markCanvasRebuildComplete: () =>
      set((state) => {
        state.needsCanvasRebuild = false;
      }),
  }))
);

// Corrected delay calculation in setSpeed:
// The original code had 2000 / speed, it should be 1000 / speed for consistency.
// Also added console.log for pauseExecution in stepForward.