/**
 * Trace Service
 * Orchestrates parsing, interpretation, and trace generation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path, { fileURLToPath } from 'path';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TraceService {
  constructor() {
    this.walker = null;
    this.interpreter = null;
  }

  /**
   * Generate execution trace for C/C++ code
   * @param {string} code - Source code
   * @param {string} language - 'c' or 'cpp'
   * @param {Array} inputs - User inputs for scanf/cin
   * @returns {Promise<Array<ExecutionStep>>}
   */
  async generateTrace(code, language = 'c', inputs = []) {
    const tempFilePath = path.join(__dirname, '../../temp', `temp.${language}`);
    const executablePath = path.join(__dirname, '../../temp', 'temp_executable');
    const gccCommand = language === 'c' ? `gcc -o ${executablePath} ${tempFilePath}` : `g++ -o ${executablePath} ${tempFilePath}`;

    try {
      // Write code to a temporary file
      fs.writeFileSync(tempFilePath, code);

      // Compile the code with GCC
      await execAsync(gccCommand);

      // Execute the compiled binary and capture the output
      const { stdout } = await execAsync(executablePath);

      // Clean up temporary files
      fs.unlinkSync(tempFilePath);
      fs.unlinkSync(executablePath);

      // Parse the execution trace from the output
      const trace = JSON.parse(stdout);

      // Validate the trace
      this._validateTrace(trace);

      return trace;
    } catch (error) {
      console.error(`❌ Trace generation error: ${error.message}`);

      // Clean up temporary files
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (fs.existsSync(executablePath)) {
        fs.unlinkSync(executablePath);
      }

      throw new Error(`Trace generation failed: ${error.message}`);
    }
  }

  /**
   * Validate syntax using GCC
   */
  async validateSyntax(code, language = 'c') {
    const tempFilePath = path.join(__dirname, '../../temp', `temp.${language}`);
    const gccCommand = language === 'c' ? `gcc -fsyntax-only ${tempFilePath}` : `g++ -fsyntax-only ${tempFilePath}`;

    try {
      // Write code to a temporary file
      fs.writeFileSync(tempFilePath, code);

      // Run GCC for syntax validation
      await execAsync(gccCommand);

      // Clean up temporary file
      fs.unlinkSync(tempFilePath);

      return { valid: true, errors: [] };
    } catch (error) {
      // Extract GCC error messages
      const gccErrors = error.stderr.split('\n').filter(line => line);

      // Clean up temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      return { valid: false, errors: gccErrors };
    }
  }

  /**
   * Validate execution trace
   */
  _validateTrace(trace) {
    if (!Array.isArray(trace)) {
      throw new Error('Invalid trace: not an array');
    }

    if (trace.length === 0) {
      throw new Error('Invalid trace: empty trace');
    }

    // Validate each step
    for (const step of trace) {
      if (!step.id && step.id !== 0) {
        throw new Error('Invalid step: missing id');
      }
      if (!step.line) {
        throw new Error(`Invalid step ${step.id}: missing line number`);
      }
      if (!step.type) {
        throw new Error(`Invalid step ${step.id}: missing type`);
      }
      if (!step.explanation) {
        throw new Error(`Invalid step ${step.id}: missing explanation`);
      }
      if (!step.state) {
        throw new Error(`Invalid step ${step.id}: missing state`);
      }
    }

    return true;
  }

  /**
   * Extract input requirements from code
   */
  async extractInputRequirements(code, language = 'c') {
    try {
      const walker = new ASTWalker(language);
      const tree = walker.parse(code);
      
      const requirements = [];
      
      this._scanForInputs(tree.rootNode, requirements);
      
      return requirements;
    } catch (error) {
      return [];
    }
  }

  /**
   * Scan AST for input statements
   */
  _scanForInputs(node, requirements) {
    if (node.type === 'call_expression') {
      const funcNode = node.childForFieldName('function');
      if (funcNode && (funcNode.text === 'scanf' || funcNode.text === 'cin')) {
        requirements.push({
          line: node.startPosition.row + 1,
          function: funcNode.text,
          type: funcNode.text === 'scanf' ? 'scanf' : 'cin'
        });
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      this._scanForInputs(node.child(i), requirements);
    }
  }
}

export default TraceService;