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
      }
      
      // Step 3: Generate trace with LLDB
      const traceResult = await lldbDebugger.generateTrace(executable, semanticInfo);
      
      // Step 4: Enhance trace with semantic information
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
        const classInfo = semanticInfo.classes.find(c => c.name === step.className);
        if (classInfo) {
          enhanced.classInfo = {
            members: classInfo.members.filter(m => m.isField),
            methods: classInfo.members.filter(m => m.isMethod),
            hasConstructor: classInfo.hasConstructor,
            hasDestructor: classInfo.hasDestructor
          };
        }
      }
      
      // Enhance explanation with better context
      if (step.type === 'object_creation') {
        enhanced.explanation = `Creating object ${step.objectName || step.variable} of class ${step.className}`;
      } else if (step.type === 'variable_declaration') {
        enhanced.explanation = `Declared variable ${step.variable}`;
      } else if (step.type === 'assignment') {
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
      if (step.type === 'function_call' && step.function && !seen.has(step.function)) {
        functions.push({
          name: step.function,
          line: step.line,
          returnType: 'unknown'
        });
        seen.add(step.function);
      }
    }

    return functions;
  }
}

export default new HybridDebugger();