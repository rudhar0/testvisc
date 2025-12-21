/**
 * C/C++ Interpreter
 * Simulates C/C++ execution without running binaries
 */

import { MemoryManager } from './memory-manager.js';
import { LoopHandler } from './loop-handler.js';
import { InputHandler } from './input-handler.js';

export class CInterpreter {
  constructor() {
    this.memory = new MemoryManager();
    this.loopHandler = new LoopHandler();
    this.inputHandler = new InputHandler();
    this.stepCounter = 0;
  }

  /**
   * Execute C/C++ code and generate trace
   */
  async execute(code, language = 'c', inputs = []) {
    this.stepCounter = 0;
    const steps = [];
    const lines = code.split('\n');

    // Step 0: Program start
    steps.push(this.createStep({
      type: 'program_start',
      line: 1,
      explanation: 'Program execution started'
    }));

    // Parse and execute line by line
    let currentScope = 'global';
    let inFunction = null;
    let inLoop = false;
    let loopSteps = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Skip empty lines and preprocessor directives
      if (!line || line.startsWith('#') || line.startsWith('//')) {
        continue;
      }

      // Detect function entry
      if (line.match(/int\s+main\s*\(/)) {
        inFunction = 'main';
        this.memory.pushStackFrame('main');
        steps.push(this.createStep({
          type: 'function_call',
          line: lineNum,
          function: 'main',
          explanation: 'Entering main() function',
          animation: {
            type: 'push_frame',
            target: 'stack',
            frameId: 'frame_0',
            duration: 600
          }
        }));
        continue;
      }

      // Skip function braces
      if (line === '{' || line === '}') {
        if (line === '}' && inFunction) {
          // Function return
          steps.push(this.createStep({
            type: 'function_return',
            line: lineNum,
            function: inFunction,
            returnValue: 0,
            explanation: `Returning from ${inFunction}() with value 0`,
            animation: {
              type: 'pop_frame',
              target: 'stack',
              frameId: 'frame_0',
              duration: 600
            }
          }));
          inFunction = null;
        }
        continue;
      }

      // Variable declaration
      if (this.isVariableDeclaration(line)) {
        const varInfo = this.parseVariableDeclaration(line);
        
        if (currentScope === 'global' || !inFunction) {
          // Global variable
          this.memory.declareGlobal(varInfo.name, varInfo.type, varInfo.value);
          steps.push(this.createStep({
            type: 'global_declaration',
            line: lineNum,
            variable: varInfo.name,
            dataType: varInfo.type,
            value: varInfo.value,
            explanation: `Declared global variable: ${varInfo.type} ${varInfo.name} = ${varInfo.value}`,
            animation: {
              type: 'appear',
              target: 'global',
              element: varInfo.name,
              duration: 500
            }
          }));
        } else {
          // Local variable
          this.memory.declareLocal(varInfo.name, varInfo.type, varInfo.value);
          steps.push(this.createStep({
            type: 'variable_declaration',
            line: lineNum,
            scope: 'local',
            function: inFunction,
            variable: varInfo.name,
            dataType: varInfo.type,
            value: varInfo.value,
            explanation: `Declared local variable: ${varInfo.type} ${varInfo.name} = ${varInfo.value}`,
            animation: {
              type: 'appear',
              target: 'stack',
              frameId: 'frame_0',
              element: varInfo.name,
              duration: 400
            }
          }));
        }
        continue;
      }

      // Assignment
      if (this.isAssignment(line)) {
        const assignment = this.parseAssignment(line);
        const oldValue = this.memory.getValue(assignment.variable) || 0;
        const newValue = this.evaluateExpression(assignment.expression);
        
        this.memory.setValue(assignment.variable, newValue);
        
        steps.push(this.createStep({
          type: 'assignment',
          line: lineNum,
          variable: assignment.variable,
          oldValue,
          newValue,
          explanation: `Assigned value ${newValue} to variable ${assignment.variable}`,
          animation: {
            type: 'value_change',
            target: this.memory.isGlobal(assignment.variable) ? 'global' : 'stack',
            frameId: 'frame_0',
            element: assignment.variable,
            from: oldValue,
            to: newValue,
            duration: 500,
            effect: 'pulse'
          }
        }));
        continue;
      }

      // Array declaration
      if (this.isArrayDeclaration(line)) {
        const arrayInfo = this.parseArrayDeclaration(line);
        this.memory.declareArray(arrayInfo.name, arrayInfo.type, arrayInfo.size, arrayInfo.values);
        
        steps.push(this.createStep({
          type: 'array_declaration',
          line: lineNum,
          variable: arrayInfo.name,
          dataType: `${arrayInfo.type}[]`,
          size: arrayInfo.size,
          values: arrayInfo.values,
          explanation: `Declared array: ${arrayInfo.type} ${arrayInfo.name}[${arrayInfo.size}]`,
          animation: {
            type: 'array_create',
            target: 'stack',
            frameId: 'frame_0',
            element: arrayInfo.name,
            cells: arrayInfo.size,
            duration: 800
          }
        }));
        continue;
      }

      // Loop detection
      if (this.isLoopStart(line)) {
        inLoop = true;
        const loopInfo = this.parseLoop(line);
        
        steps.push(this.createStep({
          type: 'loop_start',
          line: lineNum,
          loopType: loopInfo.type,
          iterations: loopInfo.iterations,
          explanation: `Starting ${loopInfo.type} loop`,
          animation: {
            type: 'loop_indicator',
            target: 'overlay',
            loopId: 'loop_0',
            effect: 'circular_highlight'
          }
        }));
        
        // Simulate loop iterations (compress if > 10)
        loopSteps = this.simulateLoop(loopInfo, lineNum);
        if (loopSteps.length > 10) {
          loopSteps = this.loopHandler.compressLoop(loopSteps);
        }
        steps.push(...loopSteps);
        
        inLoop = false;
        continue;
      }

      // Input statement (scanf/cin)
      if (this.inputHandler.isInputStatement(line)) {
        const inputInfo = this.inputHandler.parseInputStatement(line);
        
        steps.push(this.createStep({
          type: 'input_request',
          line: lineNum,
          inputType: inputInfo.type,
          variables: inputInfo.variables,
          explanation: `Waiting for user input: ${line}`,
          pauseExecution: true,
          inputRequest: {
            format: inputInfo.format,
            variables: inputInfo.variables,
            expectedTypes: inputInfo.types
          },
          animation: {
            type: 'input_dialog',
            target: 'overlay',
            prompt: `Enter value for ${inputInfo.variables.join(', ')}`,
            expectedType: inputInfo.types[0]
          }
        }));
        continue;
      }

      // Output statement (printf/cout)
      if (this.isOutputStatement(line)) {
        const output = this.parseOutput(line);
        steps.push(this.createStep({
          type: 'output',
          line: lineNum,
          output: output,
          explanation: `Output: ${output}`
        }));
        continue;
      }
    }

    // Final step: Program end
    steps.push(this.createStep({
      type: 'program_end',
      line: lines.length,
      returnValue: 0,
      explanation: 'Program execution completed',
      animation: {
        type: 'program_complete',
        effect: 'fade_all'
      }
    }));

    return {
      steps,
      totalSteps: steps.length
    };
  }

  /**
   * Create execution step with current memory state
   */
  createStep(stepData) {
    const step = {
      id: this.stepCounter++,
      ...stepData,
      state: this.memory.getSnapshot()
    };

    // Add default animation if not provided
    if (!step.animation && step.type !== 'program_start') {
      step.animation = {
        type: 'appear',
        target: 'stack',
        duration: 500
      };
    }

    return step;
  }

  /**
   * Check if line is variable declaration
   */
  isVariableDeclaration(line) {
    return /^(int|float|double|char|long)\s+\w+/.test(line);
  }

  /**
   * Parse variable declaration
   */
  parseVariableDeclaration(line) {
    const match = line.match(/^(int|float|double|char|long)\s+(\w+)\s*=?\s*([^;]+)?/);
    if (!match) return null;

    return {
      type: match[1],
      name: match[2],
      value: match[3] ? this.evaluateExpression(match[3]) : this.getDefaultValue(match[1])
    };
  }

  /**
   * Check if line is assignment
   */
  isAssignment(line) {
    return /^\w+\s*=\s*[^=]/.test(line);
  }

  /**
   * Parse assignment
   */
  parseAssignment(line) {
    const match = line.match(/^(\w+)\s*=\s*([^;]+)/);
    return {
      variable: match[1],
      expression: match[2]
    };
  }

  /**
   * Check if line is array declaration
   */
  isArrayDeclaration(line) {
    return /\w+\s+\w+\s*\[\s*\d+\s*\]/.test(line);
  }

  /**
   * Parse array declaration
   */
  parseArrayDeclaration(line) {
    const match = line.match(/(\w+)\s+(\w+)\s*\[\s*(\d+)\s*\]\s*=?\s*\{([^}]+)\}?/);
    if (!match) {
      const simpleMatch = line.match(/(\w+)\s+(\w+)\s*\[\s*(\d+)\s*\]/);
      return {
        type: simpleMatch[1],
        name: simpleMatch[2],
        size: parseInt(simpleMatch[3]),
        values: Array(parseInt(simpleMatch[3])).fill(0)
      };
    }

    return {
      type: match[1],
      name: match[2],
      size: parseInt(match[3]),
      values: match[4] ? match[4].split(',').map(v => this.evaluateExpression(v.trim())) : []
    };
  }

  /**
   * Check if line starts a loop
   */
  isLoopStart(line) {
    return /^(for|while)\s*\(/.test(line);
  }

  /**
   * Parse loop
   */
  parseLoop(line) {
    const forMatch = line.match(/for\s*\(\s*\w+\s*=\s*(\d+)\s*;\s*\w+\s*<\s*(\d+)/);
    if (forMatch) {
      return {
        type: 'for',
        start: parseInt(forMatch[1]),
        end: parseInt(forMatch[2]),
        iterations: parseInt(forMatch[2]) - parseInt(forMatch[1])
      };
    }

    return {
      type: 'while',
      iterations: 5 // Default assumption
    };
  }

  /**
   * Simulate loop iterations
   */
  simulateLoop(loopInfo, startLine) {
    const steps = [];
    for (let i = 0; i < loopInfo.iterations; i++) {
      steps.push(this.createStep({
        type: 'loop_iteration',
        line: startLine,
        loopId: 'loop_0',
        iteration: i,
        explanation: `Loop iteration ${i}`,
        animation: {
          type: 'loop_cycle',
          iteration: i,
          duration: 300
        }
      }));
    }
    return steps;
  }

  /**
   * Check if line is input statement
   */
  isInputStatement(line) {
    return line.includes('scanf') || line.includes('cin');
  }

  /**
   * Check if line is output statement
   */
  isOutputStatement(line) {
    return line.includes('printf') || line.includes('cout');
  }

  /**
   * Parse output statement
   */
  parseOutput(line) {
    const printfMatch = line.match(/printf\s*\(\s*"([^"]*)"/);
    if (printfMatch) {
      return printfMatch[1].replace(/%d|%f|%s/g, (match) => {
        // Simplified - just show format
        return '<value>';
      });
    }
    return 'Output';
  }

  /**
   * Evaluate expression (simplified)
   */
  evaluateExpression(expr) {
    expr = expr.trim();
    
    // Number literal
    if (/^\d+$/.test(expr)) {
      return parseInt(expr);
    }
    
    // Float literal
    if (/^\d+\.\d+$/.test(expr)) {
      return parseFloat(expr);
    }
    
    // String literal
    if (expr.startsWith('"') && expr.endsWith('"')) {
      return expr.slice(1, -1);
    }
    
    // Variable reference
    if (/^\w+$/.test(expr)) {
      return this.memory.getValue(expr) || 0;
    }
    
    // Simple arithmetic
    try {
      return eval(expr.replace(/\w+/g, (match) => {
        return this.memory.getValue(match) || 0;
      }));
    } catch {
      return 0;
    }
  }

  /**
   * Get default value for type
   */
  getDefaultValue(type) {
    const defaults = {
      'int': 0,
      'float': 0.0,
      'double': 0.0,
      'char': '\0',
      'long': 0
    };
    return defaults[type] || 0;
  }
}

export default CInterpreter;