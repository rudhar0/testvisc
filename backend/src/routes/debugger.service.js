
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import GdbMiParser from '../parsers/gdb-mi-parser.js';
import { EventEmitter } from 'events';

class DebuggerService extends EventEmitter {
    constructor(io) {
        super();
        this.io = io;
        this.parser = null;
    }

    async start(code, language) {
        if (this.parser) {
            this.stop();
        }

        const exePath = await this.compile(code, language);
        this.parser = new GdbMiParser(exePath);

        this.parser.on('record', (record) => {
            if (record.asyncClass === 'exec' && record.type === 'stopped') {
                this.emit('stopped', record.payload);
                if (this.io) {
                    this.io.emit('debugger:stopped', record.payload);
                }
            }
        });

        this.parser.on('error', (error) => {
            this.emit('error', error);
            if (this.io) {
                this.io.emit('debugger:error', error);
            }
        });

        return this.sendCommand('-exec-run');
    }

    async compile(code, language) {
        const tmpDir = os.tmpdir();
        const sourcePath = path.join(tmpDir, `temp_${Date.now()}.cpp`);
        const exePath = path.join(tmpDir, `temp_${Date.now()}.exe`);

        fs.writeFileSync(sourcePath, code);

        return new Promise((resolve, reject) => {
            const compiler = language === 'cpp' ? 'g++' : 'gcc';
            const gcc = spawn(compiler, ['-g', sourcePath, '-o', exePath]);
            let stderr = '';

            gcc.stderr.on('data', (data) => stderr += data);
            
            gcc.on('close', (code) => {
                if (code === 0) resolve(exePath);
                else reject(new Error(stderr || 'Compilation failed'));
            });
        });
    }

    async sendCommand(command) {
        if (this.parser) {
            return this.parser.sendCommand(command);
        } else {
            const error = new Error('GDB not running');
            this.emit('error', error);
            throw error;
        }
    }

    async step() {
        return this.sendCommand('-exec-step');
    }

    async next() {
        return this.sendCommand('-exec-next');
    }

    async continue() {
        return this.sendCommand('-exec-continue');
    }

    async getStack() {
        const result = await this.sendCommand('-stack-list-frames');
        return result && result.payload ? result.payload.stack : [];
    }

    async getLocalVariables() {
        const result = await this.sendCommand('-stack-list-locals 1');
        return result && result.payload ? result.payload.locals : [];
    }
    
    async createVariable(expression) {
        const result = await this.sendCommand(`-var-create - * ${expression}`);
        return result ? result.payload : null;
    }

    async listVariableChildren(variableName) {
        const result = await this.sendCommand(`-var-list-children --all-values ${variableName}`);
        return result && result.payload ? result.payload.children : [];
    }

    stop() {
        if (this.parser) {
            this.parser.stop();
            this.parser = null;
        }
        this.emit('terminated');
    }
}

export default DebuggerService;