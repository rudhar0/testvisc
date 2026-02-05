const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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
// Assuming we can run the backend service or similar. 
// Actually I need to run the tracer service. 
// I'll try to use the backend API or just run the tracer if accessible.
// But the tracer is a service inside backend.
// Let's try to run a script that imports the service.

const TracerService = require('./src/services/instrumentation-tracer.service.js');

async function runTest() {
    try {
        const tracer = new TracerService();
        console.log('Generating trace...');
        const trace = await tracer.generateTrace(path.resolve(testFile), '');

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
            console.log('Found ' + iterations.length + ' buffered iterations (expected 3).');

            if (iterations.length === 3) {
                console.log('✅ Loop compression successful!');
            } else {
                console.error('❌ Mismatch in iterations.');
            }

        } else {
            console.error('❌ No loop summary found. Compression failed.');
            // Print some steps to debug
            console.log('First 10 steps types:', trace.steps.slice(0, 10).map(s => s.eventType));
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

runTest();
