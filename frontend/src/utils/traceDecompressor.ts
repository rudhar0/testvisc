
// ============================================
// frontend/src/utils/traceDecompressor.ts
// COMPLETE IMPLEMENTATION
// ============================================
import type { ExecutionStep, MemoryState, AnimationConfig } from '@types/index';

class TraceDecompressor {
  decompressChunks(chunks: any[]): ExecutionStep[] {
    if (!chunks || chunks.length === 0) {
      console.warn('No chunks to decompress');
      return [];
    }

    const sortedChunks = [...chunks].sort((a, b) => a.chunkId - b.chunkId);
    const allSteps = sortedChunks.flatMap(chunk => chunk.steps || []);
    
    console.log(`🔄 Decompressing ${allSteps.length} steps from ${chunks.length} chunks...`);
    
    const decompressed = this.reconstructStates(allSteps);
    
    console.log(`✅ Decompressed ${decompressed.length} steps`);
    
    return decompressed;
  }

  private reconstructStates(compressedSteps: any[]): ExecutionStep[] {
    const fullSteps: ExecutionStep[] = [];
    
    let currentState: MemoryState = {
      globals: {},
      stack: [],
      heap: {},
      callStack: []
    };
    
    for (const step of compressedSteps) {
      if (step.stateDiff !== undefined && step.stateDiff !== null) {
        currentState = this.applyStateDiff(currentState, step.stateDiff);
      }
      
      const animation = this.decompressAnimation(step.animation);
      
      const fullStep: ExecutionStep = {
        id: step.id,
        type: step.type,
        line: step.line,
        explanation: step.explanation,
        state: this.cloneState(currentState),
        animation,
      };
      
      if (step.pauseExecution) {
        fullStep.pauseExecution = true;
      }
      
      if (step.inputRequest) {
        fullStep.inputRequest = step.inputRequest;
      }
      
      fullSteps.push(fullStep);
    }
    
    return fullSteps;
  }

  private applyStateDiff(currentState: MemoryState, diff: any): MemoryState {
    if (!diff || (typeof diff === 'object' && Object.keys(diff).length === 0)) {
      return currentState;
    }
    
    const newState = this.cloneState(currentState);
    
    if (diff.globals) {
      newState.globals = { ...newState.globals };
      
      for (const key in diff.globals) {
        if (diff.globals[key] === null) {
          delete newState.globals[key];
        } else {
          newState.globals[key] = diff.globals[key];
        }
      }
    }
    
    if (diff.stack !== undefined) {
      newState.stack = diff.stack;
    }
    
    if (diff.heap) {
      newState.heap = { ...newState.heap };
      
      for (const key in diff.heap) {
        if (diff.heap[key] === null) {
          delete newState.heap[key];
        } else {
          newState.heap[key] = diff.heap[key];
        }
      }
    }
    
    if (diff.callStack !== undefined) {
      newState.callStack = diff.callStack;
    }
    
    return newState;
  }

  private decompressAnimation(compressed: any): AnimationConfig | null {
    if (!compressed) return null;
    
    const animation: AnimationConfig = {
      type: compressed.t || compressed.type,
      target: compressed.tg || compressed.target,
      duration: compressed.d || compressed.duration || 500,
    };
    
    if (compressed.e || compressed.effect) {
      animation.effect = compressed.e || compressed.effect;
    }
    
    if (compressed.el || compressed.element) {
      animation.element = compressed.el || compressed.element;
    }
    
    if (compressed.fid || compressed.frameId) {
      animation.frameId = compressed.fid || compressed.frameId;
    }
    
    return animation;
  }

  private cloneState(state: MemoryState): MemoryState {
    return JSON.parse(JSON.stringify(state));
  }
}

export const traceDecompressor = new TraceDecompressor();
export default traceDecompressor;
