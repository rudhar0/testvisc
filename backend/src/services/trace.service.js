/**
 * Trace Service
 * Orchestrates parsing, interpretation, and trace generation
 */

import gccExecutor from './gcc-executor.service.js';

class TraceService {
  constructor() {
  }

  /**
   * Generate execution trace for C/C++ code
   * @param {string} code - Source code
   * @param {string} language - 'c' or 'cpp'
   * @param {Array} inputs - User inputs for scanf/cin
   * @returns {Promise<Array<ExecutionStep>>}
   */
  async generateTrace(code, language = 'c', inputs = []) {
    try {
      console.info('🔎 Generating trace using GCC/GDB in Docker sandbox...');
      
      const trace = await gccExecutor.execute(code, language, inputs);

      // Post-process trace (compress loops, etc.)
      const processedTrace = this._compressLoops(trace);

      return processedTrace;
    } catch (error) {
      console.error(`❌ Trace generation error: ${error.message}`);
      throw new Error(`Trace generation failed: ${error.message}`);
    }
  }

  /**
   * Compress long loops in the trace
   */
  _compressLoops(trace) {
    const MAX_STEPS = 1000;
    if (trace.length > MAX_STEPS) {
      const start = trace.slice(0, MAX_STEPS / 2);
      const end = trace.slice(trace.length - (MAX_STEPS / 2));
      const gap = {
        id: start.length,
        type: 'gap',
        explanation: `... ${trace.length - MAX_STEPS} steps hidden (trace compressed) ...`,
        state: { variables: {}, stack: [], heap: {} }
      };
      return [...start, gap, ...end];
    }
    return trace;
  }

  /**
   * Validate syntax using GCC
   */
  async validateSyntax(code, language = 'c') {
    return await gccExecutor.validate(code, language);
  }

  /**
   * Validate execution trace
   */
  _validateTrace(trace) {
    if (!Array.isArray(trace)) {
      throw new Error('Invalid trace: not an array');
    }

    return true;
  }

  /**
   * Extract input requirements from code
   */
  async extractInputRequirements(code, language = 'c') {
    // Simple regex scan for MVP
    const requirements = [];
    const lines = code.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('scanf') || line.includes('cin')) {
        requirements.push({
          line: i + 1,
          type: line.includes('scanf') ? 'scanf' : 'cin'
        });
      }
    });
    return requirements;
  }

  /**
   * Get statistics from a trace
   */
  getTraceStats(trace) {
    const stats = {
      totalSteps: trace.length,
      stepTypes: {},
      heapAllocations: 0,
      maxStackDepth: 0
    };

    trace.forEach(step => {
      if (step.type) stats.stepTypes[step.type] = (stats.stepTypes[step.type] || 0) + 1;
      if (step.state && step.state.stack) {
        stats.maxStackDepth = Math.max(stats.maxStackDepth, step.state.stack.length);
      }
    });

    return stats;
  }
}

export default TraceService;