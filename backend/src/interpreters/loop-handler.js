/**
 * Loop Handler
 * Compresses long loops for better visualization
 */

export class LoopHandler {
  constructor(maxShown = 10) {
    this.maxShown = maxShown;
  }

  /**
   * Compress loop steps - show first N and last N iterations
   */
  compressLoop(loopSteps, maxShown = this.maxShown) {
    if (loopSteps.length <= maxShown) {
      return loopSteps; // Short loop, show all
    }

    const firstHalf = Math.floor(maxShown / 2);
    const lastHalf = maxShown - firstHalf;

    const firstIterations = loopSteps.slice(0, firstHalf);
    const lastIterations = loopSteps.slice(-lastHalf);
    const skippedCount = loopSteps.length - maxShown;

    // Create compressed indicator
    const compressedStep = {
      id: loopSteps[firstHalf].id,
      type: 'loop_compressed',
      line: loopSteps[firstHalf].line,
      message: `... (${skippedCount} iterations skipped)`,
      skippedIterations: skippedCount,
      explanation: `Skipped ${skippedCount} loop iterations for visualization`,
      state: loopSteps[firstHalf].state,
      animation: {
        type: 'fast_forward',
        duration: 200,
        effect: 'blur'
      }
    };

    return [
      ...firstIterations,
      compressedStep,
      ...lastIterations
    ];
  }

  /**
   * Detect if loop is long enough to compress
   */
  shouldCompress(iterationCount) {
    return iterationCount > this.maxShown;
  }

  /**
   * Get compression summary
   */
  getCompressionSummary(originalCount, compressedCount) {
    return {
      original: originalCount,
      compressed: compressedCount,
      saved: originalCount - compressedCount,
      ratio: ((compressedCount / originalCount) * 100).toFixed(2) + '%'
    };
  }
}

export default LoopHandler;