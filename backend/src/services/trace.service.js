/**
 * Trace Service - Generate step-by-step execution trace
 * This is the CORE of the entire system
 */

import { CInterpreter } from '../interpreters/c.interpreter.js';

class TraceService {
  constructor() {
    this.interpreter = new CInterpreter();
  }

  /**
   * Main entry point - generate complete execution trace
   */
  async generateTrace(code, language = 'c', inputs = []) {
    try {
      console.log('🔍 Starting trace generation...');
      
      // Parse code and extract metadata
      const ast = this.parseCode(code, language);
      const globals = this.extractGlobals(ast);
      const functions = this.extractFunctions(ast);
      
      // Find main function
      const mainFunc = functions.find(f => f.name === 'main');
      if (!mainFunc) {
        throw new Error('No main() function found');
      }

      // Execute and generate trace
      const trace = await this.interpreter.execute(code, language, inputs);
      
      console.log(`✅ Generated ${trace.steps.length} execution steps`);
      
      return {
        steps: trace.steps,
        totalSteps: trace.steps.length,
        globals: this.formatGlobals(globals),
        functions: this.formatFunctions(functions),
        metadata: {
          language,
          linesOfCode: code.split('\n').length,
          generatedAt: Date.now()
        }
      };
      
    } catch (error) {
      console.error('❌ Trace generation failed:', error);
      throw error;
    }
  }

  /**
   * Parse code into AST (simplified version)
   */
  parseCode(code, language) {
    const lines = code.split('\n');
    const ast = {
      type: 'Program',
      body: [],
      globals: [],
      functions: []
    };

    let inFunction = false;
    let currentFunction = null;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('//') || line.startsWith('#')) {
        continue;
      }

      // Detect function declaration
      const funcMatch = line.match(/(\w+)\s+(\w+)\s*\([^)]*\)\s*\{?/);
      if (funcMatch && !inFunction) {
        currentFunction = {
          returnType: funcMatch[1],
          name: funcMatch[2],
          line: i + 1,
          body: []
        };
        inFunction = true;
        ast.functions.push(currentFunction);
        if (line.includes('{')) braceCount++;
        continue;
      }

      // Track braces
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      if (inFunction && braceCount === 0) {
        inFunction = false;
        currentFunction = null;
      }

      // Detect global variables
      if (!inFunction) {
        const globalMatch = line.match(/^(int|float|double|char)\s+(\w+)/);
        if (globalMatch) {
          ast.globals.push({
            type: globalMatch[1],
            name: globalMatch[2],
            line: i + 1
          });
        }
      }

      // Add to function body
      if (inFunction && currentFunction) {
        currentFunction.body.push({
          line: i + 1,
          code: line
        });
      }
    }

    return ast;
  }

  /**
   * Extract global variables
   */
  extractGlobals(ast) {
    return ast.globals || [];
  }

  /**
   * Extract functions
   */
  extractFunctions(ast) {
    return ast.functions || [];
  }

  /**
   * Format globals for response
   */
  formatGlobals(globals) {
    return globals.map(g => ({
      name: g.name,
      type: g.type,
      line: g.line,
      scope: 'global'
    }));
  }

  /**
   * Format functions for response
   */
  formatFunctions(functions) {
    return functions.map(f => ({
      name: f.name,
      returnType: f.returnType,
      line: f.line,
      isMain: f.name === 'main'
    }));
  }
}

export const traceService = new TraceService();