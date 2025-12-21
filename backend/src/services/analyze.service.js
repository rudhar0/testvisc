/**
 * Code Analysis Service
 * Provides fallback analysis when GCC is not available
 */

class AnalyzeService {
  /**
   * Auto-detect C vs C++
   */
  detectLanguage(code) {
    // C++ indicators
    const cppPatterns = [
      /\#include\s*<iostream>/,
      /std::/,
      /\bclass\b/,
      /\bnamespace\b/,
      /\btemplate\s*</,
      /\bcout\b/,
      /\bcin\b/,
      /\busing\s+namespace/
    ];

    for (const pattern of cppPatterns) {
      if (pattern.test(code)) {
        return 'cpp';
      }
    }

    // Default to C
    return 'c';
  }

  /**
   * Basic syntax validation (fallback)
   */
  async validateSyntax(code, language = 'c') {
    const errors = [];
    const warnings = [];

    // Basic checks
    if (!code.includes('main')) {
      errors.push({
        line: 0,
        message: 'No main function found'
      });
    }

    // Check for balanced braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        line: 0,
        message: 'Unbalanced braces'
      });
    }

    // Check for balanced parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push({
        line: 0,
        message: 'Unbalanced parentheses'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Parse AST (fallback - basic parsing)
   */
  async parseAST(code, language = 'c') {
    // This is a placeholder - in production, use tree-sitter or similar
    return {
      success: true,
      ast: {
        type: 'Program',
        functions: this.extractFunctions(code),
        globals: this.extractGlobals(code),
        includes: this.extractIncludes(code)
      }
    };
  }

  /**
   * Extract function declarations
   */
  extractFunctions(code) {
    const functions = [];
    const functionPattern = /(\w+)\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let match;

    while ((match = functionPattern.exec(code)) !== null) {
      functions.push({
        returnType: match[1],
        name: match[2],
        line: code.substring(0, match.index).split('\n').length
      });
    }

    return functions;
  }

  /**
   * Extract global variables
   */
  extractGlobals(code) {
    const globals = [];
    // Simple pattern for global declarations
    const globalPattern = /^(int|float|double|char|long)\s+(\w+)\s*(?:=\s*([^;]+))?\s*;/gm;
    let match;

    while ((match = globalPattern.exec(code)) !== null) {
      globals.push({
        type: match[1],
        name: match[2],
        initialValue: match[3] || null,
        line: code.substring(0, match.index).split('\n').length
      });
    }

    return globals;
  }

  /**
   * Extract #include statements
   */
  extractIncludes(code) {
    const includes = [];
    const includePattern = /#include\s*[<"]([^>"]+)[>"]/g;
    let match;

    while ((match = includePattern.exec(code)) !== null) {
      includes.push(match[1]);
    }

    return includes;
  }

  /**
   * Generate execution trace using trace service
   */
  async generateTrace(code, language = 'c', inputs = []) {
    // Import trace service dynamically
    const { traceService } = await import('./trace.service.js');
    
    // Generate full execution trace
    return await traceService.generateTrace(code, language, inputs);
  }
}

export const analyzeService = new AnalyzeService();