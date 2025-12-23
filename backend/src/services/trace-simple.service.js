/**
 * Simplified Trace Service - FIXED VERSION
 * Generates trace with correct state structure matching frontend types
 */

import ASTWalker from '../parsers/ast-walker.js';
import clangAnalyzerService from './clang-analyzer.service.js';

class TraceService {
  constructor() {
    this.walker = null;
  }

  async generateTrace(code, language = 'c', inputs = []) {
    try {
      console.log(`🔍 Validating ${language.toUpperCase()} code...`);

      let tree = null;
      let clangAvailable = true;
      
      try {
        const validationResult = await clangAnalyzerService.validateCode(code, language);
        if (!validationResult.valid) {
          let errorsToProcess = validationResult.errors;
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
        
        try {
          this.walker = new ASTWalker(language);
          tree = this.walker.parse(code);
          console.log(`✅ Tree-sitter parsing passed`);
        } catch (parseError) {
          throw new Error(`Syntax error: ${parseError.message}`);
        }
      }

      if (!tree) {
        console.log(`🔍 Parsing ${language.toUpperCase()} code with tree-sitter...`);
        this.walker = new ASTWalker(language);
        tree = this.walker.parse(code);
      }

      try {
        const mainFunc = this.walker.findMain(tree);
        console.log(`✅ Found main function at line ${mainFunc.startLine}`);
      } catch (error) {
        throw new Error(`No main function found: ${error.message}`);
      }

      const trace = await this._generateSemanticTrace(code, language, inputs, clangAvailable);
      console.log(`✅ Execution trace generated: ${trace.length} steps`);

      return trace;
    } catch (error) {
      console.error(`❌ Trace generation error: ${error.message}`);
      throw new Error(`Trace generation failed: ${error.message}`);
    }
  }

  /**
   * Generate trace with CORRECT state structure
   */
  async _generateSemanticTrace(code, language, inputs, clangAvailable = true) {
    const lines = code.split('\n');
    const trace = [];
    let stepId = 0;

    // Get semantic information
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

    // Helper to create proper state structure
    const createState = (globals = {}, callStack = [], heap = {}) => ({
      globals,        // Object with variable names as keys
      stack: [],      // Legacy, keeping empty for compatibility
      heap,           // Object with addresses as keys
      callStack       // Array of CallFrame objects
    });

    // Program start
    trace.push({
      id: stepId++,
      line: 1,
      type: 'program_start',
      explanation: 'Program execution begins',
      state: createState(),
      animation: {
        type: 'appear',
        target: 'global',
        duration: 500
      }
    });

    // Parse and generate steps
    let inMain = false;
    let mainLineNum = 0;
    const localVars = {}; // Track local variables

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
          explanation: 'Entering main() function',
          state: createState({}, [{
            function: 'main',
            returnType: 'int',
            params: {},
            locals: {},
            frameId: 'frame_0',
            returnAddress: null,
            isActive: true
          }]),
          animation: {
            type: 'push_frame',
            target: 'stack',
            duration: 400
          }
        });
        continue;
      }

      if (!inMain) continue;

      // Get current call stack from last step
      const lastState = trace[trace.length - 1].state;
      const currentCallStack = [...lastState.callStack];
      const currentGlobals = { ...lastState.globals };

      // Detect variable declarations
      const varDeclMatch = trimmed.match(/^(int|char|float|double|bool|auto|long|short)\s+(\w+)\s*(?:=\s*([^;]+))?;?/);
      if (varDeclMatch) {
        const [, type, name, initValue] = varDeclMatch;
        const value = initValue ? this._parseValue(initValue) : 0;
        
        // Add to local variables
        localVars[name] = {
          name,
          type,
          value,
          address: `0x${(0x7fff0000 + Object.keys(localVars).length * 8).toString(16)}`,
          scope: 'local',
          isAlive: true
        };

        // Update call stack with new variable
        if (currentCallStack.length > 0) {
          currentCallStack[currentCallStack.length - 1].locals = { ...localVars };
        }

        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'variable_declaration',
          explanation: `Declare ${type} ${name}${initValue ? ` = ${value}` : ''}`,
          state: createState(currentGlobals, currentCallStack),
          animation: {
            type: 'appear',
            target: 'stack',
            duration: 300,
            element: name
          }
        });
      }

      // Detect assignments
      const assignMatch = trimmed.match(/^(\w+)\s*=\s*([^;]+);?/);
      if (assignMatch && !varDeclMatch && !trimmed.startsWith('//')) {
        const [, name, valueExpr] = assignMatch;
        const newValue = this._parseValue(valueExpr);
        
        if (localVars[name]) {
          const oldValue = localVars[name].value;
          localVars[name].value = newValue;
          
          // Update call stack
          if (currentCallStack.length > 0) {
            currentCallStack[currentCallStack.length - 1].locals = { ...localVars };
          }

          trace.push({
            id: stepId++,
            line: lineNum,
            type: 'assignment',
            explanation: `${name} = ${newValue}`,
            state: createState(currentGlobals, currentCallStack),
            animation: {
              type: 'value_change',
              target: 'stack',
              duration: 400,
              element: name,
              from: oldValue,
              to: newValue
            }
          });
        }
      }

      // Detect output (printf/cout)
      if (trimmed.includes('printf') || trimmed.includes('cout')) {
        const funcName = trimmed.includes('printf') ? 'printf' : 'cout';
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'output',
          explanation: `Output: ${trimmed.substring(0, 50)}...`,
          state: createState(currentGlobals, currentCallStack),
          animation: {
            type: 'appear',
            target: 'overlay',
            duration: 500
          }
        });
      }

      // Detect return
      if (trimmed.includes('return')) {
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'function_return',
          explanation: 'Return from main()',
          state: createState(currentGlobals, []),
          animation: {
            type: 'pop_frame',
            target: 'stack',
            duration: 400
          }
        });
        inMain = false;
        break;
      }
    }

    // Program end
    trace.push({
      id: stepId++,
      line: lines.length,
      type: 'program_end',
      explanation: 'Program execution completed',
      state: createState(),
      animation: {
        type: 'disappear',
        target: 'global',
        duration: 500
      }
    });

    return trace;
  }

  /**
   * Parse simple values from expressions
   */
  _parseValue(expr) {
    const trimmed = expr.trim();
    
    // Number
    if (/^-?\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    
    // Float
    if (/^-?\d+\.\d+$/.test(trimmed)) {
      return parseFloat(trimmed);
    }
    
    // String literal
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    
    // Char literal
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }
    
    // Default
    return trimmed;
  }

  async validateSyntax(code, language = 'c') {
    try {
      const walker = new ASTWalker(language);
      const tree = walker.parse(code);
      
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
      if (step.state.callStack) {
        stats.maxStackDepth = Math.max(stats.maxStackDepth, step.state.callStack.length);
      }
    }

    return stats;
  }

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