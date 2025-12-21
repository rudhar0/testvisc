/**
 * Analyze Service
 * Main service for handling code analysis requests
 */

import TraceService from './trace.service.js';

class AnalyzeService {
  constructor() {
    this.traceService = new TraceService();
  }

  /**
   * Analyze code and generate execution trace
   * @param {Object} options
   * @param {string} options.code - Source code
   * @param {string} options.language - Programming language ('c' or 'cpp')
   * @param {Array} options.inputs - User inputs for interactive programs
   * @returns {Promise<Object>} Analysis result
   */
  async analyze({ code, language = 'c', inputs = [] }) {
    try {
      // Validate inputs
      this._validateAnalyzeRequest(code, language);

      // First, validate syntax
      const syntaxCheck = await this.traceService.validateSyntax(code, language);
      
      if (!syntaxCheck.valid) {
        return {
          success: false,
          error: 'Syntax errors found',
          errors: syntaxCheck.errors,
          trace: []
        };
      }

      // Generate execution trace
      let trace;
      try {
        trace = await this.traceService.generateTrace(code, language, inputs);
      } catch (traceError) {
        console.error(`❌ Trace generation error: ${traceError.message}`);
        // For now, return error with details
        throw new Error(`Code execution failed: ${traceError.message}`);
      }

      // Get trace statistics
      const stats = this.traceService.getTraceStats(trace);

      return {
        success: true,
        trace,
        stats,
        metadata: {
          language,
          totalSteps: trace.length,
          hasInput: stats.stepTypes['input_request'] > 0,
          hasHeap: stats.heapAllocations > 0,
          maxStackDepth: stats.maxStackDepth
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        trace: []
      };
    }
  }

  /**
   * Validate syntax only (fast check)
   */
  async validateSyntax({ code, language = 'c' }) {
    try {
      this._validateAnalyzeRequest(code, language);

      const result = await this.traceService.validateSyntax(code, language);

      return {
        success: result.valid,
        valid: result.valid,
        errors: result.errors
      };
    } catch (error) {
      return {
        success: false,
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Extract input requirements from code
   */
  async getInputRequirements({ code, language = 'c' }) {
    try {
      this._validateAnalyzeRequest(code, language);

      const requirements = await this.traceService.extractInputRequirements(code, language);

      return {
        success: true,
        requirements,
        needsInput: requirements.length > 0
      };
    } catch (error) {
      return {
        success: false,
        requirements: [],
        needsInput: false,
        error: error.message
      };
    }
  }

  /**
   * Continue execution after input is provided
   * This is called when user provides input during execution
   */
  async continueExecution({ code, language = 'c', inputs = [], stepId = 0 }) {
    try {
      // For now, we regenerate the trace with inputs
      // In a more sophisticated implementation, we could resume from stepId
      return await this.analyze({ code, language, inputs });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        trace: []
      };
    }
  }

  /**
   * Validate analyze request
   */
  _validateAnalyzeRequest(code, language) {
    if (!code || typeof code !== 'string') {
      throw new Error('Code is required and must be a string');
    }

    if (code.trim().length === 0) {
      throw new Error('Code cannot be empty');
    }

    if (!['c', 'cpp', 'c++'].includes(language.toLowerCase())) {
      throw new Error('Language must be "c" or "cpp"');
    }

    // Check code length (prevent abuse)
    if (code.length > 100000) {
      throw new Error('Code exceeds maximum length (100KB)');
    }
  }

  /**
   * Get supported features
   */
  getSupportedFeatures() {
    return {
      languages: ['c', 'cpp'],
      features: {
        variables: true,
        arrays: true,
        pointers: true,
        functions: true,
        recursion: true,
        loops: true,
        conditionals: true,
        heap: true,
        malloc: true,
        free: true,
        printf: true,
        scanf: true,
        cout: true,
        cin: true
      },
      limitations: {
        maxExecutionSteps: 10000,
        maxLoopIterations: 10000,
        maxStackDepth: 1000,
        maxHeapSize: 1000000
      }
    };
  }
}

export const analyzeService = new AnalyzeService();
export default AnalyzeService;