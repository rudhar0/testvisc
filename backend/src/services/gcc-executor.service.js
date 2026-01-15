/**
 * GCC Executor Service
 * Handles compilation and execution within a Docker sandbox
 */

import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import GdbController from './gdb-controller.js';
import fs from 'fs';
import path from 'path';

class GccExecutor {
  constructor() {
    this.docker = new Docker();
    // Ensure this image exists: docker build -t testvisc-sandbox .
    this.image = 'testvisc-sandbox'; 
  }

  /**
   * Execute code and return trace
   */
  async execute(code, language, inputs = []) {
    let container = null;
    try {
      // 1. Create Sandbox
      container = await this._createSandbox();

      // 2. Prepare Files
      const sourceExt = language === 'cpp' ? 'cpp' : 'c';
      const sourceFile = `source.${sourceExt}`;
      const inputFile = 'input.txt';
      
      // Write source code using a here-document to avoid shell escaping issues
      const sourceDelimiter = `EOF_SOURCE_${uuidv4().replace(/-/g, '')}`;
      await this._execCommand(container, ['bash', '-c', `cat > ${sourceFile} <<'${sourceDelimiter}'\n${code}\n${sourceDelimiter}`]);
      
      // Write inputs using a here-document
      const inputStr = inputs.join('\n');
      const inputDelimiter = `EOF_INPUT_${uuidv4().replace(/-/g, '')}`;
      await this._execCommand(container, ['bash', '-c', `cat > ${inputFile} <<'${inputDelimiter}'\n${inputStr}\n${inputDelimiter}`]);

      // 3. Compile
      const compiler = language === 'cpp' ? 'g++' : 'gcc';
      const compileCmd = [compiler, '-g', '-O0', sourceFile, '-o', 'app'];
      
      const compileResult = await this._execCommand(container, compileCmd);
      if (compileResult.exitCode !== 0) {
        throw new Error(`Compilation failed:\n${compileResult.stderr}`);
      }

      // 4. Run GDB
      return await this._runGdbSession(container, 'app', inputFile);

    } finally {
      // Cleanup
      if (container) {
        try {
          await container.stop();
          await container.remove();
        } catch (e) {
          console.error('Error cleaning up container:', e);
        }
      }
    }
  }

  /**
   * Validate syntax only
   */
  async validate(code, language) {
    let container = null;
    try {
      container = await this._createSandbox();
      const sourceExt = language === 'cpp' ? 'cpp' : 'c';
      const sourceFile = `source.${sourceExt}`;
      
      // Write source code using a here-document to avoid shell escaping issues
      const sourceDelimiter = `EOF_VALIDATE_${uuidv4().replace(/-/g, '')}`;
      await this._execCommand(container, ['bash', '-c', `cat > ${sourceFile} <<'${sourceDelimiter}'\n${code}\n${sourceDelimiter}`]);
      
      const compiler = language === 'cpp' ? 'g++' : 'gcc';
      const result = await this._execCommand(container, [compiler, '-fsyntax-only', sourceFile]);
      
      return {
        valid: result.exitCode === 0,
        errors: result.exitCode !== 0 ? result.stderr.split('\n') : []
      };
    } catch (e) {
      return { valid: false, errors: [e.message] };
    } finally {
      if (container) {
        try { await container.stop(); await container.remove(); } catch (e) {}
      }
    }
  }

  async _createSandbox() {
    const container = await this.docker.createContainer({
      Image: 'gcc:latest', // Using standard gcc image, assuming gdb is installed or we install it
      Cmd: ['tail', '-f', '/dev/null'], // Keep alive
      Tty: false,
      HostConfig: {
        Memory: 512 * 1024 * 1024, // 512MB
        CpuQuota: 50000, // 50% CPU
        NetworkMode: 'none'
      }
    });
    
    await container.start();
    
    // Install GDB if not present (fallback if custom image not used)
    // In production, use a pre-built image with GDB
    await this._execCommand(container, ['apt-get', 'update']);
    await this._execCommand(container, ['apt-get', 'install', '-y', 'gdb']);
    
    return container;
  }

  async _execCommand(container, cmd) {
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start();
    let stdout = '';
    let stderr = '';

    return new Promise((resolve, reject) => {
      container.modem.demuxStream(stream, {
        write: (chunk) => stdout += chunk.toString('utf8')
      }, {
        write: (chunk) => stderr += chunk.toString('utf8')
      });

      stream.on('end', async () => {
        const inspect = await exec.inspect();
        resolve({ exitCode: inspect.ExitCode, stdout, stderr });
      });
    });
  }

  async _runGdbSession(container, binary, inputFile) {
    const trace = [];
    
    // Start GDB in MI mode
    const exec = await container.exec({
      Cmd: ['gdb', '--interpreter=mi', binary],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false
    });

    const stream = await exec.start({ hijack: true, stdin: true });
    const gdb = new GdbController(stream);

    // Initialize GDB
    // Redirect stdin from file for scanf
    await gdb.sendCommand(`-exec-arguments < ${inputFile}`);
    await gdb.sendCommand('-break-insert main');
    await gdb.sendCommand('-exec-run');

    let stepId = 0;
    const maxSteps = 1000; // Safety limit

    while (stepId < maxSteps) {
      // Step
      const stepRes = await gdb.sendCommand('-exec-next');
      
      // Check if program exited
      // Note: GDB MI response for exit is complex, simplified check here:
      // If we can't get locals, we likely exited or crashed
      
      try {
        const locals = await gdb.getLocals();
        const stack = await gdb.getStack();
        
        // Construct trace step
        // We need the current line number. 
        // The -exec-next response usually contains frame info if stopped.
        // If not, we can query -stack-info-frame
        
        // For robustness, let's query frame
        // const frameRes = await gdb.sendCommand('-stack-info-frame');
        // But our simple parser might have caught it in stepRes if it was *stopped
        
        if (stepRes.line) {
          trace.push({
            id: stepId++,
            line: stepRes.line,
            type: 'step',
            explanation: `Line ${stepRes.line} executed`,
            state: {
              variables: this._formatVariables(locals),
              stack: stack,
              heap: {}   // TODO: Implement heap tracking
            }
          });
        } else {
            // If no line info, maybe we finished?
            break;
        }
      } catch (e) {
        // Likely exited
        break;
      }
    }

    return trace;
  }

  _formatVariables(locals) {
    const vars = {};
    locals.forEach(l => vars[l.name] = l.value);
    return vars;
  }
}

export default new GccExecutor();