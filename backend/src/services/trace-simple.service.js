/**
 * Simplified Trace Service
 * Uses Clang + LibTooling for validation and generates trace from code analysis
 */

import ASTWalker from '../parsers/ast-walker.js';
import clangAnalyzerService from './clang-analyzer.service.js';

class TraceService {
  constructor() {
    this.walker = null;
  }

  /**
   * Generate execution trace for C/C++ code
   * Validates with Clang if available, parses with tree-sitter, generates trace with semantic info
   * Fallback to tree-sitter parsing if Clang is not available
   */
  async generateTrace(code, language = 'c', inputs = []) {
    try {
      console.log(`🔍 Validating ${language.toUpperCase()} code...`);

      // Try to validate with Clang, but don't fail if Clang is not available
      let tree = null; // Declare tree here to be accessible later
      let clangAvailable = true;
      try {
        const validationResult = await clangAnalyzerService.validateCode(code, language);
        if (!validationResult.valid) {
          let errorsToProcess = validationResult.errors;
          // Ensure errorsToProcess is an array before calling map.
          // This handles cases where validationResult.errors might be a string,
          // a non-array object, or null/undefined.
          if (!Array.isArray(errorsToProcess)) {
            errorsToProcess = errorsToProcess ? [errorsToProcess] : [];
          }
          const errorMsgs = errorsToProcess.map(e => typeof e === 'string' ? e : e.message).join(', ');
          throw new Error(`Syntax errors found: ${errorMsgs}`);
        }
        console.log(`✅ Clang semantic validation passed`);
      } catch (clangError) {
        console.warn(`⚠️  Clang validation unavailable, using tree-sitter fallback: ${clangError.message}`);
        clangAvailable = false;
        
        // Fallback: Basic syntax validation with tree-sitter
        try {
          this.walker = new ASTWalker(language);
          tree = this.walker.parse(code); // Parse here if Clang fails
          console.log(`✅ Tree-sitter parsing passed`);
        } catch (parseError) {
          throw new Error(`Syntax error: ${parseError.message}`);
        }
      }

      // Parse code with tree-sitter for basic structure analysis
      if (!tree) { // Only parse if tree wasn't already parsed in the Clang fallback
        console.log(`🔍 Parsing ${language.toUpperCase()} code with tree-sitter...`);
        this.walker = new ASTWalker(language);
        tree = this.walker.parse(code);
      }

      // Check for main function
      try {
        const mainFunc = this.walker.findMain(tree);
        console.log(`✅ Found main function at line ${mainFunc.startLine}`);
      } catch (error) {
        throw new Error(`No main function found: ${error.message}`);
      }

      // Generate trace with semantic information
      const trace = await this._generateSemanticTrace(code, language, inputs, clangAvailable);
      console.log(`✅ Execution trace generated: ${trace.length} steps`);

      return trace;
    } catch (error) {
      console.error(`❌ Trace generation error: ${error.message}`);
      throw new Error(`Trace generation failed: ${error.message}`);
    }
  }

  /**
   * Generate trace with semantic information from Clang analysis (with fallback)
   */
  async _generateSemanticTrace(code, language, inputs, clangAvailable = true) {
    const lines = code.split('\n');
    const trace = [];
    let stepId = 0;

    // Get semantic information (if Clang is available)
    let semanticInfo = null;
    if (clangAvailable) {
      try {
        semanticInfo = await clangAnalyzerService.analyzeCode(code, language);
      } catch (error) {
        console.warn(`⚠️  Failed to get semantic info: ${error.message}`);
        semanticInfo = { success: false, analysis: null };
      }
    } else {
      semanticInfo = { success: false, analysis: null };
    }

    // Program start
    trace.push({
      id: stepId++,
      line: 1,
      type: 'program_start',
      explanation: 'Program execution begins',
      semantic: {
        functions: semanticInfo.analysis?.semantic?.functions ?? 0, // These are counts, not arrays
        classes: semanticInfo.analysis?.semantic?.classes ?? 0,     // Use nullish coalescing for default 0
        variables: semanticInfo.analysis?.semantic?.variables ?? 0
      },
      state: {
        globals: semanticInfo.analysis?.variables?.filter(v => v.scope === 'global') || [], // Filter for actual globals
        stack: [],
        heap: [],
        pointers: semanticInfo.analysis?.pointers?.pointers || []
      }
    });

    // Parse functions and key lines
    let inMain = false;
    let mainLineNum = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const currentGlobals = trace[trace.length - 1].state.globals; // Carry globals forward
      const trimmed = line.trim();

      // Detect main function
      if (trimmed.includes('main') && (trimmed.includes('(') && trimmed.includes(')'))) {
        inMain = true;
        mainLineNum = lineNum;
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'function_call',
          explanation: `Entering main() function`,
          state: {
            globals: currentGlobals, // Carry globals forward
            stack: [{ id: 'frame_0', function: 'main', line: lineNum, variables: [] }],
            heap: [],
            pointers: []
          }
        });
        continue;
      }

      if (!inMain) continue;

      // Detect variable declarations
      const varDeclMatch = trimmed.match(/^(int|char|float|double|bool|auto|long|short)\s+(\w+)\s*(?:=|;)/);
      if (varDeclMatch) {
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'declaration',
          explanation: `Variable ${varDeclMatch[2]} declared (type: ${varDeclMatch[1]})`,
          state: {
            globals: currentGlobals, // Carry globals forward
            stack: [{ id: 'frame_0', function: 'main', line: lineNum, variables: [{ name: varDeclMatch[2], type: varDeclMatch[1], value: 0 }] }],
            heap: [],
            pointers: []
          }
        });
      }

      // Detect assignments
      const assignMatch = trimmed.match(/(\w+)\s*=/);
      if (assignMatch && !varDeclMatch && !trimmed.startsWith('//')) {
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'assignment',
          explanation: `Assignment: ${trimmed}`,
          state: {
            globals: currentGlobals, // Carry globals forward
            stack: [{ id: 'frame_0', function: 'main', line: lineNum, variables: [] }],
            heap: [],
            pointers: []
          }
        });
      }

      // Detect function calls
      if (trimmed.includes('printf') || trimmed.includes('cout') || trimmed.includes('scanf') || trimmed.includes('cin')) {
        const funcName = trimmed.includes('printf') ? 'printf' : 
                        trimmed.includes('cout') ? 'cout' :
                        trimmed.includes('scanf') ? 'scanf' : 'cin';
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'function_call',
          explanation: `Call to ${funcName}(): ${trimmed}`,
          state: {
            globals: currentGlobals, // Carry globals forward
            stack: [{ id: 'frame_0', function: 'main', line: lineNum, variables: [] }],
            heap: [],
            pointers: []
          }
        });
      }

      // Detect return statement
      if (trimmed.includes('return')) {
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'function_return',
          explanation: 'Return from main()',
          state: {
            globals: currentGlobals, // Carry globals forward
            stack: [],
            heap: [],
            pointers: []
          }
        });
        inMain = false;
        break;
      }
    }

    // Program end
    if (trace.length > 1) {
      trace.push({
        id: stepId++,
        line: lines.length,
        type: 'program_end',
        explanation: 'Program execution completed',
        state: {
          globals: [],
          stack: [],
          heap: [],
          pointers: []
        }
      });
    }

    return trace.length > 1 ? trace : this._getMinimalTrace();
  }

  /**
   * Get a minimal valid trace for any code
   */
  _getMinimalTrace() {
    return [
      {
        id: 0,
        line: 1,
        type: 'program_start',
        explanation: 'Program execution begins',
        state: { globals: [], stack: [], heap: [], pointers: [] }
      },
      {
        id: 1,
        line: 2,
        type: 'program_end',
        explanation: 'Program execution completed',
        state: { globals: [], stack: [], heap: [], pointers: [] }
      }
    ];
  }

  /**
   * Validate syntax only (without execution)
   */
  async validateSyntax(code, language = 'c') {
    try {
      const walker = new ASTWalker(language);
      const tree = walker.parse(code);
      
      // Syntax is valid if tree parses without error
      return {
        valid: true,
        errors: []
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Get trace statistics
   */
  getTraceStats(trace) {
    const stats = {
      totalSteps: trace.length,
      stepTypes: {},
      maxStackDepth: 0,
      heapAllocations: 0,
      loopIterations: 0
    };

    for (const step of trace) {
      stats.stepTypes[step.type] = (stats.stepTypes[step.type] || 0) + 1;
      if (step.state.stack) {
        stats.maxStackDepth = Math.max(stats.maxStackDepth, step.state.stack.length);
      }
    }

    return stats;
  }

  /**
   * Extract input requirements from code
   */
  async extractInputRequirements(code, language = 'c') {
    const requirements = [];
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('scanf') || line.includes('cin')) {
        requirements.push({
          line: i + 1,
          function: line.includes('scanf') ? 'scanf' : 'cin',
          type: line.includes('scanf') ? 'scanf' : 'cin'
        });
      }
    }
    
    return requirements;
  }
}

export default TraceService;
