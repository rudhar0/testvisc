// src/services/instrumentation-tracer.service.js
// ENHANCED VERSION with step filtering and output tracking
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
       ✅ IMPROVED: Smart filtering based on source file origin
       
       STRATEGY: Only show events from USER source files, filter everything else
       This is more reliable than function name matching
       -------------------------------------------------------------- */
    shouldFilterEvent(info, event, userSourceFile) {
        const { file, function: fn, line } = info;
        
        // ❌ Filter: No valid source location
        if (!file || line === 0 || file === 'unknown' || file === '??') {
            return true;
        }
        
        // ❌ Filter: System paths (absolute paths outside project)
        if (process.platform !== 'win32') {
            if (file.startsWith('/usr/') || 
                file.startsWith('/lib/') ||
                file.includes('include/c++/') ||
                file.includes('include/bits/')) {
                return true;
            }
        } else {
            // Windows: Filter MinGW system includes
            if (file.includes('mingw') || 
                file.includes('include\\c++') ||
                file.includes('lib\\gcc')) {
                return true;
            }
        }
        
        // ✅ BEST PRACTICE: Keep if it's from user's source file
        const userBasename = path.basename(userSourceFile);
        const eventBasename = path.basename(file);
        if (eventBasename === userBasename) {
            return false; // KEEP user code
        }
        
        // ❌ Filter: Compiler-generated or STL code
        if (file.includes('stl_') || 
            file.includes('bits/') ||
            file.includes('iostream') ||
            file.includes('ostream') ||
            file.includes('streambuf')) {
            return true;
        }
        
        // ❌ Filter: Known internal functions (last resort)
        const internalPrefixes = [
            '__', '_IO_', '_M_', 'std::__', 
            'std::basic_', 'std::char_traits',
            '__gnu_cxx::', '__cxxabi'
        ];
        
        if (internalPrefixes.some(prefix => fn.startsWith(prefix))) {
            return true;
        }
        
        // ✅ KEEP: Everything else (user code, user headers, etc.)
        return false;
    }

    /* \u2705 NEW: Helper to group consecutive events at same source location
       
       Returns events grouped by (file:line) so we can show ONE step per line
       and collapse internal STL/IO operations into internalEvents.
       -------------------------------------------------------------- */
    groupEventsByLocation(events, executable, userSourceFile) {
        const groups = [];
        let currentGroup = null;
        let currentLocation = null;

        for (const event of events) {
            const info = event.resolvedInfo; // Pre-resolved in convertToSteps
            const locationKey = `${info.file}:${info.line}`;

            if (locationKey !== currentLocation) {
                // New location → create new group
                if (currentGroup) {
                    groups.push(currentGroup);
                }
                currentGroup = {
                    location: locationKey,
                    info,
                    events: [event]
                };
                currentLocation = locationKey;
            } else {
                // Same location → merge into group
                currentGroup.events.push(event);
            }
        }

        if (currentGroup) {
            groups.push(currentGroup);
        }

        return groups;
    }

    /* \u2705 NEW: Filter extra steps - keep only user code + important internal events
       
       Rules:
       - KEEP all user source file events
       - KEEP all memory/heap operations (important for visualization)
       - KEEP all variable changes (important for state tracking)
       - FILTER all STL/iostream internals
       - FILTER all compiler-generated functions
       - FILTER all __internal functions
       -------------------------------------------------------------- */
    filterExtraSteps(rawSteps) {
        return rawSteps.filter(step => {
            // \u2705 Always keep program markers
            if (step.eventType === 'program_start' || step.eventType === 'program_end') {
                return true;
            }

            // \u2705 Always keep memory operations
            if (step.eventType === 'heap_alloc' || step.eventType === 'heap_free') {
                return true;
            }

            // \u2705 Always keep variable changes
            if (step.eventType === 'var') {
                return true;
            }

            // \u2705 Always keep output operations (printf, cout)
            if (step.eventType === 'output') {
                return true;
            }

            // \u274c Filter: Internal function signatures
            const internalPrefixes = ['__', '_M_', 'std::', '__gnu', '__cxxabi'];
            if (internalPrefixes.some(prefix => step.function.startsWith(prefix))) {
                return false;
            }

            // \u274c Filter: No source line (unknown location)
            if (step.line === 0 || step.file === 'unknown') {
                return false;
            }

            // \u2705 Keep everything else (user code)
            return true;
        });
    }

    /* --------------------------------------------------------------
       ✅ NEW: Determine if event represents output operation
       
       IMPORTANT: These functions directly affect user-visible output,
       so we need to track when they're called and capture their output.
       
       Detects: printf, cout, puts, fprintf, etc.
       Also detects STL stream operators that are instrumented
       -------------------------------------------------------------- */
    isOutputEvent(event, info) {
        const { function: fn } = info;
        
        // Direct C function calls
        const cFunctions = ['printf', 'puts', 'putchar', 'fprintf', 'sprintf', 'fwrite', 'fputs', 'write'];
        if (cFunctions.some(f => fn.includes(f))) {
            return true;
        }
        
        // C++ stream functions and operators
        const cppFunctions = [
            'operator<<',      // std::cout << x
            'operator>>',      // std::cin >> x
            'std::cout',
            'std::cerr',
            'std::clog',
            'std::basic_ostream',
            '__ostream_insert'
        ];
        if (cppFunctions.some(f => fn.includes(f))) {
            return true;
        }
        
        // Check if function name contains stream-related patterns
        if (fn.includes('stream') || fn.includes('ostream') || fn.includes('output')) {
            return true;
        }
        
        return false;
    }

    /* \u2705 NEW: Track output events and extract relevant text
       
       Maps output operations to the actual text produced,
       so frontend can show \"cout << x;\" with result \"5\\n\"
       -------------------------------------------------------------- */
    trackOutputEvent(event, info, outputBuffer, outputIndex) {
        if (!this.isOutputEvent(event, info)) {
            return { output: null, newIndex: outputIndex };
        }

        // Try to extract next chunk of output
        if (outputBuffer && outputBuffer.length > outputIndex) {
            const remaining = outputBuffer.substring(outputIndex);
            
            // For printf/cout, try to get next line
            const nextNewline = remaining.indexOf('\n');
            if (nextNewline !== -1) {
                const extracted = remaining.substring(0, nextNewline + 1);
                return {
                    output: extracted,
                    newIndex: outputIndex + nextNewline + 1
                };
            } else if (remaining.length > 0) {
                // No newline but output remains
                return {
                    output: remaining,
                    newIndex: outputBuffer.length
                };
            }
        }

        return { output: null, newIndex: outputIndex };
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
       ✅ MODIFIED: Run the instrumented binary and capture STDOUT/STDERR
       Now returns both output and execution status
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
                console.log(`📤 stdout: ${chunk}`);
            });
            proc.stderr.on('data', d => {
                const chunk = d.toString();
                stderr += chunk;
                console.log(`⚠️  stderr: ${chunk}`);
            });

            const timeout = setTimeout(() => {
                proc.kill('SIGKILL');
                reject(new Error('Execution timeout (10 s)'));
            }, 10000);

            proc.on('close', code => {
                clearTimeout(timeout);
                console.log(`🛑 Exit code: ${code}`);
                console.log(`📊 stdout: ${stdout.length} bytes`);
                console.log(`📊 stderr: ${stderr.length} bytes`);
                
                if (code === 0 || code === null) {
                    console.log('✅ Execution completed');
                    // ✅ NEW: Return captured output
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

    /* ✅ COMPLETELY REWRITTEN: Turn raw events → clean user-facing steps
       
       CHANGES:
       1. Groups events by source location (file:line)
       2. Only creates NEW step when source line changes
       3. Merges internal events into internalEvents array
       4. Tracks program output and attaches to relevant steps
       5. Filters out system/STL internals
       6. Creates explicit "main started" and "program end" steps
       7. Assigns any captured output to visible steps
       
       IMPORTANT: Even if function names aren't resolved (func:"unknown"),
       we still need to show output that was captured!
       -------------------------------------------------------------- */
    async convertToSteps(events, executable, sourceFile, programOutput) {
        console.log(`📊 Converting ${events.length} events to steps...`);

        const steps = [];
        let stepIndex = 0;
        
        // ✅ NEW: Track last user-visible source location
        let lastUserLocation = null;
        let lastStep = null;
        
        // ✅ NEW: Track accumulated output
        let outputBuffer = programOutput.stdout || '';
        let outputIndex = 0;
        
        // ✅ NEW: Track if we have uncaptured output
        let hasUncapturedOutput = outputBuffer.length > 0;
        
        // ✅ NEW: Detect main function entry for explicit step
        let mainStarted = false;

        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            console.log('🔎 raw event:', JSON.stringify(ev));
            
            // --- Resolve event location ---
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

            // ✅ NEW: Create explicit "main started" step
            if (!mainStarted && info.function === 'main' && ev.type === 'func_enter') {
                steps.push({
                    stepIndex: stepIndex++,
                    eventType: 'program_start',
                    line: info.line,
                    function: 'main',
                    file: path.basename(info.file),
                    timestamp: ev.ts || null,
                    explanation: '🚀 Program execution started in main()',
                    stdout: null,
                    internalEvents: []
                });
                mainStarted = true;
                lastUserLocation = `${info.file}:${info.line}`;
                lastStep = steps[steps.length - 1];
                console.log(`📍 Step ${stepIndex - 1}: [program_start] 🚀 main() started`);
                continue;
            }

            // ✅ IMPROVED: On main exit, check if we have output to capture
            if (mainStarted && info.function === 'main' && ev.type === 'func_exit' && hasUncapturedOutput) {
                // Create an output step for main's output
                if (outputIndex < outputBuffer.length) {
                    const step = {
                        stepIndex: stepIndex++,
                        eventType: 'output',
                        line: info.line,
                        function: 'main',
                        file: path.basename(info.file),
                        timestamp: ev.ts || null,
                        stdout: outputBuffer.substring(outputIndex),
                        explanation: `📤 Output: ${outputBuffer.substring(outputIndex).trim()}`,
                        internalEvents: []
                    };
                    steps.push(step);
                    lastStep = step;
                    outputIndex = outputBuffer.length;
                    hasUncapturedOutput = false;
                    console.log(`📤 Output step created with: ${outputBuffer.substring(outputIndex - (outputBuffer.length - outputIndex)).trim()}`);
                    continue;
                }
            }

            // ✅ IMPROVED: Filter using source file comparison
            if (this.shouldFilterEvent(info, ev, sourceFile)) {
                // Keep track internally but don't create visible steps
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
                console.log(`🔇 Filtered: ${info.function} from ${path.basename(info.file)} (not user code)`);
                continue;
            }

            // Skip events with no useful source location
            if (!info.file || info.line === 0) {
                console.log(`⚠️  Skipped: no source location`);
                continue;
            }

            // ✅ NEW: Create location key for grouping
            const locationKey = `${info.file}:${info.line}`;
            
            // ✅ NEW: Check if same source line (group events)
            const isSameLocation = locationKey === lastUserLocation;
            
            // ✅ NEW: Variable events ALWAYS create their own step (important for animation)
            const isVariableEvent = ev.type === 'var';
            
            // ✅ NEW: Heap events should create visible steps
            const isHeapEvent = ev.type === 'heap_alloc' || ev.type === 'heap_free';
            
            if (isSameLocation && !isVariableEvent && !isHeapEvent && lastStep) {
                // ----- MERGE into existing step -----
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
                console.log(`🔀 Merged into step ${lastStep.stepIndex}: ${ev.type}`);
                continue;
            }

            // ----- CREATE NEW STEP -----
            
            // ✅ NEW: Check if this is an output operation and extract the output
            let capturedOutput = null;
            let isOutputOp = false;
            
            if (this.isOutputEvent(ev, info)) {
                isOutputOp = true;
                const result = this.trackOutputEvent(ev, info, outputBuffer, outputIndex);
                capturedOutput = result.output;
                outputIndex = result.newIndex;
                
                if (capturedOutput) {
                    console.log(`📤 Captured output: ${JSON.stringify(capturedOutput)}`);
                }
            }

            const step = {
                stepIndex: stepIndex++,
                eventType: isOutputOp ? 'output' : ev.type, // ✅ CHANGED: Mark as 'output' if detected
                line: info.line,
                function: info.function,
                file: path.basename(info.file),
                timestamp: ev.ts || null,
                name: ev.name || null,
                value: ev.value ?? null,
                varType: ev.type === 'var' ? (ev.varType || 'unknown') : null,
                size: ev.size ?? null,
                addr: ev.addr ?? null,
                stdout: capturedOutput, // ✅ NEW: Attach captured output
                explanation: this.getEventExplanation(ev, info, capturedOutput, isOutputOp),
                internalEvents: [] // ✅ NEW: Container for merged events
            };
            
            steps.push(step);
            lastStep = step;
            lastUserLocation = locationKey;
            
            console.log(`📍 Step ${step.stepIndex}: [${step.eventType}] ${step.function}:${step.line} ${step.explanation}`);
        }

        // ✅ NEW: Check if there's unassigned output and attach to appropriate steps
        if (outputIndex < outputBuffer.length) {
            const remainingOutput = outputBuffer.substring(outputIndex);
            
            // Find the last main() execution step to attach output
            for (let i = steps.length - 1; i >= 0; i--) {
                const step = steps[i];
                if ((step.function === 'main' || step.eventType === 'func_enter') && step.eventType !== 'program_start' && step.eventType !== 'program_end') {
                    if (!step.stdout) {
                        step.stdout = remainingOutput;
                        step.eventType = 'output';
                        step.explanation = `📤 Output: ${remainingOutput.trim()}`;
                        console.log(`📤 Attached remaining output to step ${step.stepIndex}: ${remainingOutput.trim()}`);
                        outputIndex = outputBuffer.length;
                    }
                    break;
                }
            }
        }

        // ✅ NEW: Add explicit "program end" step
        steps.push({
            stepIndex: stepIndex++,
            eventType: 'program_end',
            line: 0,
            function: 'main',
            file: path.basename(sourceFile),
            timestamp: Date.now(),
            explanation: '✅ Program execution completed',
            stdout: outputIndex < outputBuffer.length ? outputBuffer.substring(outputIndex) : null,
            internalEvents: []
        });

        // ✅ NEW: Apply extra step filtering to remove unnecessary internal steps
        const filteredSteps = this.filterExtraSteps(steps);

        console.log(`✅ Generated ${filteredSteps.length} clean execution steps (from ${steps.length})`);
        console.log(`🔍 Filtered out ${steps.length - filteredSteps.length} extra internal steps`);
        console.log(`📊 Event analysis: ${events.length} raw events → ${filteredSteps.length} visible steps`);
        
        return filteredSteps;
    }

    /* ✅ MODIFIED: Enhanced explanation with output info and proper output handling */
    getEventExplanation(ev, info, output, isOutputOp) {
        // ✅ NEW: Handle output operations with actual captured output
        if (isOutputOp && output) {
            return `📤 Output: ${output.trim()}`;
        }
        
        if (isOutputOp) {
            return `📤 ${info.function}() called`;
        }
        
        switch (ev.type) {
            case 'func_enter': 
                return `Entering ${info.function}()`;
            case 'func_exit':  
                return `Exiting ${info.function}()`;
            case 'var':        
                return `${ev.name} = ${ev.value}`;
            case 'heap_alloc': 
                return `Allocated ${ev.size} bytes at ${ev.addr}`;
            case 'heap_free':  
                return `Freed memory at ${ev.addr}`;
            default:           
                if (output) {
                    return `Output: ${output.trim()}`;
                }
                return `${ev.type} event`;
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
            if ((s.eventType === 'func_enter' || s.eventType === 'program_start') && !map.has(s.function)) {
                map.set(s.function, { name: s.function, line: s.line, returnType: 'auto' });
            }
        }
        return Array.from(map.values());
    }

    /* --------------------------------------------------------------
       ✅ MODIFIED: Public entry point with output tracking
       -------------------------------------------------------------- */
    async generateTrace(code, language = 'cpp') {
        console.log('🚀 Starting Instrumentation‑Based Execution Tracing...');
        console.log(`📝 Code size: ${code.length} bytes`);

        let exe, src, traceOut, hdr;
        try {
            ({ executable: exe, sourceFile: src, traceOutput: traceOut, headerCopy: hdr } = await this.compile(code, language));

            // ✅ MODIFIED: Capture program output
            const { stdout, stderr } = await this.executeInstrumented(exe, traceOut);

            const rawEvents = await this.parseTraceFile(traceOut);
            console.log(`📋 Captured ${rawEvents.length} raw events`);

            // ✅ MODIFIED: Pass output to step converter
            const steps = await this.convertToSteps(rawEvents, exe, src, { stdout, stderr });

            const result = {
                steps,
                totalSteps: steps.length,
                globals: this.extractGlobals(steps),
                functions: this.extractFunctions(steps),
                metadata: {
                    debugger: process.platform === 'win32' ? 'mingw‑instrumentation' : 'gcc‑instrumentation',
                    version: '1.1', // ✅ NEW: Version bump
                    hasRealMemory: true,
                    hasHeapTracking: true,
                    hasOutputTracking: true, // ✅ NEW: Feature flag
                    capturedEvents: rawEvents.length,
                    filteredEvents: rawEvents.length - steps.length, // ✅ NEW: Show filtering stats
                    programOutput: stdout, // ✅ NEW: Full output available
                    timestamp: Date.now()
                }
            };
            console.log('✅ Trace generation complete', {
                steps: result.totalSteps,
                functions: result.functions.length,
                globals: result.globals.length,
                outputLines: stdout.split('\n').length
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