import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import tracer from './src/services/instrumentation-tracer.service.js';

const __filename = fileURLToPath(import.meta.url);
const testFile = 'loop_test.c';
const testCode = `
#include <stdio.h>

int main() {
    int sum = 0;
    for (int i = 0; i < 3; i++) {
        sum += i;
        printf("Iteration %d, sum %d\\n", i, sum);
    }
    printf("Final sum: %d\\n", sum);
    return 0;
}
`;
fs.writeFileSync(testFile, testCode);

async function run() {
    try {
        console.log('Compiling...');
        const result = await tracer.compile(testCode, 'c');
        console.log('Compile success.');

        console.log('Running executable manually...');
        const env = { ...process.env, TRACE_OUTPUT: result.traceOutput };
        try {
            const output = execSync(result.executable, { encoding: 'utf-8', env });
            console.log('Output:', output);
        } catch (err) {
            console.error('Execution failed:', err.message);
        }

        console.log('Reading trace file:', result.traceOutput);
        if (fs.existsSync(result.traceOutput)) {
            const traceContent = fs.readFileSync(result.traceOutput, 'utf-8');
            // Trace file is valid JSON?
            // The backend writes JSON events separated by comma inside a file (but format might be slightly specific based on tracer.cpp)
            // Tracer.cpp writes: { ... }, { ... }
            // It doesn't wrap in [ ]. So it's not valid JSON as a whole.
            // Wait, `instrumentation-tracer.service.js` parses it as JSON?
            // Line 343: `const parsed = JSON.parse(txt);`
            // This implies `tracer.cpp` DOES output valid JSON.

            // Let's check `tracer.cpp` write_json_event.
            // Line 146: `if (g_event_counter > 0) fputs(",\n", g_trace_file);`
            // Line 148: `fprintf(..., "{...}")`

            // Where is the opening '['?
            // Constructor? `init_tracer`?
            // `init_tracer` (lines 798-...)
            // I didn't see init_tracer content.

            // I'll assume parsing logic of `instrumentation-tracer` assumes valid JSON or handles it.
            // Actually `tracer.generateTrace` calls `this.parseTraceFile(traceOut)`.
            // I should rely on `tracer.parseTraceFile` logic if possible, or just hack it.
            // For safety, I'll assume valid JSON if the service does so.

            // WAIT. `tracer.parseTraceFile` reads the file.

            const parsed = await tracer.parseTraceFile(result.traceOutput);
            const events = parsed.events;

            console.log(`Parsed ${events.length} events.`);

            // Now call convertToSteps?
            // `tracer.generateTrace` calls `convertToSteps`.
            // I need to call it to see compression.
            // `convertToSteps(events, exe, src, { stdout, stderr }, functions, inputLinesMap)`

            // I'll try to just inspect EVENTS first.
            // `loop_start`, `loop_end` are raw events.
            // `loop_body_summary` is created ONLY in `convertToSteps`?
            // YES. `convertToSteps` does the compression.

            // So I MUST call `convertToSteps` to verify compression.

            const functions = parsed.functions;
            const inputLinesMap = new Map(); // Empty for now

            const steps = await tracer.convertToSteps(events, result.executable, result.sourceFile, { stdout: 'simulated output', stderr: '' }, functions, inputLinesMap);

            console.log(`Converted to ${steps.length} steps.`);

            const summaries = steps.filter(s => s.eventType === 'loop_body_summary' || s.type === 'loop_body_summary');
            console.log(`Found ${summaries.length} loop summaries.`);

            if (summaries.length > 0) {
                console.log('✅ Loop compression confirmed!');
                console.log('Summary events count:', summaries[0].events ? summaries[0].events.length : 0);
            } else {
                console.error('❌ Loop compression NOT found.');
            }
        } else {
            console.error('❌ Trace file not created.');
        }

        // Cleanup
        // await tracer.cleanup([result.executable, result.sourceFile, result.traceOutput, result.headerCopy]);
    } catch (e) {
        console.error('Test failed:', e);
        if (e.stack) console.error(e.stack);
    }
}
run();
