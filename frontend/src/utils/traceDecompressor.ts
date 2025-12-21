/**
 * Trace Decompressor
 * Reconstructs full execution states from compressed diffs
 */

import type { ExecutionStep, MemoryState, AnimationConfig } from '@types/index';

class TraceDecompressor {
  /**
   * Decompress chunks received from backend
   */
  decompressChunks(chunks: any[]): ExecutionStep[] {
    if (!chunks || chunks.length === 0) {
      console.warn('No chunks to decompress');
      return [];
    }

    // Sort chunks by ID
    const sortedChunks = [...chunks].sort((a, b) => a.chunkId - b.chunkId);
    
    // Extract all steps
    const allSteps = sortedChunks.flatMap(chunk => chunk.steps || []);
    
    console.log(`🔄 Decompressing ${allSteps.length} steps from ${chunks.length} chunks...`);
    
    // Reconstruct full states
    const decompressed = this.reconstructStates(allSteps);
    
    console.log(`✅ Decompressed ${decompressed.length} steps`);
    
    return decompressed;
  }

  /**
   * Reconstruct full states from compressed diffs
   */
  private reconstructStates(compressedSteps: any[]): ExecutionStep[] {
    const fullSteps: ExecutionStep[] = [];
    
    // Initial empty state
    let currentState: MemoryState = {
      globals: {},
      stack: [],
      heap: {},
      callStack: []
    };
    
    for (const step of compressedSteps) {
      // Apply state diff to reconstruct full state
      if (step.stateDiff !== undefined && step.stateDiff !== null) {
        currentState = this.applyStateDiff(currentState, step.stateDiff);
      }
      
      // Decompress animation
      const animation = this.decompressAnimation(step.animation);
      
      // Create full step
      const fullStep: ExecutionStep = {
        id: step.id,
        type: step.type,
        line: step.line,
        explanation: step.explanation,
        state: this.cloneState(currentState), // Deep clone
        animation,
      };
      
      // Add optional fields
      if (step.pauseExecution) {
        fullStep.pauseExecution = true;
      }
      
      if (step.inputRequest) {
        fullStep.inputRequest = step.inputRequest;
      }
      
      if (step.variable) {
        (fullStep as any).variable = step.variable;
      }
      
      if (step.value !== undefined) {
        (fullStep as any).value = step.value;
      }
      
      if (step.oldValue !== undefined) {
        (fullStep as any).oldValue = step.oldValue;
      }
      
      if (step.newValue !== undefined) {
        (fullStep as any).newValue = step.newValue;
      }
      
      fullSteps.push(fullStep);
    }
    
    return fullSteps;
  }

  /**
   * Apply state diff to current state
   */
  private applyStateDiff(currentState: MemoryState, diff: any): MemoryState {
    // If diff is null/empty, return current state
    if (!diff || (typeof diff === 'object' && Object.keys(diff).length === 0)) {
      return currentState;
    }
    
    // Start with current state
    const newState = this.cloneState(currentState);
    
    // Apply global changes
    if (diff.globals) {
      newState.globals = { ...newState.globals };
      
      for (const key in diff.globals) {
        if (diff.globals[key] === null) {
          // Deletion
          delete newState.globals[key];
        } else {
          // Addition or update
          newState.globals[key] = diff.globals[key];
        }
      }
    }
    
    // Apply stack changes
    if (diff.stack !== undefined) {
      newState.stack = diff.stack;
    }
    
    // Apply heap changes
    if (diff.heap) {
      newState.heap = { ...newState.heap };
      
      for (const key in diff.heap) {
        if (diff.heap[key] === null) {
          // Deletion
          delete newState.heap[key];
        } else {
          // Addition or update
          newState.heap[key] = diff.heap[key];
        }
      }
    }
    
    // Apply call stack changes
    if (diff.callStack !== undefined) {
      newState.callStack = diff.callStack;
    }
    
    return newState;
  }

  /**
   * Decompress animation config
   */
  private decompressAnimation(compressed: any): AnimationConfig | null {
    if (!compressed) return null;
    
    const animation: AnimationConfig = {
      type: compressed.t || compressed.type,
      target: compressed.tg || compressed.target,
      duration: compressed.d || compressed.duration || 500,
    };
    
    // Add optional fields
    if (compressed.e || compressed.effect) {
      animation.effect = compressed.e || compressed.effect;
    }
    
    if (compressed.el || compressed.element) {
      animation.element = compressed.el || compressed.element;
    }
    
    if (compressed.fid || compressed.frameId) {
      animation.frameId = compressed.fid || compressed.frameId;
    }
    
    if (compressed.f !== undefined || compressed.from !== undefined) {
      animation.from = compressed.f !== undefined ? compressed.f : compressed.from;
    }
    
    if (compressed.to !== undefined) {
      animation.to = compressed.to;
    }
    
    return animation;
  }

  /**
   * Deep clone state object
   */
  private cloneState(state: MemoryState): MemoryState {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(originalSize: number, compressedSize: number) {
    const reduction = originalSize - compressedSize;
    const percentage = ((reduction / originalSize) * 100).toFixed(2);
    
    return {
      originalSize,
      compressedSize,
      reduction,
      percentage: `${percentage}%`,
      ratio: (originalSize / compressedSize).toFixed(2) + 'x'
    };
  }
}

// Export singleton instance
export const traceDecompressor = new TraceDecompressor();
export default traceDecompressor;