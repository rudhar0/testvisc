/**
 * C/C++ Interpreter
 * Simulates C/C++ execution by walking AST and maintaining virtual memory
 */

import { ExecutionStep, StepType, AnimationType } from '../models/execution-step.model.js';
import MemoryManager from './memory-manager.js';

export default class CInterpreter {
  constructor(astWalker, sourceCode) {
    this.walker = astWalker;
    this.sourceCode = sourceCode;
    this.memory = new MemoryManager();
    this.steps = [];
    this.stepId = 0;
    this.functions = new Map();
    this.loopDepth = 0;
    this.loopIterations = new Map();
    this.inputQueue = [];
    this.outputBuffer = [];
  }

  /**
   * Execute program and generate trace
   */
  async execute(tree, inputs = []) {
    this.inputQueue = [...inputs];
    
    try {
      // Extract functions
      this.functions = this.walker.extractFunctions(tree);
      
      // Process globals
      const globals = this.walker.extractGlobals(tree);
      for (const globalDecl of globals) {
        await this._processDeclaration(globalDecl, true);
      }
      
      // Find and execute main
      const mainFunc = this.walker.findMain(tree);
      
      this._addStep({
        line: mainFunc.startLine,
        type: StepType.PROGRAM_START,
        explanation: 'Program execution begins',
        animation: {
          type: AnimationType.HIGHLIGHT,
          target: 'line',
          line: mainFunc.startLine,
          duration: 500
        }
      });
      
      // Push main frame
      this.memory.pushFrame('main', mainFunc.startLine);
      
      // Execute main body
      const result = await this._executeBlock(mainFunc.body);
      
      // Pop main frame
      this.memory.popFrame();
      
      this._addStep({
        line: mainFunc.endLine,
        type: StepType.PROGRAM_END,
        explanation: 'Program execution completed',
        animation: {
          type: AnimationType.HIGHLIGHT,
          target: 'line',
          line: mainFunc.endLine,
          duration: 500
        }
      });
      
      return this.steps;
    } catch (error) {
      throw new Error(`Execution error: ${error.message}`);
    }
  }

  /**
   * Execute a block of statements
   */
  async _executeBlock(blockNode) {
    if (!blockNode) return null;
    
    const statements = this.walker.getStatements(blockNode);
    let returnValue = null;
    
    for (const stmt of statements) {
      const result = await this._executeStatement(stmt);
      
      if (result && result.isReturn) {
        returnValue = result.value;
        break;
      }
    }
    
    return returnValue;
  }

  /**
   * Execute a single statement
   */
  async _executeStatement(node) {
    if (!node) return null;
    
    switch (node.type) {
      case 'declaration':
        return await this._processDeclaration(this.walker._parseDeclaration(node));
      
      case 'expression_statement':
        const expr = node.childForFieldName('expression') || node.child(0);
        return await this._evaluateExpression(expr);
      
      case 'return_statement':
        return await this._executeReturn(node);
      
      case 'if_statement':
        return await this._executeIf(node);
      
      case 'while_statement':
        return await this._executeWhile(node);
      
      case 'for_statement':
        return await this._executeFor(node);
      
      case 'do_statement':
        return await this._executeDoWhile(node);
      
      case 'compound_statement':
        return await this._executeBlock(node);
      
      default:
        // Skip unknown statement types
        return null;
    }
  }

  /**
   * Process declaration
   */
  async _processDeclaration(declInfo, isGlobal = false) {
    for (const decl of declInfo.declarators) {
      const line = decl.line;
      
      // Handle array type
      let actualType = decl.type;
      let arraySize = null;
      
      const arrayMatch = decl.type.match(/^(.+)\[(\d*)\]$/);
      if (arrayMatch) {
        actualType = arrayMatch[1];
        arraySize = arrayMatch[2] ? parseInt(arrayMatch[2]) : null;
      }
      
      // Initialize value
      let value = null;
      if (decl.initializer) {
        value = await this._evaluateExpression(decl.initializer);
      } else if (arraySize !== null) {
        // Array without initializer - create array of zeros
        value = new Array(arraySize).fill(0);
      }
      
      // Declare variable
      const variable = this.memory.declareVariable(
        decl.name,
        actualType,
        value,
        isGlobal
      );
      
      // Add step
      this._addStep({
        line,
        type: StepType.DECLARATION,
        explanation: `Declare ${decl.type} ${decl.name}${value !== null ? ` = ${this._formatValue(value)}` : ''}`,
        animation: {
          type: AnimationType.CREATE,
          target: isGlobal ? 'global' : 'stack',
          elementId: variable.address,
          duration: 300
        }
      });
      
      if (decl.initializer && value !== null) {
        this._addStep({
          line,
          type: StepType.ASSIGNMENT,
          explanation: `Initialize ${decl.name} to ${this._formatValue(value)}`,
          animation: {
            type: AnimationType.UPDATE,
            target: 'variable',
            elementId: variable.address,
            from: null,
            to: value,
            duration: 400
          }
        });
      }
    }
    
    return null;
  }

  /**
   * Evaluate expression
   */
  async _evaluateExpression(node) {
    if (!node) return null;
    
    switch (node.type) {
      case 'number_literal':
        return parseInt(node.text);
      
      case 'string_literal':
        return node.text.slice(1, -1); // Remove quotes
      
      case 'char_literal':
        return node.text.charCodeAt(1); // Get char code
      
      case 'true':
        return 1;
      
      case 'false':
        return 0;
      
      case 'identifier':
        const variable = this.memory.getVariable(node.text);
        return variable.value;
      
      case 'assignment_expression':
        return await this._executeAssignment(node);
      
      case 'binary_expression':
        return await this._evaluateBinaryExpression(node);
      
      case 'unary_expression':
        return await this._evaluateUnaryExpression(node);
      
      case 'update_expression':
        return await this._evaluateUpdateExpression(node);
      
      case 'call_expression':
        return await this._executeCall(node);
      
      case 'subscript_expression':
        return await this._evaluateSubscript(node);
      
      case 'pointer_expression':
        return await this._evaluatePointer(node);
      
      case 'parenthesized_expression':
        const inner = node.child(1);
        return await this._evaluateExpression(inner);
      
      default:
        return 0;
    }
  }

  /**
   * Execute assignment
   */
  async _executeAssignment(node) {
    const left = node.childForFieldName('left');
    const right = node.childForFieldName('right');
    const operator = node.childForFieldName('operator')?.text || '=';
    
    const line = this.walker.getLine(node);
    const value = await this._evaluateExpression(right);
    
    // Handle different left-hand sides
    if (left.type === 'identifier') {
      const name = left.text;
      let finalValue = value;
      
      // Handle compound assignments
      if (operator !== '=') {
        const currentValue = this.memory.getVariable(name).value;
        finalValue = this._applyOperator(currentValue, value, operator.slice(0, -1));
      }
      
      const variable = this.memory.setVariable(name, finalValue);
      
      this._addStep({
        line,
        type: StepType.ASSIGNMENT,
        explanation: `Assign ${name} ${operator} ${this._formatValue(value)}`,
        animation: {
          type: AnimationType.UPDATE,
          target: 'variable',
          elementId: variable.address,
          from: operator === '=' ? null : variable.value,
          to: finalValue,
          duration: 400
        }
      });
      
      return finalValue;
    } else if (left.type === 'subscript_expression') {
      // Array assignment
      return await this._executeArrayAssignment(left, value, line);
    } else if (left.type === 'pointer_expression') {
      // Pointer dereference assignment
      return await this._executePointerAssignment(left, value, line);
    }
    
    return value;
  }

  /**
   * Execute array assignment
   */
  async _executeArrayAssignment(subscriptNode, value, line) {
    const arrayNode = subscriptNode.childForFieldName('argument');
    const indexNode = subscriptNode.childForFieldName('index');
    
    const arrayName = arrayNode.text;
    const index = await this._evaluateExpression(indexNode);
    
    const arrayVar = this.memory.getVariable(arrayName);
    
    if (!Array.isArray(arrayVar.value)) {
      throw new Error(`${arrayName} is not an array`);
    }
    
    if (index < 0 || index >= arrayVar.value.length) {
      throw new Error(`Array index out of bounds: ${index}`);
    }
    
    arrayVar.value[index] = value;
    
    this._addStep({
      line,
      type: StepType.ARRAY_ACCESS,
      explanation: `Set ${arrayName}[${index}] = ${this._formatValue(value)}`,
      animation: {
        type: AnimationType.UPDATE,
        target: 'array_element',
        elementId: `${arrayVar.address}_${index}`,
        from: null,
        to: value,
        duration: 400
      }
    });
    
    return value;
  }

  /**
   * Execute pointer assignment (*ptr = value)
   */
  async _executePointerAssignment(ptrNode, value, line) {
    const operand = ptrNode.childForFieldName('argument') || ptrNode.child(1);
    const ptrName = operand.text;
    
    const ptrVar = this.memory.getVariable(ptrName);
    const address = ptrVar.value;
    
    if (typeof address !== 'number') {
      throw new Error(`Invalid pointer dereference`);
    }
    
    this.memory.writeHeap(address, 0, value);
    
    this._addStep({
      line,
      type: StepType.POINTER_DEREF,
      explanation: `Set *${ptrName} = ${this._formatValue(value)}`,
      animation: {
        type: AnimationType.UPDATE,
        target: 'heap',
        elementId: `0x${address.toString(16)}`,
        from: null,
        to: value,
        duration: 400
      }
    });
    
    return value;
  }

  /**
   * Evaluate binary expression
   */
  async _evaluateBinaryExpression(node) {
    const left = node.childForFieldName('left');
    const right = node.childForFieldName('right');
    const operator = node.childForFieldName('operator')?.text;
    
    const leftValue = await this._evaluateExpression(left);
    const rightValue = await this._evaluateExpression(right);
    
    return this._applyOperator(leftValue, rightValue, operator);
  }

  /**
   * Apply binary operator
   */
  _applyOperator(left, right, operator) {
    switch (operator) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return Math.floor(left / right);
      case '%': return left % right;
      case '<': return left < right ? 1 : 0;
      case '>': return left > right ? 1 : 0;
      case '<=': return left <= right ? 1 : 0;
      case '>=': return left >= right ? 1 : 0;
      case '==': return left === right ? 1 : 0;
      case '!=': return left !== right ? 1 : 0;
      case '&&': return (left && right) ? 1 : 0;
      case '||': return (left || right) ? 1 : 0;
      case '&': return left & right;
      case '|': return left | right;
      case '^': return left ^ right;
      case '<<': return left << right;
      case '>>': return left >> right;
      default: return 0;
    }
  }

  /**
   * Evaluate unary expression
   */
  async _evaluateUnaryExpression(node) {
    const operator = node.childForFieldName('operator')?.text || node.child(0)?.text;
    const argument = node.childForFieldName('argument') || node.child(1);
    
    const value = await this._evaluateExpression(argument);
    
    switch (operator) {
      case '-': return -value;
      case '+': return value;
      case '!': return value ? 0 : 1;
      case '~': return ~value;
      case '&': // Address-of
        if (argument.type === 'identifier') {
          const variable = this.memory.getVariable(argument.text);
          return variable.address;
        }
        return 0;
      case '*': // Dereference
        if (typeof value === 'number') {
          return this.memory.readHeap(value, 0);
        }
        return 0;
      default:
        return value;
    }
  }

  /**
   * Evaluate update expression (++ and --)
   */
  async _evaluateUpdateExpression(node) {
    const operator = node.childForFieldName('operator')?.text || node.child(0)?.text;
    const argument = node.childForFieldName('argument') || node.child(1);
    const line = this.walker.getLine(node);
    
    if (argument.type !== 'identifier') {
      throw new Error('Update expression requires variable');
    }
    
    const name = argument.text;
    const variable = this.memory.getVariable(name);
    const oldValue = variable.value;
    const newValue = operator.includes('+') ? oldValue + 1 : oldValue - 1;
    
    this.memory.setVariable(name, newValue);
    
    this._addStep({
      line,
      type: StepType.ASSIGNMENT,
      explanation: `${operator}${name}: ${oldValue} → ${newValue}`,
      animation: {
        type: AnimationType.UPDATE,
        target: 'variable',
        elementId: variable.address,
        from: oldValue,
        to: newValue,
        duration: 300
      }
    });
    
    // Return based on prefix/postfix
    const isPrefix = node.text.startsWith(operator);
    return isPrefix ? newValue : oldValue;
  }

  /**
   * Evaluate subscript (array access)
   */
  async _evaluateSubscript(node) {
    const arrayNode = node.childForFieldName('argument');
    const indexNode = node.childForFieldName('index');
    
    const arrayName = arrayNode.text;
    const index = await this._evaluateExpression(indexNode);
    const line = this.walker.getLine(node);
    
    const arrayVar = this.memory.getVariable(arrayName);
    
    if (!Array.isArray(arrayVar.value)) {
      throw new Error(`${arrayName} is not an array`);
    }
    
    if (index < 0 || index >= arrayVar.value.length) {
      throw new Error(`Array index out of bounds: ${index}`);
    }
    
    const value = arrayVar.value[index];
    
    this._addStep({
      line,
      type: StepType.ARRAY_ACCESS,
      explanation: `Access ${arrayName}[${index}] = ${this._formatValue(value)}`,
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'array_element',
        elementId: `${arrayVar.address}_${index}`,
        duration: 300
      }
    });
    
    return value;
  }

  /**
   * Evaluate pointer expression
   */
  async _evaluatePointer(node) {
    const operator = node.child(0)?.text;
    const argument = node.childForFieldName('argument') || node.child(1);
    
    if (operator === '&') {
      // Address-of
      if (argument.type === 'identifier') {
        const variable = this.memory.getVariable(argument.text);
        return variable.address;
      }
    } else if (operator === '*') {
      // Dereference
      const address = await this._evaluateExpression(argument);
      if (typeof address === 'number') {
        return this.memory.readHeap(address, 0);
      }
    }
    
    return 0;
  }

  /**
   * Execute function call
   */
  async _executeCall(node) {
    const functionNode = node.childForFieldName('function');
    const argumentsNode = node.childForFieldName('arguments');
    const functionName = functionNode.text;
    const line = this.walker.getLine(node);
    
    // Handle built-in functions
    if (this._isBuiltinFunction(functionName)) {
      return await this._executeBuiltinFunction(functionName, argumentsNode, line);
    }
    
    // User-defined function
    const funcDef = this.functions.get(functionName);
    if (!funcDef) {
      throw new Error(`Function '${functionName}' not defined`);
    }
    
    // Evaluate arguments
    const args = await this._evaluateArguments(argumentsNode);
    
    this._addStep({
      line,
      type: StepType.FUNCTION_CALL,
      explanation: `Call function ${functionName}(${args.map(a => this._formatValue(a)).join(', ')})`,
      animation: {
        type: AnimationType.PUSH,
        target: 'stack',
        duration: 400
      }
    });
    
    // Push new frame
    const frame = this.memory.pushFrame(functionName, line);
    
    // Bind parameters
    for (let i = 0; i < funcDef.parameters.length; i++) {
      const param = funcDef.parameters[i];
      const argValue = i < args.length ? args[i] : 0;
      this.memory.declareVariable(param.name, param.type, argValue, false);
    }
    
    // Execute function body
    const returnValue = await this._executeBlock(funcDef.body);
    
    // Pop frame
    this.memory.popFrame();
    
    this._addStep({
      line,
      type: StepType.FUNCTION_RETURN,
      explanation: `Return from ${functionName}${returnValue !== null ? ': ' + this._formatValue(returnValue) : ''}`,
      animation: {
        type: AnimationType.POP,
        target: 'stack',
        duration: 400
      }
    });
    
    return returnValue;
  }

  /**
   * Check if function is built-in
   */
  _isBuiltinFunction(name) {
    return ['printf', 'scanf', 'malloc', 'free', 'strlen', 'strcpy', 'cout', 'cin'].includes(name);
  }

  /**
   * Execute built-in function
   */
  async _executeBuiltinFunction(name, argumentsNode, line) {
    const args = await this._evaluateArguments(argumentsNode);
    
    switch (name) {
      case 'printf':
        return await this._executePrintf(args, line);
      
      case 'scanf':
        return await this._executeScanf(args, line);
      
      case 'malloc':
        return this._executeMalloc(args, line);
      
      case 'free':
        return this._executeFree(args, line);
      
      case 'cout':
        return await this._executeCout(argumentsNode, line);
      
      case 'cin':
        return await this._executeCin(argumentsNode, line);
      
      default:
        return 0;
    }
  }

  /**
   * Execute printf
   */
  async _executePrintf(args, line) {
    if (args.length === 0) return 0;
    
    const format = args[0];
    const output = this._formatPrintf(format, args.slice(1));
    this.outputBuffer.push(output);
    
    this._addStep({
      line,
      type: StepType.OUTPUT,
      explanation: `Output: "${output}"`,
      stdout: this.outputBuffer.join(''),
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'output',
        duration: 500
      }
    });
    
    return output.length;
  }

  /**
   * Execute scanf
   */
  async _executeScanf(args, line) {
    if (args.length < 2) return 0;
    
    const format = args[0];
    const variables = [];
    
    // Extract variable names from format
    const formatMatches = format.match(/%[difs]/g) || [];
    
    for (let i = 0; i < formatMatches.length && i + 1 < args.length; i++) {
      variables.push({
        name: `var${i}`,
        type: this._formatToType(formatMatches[i])
      });
    }
    
    // Request input
    this._addStep({
      line,
      type: StepType.INPUT_REQUEST,
      explanation: `Waiting for input: ${variables.map(v => v.type).join(', ')}`,
      inputRequest: {
        variables,
        expectedType: 'multiple'
      },
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'input',
        duration: 500
      }
    });
    
    // Get input from queue
    const inputValues = this.inputQueue.splice(0, variables.length);
    
    // Assign to variables (this is simplified - in real scanf, args are pointers)
    for (let i = 0; i < inputValues.length; i++) {
      // Note: In real implementation, we'd dereference the pointer
      // For now, we'll just note the input was received
    }
    
    return inputValues.length;
  }

  /**
   * Execute malloc
   */
  _executeMalloc(args, line) {
    const size = args[0] || 1;
    const address = this.memory.malloc(size, 'void*');
    
    this._addStep({
      line,
      type: StepType.MALLOC,
      explanation: `Allocate ${size} bytes at 0x${address.toString(16)}`,
      animation: {
        type: AnimationType.ALLOCATE,
        target: 'heap',
        elementId: `0x${address.toString(16)}`,
        duration: 400
      }
    });
    
    return address;
  }

  /**
   * Execute free
   */
  _executeFree(args, line) {
    const address = args[0];
    
    if (typeof address !== 'number') {
      throw new Error('Invalid free: not a valid address');
    }
    
    this.memory.free(address);
    
    this._addStep({
      line,
      type: StepType.FREE,
      explanation: `Free memory at 0x${address.toString(16)}`,
      animation: {
        type: AnimationType.DEALLOCATE,
        target: 'heap',
        elementId: `0x${address.toString(16)}`,
        duration: 400
      }
    });
    
    return 0;
  }

  /**
   * Execute C++ cout
   */
  async _executeCout(argumentsNode, line) {
    // Simplified cout handling
    let output = '';
    
    for (let i = 0; i < argumentsNode.childCount; i++) {
      const arg = argumentsNode.child(i);
      if (arg.type !== ',' && arg.type !== '(' && arg.type !== ')') {
        const value = await this._evaluateExpression(arg);
        output += this._formatValue(value);
      }
    }
    
    this.outputBuffer.push(output);
    
    this._addStep({
      line,
      type: StepType.OUTPUT,
      explanation: `Output: "${output}"`,
      stdout: this.outputBuffer.join(''),
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'output',
        duration: 500
      }
    });
    
    return 0;
  }

  /**
   * Execute C++ cin
   */
  async _executeCin(argumentsNode, line) {
    // Similar to scanf
    return await this._executeScanf([], line);
  }

  /**
   * Evaluate function arguments
   */
  async _evaluateArguments(argumentsNode) {
    if (!argumentsNode) return [];
    
    const args = [];
    
    for (let i = 0; i < argumentsNode.childCount; i++) {
      const child = argumentsNode.child(i);
      if (child.type !== ',' && child.type !== '(' && child.type !== ')') {
        const value = await this._evaluateExpression(child);
        args.push(value);
      }
    }
    
    return args;
  }

  /**
   * Execute return statement
   */
  async _executeReturn(node) {
    const valueNode = node.child(1);
    const line = this.walker.getLine(node);
    
    let value = null;
    if (valueNode && valueNode.type !== ';') {
      value = await this._evaluateExpression(valueNode);
    }
    
    this._addStep({
      line,
      type: StepType.FUNCTION_RETURN,
      explanation: `Return${value !== null ? ' ' + this._formatValue(value) : ''}`,
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'line',
        line,
        duration: 300
      }
    });
    
    return { isReturn: true, value };
  }

  /**
   * Execute if statement
   */
  async _executeIf(node) {
    const condition = node.childForFieldName('condition');
    const consequence = node.childForFieldName('consequence');
    const alternative = node.childForFieldName('alternative');
    const line = this.walker.getLine(node);
    
    // Evaluate condition (handle parenthesized)
    let condNode = condition;
    if (condition.type === 'parenthesized_expression') {
      condNode = condition.child(1);
    }
    
    const condValue = await this._evaluateExpression(condNode);
    const isTruthy = condValue !== 0 && condValue !== null && condValue !== false;
    
    this._addStep({
      line,
      type: StepType.CONDITION_CHECK,
      explanation: `Check if condition (${this._formatValue(condValue)}) is ${isTruthy ? 'true' : 'false'}`,
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'line',
        line,
        duration: 300
      }
    });
    
    if (isTruthy) {
      this._addStep({
        line,
        type: StepType.BRANCH_TAKEN,
        explanation: 'Taking true branch',
        animation: {
          type: AnimationType.HIGHLIGHT,
          target: 'line',
          line: this.walker.getLine(consequence),
          duration: 300
        }
      });
      return await this._executeStatement(consequence);
    } else if (alternative) {
      this._addStep({
        line,
        type: StepType.BRANCH_NOT_TAKEN,
        explanation: 'Taking false branch',
        animation: {
          type: AnimationType.HIGHLIGHT,
          target: 'line',
          line: this.walker.getLine(alternative),
          duration: 300
        }
      });
      
      // Handle else-if
      if (alternative.type === 'if_statement') {
        return await this._executeIf(alternative);
      }
      return await this._executeStatement(alternative);
    } else {
      this._addStep({
        line,
        type: StepType.BRANCH_NOT_TAKEN,
        explanation: 'Condition false, skipping block',
        animation: {
          type: AnimationType.HIGHLIGHT,
          target: 'line',
          line,
          duration: 300
        }
      });
    }
    
    return null;
  }

  /**
   * Execute while loop
   */
  async _executeWhile(node) {
    const condition = node.childForFieldName('condition');
    const body = node.childForFieldName('body');
    const line = this.walker.getLine(node);
    const loopId = `while_${line}_${this.loopDepth}`;
    
    this.loopDepth++;
    this.loopIterations.set(loopId, 0);
    
    this._addStep({
      line,
      type: StepType.LOOP_START,
      explanation: 'Start while loop',
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'line',
        line,
        duration: 300
      }
    });
    
    const iterations = [];
    
    while (true) {
      // Evaluate condition
      let condNode = condition;
      if (condition.type === 'parenthesized_expression') {
        condNode = condition.child(1);
      }
      
      const condValue = await this._evaluateExpression(condNode);
      const isTruthy = condValue !== 0 && condValue !== null && condValue !== false;
      
      const iterCount = this.loopIterations.get(loopId);
      
      if (!isTruthy) {
        this._addStep({
          line,
          type: StepType.CONDITION_CHECK,
          explanation: `Loop condition false after ${iterCount} iterations`,
          animation: {
            type: AnimationType.HIGHLIGHT,
            target: 'line',
            line,
            duration: 300
          }
        });
        break;
      }
      
      iterations.push(iterCount);
      
      // Check for loop compression
      if (iterCount < 5 || iterations.length <= 10) {
        this._addStep({
          line,
          type: StepType.LOOP_ITERATION,
          explanation: `Loop iteration ${iterCount + 1}`,
          animation: {
            type: AnimationType.HIGHLIGHT,
            target: 'line',
            line,
            duration: 300
          }
        });
        
        // Execute body
        const result = await this._executeStatement(body);
        if (result && result.isReturn) {
          this.loopDepth--;
          return result;
        }
      } else if (iterCount === 5) {
        // Add compression step
        this._addStep({
          line,
          type: StepType.LOOP_COMPRESSED,
          explanation: `... ${iterations.length - 10} iterations compressed ...`,
          animation: {
            type: AnimationType.HIGHLIGHT,
            target: 'line',
            line,
            duration: 200
          }
        });
        
        // Skip to near end
        const skipTo = iterations.length - 5;
        while (this.loopIterations.get(loopId) < skipTo) {
          // Execute silently
          await this._executeStatementSilent(body);
          this.loopIterations.set(loopId, this.loopIterations.get(loopId) + 1);
        }
      }
      
      this.loopIterations.set(loopId, iterCount + 1);
      
      // Safety limit
      if (iterCount > 10000) {
        throw new Error('Loop iteration limit exceeded');
      }
    }
    
    this._addStep({
      line,
      type: StepType.LOOP_END,
      explanation: 'End while loop',
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'line',
        line,
        duration: 300
      }
    });
    
    this.loopDepth--;
    return null;
  }

  /**
   * Execute for loop
   */
  async _executeFor(node) {
    const initializer = node.childForFieldName('initializer');
    const condition = node.childForFieldName('condition');
    const update = node.childForFieldName('update');
    const body = node.childForFieldName('body');
    const line = this.walker.getLine(node);
    const loopId = `for_${line}_${this.loopDepth}`;
    
    this.loopDepth++;
    
    // Execute initializer
    if (initializer) {
      if (initializer.type === 'declaration') {
        await this._processDeclaration(this.walker._parseDeclaration(initializer));
      } else {
        await this._evaluateExpression(initializer);
      }
    }
    
    this._addStep({
      line,
      type: StepType.LOOP_START,
      explanation: 'Start for loop',
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'line',
        line,
        duration: 300
      }
    });
    
    this.loopIterations.set(loopId, 0);
    const iterations = [];
    
    while (true) {
      // Check condition
      let condValue = true;
      if (condition) {
        condValue = await this._evaluateExpression(condition);
        condValue = condValue !== 0 && condValue !== null && condValue !== false;
      }
      
      const iterCount = this.loopIterations.get(loopId);
      
      if (!condValue) {
        this._addStep({
          line,
          type: StepType.CONDITION_CHECK,
          explanation: `Loop condition false after ${iterCount} iterations`,
          animation: {
            type: AnimationType.HIGHLIGHT,
            target: 'line',
            line,
            duration: 300
          }
        });
        break;
      }
      
      iterations.push(iterCount);
      
      // Loop compression logic (same as while)
      if (iterCount < 5 || iterations.length <= 10) {
        this._addStep({
          line,
          type: StepType.LOOP_ITERATION,
          explanation: `Loop iteration ${iterCount + 1}`,
          animation: {
            type: AnimationType.HIGHLIGHT,
            target: 'line',
            line,
            duration: 300
          }
        });
        
        // Execute body
        const result = await this._executeStatement(body);
        if (result && result.isReturn) {
          this.loopDepth--;
          return result;
        }
        
        // Execute update
        if (update) {
          await this._evaluateExpression(update);
        }
      } else if (iterCount === 5) {
        this._addStep({
          line,
          type: StepType.LOOP_COMPRESSED,
          explanation: `... ${iterations.length - 10} iterations compressed ...`,
          animation: {
            type: AnimationType.HIGHLIGHT,
            target: 'line',
            line,
            duration: 200
          }
        });
        
        const skipTo = iterations.length - 5;
        while (this.loopIterations.get(loopId) < skipTo) {
          await this._executeStatementSilent(body);
          if (update) {
            await this._evaluateExpressionSilent(update);
          }
          this.loopIterations.set(loopId, this.loopIterations.get(loopId) + 1);
        }
      }
      
      this.loopIterations.set(loopId, iterCount + 1);
      
      if (iterCount > 10000) {
        throw new Error('Loop iteration limit exceeded');
      }
    }
    
    this._addStep({
      line,
      type: StepType.LOOP_END,
      explanation: 'End for loop',
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'line',
        line,
        duration: 300
      }
    });
    
    this.loopDepth--;
    return null;
  }

  /**
   * Execute do-while loop
   */
  async _executeDoWhile(node) {
    const body = node.childForFieldName('body');
    const condition = node.childForFieldName('condition');
    const line = this.walker.getLine(node);
    const loopId = `dowhile_${line}_${this.loopDepth}`;
    
    this.loopDepth++;
    this.loopIterations.set(loopId, 0);
    
    this._addStep({
      line,
      type: StepType.LOOP_START,
      explanation: 'Start do-while loop',
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'line',
        line,
        duration: 300
      }
    });
    
    const iterations = [];
    
    do {
      const iterCount = this.loopIterations.get(loopId);
      iterations.push(iterCount);
      
      if (iterCount < 5 || iterations.length <= 10) {
        this._addStep({
          line,
          type: StepType.LOOP_ITERATION,
          explanation: `Loop iteration ${iterCount + 1}`,
          animation: {
            type: AnimationType.HIGHLIGHT,
            target: 'line',
            line,
            duration: 300
          }
        });
        
        const result = await this._executeStatement(body);
        if (result && result.isReturn) {
          this.loopDepth--;
          return result;
        }
      } else if (iterCount === 5) {
        this._addStep({
          line,
          type: StepType.LOOP_COMPRESSED,
          explanation: `... ${iterations.length - 10} iterations compressed ...`,
          animation: {
            type: AnimationType.HIGHLIGHT,
            target: 'line',
            line,
            duration: 200
          }
        });
        
        const skipTo = iterations.length - 5;
        while (this.loopIterations.get(loopId) < skipTo) {
          await this._executeStatementSilent(body);
          this.loopIterations.set(loopId, this.loopIterations.get(loopId) + 1);
        }
      }
      
      this.loopIterations.set(loopId, iterCount + 1);
      
      if (iterCount > 10000) {
        throw new Error('Loop iteration limit exceeded');
      }
      
      // Check condition
      let condNode = condition;
      if (condition.type === 'parenthesized_expression') {
        condNode = condition.child(1);
      }
      
      const condValue = await this._evaluateExpression(condNode);
      const isTruthy = condValue !== 0 && condValue !== null && condValue !== false;
      
      if (!isTruthy) {
        this._addStep({
          line,
          type: StepType.CONDITION_CHECK,
          explanation: `Loop condition false after ${iterCount + 1} iterations`,
          animation: {
            type: AnimationType.HIGHLIGHT,
            target: 'line',
            line,
            duration: 300
          }
        });
        break;
      }
    } while (true);
    
    this._addStep({
      line,
      type: StepType.LOOP_END,
      explanation: 'End do-while loop',
      animation: {
        type: AnimationType.HIGHLIGHT,
        target: 'line',
        line,
        duration: 300
      }
    });
    
    this.loopDepth--;
    return null;
  }

  /**
   * Execute statement without adding steps (for loop compression)
   */
  async _executeStatementSilent(node) {
    const originalSteps = this.steps.length;
    await this._executeStatement(node);
    this.steps.splice(originalSteps); // Remove added steps
  }

  /**
   * Evaluate expression without adding steps
   */
  async _evaluateExpressionSilent(node) {
    const originalSteps = this.steps.length;
    const result = await this._evaluateExpression(node);
    this.steps.splice(originalSteps);
    return result;
  }

  /**
   * Add execution step
   */
  _addStep(stepData) {
    const step = new ExecutionStep({
      id: this.stepId++,
      line: stepData.line,
      type: stepData.type,
      explanation: stepData.explanation,
      state: this.memory.snapshot(),
      animation: stepData.animation,
      inputRequest: stepData.inputRequest || null,
      stdout: stepData.stdout || ''
    });
    
    this.steps.push(step);
  }

  /**
   * Format value for display
   */
  _formatValue(value) {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (Array.isArray(value)) {
      return `[${value.join(', ')}]`;
    }
    if (typeof value === 'number' && value > 1000) {
      return `0x${value.toString(16)}`;
    }
    return String(value);
  }

  /**
   * Format printf string
   */
  _formatPrintf(format, args) {
    let result = format;
    let argIndex = 0;
    
    result = result.replace(/%([difs])/g, (match, spec) => {
      if (argIndex >= args.length) return match;
      const arg = args[argIndex++];
      
      switch (spec) {
        case 'd':
        case 'i':
          return String(Math.floor(arg));
        case 'f':
          return String(parseFloat(arg));
        case 's':
          return String(arg);
        default:
          return match;
      }
    });
    
    // Handle escape sequences
    result = result.replace(/\\n/g, '\n');
    result = result.replace(/\\t/g, '\t');
    
    return result;
  }

  /**
   * Convert format specifier to type
   */
  _formatToType(spec) {
    switch (spec) {
      case '%d':
      case '%i':
        return 'int';
      case '%f':
        return 'float';
      case '%s':
        return 'string';
      default:
        return 'int';
    }
  }
}