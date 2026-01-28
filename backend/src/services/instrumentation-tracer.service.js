// backend/src/services/instrumentation-tracer.service.js
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
        this.pointerRegistry = new Map();
        this.functionRegistry = new Map();
        this.callStack = [];
        
        this.frameStack = [];
        this.globalCallIndex = 0;
        this.frameCounts = new Map();
    }

    async ensureTempDir() {
        if (!existsSync(this.tempDir)) {
            await mkdir(this.tempDir, { recursive: true });
        }
    }

    generateFrameId(functionName) {
        const count = this.frameCounts.get(functionName) || 0;
        this.frameCounts.set(functionName, count + 1);
        return `${functionName}-${count}`;
    }

    getCurrentFrameMetadata() {
        if (this.frameStack.length === 0) {
            return {
                frameId: 'main-0',
                callDepth: 0,
                callIndex: this.globalCallIndex++,
                parentFrameId: undefined
            };
        }
        
        const current = this.frameStack[this.frameStack.length - 1];
        return {
            frameId: current.frameId,
            callDepth: current.callDepth,
            callIndex: this.globalCallIndex++,
            parentFrameId: current.parentFrameId
        };
    }

    pushCallFrame(functionName) {
        const parentFrame = this.frameStack.length > 0 
            ? this.frameStack[this.frameStack.length - 1] 
            : null;
        
        const frameId = this.generateFrameId(functionName);
        const callDepth = this.frameStack.length;
        
        const frame = {
            frameId,
            functionName,
            callDepth,
            parentFrameId: parentFrame ? parentFrame.frameId : undefined,
            entryCallIndex: this.globalCallIndex++,
            activeLoops: new Set(),
            declaredVariables: new Map()
        };
        
        this.frameStack.push(frame);
        return frame;
    }

    popCallFrame() {
        return this.frameStack.pop();
    }

    async getLineInfo(executable, address) {
        return new Promise((resolve) => {
            const proc = spawn('addr2line', ['-e', executable, '-f', '-C', '-i', address]);
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
        
        if (!file || line === 0 || file === 'unknown' || file === '??') return true;
        
        if (fn && (fn.includes('GLOBAL__sub') || 
                   fn.includes('_static_initialization_and_destruction'))) {
            return true;
        }
        
        if (process.platform !== 'win32') {
            if (file.startsWith('/usr/') || file.startsWith('/lib/') ||
                file.includes('include/c++/') || file.includes('include/bits/')) return true;
        } else {
            if (file.includes('mingw') || file.includes('include\\c++') ||
                file.includes('lib\\gcc')) return true;
        }
        
        const userBasename = path.basename(userSourceFile);
        const eventBasename = path.basename(file);
        if (eventBasename === userBasename) return false;
        
        if (file.includes('stl_') || file.includes('bits/') ||
            file.includes('iostream') || file.includes('ostream') ||
            file.includes('streambuf')) return true;
        
        const internalPrefixes = ['__', '_IO_', '_M_', 'std::__', 
            'std::basic_', 'std::char_traits', '__gnu_cxx::', '__cxxabi'];
        
        return internalPrefixes.some(prefix => fn && fn.startsWith(prefix));
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
        if (!stdout || stdout.trim().length === 0) return [];

        const lines = stdout.split('\n');
        const steps = [];
        let stepIndex = baseStepIndex;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().length === 0 && i === lines.length - 1) continue;

            const { rendered, escapes } = this.parseEscapeSequences(line);
            
            const frameMetadata = this.getCurrentFrameMetadata();
            
            steps.push({
                stepIndex: stepIndex++,
                eventType: 'output',
                line: 0,
                function: 'output',
                scope: 'global',
                file: 'stdout',
                timestamp: Date.now() + i,
                text: rendered,
                rawText: line,
                escapeInfo: escapes,
                explanation: `📤 Output: "${rendered}"`,
                internalEvents: [],
                ...frameMetadata
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
        const executable = path.join(this.tempDir, `exec_${sessionId}${process.platform === 'win32' ? '.exe' : ''}`);
        const traceOutput = path.join(this.tempDir, `trace_${sessionId}.json`);
        const headerCopy = path.join(this.tempDir, 'trace.h');

        await writeFile(sourceFile, instrumented, 'utf-8');
        await copyFile(this.traceHeader, headerCopy);

        const compileUser = new Promise((resolve, reject) => {
            const args = ['-c', '-g', '-O0', stdFlag, '-fno-omit-frame-pointer',
                '-finstrument-functions', sourceFile, '-o', userObj];
            const p = spawn(compiler, args);
            let err = '';
            p.stderr.on('data', d => err += d.toString());
            p.on('close', code => code === 0 ? resolve() : reject(new Error(`User compile failed:\n${err}`)));
            p.on('error', e => reject(e));
        });

        const compileTracer = new Promise((resolve, reject) => {
            const args = ['-c', '-g', '-O0', stdFlag, '-fno-omit-frame-pointer',
                this.tracerCpp, '-o', tracerObj];
            const p = spawn(compiler, args);
            let err = '';
            p.stderr.on('data', d => err += d.toString());
            p.on('close', code => code === 0 ? resolve() : reject(new Error(`Tracer compile failed:\n${err}`)));
            p.on('error', e => reject(e));
        });

        await Promise.all([compileUser, compileTracer]);

        const linkArgs = [userObj, tracerObj, '-o', executable];
        if (process.platform !== 'win32') linkArgs.unshift('-pthread', '-ldl');

        return new Promise((resolve, reject) => {
            const link = spawn(compiler, linkArgs);
            let err = '';
            link.stderr.on('data', d => err += d.toString());
            link.on('close', code => {
                if (code === 0) {
                    resolve({ executable, sourceFile, traceOutput, headerCopy });
                } else {
                    reject(new Error(`Linking failed:\n${err}`));
                }
            });
            link.on('error', e => reject(e));
        });
    }

    async executeInstrumented(executable, traceOutput) {
        return new Promise((resolve, reject) => {
            const cmd = process.platform === 'win32' ? executable : `./${path.basename(executable)}`;
            const cwd = process.platform === 'win32' ? path.dirname(executable) : process.cwd();

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
            return { events: parsed.events || [], functions: parsed.tracked_functions || [] };
        } catch (e) {
            console.error('Failed to read/parse trace file:', e.message);
            return { events: [], functions: [] };
        }
    }

    async convertToSteps(events, executable, sourceFile, programOutput, trackedFunctions) {
        console.log(`📊 Converting ${events.length} events to beginner-correct steps...`);

        const steps = [];
        let stepIndex = 0;
        let mainStarted = false;
        let currentFunction = 'main';

        this.frameStack = [];
        this.globalCallIndex = 0;
        this.frameCounts = new Map();

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

            if (!mainStarted && info.function === 'main' && ev.type === 'func_enter') {
                const mainFrame = this.pushCallFrame('main');
                
                steps.push({
                    stepIndex: stepIndex++,
                    eventType: 'program_start',
                    line: info.line,
                    function: 'main',
                    scope: 'global',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    explanation: '🚀 Program started',
                    internalEvents: [],
                    frameId: mainFrame.frameId,
                    callDepth: mainFrame.callDepth,
                    callIndex: mainFrame.entryCallIndex,
                    parentFrameId: mainFrame.parentFrameId,
                    isFunctionEntry: true
                });
                mainStarted = true;
                currentFunction = 'main';
                continue;
            }

            if (this.shouldFilterEvent(info, ev, sourceFile)) continue;
            if (!info.file || info.line === 0) continue;

            if (ev.type === 'func_enter' && info.function !== 'main') {
                const newFrame = this.pushCallFrame(info.function);
                currentFunction = info.function;
                
                steps.push({
                    stepIndex: stepIndex++,
                    eventType: 'func_enter',
                    line: info.line,
                    function: info.function,
                    scope: 'function',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    explanation: `➡️ Entering ${info.function}`,
                    internalEvents: [],
                    frameId: newFrame.frameId,
                    callDepth: newFrame.callDepth,
                    callIndex: newFrame.entryCallIndex,
                    parentFrameId: newFrame.parentFrameId,
                    isFunctionEntry: true
                });
                continue;
            }

            if (ev.type === 'func_exit') {
                const exitingFrame = this.popCallFrame();
                
                if (exitingFrame) {
                    steps.push({
                        stepIndex: stepIndex++,
                        eventType: 'func_exit',
                        line: info.line,
                        function: info.function,
                        scope: 'function',
                        file: path.basename(info.file),
                        timestamp: ev.ts || null,
                        explanation: `⬅️ Exiting ${info.function}`,
                        internalEvents: [],
                        frameId: exitingFrame.frameId,
                        callDepth: exitingFrame.callDepth,
                        callIndex: this.globalCallIndex++,
                        parentFrameId: exitingFrame.parentFrameId,
                        isFunctionExit: true
                    });
                }
                
                currentFunction = this.frameStack.length > 0 
                    ? this.frameStack[this.frameStack.length - 1].functionName 
                    : 'main';
                if (!currentFunction) currentFunction = 'main';
                continue;
            }

            const frameMetadata = this.getCurrentFrameMetadata();
            const currentFrame = this.frameStack[this.frameStack.length - 1];

            let step = null;

            if (ev.type === 'loop_start') {
                const loopId = ev.loopId;
                if (currentFrame && !currentFrame.activeLoops.has(loopId)) {
                    currentFrame.activeLoops.add(loopId);
                    step = {
                        stepIndex: stepIndex++,
                        eventType: 'loop_start',
                        line: info.line,
                        function: currentFunction,
                        scope: 'block',
                        file: path.basename(info.file),
                        timestamp: ev.ts || null,
                        loopId: ev.loopId,
                        loopType: ev.loopType,
                        explanation: `Loop started (${ev.loopType})`,
                        internalEvents: [],
                        ...frameMetadata
                    };
                }
                
            } else if (ev.type === 'loop_end') {
                const loopId = ev.loopId;
                if (currentFrame && currentFrame.activeLoops.has(loopId)) {
                    currentFrame.activeLoops.delete(loopId);
                    step = {
                        stepIndex: stepIndex++,
                        eventType: 'loop_end',
                        line: info.line,
                        function: currentFunction,
                        scope: 'block',
                        file: path.basename(info.file),
                        timestamp: ev.ts || null,
                        loopId: ev.loopId,
                        explanation: `Loop ended`,
                        internalEvents: [],
                        ...frameMetadata
                    };
                }
                
            } else if (ev.type === 'loop_condition') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'loop_condition',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    loopId: ev.loopId,
                    result: ev.result,
                    explanation: `Loop condition: ${ev.result ? 'true (continue)' : 'false (exit)'}`,
                    internalEvents: [],
                    ...frameMetadata
                };
                
            } else if (ev.type === 'loop_break') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'loop_break',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    explanation: '🔴 Break statement',
                    internalEvents: [],
                    ...frameMetadata
                };
                
            } else if (ev.type === 'loop_continue') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'loop_continue',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    explanation: '🔄 Continue statement',
                    internalEvents: [],
                    ...frameMetadata
                };
                
            } else if (ev.type === 'array_create') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'array_create',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    symbol: ev.name,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    name: ev.name,
                    baseType: ev.baseType,
                    dimensions: ev.dimensions,
                    isStack: ev.isStack !== false,
                    memoryRegion: 'stack',
                    explanation: `📦 Array ${ev.name}${JSON.stringify(ev.dimensions)} declared`,
                    internalEvents: [],
                    ...frameMetadata
                };
                
                this.arrayRegistry.set(ev.name, {
                    name: ev.name,
                    baseType: ev.baseType,
                    dimensions: ev.dimensions,
                    isStack: ev.isStack !== false
                });
                
            } else if (ev.type === 'array_index_assign') {
                const charInfo = ev.char ? ` ('${String.fromCharCode(ev.value)}')` : '';
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'array_index_assign',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    symbol: ev.name,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    name: ev.name,
                    indices: ev.indices,
                    value: ev.value,
                    memoryRegion: 'stack',
                    explanation: `${ev.name}${JSON.stringify(ev.indices)} = ${ev.value}${charInfo}`,
                    internalEvents: [],
                    ...frameMetadata
                };
                
            } else if (ev.type === 'pointer_alias') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'pointer_alias',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    symbol: ev.name,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    name: ev.name,
                    aliasOf: ev.aliasOf,
                    decayedFromArray: ev.decayedFromArray || false,
                    pointsTo: {
                        region: 'stack',
                        target: ev.aliasOf,
                        address: null
                    },
                    explanation: ev.decayedFromArray 
                        ? `${ev.name} → ${ev.aliasOf} (array decay)`
                        : `${ev.name} → &${ev.aliasOf}`,
                    internalEvents: [],
                    ...frameMetadata
                };
                
                this.pointerRegistry.set(ev.name, {
                    pointsTo: ev.aliasOf,
                    isHeap: false
                });
                
            } else if (ev.type === 'pointer_deref_write') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'pointer_deref_write',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    symbol: ev.pointerName,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    pointerName: ev.pointerName,
                    targetName: ev.targetName,
                    value: ev.value,
                    isHeap: ev.isHeap || false,
                    explanation: ev.isHeap
                        ? `*${ev.pointerName} = ${ev.value} (heap write)`
                        : `*${ev.pointerName} = ${ev.value} (writes to ${ev.targetName})`,
                    internalEvents: [],
                    ...frameMetadata
                };
                
            } else if (ev.type === 'heap_write') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'heap_write',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    address: ev.addr || ev.address,
                    value: ev.value,
                    memoryRegion: 'heap',
                    explanation: `Heap cell = ${ev.value}`,
                    internalEvents: [],
                    ...frameMetadata
                };
                
            } else if (ev.type === 'declare') {
                const varKey = `${frameMetadata.frameId}:${ev.name}`;
                if (currentFrame && currentFrame.declaredVariables.has(varKey)) {
                    step = {
                        stepIndex: stepIndex++,
                        eventType: 'var_assign',
                        line: info.line,
                        function: currentFunction,
                        scope: 'block',
                        symbol: ev.name,
                        file: path.basename(info.file),
                        timestamp: ev.ts || null,
                        name: ev.name,
                        value: null,
                        explanation: `${ev.name} redeclared in loop (treated as assignment)`,
                        internalEvents: [],
                        ...frameMetadata
                    };
                } else {
                    if (currentFrame) {
                        currentFrame.declaredVariables.set(varKey, true);
                    }
                    step = {
                        stepIndex: stepIndex++,
                        eventType: 'var_declare',
                        line: info.line,
                        function: currentFunction,
                        scope: 'block',
                        symbol: ev.name,
                        file: path.basename(info.file),
                        timestamp: ev.ts || null,
                        name: ev.name,
                        varType: ev.varType,
                        explanation: `${ev.varType} ${ev.name} declared`,
                        internalEvents: [],
                        ...frameMetadata
                    };
                }
                
            } else if (ev.type === 'assign') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'var_assign',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    symbol: ev.name,
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    name: ev.name,
                    value: ev.value,
                    explanation: `${ev.name} = ${ev.value}`,
                    internalEvents: [],
                    ...frameMetadata
                };
                
            } else if (ev.type === 'heap_alloc' && ev.isHeap) {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'heap_alloc',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    size: ev.size,
                    address: ev.addr,
                    memoryRegion: 'heap',
                    baseType: 'int',
                    explanation: `Allocated ${ev.size} bytes on heap`,
                    internalEvents: [],
                    ...frameMetadata
                };
                
            } else if (ev.type === 'heap_free') {
                step = {
                    stepIndex: stepIndex++,
                    eventType: 'heap_free',
                    line: info.line,
                    function: currentFunction,
                    scope: 'block',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    address: ev.addr,
                    memoryRegion: 'heap',
                    explanation: `Freed heap memory`,
                    internalEvents: [],
                    ...frameMetadata
                };
            }

            if (step) {
                steps.push(step);
            }
        }

        const outputSteps = this.createOutputSteps(programOutput.stdout, steps.length);
        const allSteps = [...steps, ...outputSteps];

        const lastStepIndex = allSteps.at(-1)?.stepIndex ?? 0;
        const finalFrameMetadata = this.getCurrentFrameMetadata();
        
        allSteps.push({
            stepIndex: lastStepIndex + 1,
            eventType: 'program_end',
            line: 0,
            function: 'main',
            scope: 'global',
            file: path.basename(sourceFile),
            timestamp: Date.now(),
            explanation: '✅ Program completed',
            internalEvents: [],
            ...finalFrameMetadata
        });

        console.log(`✅ Generated ${allSteps.length} beginner-correct steps with frame tracking`);
        
        return allSteps;
    }

    extractGlobals(steps) {
        return steps
            .filter(s => s.scope === 'global' && (s.eventType === 'var_assign' || s.eventType === 'array_create'))
            .map(s => ({
                name: s.symbol || s.name,
                type: s.baseType || 'int',
                value: s.value,
                scope: 'global'
            }));
    }

    extractFunctions(steps, trackedFunctions) {
        const map = new Map();
        
        for (const fn of trackedFunctions) {
            if (fn && fn !== 'unknown' && fn.length > 1) {
                if (!map.has(fn)) {
                    map.set(fn, { 
                        name: fn, 
                        line: 0, 
                        returnType: 'auto',
                        type: 'function'
                    });
                }
            }
        }
        
        return Array.from(map.values());
    }

    async generateTrace(code, language = 'cpp') {
        console.log('🚀 Starting beginner-correct trace generation with frame tracking...');

        this.arrayRegistry.clear();
        this.pointerRegistry.clear();
        this.functionRegistry.clear();
        this.callStack = [];
        
        this.frameStack = [];
        this.globalCallIndex = 0;
        this.frameCounts = new Map();

        let exe, src, traceOut, hdr;
        try {
            ({ executable: exe, sourceFile: src, traceOutput: traceOut, headerCopy: hdr } = 
                await this.compile(code, language));

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
                    debugger: 'gcc-instrumentation-beginner-correct',
                    version: '7.4',
                    hasRealMemory: true,
                    hasHeapTracking: true,
                    hasArraySupport: true,
                    hasPointerSupport: true,
                    hasPointerDerefWriteSemantics: true,
                    hasCharArrayStringInit: true,
                    noStepCollapsing: true,
                    hasCallFrameTracking: true,
                    hasLoopStructureTracking: true,
                    hasBreakContinueTracking: true,
                    capturedEvents: events.length,
                    emittedSteps: steps.length,
                    programOutput: stdout,
                    timestamp: Date.now()
                }
            };
            
            console.log('✅ Beginner-correct trace complete with frame tracking', {
                steps: result.totalSteps,
                functions: result.functions.length,
                arrays: this.arrayRegistry.size,
                pointers: this.pointerRegistry.size,
                maxCallDepth: Math.max(...steps.map(s => s.callDepth || 0))
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