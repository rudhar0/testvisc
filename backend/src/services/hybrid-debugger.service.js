import clangAnalyzer from './clang-analyzer.service.js';
import lldbDebugger from './lldb-debugger.service.js';
import compilerService from './compiler.service.js';

class HybridDebugger {
  /**
   * Complete debugging workflow:
   * 1. Clang semantic analysis (structure)
   * 2. Compilation
   * 3. LLDB execution trace (runtime values)
   */
  async generateTrace(code, language = 'cpp') {
    console.log('🚀 Starting Hybrid Debugging (Clang + LLDB)...');
    
    try {
      // Step 1: Clang Semantic Analysis
      let semanticInfo = null;
      
      if (language === 'cpp' || language === 'c++') {
        try {
          semanticInfo = await clangAnalyzer.analyzeCode(code, language);
          console.log('📊 Semantic analysis complete:', {
            classes: semanticInfo.classes.length,
            constructors: semanticInfo.constructors.length,
            variables: semanticInfo.variables.length
          });
        } catch (error) {
          console.warn('⚠️  Clang analysis failed, continuing without semantic info:', error.message);
        }
      }
      
      // Step 2: Compile
      const { executable, sourceFile } = await compilerService.compile(code, language);
      console.log('✅ Compilation successful:', executable);
      
      // Add source file to semantic info
      if (semanticInfo) {
        semanticInfo.source_file = sourceFile;
      } else {
        semanticInfo = { source_file: sourceFile };
      }
      
      // Step 3: Generate trace with LLDB
      const traceResult = await lldbDebugger.generateTrace(executable, semanticInfo);
      
      // Step 4: Check if trace is meaningful
      if (!traceResult.steps || traceResult.totalSteps === 0) {
        console.warn('⚠️  No steps generated - creating minimal trace from source');
        return this.createMinimalTrace(code, semanticInfo);
      }
      
      // Step 5: Enhance trace with semantic information
      const enhancedTrace = this.enhanceTraceWithSemantics(traceResult.steps, semanticInfo);
      
      console.log(`✅ Hybrid debugging complete: ${enhancedTrace.length} steps`);
      
      return {
        steps: enhancedTrace,
        totalSteps: enhancedTrace.length,
        globals: this.extractGlobals(enhancedTrace),
        functions: this.extractFunctions(enhancedTrace, semanticInfo),
        metadata: {
          debugger: 'hybrid-clang-lldb',
          hasSemanticInfo: !!semanticInfo
        }
      };
      
    } catch (error) {
      console.error('❌ Hybrid debugging failed:', error);
      throw error;
    }
  }

  /**
   * Create minimal trace when LLDB fails
   * This is a fallback for very simple programs
   */
  createMinimalTrace(code, semanticInfo) {
    console.log('🔧 Creating minimal trace from source analysis...');
    
    const lines = code.split('\n').filter(line => {
      const trimmed = line.trim();
      // Skip empty lines, comments, preprocessor, braces
      return trimmed && 
             !trimmed.startsWith('//') &&
             !trimmed.startsWith('/*') &&
             !trimmed.startsWith('#') &&
             !trimmed.startsWith('{') &&
             !trimmed.startsWith('}') &&
             trimmed !== 'using namespace std;';
    });
    
    const steps = [];
    let stepId = 0;
    
    // Find main function start
    const mainStart = code.indexOf('int main()');
    let currentLine = 1;
    
    if (mainStart >= 0) {
      currentLine = code.substring(0, mainStart).split('\n').length;
    }
    
    // Create entry step
    steps.push({
      id: stepId++,
      type: 'function_call',
      line: currentLine,
      function: 'main',
      explanation: 'Entering main function',
      state: {
        callStack: [{
          function: 'main',
          line: currentLine,
          file: 'main.cpp',
          locals: {}
        }],
        globals: {},
        stack: [],
        heap: {}
      }
    });
    
    // Analyze code for variable declarations and operations
    const varPattern = /\b(int|float|double|char|bool|string|auto)\s+(\w+)\s*=?\s*([^;]*);/g;
    const classInstPattern = /(\w+)\s+(\w+)(\([^)]*\))?;/g;
    
    let match;
    let lineNum = 1;
    
    for (const line of code.split('\n')) {
      lineNum++;
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
        continue;
      }
      
      // Check for variable declarations
      const varMatch = varPattern.exec(line);
      if (varMatch) {
        const [, type, name, value] = varMatch;
        steps.push({
          id: stepId++,
          type: 'variable_declaration',
          line: lineNum,
          function: 'main',
          variable: name,
          dataType: type,
          value: value.trim() || null,
          explanation: `Declared variable ${name}`,
          state: {
            callStack: [{
              function: 'main',
              line: lineNum,
              file: 'main.cpp',
              locals: {
                [name]: {
                  name,
                  type,
                  value: value.trim() || null,
                  scope: 'local',
                  isAlive: true
                }
              }
            }],
            globals: {},
            stack: [],
            heap: {}
          }
        });
      }
      
      // Check for class instantiation
      if (semanticInfo?.classes?.length > 0 && trimmed.includes(' ') && trimmed.endsWith(';')) {
        for (const cls of semanticInfo.classes) {
          if (trimmed.includes(cls.name + ' ')) {
            const objMatch = new RegExp(`${cls.name}\\s+(\\w+)`).exec(trimmed);
            if (objMatch) {
              steps.push({
                id: stepId++,
                type: 'object_creation',
                line: lineNum,
                function: 'main',
                className: cls.name,
                objectName: objMatch[1],
                explanation: `Created object ${objMatch[1]} of class ${cls.name}`,
                state: {
                  callStack: [{
                    function: 'main',
                    line: lineNum,
                    file: 'main.cpp',
                    locals: {
                      [objMatch[1]]: {
                        name: objMatch[1],
                        type: cls.name,
                        primitive: 'class',
                        className: cls.name,
                        value: [],
                        scope: 'local',
                        isAlive: true
                      }
                    }
                  }],
                  globals: {},
                  stack: [],
                  heap: {}
                }
              });
            }
          }
        }
      }
      
      // Check for cout/printf statements
      if (trimmed.includes('cout') || trimmed.includes('printf')) {
        steps.push({
          id: stepId++,
          type: 'line_execution',
          line: lineNum,
          function: 'main',
          explanation: `Executing output statement`,
          state: {
            callStack: [{
              function: 'main',
              line: lineNum,
              file: 'main.cpp',
              locals: {}
            }],
            globals: {},
            stack: [],
            heap: {}
          }
        });
      }
      
      // Check for return statement
      if (trimmed.startsWith('return ')) {
        steps.push({
          id: stepId++,
          type: 'line_execution',
          line: lineNum,
          function: 'main',
          explanation: 'Returning from main',
          state: {
            callStack: [{
              function: 'main',
              line: lineNum,
              file: 'main.cpp',
              locals: {}
            }],
            globals: {},
            stack: [],
            heap: {}
          }
        });
      }
    }
    
    // Add program end
    steps.push({
      id: stepId++,
      type: 'program_end',
      line: lineNum,
      explanation: 'Program execution completed',
      state: {
        callStack: [],
        globals: {},
        stack: [],
        heap: {}
      }
    });
    
    console.log(`✅ Created minimal trace: ${steps.length} steps`);
    
    return {
      steps,
      totalSteps: steps.length,
      globals: [],
      functions: [{ name: 'main', line: currentLine, returnType: 'int' }],
      metadata: {
        debugger: 'minimal-fallback',
        hasSemanticInfo: !!semanticInfo,
        isFallback: true
      }
    };
  }

  /**
   * Enhance LLDB trace with Clang semantic information
   */
  enhanceTraceWithSemantics(steps, semanticInfo) {
    if (!semanticInfo) return steps;
    
    return steps.map((step, index) => {
      const enhanced = { ...step };
      
      // Add birthStep to all variables
      if (step.state?.callStack && step.state.callStack[0]) {
        const frame = step.state.callStack[0];
        if (frame.locals) {
          Object.values(frame.locals).forEach(variable => {
            if (!variable.birthStep) {
              variable.birthStep = index;
            }
          });
        }
      }
      
      // Enhance object_creation steps with class info
      if (step.type === 'object_creation' && step.className) {
        const classInfo = semanticInfo.classes?.find(c => c.name === step.className);
        if (classInfo) {
          enhanced.classInfo = {
            members: classInfo.members?.filter(m => m.isField) || [],
            methods: classInfo.members?.filter(m => m.isMethod) || [],
            hasConstructor: classInfo.hasConstructor,
            hasDestructor: classInfo.hasDestructor
          };
        }
      }
      
      // Enhance explanation with better context
      if (step.type === 'object_creation' && !enhanced.explanation.includes('Creating')) {
        enhanced.explanation = `Creating object ${step.objectName || step.variable} of class ${step.className}`;
      } else if (step.type === 'variable_declaration' && !enhanced.explanation.includes('Declared')) {
        enhanced.explanation = `Declared variable ${step.variable}`;
      } else if (step.type === 'assignment' && !enhanced.explanation.includes('Assigned')) {
        enhanced.explanation = `Assigned value to ${step.variable}`;
      }
      
      return enhanced;
    });
  }

  extractGlobals(trace) {
    const globals = [];
    const seen = new Set();

    for (const step of trace) {
      if (step.state?.globals) {
        Object.values(step.state.globals).forEach(g => {
          if (!seen.has(g.name)) {
            globals.push(g);
            seen.add(g.name);
          }
        });
      }
    }

    return globals;
  }

  extractFunctions(trace, semanticInfo) {
    const functions = [];
    const seen = new Set();

    // From semantic info
    if (semanticInfo?.functions) {
      semanticInfo.functions.forEach(f => {
        functions.push({
          name: f.name,
          signature: f.signature,
          line: f.line,
          returnType: f.signature.split('(')[0].trim()
        });
        seen.add(f.name);
      });
    }

    // From trace
    for (const step of trace) {
      if (step.function && !seen.has(step.function)) {
        functions.push({
          name: step.function,
          line: step.line,
          returnType: 'unknown'
        });
        seen.add(step.function);
      }
    }

    // Always ensure main is included
    if (!seen.has('main')) {
      functions.push({
        name: 'main',
        line: 1,
        returnType: 'int'
      });
    }

    return functions;
  }
}

export default new HybridDebugger();