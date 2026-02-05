import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import tracer from './src/services/instrumentation-tracer.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

console.log('Compiling and running instrumentation...');

async function runTest() {
    try {
        console.log('Using imported TracerService instance...');
        // const tracer = new TracerService(); // REMOVED - it's a singleton instance
        console.log('Service initialized.');

        console.log('Current CWD:', process.cwd());
        const targetFile = path.resolve(testFile);
        console.log('Generating trace for:', targetFile);

        // We pass empty input string
        const trace = await tracer.generateTrace(targetFile, '');

        console.log('Trace generated with ' + trace.steps.length + ' steps.');

        const loopSummaries = trace.steps.filter(s => s.eventType === 'loop_body_summary');
        console.log('Found ' + loopSummaries.length + ' loop_body_summary events.');

        if (loopSummaries.length > 0) {
            const summary = loopSummaries[0];
            console.log('First summary events count: ' + summary.events.length);
            console.log('First summary explanation: ' + summary.explanation);

            // Check structure
            const loopStart = trace.steps.find(s => s.eventType === 'loop_start');
            const loopEnd = trace.steps.find(s => s.eventType === 'loop_end');

            if (loopStart && loopEnd) {
                console.log('✅ Found loop_start and loop_end');
            } else {
                console.error('❌ Missing start/end');
            }

            // Expected sequence for 3 iterations:
            // loop_start
            // loop_body_summary (containing 3 iterations worth of events)
            // loop_end

            // Check if flattened events are correct
            const iterations = summary.events.filter(e => e.eventType === 'loop_body_start');
            console.log('Found ' + iterations.length + ' buffered iterations in summary (expected 3).');

            if (iterations.length === 3) {
                console.log('✅ Loop compression successful!');
            } else {
                console.error('❌ Mismatch in iterations.');
            }

        } else {
            console.error('❌ No loop summary found. Compression failed.');
            // Print some steps to debug
            // console.log('First 10 steps types:', trace.steps.slice(0, 10).map(s => s.eventType));
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
        if (err.stack) console.error(err.stack);
    }
}

runTest();
