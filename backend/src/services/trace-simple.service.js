/**
 * Simplified Trace Service
 * Uses GCC for validation and generates basic trace from code analysis
 */

import ASTWalker from '../parsers/ast-walker.js';
import { gccService } from './gcc.service.js';

class TraceService {
  constructor() {
    this.walker = null;
  }

  /**
   * Generate execution trace for C/C++ code
   * Simplified approach: validate with GCC, parse with tree-sitter, generate basic trace
   */
  async generateTrace(code, language = 'c', inputs = []) {
    try {
      console.log(`🔍 Validating ${language.toUpperCase()} code with GCC...`);

      // First, validate with GCC
      if (gccService.isAvailable()) {
        const gccResult = await gccService.compileCode(code, language);
        if (!gccResult.success) {
          throw new Error(`GCC compilation failed: ${gccResult.errors}`);
        }
        console.log(`✅ GCC validation passed`);
      }

      // Parse code with tree-sitter for basic structure analysis
      console.log(`🔍 Parsing ${language.toUpperCase()} code...`);
      this.walker = new ASTWalker(language);
      const tree = this.walker.parse(code);
      
      // Check for main function
      try {
        const mainFunc = this.walker.findMain(tree);
        console.log(`✅ Found main function at line ${mainFunc.startLine}`);
      } catch (error) {
        throw new Error(`No main function found: ${error.message}`);
      }

      // Generate simplified trace based on code analysis
      const trace = this._generateSimplifiedTrace(code, language);
      console.log(`✅ Execution trace generated: ${trace.length} steps`);

      return trace;
    } catch (error) {
      console.error(`❌ Trace generation error: ${error.message}`);
      throw new Error(`Trace generation failed: ${error.message}`);
    }
  }

  /**
   * Generate a simplified trace by analyzing code structure
   * Returns basic execution steps without full interpretation
   */
  _generateSimplifiedTrace(code, language) {
    const lines = code.split('\n');
    const trace = [];
    let stepId = 0;

    // Program start
    trace.push({
      id: stepId++,
      line: 1,
      type: 'program_start',
      explanation: 'Program execution begins',
      state: {
        globals: [],
        stack: [],
        heap: [],
        pointers: []
      }
    });

    // Parse functions and key lines
    let inMain = false;
    let mainLineNum = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
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
            globals: [],
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
            globals: [],
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
            globals: [],
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
            globals: [],
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
            globals: [],
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
