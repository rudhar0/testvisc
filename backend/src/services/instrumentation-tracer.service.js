// src/services/instrumentation-tracer.service.js
// ENHANCED VERSION with beginner mode + output step tracking
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
        this.tempDir = path.join(process.cwd(), 'temp');
        this.tracerCpp = path.join(process.cwd(), 'src', 'cpp', 'tracer.cpp');
        this.traceHeader = path.join(process.cwd(), 'src', 'cpp', 'trace.h');
        this.ensureTempDir();
    }

    async ensureTempDir() {
        if (!existsSync(this.tempDir)) {
            await mkdir(this.tempDir, { recursive: true });
        }
    }

    async getLineInfo(executable, address) {
        return new Promise((resolve) => {
            const proc = spawn('addr2line', [
                '-e', executable,
                '-f',
                '-C',
                '-i',
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

    shouldFilterEvent(info, event, userSourceFile) {
        const { file, function: fn, line } = info;
        
        if (!file || line === 0 || file === 'unknown' || file === '??') {
            return true;
        }
        
        if (process.platform !== 'win32') {
            if (file.startsWith('/usr/') || 
                file.startsWith('/lib/') ||
                file.includes('include/c++/') ||
                file.includes('include/bits/')) {
                return true;
            }
        } else {
            if (file.includes('mingw') || 
                file.includes('include\\c++') ||
                file.includes('lib\\gcc')) {
                return true;
            }
        }
        
        const userBasename = path.basename(userSourceFile);
        const eventBasename = path.basename(file);
        if (eventBasename === userBasename) {
            return false;
        }
        
        if (file.includes('stl_') || 
            file.includes('bits/') ||
            file.includes('iostream') ||
            file.includes('ostream') ||
            file.includes('streambuf')) {
            return true;
        }
        
        const internalPrefixes = [
            '__', '_IO_', '_M_', 'std::__', 
            'std::basic_', 'std::char_traits',
            '__gnu_cxx::', '__cxxabi'
        ];
        
        if (internalPrefixes.some(prefix => fn.startsWith(prefix))) {
            return true;
        }
        
        return false;
    }

    /**
     * ✅ NEW: Parse escape sequences in output text
     */
    parseEscapeSequences(text) {
        const escapes = [];
        const escapeMap = {
            '\\n': { char: '\\n', meaning: 'New line', rendered: '\n' },
            '\\t': { char: '\\t', meaning: 'Horizontal tab', rendered: '\t' },
            '\\r': { char: '\\r', meaning: 'Carriage return', rendered: '\r' },
            '\\f': { char: '\\f', meaning: 'Form feed', rendered: '\f' },
            '\\b': { char: '\\b', meaning: 'Backspace', rendered: '\b' },
            '\\\\': { char: '\\\\', meaning: 'Backslash', rendered: '\\' }
        };

        let rendered = text;
        for (const [seq, info] of Object.entries(escapeMap)) {
            if (text.includes(seq)) {
                escapes.push({ char: info.char, meaning: info.meaning });
                rendered = rendered.replace(new RegExp(seq.replace(/\\/g, '\\\\'), 'g'), info.rendered);
            }
        }

        return { rendered, escapes };
    }

    /**
     * ✅ NEW: Split output into individual line steps
     */
    createOutputSteps(stdout, baseStepIndex) {
        if (!stdout || stdout.trim().length === 0) {
            return [];
        }

        const lines = stdout.split('\n');
        const steps = [];
        let stepIndex = baseStepIndex;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip empty lines unless they're meaningful (between content)
            if (line.trim().length === 0 && i === lines.length - 1) {
                continue;
            }

            const { rendered, escapes } = this.parseEscapeSequences(line);

            steps.push({
                stepIndex: stepIndex++,
                eventType: 'output',
                line: 0,
                function: 'output',
                file: 'stdout',
                timestamp: Date.now() + i,
                text: rendered,
                rawText: line,
                escapeInfo: escapes,
                explanation: escapes.length > 0 
                    ? `📤 Output: "${rendered}" (with ${escapes.map(e => e.char).join(', ')})`
                    : `📤 Output: "${rendered}"`,
                internalEvents: []
            });
        }

        return steps;
    }

    async compile(code, language = 'cpp') {
        const sessionId = uuid();

        const ext = language === 'c' ? 'c' : 'cpp';
        const compiler = 'g++';
        const stdFlag = language === 'c' ? '-std=c11' : '-std=c++17';

        const instrumented = await codeInstrumenter.instrumentCode(code, language);
        const sourceFile = path.join(this.tempDir, `src_${sessionId}.${ext}`);
        const userObj = path.join(this.tempDir, `src_${sessionId}.o`);
        const tracerObj = path.join(this.tempDir, `tracer_${sessionId}.o`);
        const executable = path.join(this.tempDir,
            `exec_${sessionId}${process.platform === 'win32' ? '.exe' : ''}`);
        const traceOutput = path.join(this.tempDir, `trace_${sessionId}.json`);
        const headerCopy = path.join(this.tempDir, 'trace.h');

        await writeFile(sourceFile, instrumented, 'utf-8');
        await copyFile(this.traceHeader, headerCopy);

        const compileUser = new Promise((resolve, reject) => {
            const step = {
                stepIndex: stepIndex++,
                // Preserve original event type for internal use
                eventType: isOutputOp ? 'output' : ev.type,
                // NEW: Explicit step type for beginner mode (declare/assign/output)
                stepType: ev.type === 'var' ? (ev.varType || null) : (isOutputOp ? 'output' : null),
                line: info.line,
                function: info.function,
                file: path.basename(info.file),
                timestamp: ev.ts || null,
                name: ev.name || null,
                value: ev.value ?? null,
                varType: ev.type === 'var' ? (ev.varType || 'unknown') : null,
                size: ev.size ?? null,
                addr: ev.addr ?? null,
                stdout: capturedOutput,
                explanation: this.getEventExplanation(ev, info, capturedOutput, isOutputOp),
                internalEvents: []
            };
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

        const linkArgs = [
            userObj,
            tracerObj,
            '-o', executable
        ];
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

    async executeInstrumented(executable, traceOutput) {
        return new Promise((resolve, reject) => {
            console.log('▶️ Executing instrumented binary...');

            const cmd = process.platform === 'win32' ? executable
                : `./${path.basename(executable)}`;
            const cwd = process.platform === 'win32'
                ? path.dirname(executable) : process.cwd();

            const proc = spawn(cmd, [], {
                cwd,
                env: { ...process.env, TRACE_OUTPUT: traceOutput },
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 10000
            });

            let stdout = '', stderr = '';
            proc.stdout.on('data', d => {
                const chunk = d.toString();
                stdout += chunk;
            });
            proc.stderr.on('data', d => {
                const chunk = d.toString();
                stderr += chunk;
            });

            const timeout = setTimeout(() => {
                proc.kill('SIGKILL');
                reject(new Error('Execution timeout (10 s)'));
            }, 10000);

            proc.on('close', code => {
                clearTimeout(timeout);
                if (code === 0 || code === null) {
                    resolve({ stdout, stderr });
                } else {
                    const msg = `Execution failed (code ${code}):\nSTDOUT: ${stdout || '(empty)'}\nSTDERR: ${stderr || '(empty)'}`;
                    reject(new Error(msg));
                }
            });
            proc.on('error', e => {
                clearTimeout(timeout);
                reject(new Error(`Failed to execute: ${e.message}`));
            });
        });
    }

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

    /**
     * ✅ MODIFIED: Convert events to steps with output tracking
     */
    async convertToSteps(events, executable, sourceFile, programOutput) {
        console.log(`📊 Converting ${events.length} events to steps...`);

        const codeSteps = [];
        let stepIndex = 0;
        
        let lastUserLocation = null;
        let lastStep = null;
        let mainStarted = false;

        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            
            let info;
            if (ev.file && ev.line) {
                info = {
                    function: ev.func || ev.name || 'unknown',
                    file: ev.file,
                    line: ev.line
                };
            } else {
                info = await this.getLineInfo(executable, ev.addr);
            }

            // Create explicit "main started" step
            if (!mainStarted && info.function === 'main' && ev.type === 'func_enter') {
                codeSteps.push({
                    stepIndex: stepIndex++,
                    eventType: 'program_start',
                    line: info.line,
                    function: 'main',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    explanation: '🚀 Program execution started in main()',
                    internalEvents: []
                });
                mainStarted = true;
                lastUserLocation = `${info.file}:${info.line}`;
                lastStep = codeSteps[codeSteps.length - 1];
                continue;
            }

            // Filter system/library events
            if (this.shouldFilterEvent(info, ev, sourceFile)) {
                if (lastStep) {
                    if (!lastStep.internalEvents) {
                        lastStep.internalEvents = [];
                    }
                    lastStep.internalEvents.push({
                        type: ev.type,
                        function: info.function,
                        addr: ev.addr,
                        timestamp: ev.ts
                    });
                }
                continue;
            }

            if (!info.file || info.line === 0) {
                continue;
            }

            const locationKey = `${info.file}:${info.line}`;
            const isSameLocation = locationKey === lastUserLocation;
            
            // ✅ NEW: Always create steps for declare/assign events
            const isDeclareEvent = ev.type === 'declare';
            const isAssignEvent = ev.type === 'assign';
            const isVariableEvent = ev.type === 'var' || isDeclareEvent || isAssignEvent;
            const isHeapEvent = ev.type === 'heap_alloc' || ev.type === 'heap_free';
            
            if (isSameLocation && !isVariableEvent && !isHeapEvent && lastStep) {
                if (!lastStep.internalEvents) {
                    lastStep.internalEvents = [];
                }
                lastStep.internalEvents.push({
                    type: ev.type,
                    function: info.function,
                    addr: ev.addr,
                    timestamp: ev.ts,
                    name: ev.name,
                    value: ev.value
                });
                continue;
            }

            // Create new step
            const step = {
                stepIndex: stepIndex++,
                eventType: ev.type,
                line: info.line,
                function: info.function,
                file: path.basename(info.file),
                timestamp: ev.ts || null,
                name: ev.name || null,
                value: ev.value ?? null,
                varType: ev.type === 'var' || isDeclareEvent || isAssignEvent ? (ev.type || 'unknown') : null,
                size: ev.size ?? null,
                addr: ev.addr ?? null,
                explanation: this.getEventExplanation(ev, info),
                internalEvents: []
            };
            
            codeSteps.push(step);
            lastStep = step;
            lastUserLocation = locationKey;
        }

        // ✅ NEW: Interleave output steps with code steps
        const outputSteps = this.createOutputSteps(programOutput.stdout, stepIndex);
        
        // Insert output steps at the end (before program_end)
        const allSteps = [...codeSteps];
        
        // Add output steps
        for (const outStep of outputSteps) {
            allSteps.push(outStep);
        }

        // Add program end
        allSteps.push({
            stepIndex: allSteps.length,
            eventType: 'program_end',
            line: 0,
            function: 'main',
            file: path.basename(sourceFile),
            timestamp: Date.now(),
            explanation: '✅ Program execution completed',
            internalEvents: []
        });

        console.log(`✅ Generated ${allSteps.length} steps (${codeSteps.length} code + ${outputSteps.length} output)`);
        
        return allSteps;
    }

    getEventExplanation(ev, info) {
        switch (ev.type) {
            case 'func_enter': 
                return `Entering ${info.function}()`;
            case 'func_exit':  
                return `Exiting ${info.function}()`;
            case 'declare':
                return `📝 Declared ${ev.name} (${ev.type || 'variable'})`;
            case 'assign':
                return `📝 ${ev.name} = ${ev.value}`;
            case 'var':        
                return `${ev.name} = ${ev.value}`;
            case 'heap_alloc': 
                return `Allocated ${ev.size} bytes at ${ev.addr}`;
            case 'heap_free':  
                return `Freed memory at ${ev.addr}`;
            default:           
                return `${ev.type} event`;
        }
    }

    async getSourceLines(file) {
        try {
            const txt = await readFile(file, 'utf-8');
            return txt.split('\n');
        } catch { return []; }
    }

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
            if ((s.eventType === 'func_enter' || s.eventType === 'program_start') && !map.has(s.function)) {
                map.set(s.function, { name: s.function, line: s.line, returnType: 'auto' });
            }
        }
        return Array.from(map.values());
    }

    async generateTrace(code, language = 'cpp') {
        console.log('🚀 Starting Instrumentation-Based Execution Tracing...');

        let exe, src, traceOut, hdr;
        try {
            ({ executable: exe, sourceFile: src, traceOutput: traceOut, headerCopy: hdr } = await this.compile(code, language));

            const { stdout, stderr } = await this.executeInstrumented(exe, traceOut);

            const rawEvents = await this.parseTraceFile(traceOut);
            console.log(`📋 Captured ${rawEvents.length} raw events`);

            const steps = await this.convertToSteps(rawEvents, exe, src, { stdout, stderr });

            const result = {
                steps,
                totalSteps: steps.length,
                globals: this.extractGlobals(steps),
                functions: this.extractFunctions(steps),
                metadata: {
                    debugger: process.platform === 'win32' ? 'mingw-instrumentation' : 'gcc-instrumentation',
                    version: '2.0',
                    hasRealMemory: true,
                    hasHeapTracking: true,
                    hasOutputTracking: true,
                    hasBeginnerMode: true,
                    capturedEvents: rawEvents.length,
                    programOutput: stdout,
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

    async cleanup(files) {
        for (const f of files) {
            if (f && existsSync(f)) {
                try { await unlink(f); } catch (_) {}
            }
        }
    }
}

export default new InstrumentationTracer();