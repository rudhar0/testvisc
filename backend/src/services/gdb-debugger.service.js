import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import inputManagerService from './input-manager.service.js';

/**
 * GDB Debugger Service
 * Uses GDB to execute and trace C/C++ code
 */
export default class GdbDebugger {
  constructor(socket) { // Accept socket object
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
    this.inputManager.setSocket(socket); // Pass socket to the manager
    this.isWaitingForInputStep = false;
    this.inputStepPromise = {};
  }

  /**
   * Preprocess code to ensure it has newlines for stepping
   */
  preprocessCode(code) {
    let formatted = '';
    let state = 'normal'; // normal, string, char, line_comment, block_comment
    
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

  /**
   * Compile source code with debug symbols
   */
  async compile(code, language = 'c') {
    console.log('🔨 Compiling code...');
    
    const sessionId = uuidv4();
    const ext = language === 'cpp' ? 'cpp' : 'c';
    const compiler = language === 'cpp' ? 'g++' : 'gcc';

    // Ensure temp directory exists
    if (!existsSync(this.tempDir)) {
      await mkdir(this.tempDir, { recursive: true });
    }

    this.sourceFile = path.join(this.tempDir, `${sessionId}.${ext}`);
    this.executable = path.join(this.tempDir, `${sessionId}.out`);

    // Write source file
    const formattedCode = this.preprocessCode(code);
    await writeFile(this.sourceFile, formattedCode, 'utf-8');
    console.log('📝 Source file written:', this.sourceFile);

    // Statically analyze for input calls
    this.inputManager.scanCode(formattedCode);

    // Compile with debug symbols
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

  /**
   * Start GDB process
   */
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

      // Wait for GDB to be ready
      setTimeout(() => {
        this.isRunning = true;
        console.log('✅ GDB started successfully');
        resolve();
      }, 500);
    });
  }

  /**
   * Handle GDB output
   */
  handleOutput(data) {
    this.outputBuffer += data;
    
    let newlineIndex;
    while ((newlineIndex = this.outputBuffer.indexOf('\n')) !== -1) {
      const line = this.outputBuffer.substring(0, newlineIndex).trim();
      this.outputBuffer = this.outputBuffer.substring(newlineIndex + 1);

      if (line) {
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

  /**
   * Send command to GDB
   */
  sendCommand(command) {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject });
      if (!this.currentCommand) {
        this.processQueue();
      }
    });
  }

  /**
   * Process command queue
   */
  processQueue() {
    if (this.commandQueue.length === 0 || this.currentCommand) {
      return;
    }

    this.currentCommand = this.commandQueue.shift();
    console.log('GDB <', this.currentCommand.command);
    this.process.stdin.write(this.currentCommand.command + '\n');

    // Timeout after 5 seconds
    setTimeout(() => {
      if (this.currentCommand) {
        console.warn('⚠️  Command timeout:', this.currentCommand.command);
        this.currentCommand.resolve({ status: 'timeout', data: '' });
        this.currentCommand = null;
        this.processQueue();
      }
    }, 5000);
  }

  /**
   * Handles stepping over a line that requires stdin input.
   * It sends the 'next' command, provides the input, and waits for GDB to stop.
   */
  stepOverInput(inputValue) {
    return new Promise((resolve, reject) => {
        this.isWaitingForInputStep = true;
        this.inputStepPromise = { resolve, reject };

        const timeout = setTimeout(() => {
            if (this.isWaitingForInputStep) {
                this.isWaitingForInputStep = false;
                reject(new Error('Input step timed out'));
            }
        }, 10000); // 10s timeout for input execution

        console.log('GDB <', '-exec-next');
        this.process.stdin.write('-exec-next\n');
        console.log('GDB <', `(input) ${inputValue}`);
        this.process.stdin.write(`${inputValue}\n`);
    });
  }

  /**
   * Generate execution trace
   */
  async generateTrace(inputs = []) {
    console.log('🎬 Generating execution trace...');
    this.trace = [];
    this.stepId = 0;
    this.variableAddresses.clear();

    try {
      // Set breakpoint at main
      await this.sendCommand('-break-insert main');
      
      // Set breakpoints on all input lines
      for (const lineNumber of this.inputManager.inputLines.keys()) {
        await this.sendCommand(`-break-insert ${lineNumber}`);
      }
      
      // Start execution and wait for breakpoint
      const runResult = await this.sendCommand('-exec-run');
      
      if (!runResult.data.includes('reason="breakpoint-hit"')) {
          this.addStep({
              type: 'program_end',
              line: 1,
              explanation: 'Program finished before main breakpoint.',
              state: this.captureState()
          });
          console.warn('⚠️  Program did not stop at main breakpoint.');
          return this.trace;
      }

      // First step: at the beginning of main
      let currentStopInfo = this.parseStoppedInfo(runResult.data);
      let locals = await this.getLocals();
      let frames = await this.getFrames();

      this.addStep({
        type: 'function_call',
        line: currentStopInfo.line,
        explanation: `Execution starts at main on line ${currentStopInfo.line}`,
        state: this.captureState(locals, frames)
      });

      // Step through execution
      let maxSteps = 100;
      let stepCount = 0;

      while (stepCount < maxSteps) {
        let result;
        const currentLine = currentStopInfo.line;

        // Check if the next line to be executed requires input
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
          // Normal step
          result = await this.sendCommand('-exec-step');
        }

        if (result.status === 'error' || result.status === 'timeout' || result.data.includes('reason="exited"')) {
          console.log('⏹️  Execution finished. Breaking loop.');
          break;
        }

        // Check for runtime errors like segfaults
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
          break; // Stop trace generation
        }

        // Parse stopped info from the result of the step
        const stoppedInfo = this.parseStoppedInfo(result.data);
        
        if (!stoppedInfo || !stoppedInfo.line) {
          console.warn('⚠️  No line info, stopping trace. Breaking loop.');
          break;
        }
        currentStopInfo = stoppedInfo;

        // Capture state
        const newLocals = await this.getLocals();
        const newFrames = await this.getFrames();
        const oldState = this.trace[this.trace.length - 1].state;
        const oldLocals = oldState.callStack[0] ? oldState.callStack[0].locals : {};

        let stepType = 'line_execution'; // default
        let stepPayload = {};
        let explanation = `Executing line ${stoppedInfo.line}`;

        // Find changes
        const newVarNames = Object.keys(newLocals);
        const oldVarNames = Object.keys(oldLocals);

        if (newVarNames.length > oldVarNames.length) {
            stepType = 'variable_declaration';
            const newVarName = newVarNames.find(name => !oldVarNames.includes(name));
            if (newVarName) {
                const newVar = newLocals[newVarName];
                explanation = `Declare variable ${newVar.name}`;
                stepPayload = {
                    name: newVar.name,
                    value: newVar.value,
                    type: newVar.type,
                    address: newVar.address,
                };
            }
        } else {
            // Check for value changes
            for (const varName in newLocals) {
                if (oldLocals[varName] && oldLocals[varName].value !== newLocals[varName].value) {
                    stepType = 'assignment';
                    const newVar = newLocals[varName];
                    explanation = `Assign to ${newVar.name}`;
                    stepPayload = {
                        name: newVar.name,
                        value: newVar.value,
                        address: newVar.address,
                    };
                    break;
                }
            }
        }
        
        this.addStep({
          type: stepType,
          line: stoppedInfo.line,
          explanation: explanation,
          state: this.captureState(newLocals, newFrames),
          ...stepPayload
        });

        locals = newLocals;
        stepCount++;
        console.log(`Looped, stepCount is now ${stepCount}`);
      }

      // Program end
      const lastStep = this.trace.length > 0 ? this.trace[this.trace.length - 1] : null;
      this.addStep({
        type: 'program_end',
        line: lastStep?.line || 1,
        explanation: 'Program execution completed',
        state: lastStep ? JSON.parse(JSON.stringify(lastStep.state)) : this.captureState()
      });

      console.log(`✅ Generated ${this.trace.length} execution steps`);
      return this.trace;

    } catch (error) {
      console.error('❌ Error generating trace:', error);
      throw error;
    }
  }

  /**
   * Get local variables
   */
  async getLocals() {
    try {
      const result = await this.sendCommand('-stack-list-variables --simple-values');
      return this.parseVariables(result.data);
    } catch (error) {
      return {};
    }
  }

  /**
   * Get stack frames
   */
  async getFrames() {
    try {
      const result = await this.sendCommand('-stack-list-frames');
      return this.parseFrames(result.data);
    } catch (error) {
      return [];
    }
  }

  /**
   * Parse stopped info from GDB output
   */
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

  /**
   * Parse variables from GDB output - ENHANCED
   */
  parseVariables(output) {
    const variables = {};
    
    // Match: {name="x",value="10",type="int"}
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

    console.log('📊 Parsed variables:', variables);
    return variables;
  }

  /**
   * Parse value based on type
   */
  parseValue(value, type) {
    // Remove quotes if string
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    
    // Parse number
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    
    if (/^-?\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    return value;
  }

  /**
   * Parse stack frames from GDB output
   */
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

  /**
   * Capture current state - FIXED FORMAT
   */
  captureState(locals = {}, frames = []) {
    const state = {
      globals: {},
      stack: [],      // Legacy, keep empty
      heap: {},
      callStack: []
    };

    // Build proper callStack
    if (frames.length > 0 || Object.keys(locals).length > 0) {
      state.callStack = [{
        function: frames[0]?.function || 'main',
        returnType: 'int',
        params: {},
        locals: locals,          // ← This must be the parsed variables object
        frameId: 'frame_0',
        returnAddress: null,
        isActive: true
      }];
    }

    console.log('📸 Captured state:', {
      hasCallStack: state.callStack.length > 0,
      localsCount: Object.keys(state.callStack[0]?.locals || {}).length
    });

    return state;
  }

  /**
   * Add step to trace
   */
  addStep(stepData) {
    const { type, line, explanation, state, ...payload } = stepData;
    this.trace.push({
      id: this.stepId++,
      type: type,
      line: line,
      explanation: explanation,
      state: state,
      ...payload, // Spread the rest of the properties
      animation: {
        type: 'highlight',
        target: 'line',
        duration: 300
      }
    });
  }

  /**
   * Stop debugger and cleanup
   */
  async stop() {
    console.log('🛑 Stopping GDB...');
    
    if (this.process && !this.process.killed) {
      // Create a promise that resolves when the GDB process fully closes.
      // This is crucial to ensure file handles are released before we try to delete them.
      const closePromise = new Promise(resolve => {
        this.process.on('close', resolve);
      });

      // Attempt a graceful exit, then kill the process to ensure the 'close' event fires.
      this.process.stdin.write('quit\n');
      this.process.kill();
      this.process = null;

      // Wait for the process to actually terminate before proceeding.
      await closePromise;
    }

    // Cleanup temp files
    try {
      if (this.sourceFile && existsSync(this.sourceFile)) {
        await unlink(this.sourceFile);
      }
      if (this.executable && existsSync(this.executable)) {
        await unlink(this.executable);
      }
    } catch (error) {
      console.warn(`⚠️  Cleanup failed for temp files: ${error.message}`);
    }
  }
}

// Named export for consistency
export { GdbDebugger };