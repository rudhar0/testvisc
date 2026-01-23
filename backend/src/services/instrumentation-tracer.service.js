// src/services/instrumentation-tracer.service.js
// Complete implementation with strict one-line-one-step rule
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
        
        this.arrayRegistry = new Map();
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

    createOutputSteps(stdout, baseStepIndex) {
        if (!stdout || stdout.trim().length === 0) {
            return [];
        }

        const lines = stdout.split('\n');
        const steps = [];
        let stepIndex = baseStepIndex;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
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
                    ? `📤 Output: "${rendered}"`
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
            const args = [
                '-c', '-g', '-O0',
                stdFlag,
                '-fno-omit-frame-pointer',
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

        return new Promise((resolve, reject) => {
            const link = spawn(compiler, linkArgs);
            let err = '';
            link.stderr.on('data', d => err += d.toString());
            link.on('close', code => {
                if (code === 0) {
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
            proc.stdout.on('data', d => stdout += d.toString());
            proc.stderr.on('data', d => stderr += d.toString());

            const timeout = setTimeout(() => {
                proc.kill('SIGKILL');
                reject(new Error('Execution timeout (10 s)'));
            }, 10000);

            proc.on('close', code => {
                clearTimeout(timeout);
                if (code === 0 || code === null) {
                    resolve({ stdout, stderr });
                } else {
                    reject(new Error(`Execution failed (code ${code})`));
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
            return {
                events: parsed.events || [],
                functions: parsed.tracked_functions || []
            };
        } catch (e) {
            console.error('Failed to read/parse trace file:', e.message);
            return { events: [], functions: [] };
        }
    }

    // STRICT ONE-LINE-ONE-STEP RULE
    async convertToSteps(events, executable, sourceFile, programOutput, trackedFunctions) {
        console.log(`📊 Converting ${events.length} events to steps (strict filtering)...`);

        const codeSteps = [];
        let stepIndex = 0;
        
        // Track last event per source line to enforce one-step-per-line
        const lineSteps = new Map(); // Map<"file:line", step>
        let mainStarted = false;

        const normalizeFunctionName = (name) => {
            if (!name) return 'unknown';
            return name.replace(/[\r\n]/g, '');
        };

        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            
            let info;
            if (ev.file && ev.line) {
                info = {
                    function: normalizeFunctionName(ev.func || ev.name || 'unknown'),
                    file: ev.file,
                    line: ev.line
                };
            } else {
                info = await this.getLineInfo(executable, ev.addr);
                info.function = normalizeFunctionName(info.function);
            }

            // Create main start step
            if (!mainStarted && info.function === 'main' && ev.type === 'func_enter') {
                const step = {
                    stepIndex: stepIndex++,
                    eventType: 'program_start',
                    line: info.line,
                    function: 'main',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    explanation: '🚀 Program started',
                    internalEvents: []
                };
                codeSteps.push(step);
                mainStarted = true;
                continue;
            }

            // Filter system/internal events
            if (this.shouldFilterEvent(info, ev, sourceFile)) {
                continue;
            }

            if (!info.file || info.line === 0) {
                continue;
            }

            const locationKey = `${info.file}:${info.line}`;
            
            // ONE-LINE-ONE-STEP ENFORCEMENT
            // Only allow multiple steps for function enter/exit
            const isFuncEnter = ev.type === 'func_enter';
            const isFuncExit = ev.type === 'func_exit';
            const isHeapEvent = ev.type === 'heap_alloc' || ev.type === 'heap_free';
            
            // Skip heap events that aren't from real allocators
            if (isHeapEvent && !ev.isHeap) {
                continue;
            }
            
            // Skip function exits (not meaningful to beginners)
            if (isFuncExit) {
                continue;
            }
            
            // Skip redundant function enters (only main start shown)
            if (isFuncEnter && info.function !== 'main') {
                continue;
            }
            
            // Check if this line already has a step
            if (lineSteps.has(locationKey) && !isFuncEnter && !isFuncExit) {
                // Merge into existing step - update to latest value
                const existingStep = lineSteps.get(locationKey);
                
                // Update with latest value/state
                if (ev.type === 'assign' || ev.type === 'array_index_assign') {
                    if (ev.name) existingStep.name = ev.name;
                    if (ev.value !== undefined) existingStep.value = ev.value;
                    if (ev.indices) existingStep.indices = ev.indices;
                    existingStep.explanation = this.getEventExplanation(ev, info);
                }
                
                continue; // Don't create new step
            }

            // Create step based on event type
            let step = null;
            
            if (ev.type === 'array_create') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'array_create',
                    line: info.line,
                    function: info.function,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    name: ev.name,
                    baseType: ev.baseType,
                    dimensions: ev.dimensions,
                    isStack: ev.isStack !== false,
                    explanation: `Array declared: ${ev.name}${JSON.stringify(ev.dimensions)}`,
                    internalEvents: []
                };
                
                this.arrayRegistry.set(ev.name, {
                    name: ev.name,
                    baseType: ev.baseType,
                    dimensions: ev.dimensions,
                    values: [],
                    isStack: ev.isStack !== false
                });
            } else if (ev.type === 'array_init') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'array_init',
                    line: info.line,
                    function: info.function,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    name: ev.name,
                    values: ev.values,
                    explanation: `Array initialized: ${ev.name}`,
                    internalEvents: []
                };
                
                const arr = this.arrayRegistry.get(ev.name);
                if (arr) arr.values = ev.values;
            } else if (ev.type === 'array_index_assign') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'array_index_assign',
                    line: info.line,
                    function: info.function,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    name: ev.name,
                    indices: ev.indices,
                    value: ev.value,
                    explanation: `${ev.name}${JSON.stringify(ev.indices)} = ${ev.value}`,
                    internalEvents: []
                };
            } else if (ev.type === 'pointer_alias') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'pointer_alias',
                    line: info.line,
                    function: info.function,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    name: ev.name,
                    aliasOf: ev.aliasOf,
                    decayedFromArray: ev.decayedFromArray || false,
                    explanation: `${ev.name} → ${ev.aliasOf}${ev.decayedFromArray ? ' (array decay)' : ''}`,
                    internalEvents: []
                };
            } else if (ev.type === 'declare') {
                // Skip bare declares, wait for assign
                continue;
            } else if (ev.type === 'assign') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'assign',
                    line: info.line,
                    function: info.function,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    name: ev.name,
                    value: ev.value,
                    explanation: `${ev.name} = ${ev.value}`,
                    internalEvents: []
                };
            } else if (isHeapEvent && ev.isHeap) {
                step = {
                    stepIndex: stepIndex++,
                    eventType: ev.type,
                    line: info.line,
                    function: info.function,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    size: ev.size,
                    addr: ev.addr,
                    explanation: this.getEventExplanation(ev, info),
                    internalEvents: []
                };
            }
            
            if (step) {
                codeSteps.push(step);
                lineSteps.set(locationKey, step);
            }
        }

        // Add output steps
        const outputSteps = this.createOutputSteps(programOutput.stdout, stepIndex);
        const allSteps = [...codeSteps, ...outputSteps];

        // Add program end
        allSteps.push({
            stepIndex: allSteps.length,
            eventType: 'program_end',
            line: 0,
            function: 'main',
            file: path.basename(sourceFile),
            timestamp: Date.now(),
            explanation: '✅ Program completed',
            internalEvents: []
        });

        console.log(`✅ Generated ${allSteps.length} steps (${codeSteps.length} code)`);
        
        return allSteps;
    }

    getEventExplanation(ev, info) {
        switch (ev.type) {
            case 'heap_alloc': 
                return `Allocated ${ev.size} bytes`;
            case 'heap_free':  
                return `Freed memory`;
            default:           
                return `${ev.type}`;
        }
    }

    extractGlobals(steps) {
        return [];
    }

    extractFunctions(steps, trackedFunctions) {
        const map = new Map();
        
        // Add tracked functions from tracer
        for (const fn of trackedFunctions) {
            if (!map.has(fn)) {
                map.set(fn, { name: fn, line: 0, returnType: 'auto' });
            }
        }
        
        // Add from steps
        for (const s of steps) {
            if (s.function && !map.has(s.function)) {
                map.set(s.function, { name: s.function, line: s.line, returnType: 'auto' });
            }
        }
        
        return Array.from(map.values());
    }

    async generateTrace(code, language = 'cpp') {
        console.log('🚀 Starting trace generation...');

        this.arrayRegistry.clear();

        let exe, src, traceOut, hdr;
        try {
            ({ executable: exe, sourceFile: src, traceOutput: traceOut, headerCopy: hdr } = await this.compile(code, language));

            const { stdout, stderr } = await this.executeInstrumented(exe, traceOut);

            const { events, functions } = await this.parseTraceFile(traceOut);
            console.log(`📋 Captured ${events.length} raw events, ${functions.length} functions`);

            const steps = await this.convertToSteps(events, exe, src, { stdout, stderr }, functions);

            const result = {
                steps,
                totalSteps: steps.length,
                globals: this.extractGlobals(steps),
                functions: this.extractFunctions(steps, functions),
                metadata: {
                    debugger: 'gcc-instrumentation',
                    version: '4.0',
                    hasRealMemory: true,
                    hasHeapTracking: true,
                    hasArraySupport: true,
                    hasPointerSupport: true,
                    capturedEvents: events.length,
                    filteredSteps: steps.length,
                    programOutput: stdout,
                    timestamp: Date.now()
                }
            };
            
            console.log('✅ Trace complete', {
                steps: result.totalSteps,
                functions: result.functions.length,
                arrays: this.arrayRegistry.size
            });
            
            return result;
        } catch (e) {
            console.error('❌ Trace failed:', e.message);
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