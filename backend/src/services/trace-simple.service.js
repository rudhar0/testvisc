
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
   * Generate comprehensive trace with ALL execution steps
   */
  async _generateSemanticTrace(code, language, inputs, clangAvailable = true) {
    const lines = code.split('\n');
    const trace = [];
    let stepId = 0;

    const createState = (globals = {}, callStack = [], heap = {}) => ({
      globals,
      stack: [],
      heap,
      callStack
    });

    // Program start
    trace.push({
      id: stepId++,
      line: 1,
      type: 'program_start',
      explanation: 'Program execution begins',
      state: createState(),
      animation: { type: 'appear', target: 'global', duration: 500 }
    });

    let inMain = false;
    let inLoop = false;
    let loopDepth = 0;
    const globalVars = {};
    const localVars = {};
    let currentCallStack = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Skip empty lines, comments, and preprocessor directives
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('#')) {
        continue;
      }

      // Detect global variables (before main)
      if (!inMain && !trimmed.includes('main')) {
        const globalMatch = trimmed.match(/^(int|char|float|double|long|short|unsigned|signed)\s+(\w+)\s*(?:=\s*([^;]+))?;/);
        if (globalMatch) {
          const [, type, name, initValue] = globalMatch;
          const value = initValue ? this._parseValue(initValue) : 0;
          
          globalVars[name] = {
            name,
            type,
            value,
            address: `0x${(0x1000 + Object.keys(globalVars).length * 8).toString(16)}`,
            scope: 'global',
            isAlive: true
          };

          trace.push({
            id: stepId++,
            line: lineNum,
            type: 'global_declaration',
            explanation: `Declare global variable: ${type} ${name}${initValue ? ` = ${value}` : ''}`,
            state: createState({ ...globalVars }, currentCallStack),
            animation: { type: 'appear', target: 'global', duration: 300 }
          });
          continue;
        }
      }

      // Detect main function
      if (trimmed.includes('int main') || trimmed.includes('void main')) {
        inMain = true;
        
        currentCallStack = [{
          function: 'main',
          returnType: trimmed.includes('void main') ? 'void' : 'int',
          params: {},
          locals: {},
          frameId: 'frame_0',
          returnAddress: null,
          isActive: true
        }];
        
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'function_call',
          explanation: 'Entering main() function',
          state: createState({ ...globalVars }, [...currentCallStack]),
          animation: { type: 'push_frame', target: 'stack', duration: 400 }
        });
        continue;
      }

      if (!inMain) continue;

      // Get current frame
      const currentFrame = currentCallStack[currentCallStack.length - 1];
      if (!currentFrame) continue;

      // Variable declarations (including for loop initializers)
      const varDeclMatch = trimmed.match(/^(?:for\s*\(\s*)?(int|char|float|double|bool|long|short|unsigned|signed)\s+(\w+)\s*(?:=\s*([^;,)]+))?[;,)]?/);
      if (varDeclMatch && !trimmed.startsWith('//')) {
        const [, type, name, initValue] = varDeclMatch;
        const value = initValue ? this._evaluateExpression(initValue, localVars, globalVars) : 0;
        
        localVars[name] = {
          name,
          type,
          value,
          address: `0x${(0x7fff0000 + Object.keys(localVars).length * 8).toString(16)}`,
          scope: 'local',
          isAlive: true
        };

        currentFrame.locals = { ...localVars };
        
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'variable_declaration',
          explanation: `Declare local variable: ${type} ${name}${initValue ? ` = ${value}` : ''}`,
          state: createState({ ...globalVars }, [...currentCallStack]),
          animation: { type: 'appear', target: 'stack', duration: 300, element: name }
        });

        // If this is a for loop initialization, continue parsing the line
        if (trimmed.startsWith('for')) {
          inLoop = true;
          loopDepth++;
          
          trace.push({
            id: stepId++,
            line: lineNum,
            type: 'loop_start',
            explanation: 'Start for loop',
            state: createState({ ...globalVars }, [...currentCallStack]),
            animation: { type: 'highlight', target: 'line', duration: 300 }
          });
        }
        continue;
      }

      // Standalone assignments
      const assignMatch = trimmed.match(/^(\w+)\s*([\+\-\*\/]?=)\s*([^;]+);?/);
      if (assignMatch && !trimmed.startsWith('//') && !trimmed.includes('int ') && !trimmed.includes('char ') && !trimmed.includes('float ')) {
        const [, name, operator, valueExpr] = assignMatch;
        
        let newValue;
        if (operator === '=') {
          newValue = this._evaluateExpression(valueExpr, localVars, globalVars);
        } else {
          // Compound assignment (+=, -=, etc.)
          const op = operator[0];
          const currentValue = localVars[name]?.value ?? globalVars[name]?.value ?? 0;
          const rightValue = this._evaluateExpression(valueExpr, localVars, globalVars);
          newValue = this._applyOperator(currentValue, rightValue, op);
        }
        
        if (localVars[name]) {
          const oldValue = localVars[name].value;
          localVars[name].value = newValue;
          currentFrame.locals = { ...localVars };
          
          trace.push({
            id: stepId++,
            line: lineNum,
            type: 'assignment',
            explanation: `Assign ${name} ${operator} ${valueExpr} → ${newValue}`,
            state: createState({ ...globalVars }, [...currentCallStack]),
            animation: { 
              type: 'value_change', 
              target: 'stack', 
              duration: 400,
              element: name,
              from: oldValue,
              to: newValue
            }
          });
        } else if (globalVars[name]) {
          const oldValue = globalVars[name].value;
          globalVars[name].value = newValue;
          
          trace.push({
            id: stepId++,
            line: lineNum,
            type: 'assignment',
            explanation: `Assign global ${name} ${operator} ${valueExpr} → ${newValue}`,
            state: createState({ ...globalVars }, [...currentCallStack]),
            animation: { 
              type: 'value_change', 
              target: 'global', 
              duration: 400,
              element: name,
              from: oldValue,
              to: newValue
            }
          });
        }
        continue;
      }

      // Increment/Decrement operations
      const incDecMatch = trimmed.match(/^(\w+)([\+\-]{2});?$/);
      if (incDecMatch) {
        const [, name, operator] = incDecMatch;
        const isIncrement = operator === '++';
        
        if (localVars[name]) {
          const oldValue = localVars[name].value;
          const newValue = isIncrement ? oldValue + 1 : oldValue - 1;
          localVars[name].value = newValue;
          currentFrame.locals = { ...localVars };
          
          trace.push({
            id: stepId++,
            line: lineNum,
            type: 'assignment',
            explanation: `${name}${operator} → ${newValue}`,
            state: createState({ ...globalVars }, [...currentCallStack]),
            animation: { 
              type: 'value_change', 
              target: 'stack', 
              duration: 400,
              element: name,
              from: oldValue,
              to: newValue
            }
          });
        } else if (globalVars[name]) {
          const oldValue = globalVars[name].value;
          const newValue = isIncrement ? oldValue + 1 : oldValue - 1;
          globalVars[name].value = newValue;
          
          trace.push({
            id: stepId++,
            line: lineNum,
            type: 'assignment',
            explanation: `Global ${name}${operator} → ${newValue}`,
            state: createState({ ...globalVars }, [...currentCallStack]),
            animation: { 
              type: 'value_change', 
              target: 'global', 
              duration: 400,
              element: name,
              from: oldValue,
              to: newValue
            }
          });
        }
        continue;
      }

      // Detect loop start (for/while that wasn't caught by variable declaration)
      if ((trimmed.startsWith('for') || trimmed.startsWith('while')) && !inLoop) {
        inLoop = true;
        loopDepth++;
        
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'loop_start',
          explanation: `Start ${trimmed.startsWith('for') ? 'for' : 'while'} loop`,
          state: createState({ ...globalVars }, [...currentCallStack]),
          animation: { type: 'highlight', target: 'line', duration: 300 }
        });
        continue;
      }

      // Detect loop end (closing brace)
      if (trimmed === '}' && inLoop && loopDepth > 0) {
        // Check if this closes a loop by looking back
        let isLoopEnd = false;
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j].trim();
          if (prevLine.includes('++') || prevLine.includes('--') || 
              prevLine.startsWith('for') || prevLine.startsWith('while')) {
            isLoopEnd = true;
            break;
          }
          if (prevLine === '{') break;
        }

        if (isLoopEnd) {
          loopDepth--;
          if (loopDepth === 0) inLoop = false;
          
          trace.push({
            id: stepId++,
            line: lineNum,
            type: 'loop_end',
            explanation: 'Exit loop',
            state: createState({ ...globalVars }, [...currentCallStack]),
            animation: { type: 'highlight', target: 'line', duration: 300 }
          });
        }
        continue;
      }

      // Detect printf/cout output
      if (trimmed.includes('printf') || trimmed.includes('cout')) {
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'output',
          explanation: `Output statement: ${trimmed.substring(0, 60)}${trimmed.length > 60 ? '...' : ''}`,
          state: createState({ ...globalVars }, [...currentCallStack]),
          animation: { type: 'appear', target: 'overlay', duration: 500 }
        });
        continue;
      }

      // Return statement
      if (trimmed.includes('return')) {
        const returnMatch = trimmed.match(/return\s+([^;]+);?/);
        const returnValue = returnMatch ? this._evaluateExpression(returnMatch[1], localVars, globalVars) : 0;
        
        trace.push({
          id: stepId++,
          line: lineNum,
          type: 'function_return',
          explanation: `Return from ${currentFrame.function}()${returnValue !== undefined ? ` with value: ${returnValue}` : ''}`,
          state: createState({ ...globalVars }, []),
          animation: { type: 'pop_frame', target: 'stack', duration: 400 }
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
      explanation: 'Program execution completed successfully',
      state: createState(),
      animation: { type: 'disappear', target: 'global', duration: 500 }
    });

    console.log(`📊 Trace statistics: ${trace.length} total steps, ${Object.keys(globalVars).length} globals, ${Object.keys(localVars).length} locals`);
    return trace;
  }

  /**
   * Enhanced expression evaluator with support for complex expressions
   */
  _evaluateExpression(expr, localVars = {}, globalVars = {}) {
    const trimmed = expr.trim();
    
    // Number literals
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    
    // String literals
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    
    // Character literals
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.charCodeAt(1);
    }
    
    // Variable reference
    if (/^\w+$/.test(trimmed)) {
      if (localVars[trimmed]) return localVars[trimmed].value;
      if (globalVars[trimmed]) return globalVars[trimmed].value;
      return 0;
    }
    
    // Binary operations: a + b, a - b, a * b, a / b, a % b
    const binaryMatch = trimmed.match(/^(.+?)\s*([\+\-\*\/%])\s*(.+)$/);
    if (binaryMatch) {
      const [, left, op, right] = binaryMatch;
      const leftVal = this._evaluateExpression(left, localVars, globalVars);
      const rightVal = this._evaluateExpression(right, localVars, globalVars);
      return this._applyOperator(leftVal, rightVal, op);
    }
    
    // Parenthesized expressions
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return this._evaluateExpression(trimmed.slice(1, -1), localVars, globalVars);
    }
    
    // Fallback: try to parse as value
    return this._parseValue(trimmed);
  }

  /**
   * Apply binary operator
   */
  _applyOperator(left, right, operator) {
    const l = typeof left === 'number' ? left : parseFloat(left) || 0;
    const r = typeof right === 'number' ? right : parseFloat(right) || 0;
    
    switch (operator) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/': return r !== 0 ? Math.floor(l / r) : 0;
      case '%': return r !== 0 ? l % r : 0;
      default: return 0;
    }
  }

  /**
   * Parse simple values
   */
  _parseValue(expr) {
    const trimmed = expr.trim();
    
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
    if (trimmed === 'true') return 1;
    if (trimmed === 'false') return 0;
    if (trimmed === 'NULL' || trimmed === 'null') return 0;
    
    return trimmed;
  }

  async validateSyntax(code, language = 'c') {
    try {
      const walker = new ASTWalker(language);
      const tree = walker.parse(code);
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  getTraceStats(trace) {
    const stats = {
      totalSteps: trace.length,
      stepTypes: {},
      maxStackDepth: 0,
      globalCount: 0,
      localCount: 0
    };

    for (const step of trace) {
      stats.stepTypes[step.type] = (stats.stepTypes[step.type] || 0) + 1;
      
      if (step.state?.callStack) {
        stats.maxStackDepth = Math.max(stats.maxStackDepth, step.state.callStack.length);
      }
      
      if (step.state?.globals) {
        stats.globalCount = Math.max(stats.globalCount, Object.keys(step.state.globals).length);
      }
      
      if (step.state?.callStack?.[0]?.locals) {
        stats.localCount = Math.max(stats.localCount, Object.keys(step.state.callStack[0].locals).length);
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
export { TraceService };
