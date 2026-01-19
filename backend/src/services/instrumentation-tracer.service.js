// src/services/instrumentation-tracer.service.js
import { spawn } from 'child_process';
import { writeFile, readFile, unlink, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { fileURLToPath } from 'url';
import codeInstrumenter from './code-instrumenter.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class InstrumentationTracer {
    constructor() {
        this.tempDir    = path.join(process.cwd(), 'temp');
        this.tracerCpp = path.join(process.cwd(), 'src', 'cpp', 'tracer.cpp');
        this.traceHeader = path.join(process.cwd(), 'src', 'cpp', 'trace.h');
        this.ensureTempDir();
    }

    async ensureTempDir() {
        if (!existsSync(this.tempDir)) {
            await mkdir(this.tempDir, { recursive: true });
        }
    }

    /* --------------------------------------------------------------
       Resolve an address to file/line using addr2line (POSIX only)
       -------------------------------------------------------------- */
    async getLineInfo(executable, address) {
        return new Promise((resolve) => {
            const proc = spawn('addr2line', [
                '-e', executable,
                '-f',          // function name
                '-C',          // demangle C++
                '-i',          // inline frames
                address
            ]);

            let output = '';
            proc.stdout.on('data', d => output += d.toString());

            proc.on('close', () => {
                const lines = output.trim().split('\n');
                if (lines.length >= 2) {
                    const fn = lines[0];
                    const loc = lines[1];
                    const m = loc.match(/^(.+):(\d+)$/);
                    if (m) {
                        resolve({
                            function: fn !== '??' ? fn : 'unknown',
                            file: m[1],
                            line: parseInt(m[2], 10) || 0
                        });
                        return;
                    }
                }
                resolve({ function: 'unknown', file: 'unknown', line: 0 });
            });
            proc.on('error', () => resolve({ function: 'unknown', file: 'unknown', line: 0 }));
        });
    }

    /* --------------------------------------------------------------
       Compile user source (instrumented) + tracer (plain)
       -------------------------------------------------------------- */
    async compile(code, language = 'cpp') {
        const sessionId = uuid();

        const ext      = language === 'c' ? 'c' : 'cpp';
        const compiler = 'g++';
        const stdFlag  = language === 'c' ? '-std=c11' : '-std=c++17';

        // ---------- 1️⃣ Instrument the source ---------------------------------
        const instrumented = await codeInstrumenter.instrumentCode(code, language);
        const sourceFile   = path.join(this.tempDir, `src_${sessionId}.${ext}`);
        const userObj      = path.join(this.tempDir, `src_${sessionId}.o`);
        const tracerObj    = path.join(this.tempDir, `tracer_${sessionId}.o`);
        const executable   = path.join(this.tempDir,
            `exec_${sessionId}${process.platform === 'win32' ? '.exe' : ''}`);
        const traceOutput  = path.join(this.tempDir, `trace_${sessionId}.json`);
        const headerCopy   = path.join(this.tempDir, 'trace.h');

        await writeFile(sourceFile, instrumented, 'utf-8');
        await copyFile(this.traceHeader, headerCopy);

        // ---------- 2️⃣ Compile user source (with instrumentation) -------------
        const compileUser = new Promise((resolve, reject) => {
            const args = [
                '-c', '-g', '-O0',
                stdFlag,
                '-fno-omit-frame-pointer',
                // ALWAYS enable function instrumentation – works on MinGW‑w64 too
                '-finstrument-functions',
                sourceFile,
                '-o', userObj
            ];
            const p = spawn(compiler, args);
            let err = '';
            p.stderr.on('data', d => err += d.toString());
            p.on('close', code => code === 0 ? resolve()
                : reject(new Error(`User compile failed:\n${err}`)));
            p.on('error', e => reject(e));
        });

        // ---------- 3️⃣ Compile tracer (no instrumentation) --------------------
        const compileTracer = new Promise((resolve, reject) => {
            const args = [
                '-c', '-g', '-O0',
                stdFlag,
                '-fno-omit-frame-pointer',
                this.tracerCpp,
                '-o', tracerObj
            ];
            const p = spawn(compiler, args);
            let err = '';
            p.stderr.on('data', d => err += d.toString());
            p.on('close', code => code === 0 ? resolve()
                : reject(new Error(`Tracer compile failed:\n${err}`)));
            p.on('error', e => reject(e));
        });

        await Promise.all([compileUser, compileTracer]);

        // ---------- 4️⃣ Link -------------------------------------------------
        const linkArgs = [
            userObj,
            tracerObj,
            '-o', executable
        ];
        // POSIX only: need pthread & dl for tracer implementation
        if (process.platform !== 'win32') {
            linkArgs.unshift('-pthread', '-ldl');
        }

        console.log(`🔨 Linking: ${compiler} ${linkArgs.join(' ')}`);

        return new Promise((resolve, reject) => {
            const link = spawn(compiler, linkArgs);
            let err = '';
            link.stderr.on('data', d => err += d.toString());
            link.on('close', code => {
                if (code === 0) {
                    console.log('✅ Linking successful');
                    resolve({
                        executable,
                        sourceFile,
                        traceOutput,
                        headerCopy
                    });
                } else {
                    reject(new Error(`Linking failed:\n${err}`));
                }
            });
            link.on('error', e => reject(e));
        });
    }

    /* --------------------------------------------------------------
       Run the instrumented binary and capture its STDOUT/STDERR
       -------------------------------------------------------------- */
    async executeInstrumented(executable, traceOutput) {
        return new Promise((resolve, reject) => {
            console.log('▶️  Executing instrumented binary...');
            console.log(`🔍 Output file: ${traceOutput}`);

            const cmd = process.platform === 'win32' ? executable
                : `./${path.basename(executable)}`;
            const cwd = process.platform === 'win32'
                ? path.dirname(executable) : process.cwd();

            console.log(`📂 Working directory: ${cwd}`);
            console.log(`🎯 Command: ${cmd}`);
            console.log(`Executing command: ${cmd}`);

            const proc = spawn(cmd, [], {
                cwd,
                env: { ...process.env, TRACE_OUTPUT: traceOutput },
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 10000
            });

            let stdout = '', stderr = '';
            proc.stdout.on('data', d => {
                stdout += d.toString();
                console.log(`📤 stdout: ${d.toString()}`);
            });
            proc.stderr.on('data', d => {
                stderr += d.toString();
                console.log(`⚠️  stderr: ${d.toString()}`);
            });

            const timeout = setTimeout(() => {
                proc.kill('SIGKILL');
                reject(new Error('Execution timeout (10 s)'));
            }, 10000);

            proc.on('close', code => {
                clearTimeout(timeout);
                console.log(`🛑 Exit code: ${code}`);
                console.log(`📊 stdout collected: ${stdout.length} bytes`);
                console.log(`📊 stderr collected: ${stderr.length} bytes`);
                if (code === 0 || code === null) {
                    console.log('✅ Execution completed');
                    resolve({ stdout, stderr });
                } else {
                    const msg = `Execution failed (code ${code}):\nSTDOUT: ${stdout || '(empty)'}\nSTDERR: ${stderr || '(empty)'}`;
                    console.error(msg);
                    reject(new Error(msg));
                }
            });
            proc.on('error', e => {
                clearTimeout(timeout);
                reject(new Error(`Failed to execute: ${e.message}`));
            });
        });
    }

    /* --------------------------------------------------------------
       Read the JSON trace file generated by tracer.cpp
       -------------------------------------------------------------- */
    async parseTraceFile(tracePath) {
        try {
            const txt = await readFile(tracePath, 'utf-8');
            const parsed = JSON.parse(txt);
            return parsed.events || [];
        } catch (e) {
            console.error('Failed to read/parse trace file:', e.message);
            return [];
        }
    }

    /* --------------------------------------------------------------
       Turn raw events → steps that the front‑end can render
       -------------------------------------------------------------- */
    async convertToSteps(events, executable, sourceFile) {
        console.log(`📊 Converting ${events.length} events to steps...`);

        const steps = [];
        let stepIndex = 0;

        for (const ev of events) {
            console.log('🔎 raw event:', JSON.stringify(ev));
            // --- 1️⃣ If the event already bundles file/line, use them
            // (these are produced by our TRACE_* macros)
            let info;
            if (ev.file && ev.line) {
                info = {
                    function: ev.func || ev.name || 'unknown',
                    file: ev.file,
                    line: ev.line
                };
            } else {
                // --- 2️⃣ Otherwise resolve the address with addr2line
                info = await this.getLineInfo(executable, ev.addr);
            }

            // ---------------------------------------------------------
            // Discard events that have no useful source location
            // ---------------------------------------------------------
            if (!info.file || info.line === 0) continue;
            if (process.platform !== 'win32' &&
                (info.file.includes('/usr/') || info.file.includes('/lib/')))
                continue;

            // ---------------------------------------------------------
            // ONE STEP per event – no deduplication
            // ---------------------------------------------------------
            const step = {
                stepIndex: stepIndex++,
                eventType: ev.type,
                line: info.line,
                function: info.function,
                file: path.basename(info.file),
                timestamp: ev.ts || null,
                name: ev.name || null,
                value: ev.value ?? null,
                varType: ev.type === 'var' ? ev.type : null,
                size: ev.size ?? null,
                addr: ev.addr ?? null,
                locals: ev.locals ?? null,
                globals: ev.globals ?? null,
                stdout: ev.stdout ?? null,
                explanation: ev.explanation || this.getEventExplanation(ev, info)
            };
            steps.push(step);
            console.log(`📍 Step ${step.stepIndex}: [${step.eventType}] ${step.function}:${step.line} ${step.explanation}`);
        }

        // ----- END‑OF‑PROGRAM marker (always the last step) -----
        steps.push({
            stepIndex: stepIndex++,
            eventType: 'program_end',
            line: 0,
            explanation: 'Program execution completed'
        });

        console.log(`✅ Generated ${steps.length} execution steps`);
        return steps;
    }

    /* Helper – a short textual description for the UI */
    getEventExplanation(ev, info) {
        switch (ev.type) {
            case 'func_enter': return `Entering ${info.function}()`;
            case 'func_exit':  return `Exiting ${info.function}()`;
            case 'var':        return `${ev.name} = ${ev.value}`;
            case 'heap_alloc': return `Allocated ${ev.size} bytes at ${ev.addr}`;
            case 'heap_free':  return `Freed memory at ${ev.addr}`;
            default:           return `${ev.type} event`;
        }
    }

    async getSourceLines(file) {
        try {
            const txt = await readFile(file, 'utf-8');
            return txt.split('\n');
        } catch { return []; }
    }

    /* --------------------------------------------------------------
       Helpers for UI – global variables / functions extraction
       -------------------------------------------------------------- */
    extractGlobals(steps) {
        const globals = new Map();
        for (const step of steps) {
            if (step.globals) {
                for (const [n, v] of Object.entries(step.globals)) {
                    if (!globals.has(n))
                        globals.set(n, { name: n, value: v, type: typeof v, scope: 'global', alive: true });
                }
            }
        }
        return Array.from(globals.values());
    }

    extractFunctions(steps) {
        const map = new Map();
        for (const s of steps) {
            if (s.eventType === 'func_enter' && !map.has(s.function)) {
                map.set(s.function, { name: s.function, line: s.line, returnType: 'auto' });
            }
        }
        return Array.from(map.values());
    }

    /* --------------------------------------------------------------
       Public entry point – called from the Socket.IO handler
       -------------------------------------------------------------- */
    async generateTrace(code, language = 'cpp') {
        console.log('🚀 Starting Instrumentation‑Based Execution Tracing...');
        console.log(`📝 Code size: ${code.length} bytes`);

        let exe, src, traceOut, hdr;
        try {
            ({ executable: exe, sourceFile: src, traceOutput: traceOut, headerCopy: hdr } = await this.compile(code, language));

            await this.executeInstrumented(exe, traceOut);

            const rawEvents = await this.parseTraceFile(traceOut);
            console.log(`📋 Captured ${rawEvents.length} raw events`);

            const steps = await this.convertToSteps(rawEvents, exe, src);

            const result = {
                steps,
                totalSteps: steps.length,
                globals: this.extractGlobals(steps),
                functions: this.extractFunctions(steps),
                metadata: {
                    debugger: process.platform === 'win32' ? 'mingw‑instrumentation' : 'gcc‑instrumentation',
                    version: '1.0',
                    hasRealMemory: true,
                    hasHeapTracking: true,
                    capturedEvents: rawEvents.length,
                    timestamp: Date.now()
                }
            };
            console.log('✅ Trace generation complete', {
                steps: result.totalSteps,
                functions: result.functions.length,
                globals: result.globals.length
            });
            return result;
        } catch (e) {
            console.error('❌ Trace generation failed:', e.message);
            throw e;
        } finally {
            await this.cleanup([exe, src, traceOut, hdr]);
        }
    }

    /* --------------------------------------------------------------
       Delete temporary files (ignore errors)
       -------------------------------------------------------------- */
    async cleanup(files) {
        for (const f of files) {
            if (f && existsSync(f)) {
                try { await unlink(f); } catch (_) {}
            }
        }
    }
}

export default new InstrumentationTracer();
