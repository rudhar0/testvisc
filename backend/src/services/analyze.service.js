/**
 * Analyze Service
 * Main service for handling code analysis requests using Clang for static analysis.
 */

import ClangService from './clang.service.js';

class AnalyzeService {
  constructor() {
    // This service would encapsulate the logic for interacting with the Clang executable.
    // e.g., running `clang -Xclang -ast-dump=json -fsyntax-only ...`
    this.clangService = new ClangService();
  }

  /**
   * Analyze code and generate execution trace
   * @param {Object} options
   * @param {string} options.code - Source code
   * @param {string} options.language - Programming language ('c' or 'cpp')
   * @returns {Promise<Object>} Analysis result containing the AST.
   */
  async analyze({ code, language = 'c' }) {
    try {
      // Validate inputs
      this._validateAnalyzeRequest(code, language);

      // Generate AST. Clang performs syntax and semantic checks during this process.
      const analysisResult = await this.clangService.generateAst(code, language);

      if (!analysisResult.success) {
        // Distinguish between system errors (like missing Clang) and actual code syntax errors.
        const primaryError = analysisResult.errors?.[0]?.message || 'Unknown analysis error';
        const isSystemError = primaryError.includes('Clang compiler is not installed');

        console.error(isSystemError ? 'System Configuration Error:' : 'Clang Syntax Errors:', analysisResult.errors);
        return {
          success: false,
          error: isSystemError ? 'System Configuration Error' : 'Syntax errors found in code',
          errors: analysisResult.errors,
          ast: null
        };
      }

      // The primary artifact is now the AST.
      const { ast, metadata } = analysisResult;

      return {
        success: true,
        ast,
        metadata: {
          ...metadata, // Propagate rich metadata from ClangService
          language,
        }
      };
    } catch (error) {
      console.error(`❌ AST generation error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        errors: [{ message: error.message }],
        ast: null
      };
    }
  }

  /**
   * Validate syntax only (fast check using Clang).
   */
  async validateSyntax({ code, language = 'c' }) {
    try {
      this._validateAnalyzeRequest(code, language);

      const result = await this.clangService.validateSyntax(code, language);

      return {
        success: result.valid,
        valid: result.valid,
        errors: result.errors
      };
    } catch (error) {
      return {
        success: false,
        valid: false,
        error: error.message,
        errors: [{ message: error.message }]
      };
    }
  }

  /**
   * Statically extract potential input requirements from code by analyzing the AST.
   */
  async getInputRequirements({ code, language = 'c' }) {
    try {
      this._validateAnalyzeRequest(code, language);

      // This can be implemented by generating the AST and traversing it
      // to find calls to input functions like scanf, cin, etc.
      const requirements = await this.clangService.extractInputCalls(code, language);

      return {
        success: true,
        requirements, // e.g., [{ function: 'scanf', line: 10, format: '%d' }]
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
      // Features now reflect static analysis capabilities from Clang
      features: {
        astGeneration: true,
        syntaxValidation: true,
        semanticAnalysis: true, // Full semantic analysis
        typeInformation: true, // AST contains type info
        pointerAnalysis: true, // Pointer analysis & dereferencing
        templateSupport: true, // Understands templates
        classHierarchy: true, // Understands inheritance
        controlFlowGraph: true, // CFG generation
        callGraph: true, // Call graph generation
        cStandards: ['c89', 'c99', 'c11', 'c17'],
        cppStandards: ['c++98', 'c++03', 'c++11', 'c++14', 'c++17', 'c++20', 'c++23'],
      },
      // Limitations are now related to analysis time and complexity, not execution
      limitations: {
        maxAnalysisTimeSeconds: 30,
        maxCodeLength: 100000, // From _validateAnalyzeRequest
      }
    };
  }
}

export const analyzeService = new AnalyzeService();
export default AnalyzeService;