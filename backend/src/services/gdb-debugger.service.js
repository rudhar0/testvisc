// backend/src/services/gdb-debugger.service.js
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import inputManagerService from './input-manager.service.js';

/**
 * GDB Debugger Service - FIXED VERSION with correct step types
 */
export default class GdbDebugger {
  constructor(socket) {
    this.process = null;
    this.outputBuffer = '';
    this.commandQueue = [];
    this.currentCommand = null;
    this.isRunning = false;
    this.sourceFile = null;
    this.executable = null;
    this.tempDir = path.join(process.cwd(), 'temp');
    this.trace = [];
    this.stepId = 0;
    this.variableAddresses = new Map();
    this.inputManager = inputManagerService;
    this.inputManager.setSocket(socket);
    this.isWaitingForInputStep = false;
    this.inputStepPromise = {};
    this.previousVariables = {};
    this.sourceCode = '';
    // Only accumulate program output (from MI ~"...") to avoid MI noise
    this.accumulatedOutput = '';
    this.programOutput = '';
    this.lastProgramOutput = '';
    this.lastOutputStep = '';
  }

  unescapeMiString(str) {
    // str is expected to be a quoted MI string like "hello\n"
    if (str.startsWith('"') && str.endsWith('"')) {
      str = str.slice(1, -1);
    }
    return str.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }

  preprocessCode(code) {
    let formatted = '';
    let state = 'normal';
    
    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const next = code[i + 1];
      
      formatted += char;
      
      if (state === 'normal') {
        if (char === '"') state = 'string';
        else if (char === "'") state = 'char';
        else if (char === '/' && next === '/') {
          state = 'line_comment';
          formatted += next; i++;
        }
        else if (char === '/' && next === '*') {
          state = 'block_comment';
          formatted += next; i++;
        }
        else if (char === ';' || char === '{' || char === '}') {
           if (next && next !== '\n' && next !== '\r') {
             formatted += '\n';
           }
        }
      } else if (state === 'string') {
        if (char === '"' && code[i-1] !== '\\') state = 'normal';
      } else if (state === 'char') {
        if (char === "'" && code[i-1] !== '\\') state = 'normal';
      } else if (state === 'line_comment') {
        if (char === '\n') state = 'normal';
      } else if (state === 'block_comment') {
        if (char === '*' && next === '/') {
          state = 'normal';
          formatted += next; i++;
        }
      }
    }
    return formatted;
  }

  async compile(code, language = 'c') {
    console.log('🔨 Compiling code...');
    
    const sessionId = uuidv4();
    const ext = language === 'cpp' ? 'cpp' : 'c';
    const compiler = language === 'cpp' ? 'g++' : 'gcc';

    if (!existsSync(this.tempDir)) {
      await mkdir(this.tempDir, { recursive: true });
    }

    this.sourceFile = path.join(this.tempDir, `${sessionId}.${ext}`);
    this.executable = path.join(this.tempDir, `${sessionId}.out`);

    const formattedCode = this.preprocessCode(code);
    await writeFile(this.sourceFile, formattedCode, 'utf-8');
    this.sourceCode = formattedCode; // Store source code
    console.log('📝 Source file written:', this.sourceFile);

    this.inputManager.scanCode(formattedCode);

    return new Promise((resolve, reject) => {
      const args = ['-g', '-O0', this.sourceFile, '-o', this.executable];
      const compilation = spawn(compiler, args);
      let stderr = '';

      compilation.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      compilation.on('close', (code) => {
        if (code !== 0) {
          console.error('❌ Compilation failed:', stderr);
          reject(new Error(`Compilation failed: ${stderr}`));
        } else {
          console.log('✅ Compilation successful');
          resolve();
        }
      });

      compilation.on('error', (err) => {
        console.error('❌ Compilation process error:', err);
        reject(err);
      });
    });
  }

  async start() {
    console.log('🚀 Starting GDB...');
    
    return new Promise((resolve, reject) => {
      this.process = spawn('gdb', [
        '--interpreter=mi',
        '--quiet',
        this.executable
      ]);

      this.process.stdout.on('data', (data) => {
        this.handleOutput(data.toString());
      });

      this.process.stderr.on('data', (data) => {
        console.error('GDB stderr:', data.toString());
      });

      this.process.on('close', (code) => {
        console.log(`GDB process exited with code ${code}`);
        this.isRunning = false;
      });

      this.process.on('error', (error) => {
        console.error('❌ GDB process error:', error);
        reject(error);
      });

      setTimeout(() => {
        this.isRunning = true;
        console.log('✅ GDB started successfully');
        resolve();
      }, 500);
    });
  }

  handleOutput(data) {
    this.outputBuffer += data;
    this.accumulatedOutput += data;
    let newlineIndex;
    while ((newlineIndex = this.outputBuffer.indexOf('\n')) !== -1) {
      const line = this.outputBuffer.substring(0, newlineIndex).trim();
      this.outputBuffer = this.outputBuffer.substring(newlineIndex + 1);
      if (line) {
        // Capture MI console output lines (program stdout/stderr) which start with ~
        if (line.startsWith('@')) {
          try {
            const text = this.unescapeMiString(line.substring(1).trim());
            this.programOutput += text;
          } catch (e) {
            // ignore parse errors
          }
          // continue processing other line types
          continue;
        }
        if (this.isWaitingForInputStep) {
          if (line.startsWith('^done') || line.startsWith('^error') || line.startsWith('*stopped')) {
            this.isWaitingForInputStep = false;
            this.inputStepPromise.resolve({ status: line.split(',')[0].substring(1), data: line });
          }
        } else if (this.currentCommand) {
          if (line.startsWith('^done') || line.startsWith('^error') || line.startsWith('*stopped')) {
            this.currentCommand.resolve({
              status: line.split(',')[0].substring(1),
              data: line
            });
            this.currentCommand = null;
            this.processQueue();
          }
        }
      }
    }
  }

  sendCommand(command) {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject });
      if (!this.currentCommand) {
        this.processQueue();
      }
    });
  }

  processQueue() {
    if (this.commandQueue.length === 0 || this.currentCommand) {
      return;
    }

    this.currentCommand = this.commandQueue.shift();
    console.log('GDB <', this.currentCommand.command);
    this.process.stdin.write(this.currentCommand.command + '\n');

    setTimeout(() => {
      if (this.currentCommand) {
        console.warn('⚠️  Command timeout:', this.currentCommand.command);
        this.currentCommand.resolve({ status: 'timeout', data: '' });
        this.currentCommand = null;
        this.processQueue();
      }
    }, 5000);
  }

  stepOverInput(inputValue) {
    return new Promise((resolve, reject) => {
        this.isWaitingForInputStep = true;
        this.inputStepPromise = { resolve, reject };

        const timeout = setTimeout(() => {
            if (this.isWaitingForInputStep) {
                this.isWaitingForInputStep = false;
                reject(new Error('Input step timed out'));
            }
        }, 10000);

        console.log('GDB <', '-exec-next');
        this.process.stdin.write('-exec-next\n');
        console.log('GDB <', `(input) ${inputValue}`);
        this.process.stdin.write(`${inputValue}\n`);
    });
  }

  async generateTrace(inputs = []) {
    console.log('🎬 Generating execution trace...');
    this.trace = [];
    this.stepId = 0;
    this.variableAddresses.clear();
    this.previousVariables = {};

    try {
      await this.sendCommand('-break-insert main');
      
      for (const lineNumber of this.inputManager.inputLines.keys()) {
        await this.sendCommand(`-break-insert ${lineNumber}`);
      }
      
      const runResult = await this.sendCommand('-exec-run');
      
      if (!runResult.data.includes('reason="breakpoint-hit"')) {
        this.addStep({
          type: 'program_end',
          line: 1,
          explanation: 'Program finished before main breakpoint.',
          state: this.captureState({}, [])
        });
        console.warn('⚠️  Program did not stop at main breakpoint.');
        return this.trace;
      }

      let currentStopInfo = this.parseStoppedInfo(runResult.data);
      let locals = await this.getLocals();
      let frames = await this.getFrames();

      this.addStep({
        type: 'function_call',
        line: currentStopInfo.line,
        function: 'main',
        explanation: `Execution starts at main on line ${currentStopInfo.line}`,
        state: this.captureState(locals, frames)
      });

      let maxSteps = 100;
      let stepCount = 0;

      while (stepCount < maxSteps) {
        let result;
        const currentLine = currentStopInfo.line;

        if (this.inputManager.isInputLine(currentLine)) {
          const inputInfo = this.inputManager.getInputInfo(currentLine);
          
          try {
            const userInput = await this.inputManager.requestInput(inputInfo);
            result = await this.stepOverInput(userInput);
          } catch (e) {
            console.error('Error handling input step:', e);
            result = { status: 'error', data: 'Input step failed' };
          }
        } else {
          result = await this.sendCommand('-exec-step');
        }

        if (result.status === 'error' || result.status === 'timeout' || result.data.includes('reason="exited"')) {
          console.log('⏹️  Execution finished. Breaking loop.');
          break;
        }

        if (result.data.includes('reason="signal-received"')) {
          console.error('💥 Runtime Error Detected:', result.data);
          const signalName = result.data.match(/signal-name="([^"]+)"/)?.[1];
          const signalMeaning = result.data.match(/signal-meaning="([^"]+)"/)?.[1];
          const stoppedInfo = this.parseStoppedInfo(result.data);
          
          this.addStep({
            type: 'runtime_error',
            line: stoppedInfo.line,
            explanation: `Runtime Error: ${signalMeaning || signalName || 'Unknown Signal'}`,
            state: this.captureState(await this.getLocals(), await this.getFrames())
          });
          break;
        }

        const stoppedInfo = this.parseStoppedInfo(result.data);
        
        if (!stoppedInfo || !stoppedInfo.line) {
          console.warn('⚠️  No line info, stopping trace.');
          break;
        }
        currentStopInfo = stoppedInfo;

        const lineOfCode = this.sourceCode.split('\n')[stoppedInfo.line - 1] || '';

        if (lineOfCode.trim() !== '}') {
            const newLocals = await this.getLocals();
            const newFrames = await this.getFrames();
            
            // FIXED: Detect what changed and create appropriate step type
            const stepInfo = this.detectStepType(newLocals, this.previousVariables, lineOfCode);
            
            console.log('📋 Step info generated:', stepInfo);
            
            this.addStep({
              ...stepInfo,
              line: stoppedInfo.line,
              state: this.captureState(newLocals, newFrames)
            });

            // Output capturing logic
            // Use only program output parsed from MI (~"...") to avoid MI noise
            const currentProgramOutput = this.programOutput;
            if (currentProgramOutput && currentProgramOutput !== this.lastProgramOutput) {
              const newOutput = currentProgramOutput.substring(this.lastProgramOutput.length);
              if (newOutput.trim().length > 0) {
                this.addStep({
                  type: 'output',
                  stdout: newOutput,
                  line: stoppedInfo.line,
                  explanation: 'Program output',
                  state: this.captureState(newLocals, newFrames)
                });
              }
              this.lastProgramOutput = currentProgramOutput;
            }

            this.previousVariables = { ...newLocals };
        }
        stepCount++;
      }

      const lastStep = this.trace.length > 0 ? this.trace[this.trace.length - 1] : null;
      this.addStep({
        type: 'program_end',
        line: lastStep?.line || 1,
        explanation: 'Program execution completed',
        state: lastStep ? JSON.parse(JSON.stringify(lastStep.state)) : this.captureState({}, [])
      });

      console.log(`✅ Generated ${this.trace.length} execution steps`);
      return this.trace;

    } catch (error) {
      console.error('❌ Error generating trace:', error);
      throw error;
    }
  }

  /**
   * FIXED: Detect what changed between steps - CORRECT VERSION
   */
  detectStepType(newLocals, oldLocals, lineOfCode) {
    const newVarNames = Object.keys(newLocals);
    const oldVarNames = Object.keys(oldLocals);

    // Trim the line of code to remove leading/trailing whitespace
    const trimmedLine = lineOfCode.trim();

    // Loop detection
    if (trimmedLine.match(/^(for|while|do)\s*\(/)) {
      return {
        type: 'loop_start',
        explanation: `Starting a loop: ${trimmedLine}`
      };
    }

    // Conditional detection
    if (trimmedLine.match(/^if\s*\(/)) {
      return {
        type: 'conditional_start',
        explanation: `Starting a conditional block: ${trimmedLine}`
      };
    }
    
    // Function call
    const functionCallMatch = trimmedLine.match(/(\w+)\s*\((.*)\)/);
    if (functionCallMatch && !trimmedLine.startsWith('if') && !trimmedLine.startsWith('for') && !trimmedLine.startsWith('while')) {
        const functionName = functionCallMatch[1];
        // This is a naive check. A better approach would be to check if functionName is a known function.
        // For now, we assume any pattern like `word()` is a function call unless it's a keyword.
        if (functionName !== 'if' && functionName !== 'for' && functionName !== 'while' && functionName !== 'sizeof') {
            return {
                type: 'function_call',
                function: functionName,
                explanation: `Calling function ${functionName}`
            };
        }
    }


    // Variable declaration
    if (newVarNames.length > oldVarNames.length) {
      const newVarName = newVarNames.find(name => !oldVarNames.includes(name));
      if (newVarName) {
        const newVar = newLocals[newVarName];
        
        if (newVar.type.includes('*')) {
            return {
                type: 'pointer_declaration',
                explanation: `Declared pointer ${newVar.name}`,
                variable: newVar.name,
                name: newVar.name,
                dataType: newVar.type,
                primitive: newVar.type,
                value: newVar.value,
                address: newVar.address,
                scope: 'local'
            };
        }
        
        if (newVar.type.match(/\[\d*\]/)) {
            return {
                type: 'array_declaration',
                explanation: `Declared array ${newVar.name}`,
                variable: newVar.name,
                name: newVar.name,
                dataType: newVar.type,
                primitive: newVar.type,
                value: newVar.value,
                address: newVar.address,
                scope: 'local'
            };
        }
        
        return {
          type: 'variable_declaration',
          explanation: `Declared variable ${newVar.name}`,
          variable: newVar.name,
          name: newVar.name,
          dataType: newVar.type,
          primitive: newVar.type,
          value: newVar.value,
          address: newVar.address,
          scope: 'local'
        };
      }
    }

    // Assignment (value changed)
    for (const varName in newLocals) {
      if (oldLocals[varName] && oldLocals[varName].value !== newLocals[varName].value) {
        const newVar = newLocals[varName];
        return {
          type: 'assignment',
          explanation: `Assigned ${newVar.value} to ${newVar.name}`,
          variable: newVar.name,
          name: newVar.name,
          dataType: newVar.type,
          primitive: newVar.type,
          value: newVar.value,
          address: newVar.address,
          scope: 'local'
        };
      }
    }

    // Default to line execution
    return {
      type: 'line_execution',
      explanation: 'Executing line'
    };
  }

  async getLocals() {
    try {
      const result = await this.sendCommand('-stack-list-variables --all-values');
      return this.parseVariables(result.data);
    } catch (error) {
      return {};
    }
  }

  async getFrames() {
    try {
      const result = await this.sendCommand('-stack-list-frames');
      return this.parseFrames(result.data);
    } catch (error) {
      return [];
    }
  }

  parseStoppedInfo(output) {
    const lineMatch = output.match(/line="(\d+)"/);
    const funcMatch = output.match(/func="([^"]+)"/);
    const fileMatch = output.match(/file="([^"]+)"/);
    
    return {
      line: lineMatch ? parseInt(lineMatch[1]) : null,
      function: funcMatch ? funcMatch[1] : null,
      file: fileMatch ? fileMatch[1] : null
    };
  }

  parseVariables(output) {
    const variables = {};
    
    const regex = /\{[^}]*name="([^"]+)"[^}]*value="([^"]+)"[^}]*(?:type="([^"]+)")?[^}]*\}/g;
    let match;

    while ((match = regex.exec(output)) !== null) {
      const [_, name, value, type] = match;
      
      let address = this.variableAddresses.get(name);
      if (!address) {
        address = `0x${Math.random().toString(16).substr(2, 8)}`;
        this.variableAddresses.set(name, address);
      }

      variables[name] = {
        name: name,
        value: this.parseValue(value, type),
        type: type || 'int',
        address: address,
        scope: 'local',
        isAlive: true
      };
    }

    return variables;
  }

  parseValue(value, type) {
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    
    if (/^-?\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    return value;
  }

  parseFrames(output) {
    const frames = [];
    const frameRegex = /frame=\{.*?func="([^"]+)".*?\}/g;
    let match;

    while ((match = frameRegex.exec(output)) !== null) {
      frames.push({
        function: match[1]
      });
    }

    return frames;
  }

  captureState(locals = {}, frames = []) {
    const state = {
      globals: {},
      stack: [],
      heap: {},
      callStack: []
    };

    if (frames.length > 0 || Object.keys(locals).length > 0) {
      state.callStack = [{
        function: frames[0]?.function || 'main',
        returnType: 'int',
        params: {},
        locals: locals,
        frameId: 'frame_0',
        returnAddress: null,
        isActive: true
      }];
    }

    return state;
  }

  addStep(stepData) {
    const { type, line, explanation, state, ...payload } = stepData;

    // Annotate newly-created variables in the provided state with a birthStep
    // so the frontend/layout can know when each element first appears.
    try {
      if (state && state.callStack && state.callStack[0]) {
        const locals = state.callStack[0].locals || {};

        // For each local in the current state, if it wasn't present in previousVariables,
        // mark it with a birthStep so the frontend knows when it first appeared.
        Object.keys(locals).forEach((name) => {
          try {
            if (this.previousVariables === undefined || !Object.prototype.hasOwnProperty.call(this.previousVariables, name)) {
              if (locals[name] && locals[name].birthStep === undefined) {
                locals[name].birthStep = this.stepId;
              }
            }
          } catch (innerE) {
            // ignore individual failures
          }
        });
      }
    } catch (e) {
      console.warn('addStep: failed to annotate birthStep', e);
    }

    this.trace.push({
      id: this.stepId++,
      type: type,
      line: line,
      explanation: explanation,
      state: state,
      ...payload,
      animation: {
        type: 'highlight',
        target: 'line',
        duration: 300
      }
    });
  }

  async stop() {
    console.log('🛑 Stopping GDB...');
    
    if (this.process && !this.process.killed) {
      const closePromise = new Promise(resolve => {
        this.process.on('close', resolve);
      });

      this.process.stdin.write('quit\n');
      this.process.kill();
      this.process = null;

      await closePromise;
    }

    try {
      if (this.sourceFile && existsSync(this.sourceFile)) {
        await unlink(this.sourceFile);
      }
      if (this.executable && existsSync(this.executable)) {
        await unlink(this.executable);
      }
    } catch (error) {
      console.warn(`⚠️  Cleanup failed: ${error.message}`);
    }
  }
}

export { GdbDebugger };