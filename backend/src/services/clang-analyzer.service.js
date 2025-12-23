/**
 * Clang Analyzer Service
 * Advanced semantic analysis using Clang + LibTooling
 * Provides complete code understanding for C/C++
 *
 * Features:
 * - Full semantic AST analysis
 * - Pointer tracking and dereferencing patterns
 * - Template instantiation tracking
 * - Class hierarchy analysis
 * - Call graph with virtual function resolution
 * - Variable lifetime tracking
 */

import ClangService from './clang.service.js';

class ClangAnalyzerService {
  constructor() {
    this.clang = new ClangService();
  }

  /**
   * Performs comprehensive analysis of code
   * @param {string} code - Source code
   * @param {string} language - 'c' or 'cpp'
   * @returns {Promise<Object>} Complete analysis result
   */
  async analyzeCode(code, language) {
    try {
      // Run all analyses in parallel
      const [
        ast,
        pointers,
        templates,
        hierarchy,
        callGraph,
        variables,
        inputs
      ] = await Promise.all([
        this.clang.generateAst(code, language),
        this.clang.analyzePointers(code, language),
        this.clang.analyzeTemplates(code, language),
        this.clang.analyzeClassHierarchy(code, language),
        this.clang.buildCallGraph(code, language),
        this.clang.extractVariables(code, language),
        this.clang.extractInputCalls(code, language)
      ]);

      return {
        success: ast.success,
        errors: ast.errors || [], // Ensure errors is always an array, even if ast.errors is undefined
        analysis: {
          semantic: {
            functions: callGraph?.functions?.length ?? 0,
            classes: hierarchy?.classes?.length ?? 0,
            variables: variables?.length ?? 0,
            pointers: pointers?.pointers?.length ?? 0,
            templates: templates?.templates?.length ?? 0
          },
          pointers,
          templates,
          hierarchy,
          callGraph,
          variables,
          inputRequirements: inputs,
          metadata: ast.metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [{ message: error.message }],
        analysis: null
      };
    }
  }

  /**
   * Validates code syntax and semantics
   * @param {string} code
   * @param {string} language
   * @returns {Promise<Object>}
   */
  async validateCode(code, language) {
    try {
      const result = await this.clang.validateSyntax(code, language);
      return {
        valid: result.valid,
        errors: result.errors
      };
    } catch (error) {
      // Clang not available, return error
      return {
        valid: false,
        errors: [{ message: error.message }]
      };
    }
  }

  /**
   * Extracts semantic information for visualization
   * @param {string} code
   * @param {string} language
   * @returns {Promise<Object>}
   */
  async extractVisualInfo(code, language) {
    try {
      const [hierarchy, callGraph, variables, pointers] = await Promise.all([
        this.clang.analyzeClassHierarchy(code, language),
        this.clang.buildCallGraph(code, language),
        this.clang.extractVariables(code, language),
        this.clang.analyzePointers(code, language)
      ]);

      return {
        success: true,
        visualization: {
          classes: this._formatClassesForViz(hierarchy.classes),
          functions: this._formatFunctionsForViz(callGraph.functions, callGraph.calls),
          variables: this._formatVariablesForViz(variables),
          pointerChains: this._buildPointerChains(pointers, variables)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Detects potential memory issues
   * @param {string} code
   * @param {string} language
   * @returns {Promise<Object>}
   */
  async detectMemoryIssues(code, language) {
    const pointerAnalysis = await this.clang.analyzePointers(code, language);
    const issues = [];

    // Detect patterns that might indicate memory issues
    (pointerAnalysis?.patterns || []).forEach(pattern => {
      switch (pattern) {
        case 'double_pointer':
          issues.push({
            severity: 'info',
            type: 'double_pointer',
            message: 'Double pointers detected - complex memory management pattern'
          });
          break;
        case 'void_pointer_cast':
          issues.push({
            severity: 'warning',
            type: 'void_pointer_cast',
            message: 'Void pointer casts - type safety risk'
          });
          break;
        case 'null_dereference_risk':
          issues.push({
            severity: 'warning',
            type: 'null_dereference_risk',
            message: 'Potential null pointer dereference risk'
          });
          break;
        case 'pointer_arithmetic':
          issues.push({
            severity: 'info',
            type: 'pointer_arithmetic',
            message: 'Pointer arithmetic detected - bounds checking recommended'
          });
          break;
      }
    });

    return { issues };
  }

  /**
   * Formats classes for visualization
   * @private
   */
  _formatClassesForViz(classes) {
    return (classes || []).map(cls => ({
      name: cls.name,
      members: (cls.members || []).map(m => ({
        name: m.name,
        type: m.type,
        access: m.access
      })),
      methods: (cls.methods || []).map(m => ({
        name: m.name,
        access: m.access,
        isVirtual: m.isVirtual
      }))
    }));
  }

  /**
   * Formats functions for visualization
   * @private
   */
  _formatFunctionsForViz(functions, calls) {
    const functionMap = new Map((functions || []).map(f => [f.name, f]));
    
    return (functions || []).map(func => ({
      name: func.name,
      returnType: func.returnType,
      calls: (calls || [])
        .filter(c => c.callee === func.name || c.callee === 'unknown')
        .map(c => ({ to: c.callee, line: c.line })),
      line: func.line
    }));
  }

  /**
   * Formats variables for visualization
   * @private
   */
  _formatVariablesForViz(variables) {
    return (variables || []).reduce((acc, v) => {
      if (!acc[v.line]) {
        acc[v.line] = [];
      }
      acc[v.line].push({
        name: v.name,
        type: v.type,
        isPointer: v.isPointer,
        isArray: v.isArray
      });
      return acc;
    }, {});
  }

  /**
   * Builds pointer dereference chains
   * @private
   */
  _buildPointerChains(pointerAnalysis, variables) {
    const chains = [];
    
    (pointerAnalysis?.pointers || []).forEach(ptr => {
      const chain = {
        pointer: ptr.name,
        type: ptr.type,
        derefs: (pointerAnalysis?.dereferences || [])
          .filter(d => d.line >= ptr.line)
          .slice(0, 5) // First 5 dereferences
      };
      chains.push(chain);
    });

    return chains;
  }

  /**
   * Gets quick summary of code structure
   * @param {string} code
   * @param {string} language
   * @returns {Promise<Object>}
   */
  async getSummary(code, language) {
    try {
      const ast = await this.clang.generateAst(code, language);
      
      if (!ast.success) {
        return { success: false, errors: ast.errors || [] }; // Ensure errors is always an array
      }

      return {
        success: true,
        summary: {
          hasSemanticInfo: ast.metadata?.hasSemanticInfo,
          functionCount: ast.metadata?.functionCount ?? 0,
          classCount: ast.metadata?.classCount ?? 0,
          variableCount: ast.metadata?.variableCount ?? 0,
          templateCount: ast.metadata?.templateCount ?? 0
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new ClangAnalyzerService();
