import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import gdbParser from '../parsers/gdb-mi-parser.js';

class DebuggerService {
    constructor() {
        this.gdb = null;
        this.currentResolve = null;
        this.buffer = '';
    }

    async compile(code) {
        const tmpDir = os.tmpdir();
        const sourcePath = path.join(tmpDir, `temp_${Date.now()}.cpp`);
        const exePath = path.join(tmpDir, `temp_${Date.now()}.exe`);

        fs.writeFileSync(sourcePath, code);

        return new Promise((resolve, reject) => {
            // Compile with debug symbols (-g)
            const gcc = spawn('g++', ['-g', sourcePath, '-o', exePath]);
            let stderr = '';

            gcc.stderr.on('data', (data) => stderr += data);
            
            gcc.on('close', (code) => {
                if (code === 0) resolve(exePath);
                else reject(new Error(stderr || 'Compilation failed'));
            });
        });
    }

    start(exePath) {
        if (this.gdb) this.stop();

        // Start GDB in Machine Interface mode
        this.gdb = spawn('gdb', ['--interpreter=mi', exePath]);
        
        this.gdb.stdout.on('data', (data) => {
            const output = data.toString();
            this.buffer += output;
            
            // Check if operation is done (*stopped or ^done or ^error)
            if (output.includes('*stopped') || output.includes('^done') || output.includes('^error')) {
                if (this.currentResolve) {
                    const parsed = gdbParser.parse(this.buffer);
                    this.currentResolve(parsed);
                    this.currentResolve = null;
                    this.buffer = '';
                }
            }
        });

        // Initial run
        return this.sendCommand('-exec-run');
    }

    sendCommand(command) {
        return new Promise((resolve) => {
            this.currentResolve = resolve;
            if (this.gdb) {
                this.gdb.stdin.write(command + '\n');
            } else {
                resolve({ error: 'GDB not running' });
            }
        });
    }

    stop() {
        if (this.gdb) {
            this.gdb.kill();
            this.gdb = null;
        }
    }
}

export default new DebuggerService();