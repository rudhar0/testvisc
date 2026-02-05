import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import tracer from './src/services/instrumentation-tracer.service.js';

const __filename = fileURLToPath(import.meta.url);
const testFile = 'loop_test.c';
const testCode = `
#include <stdio.h>
int main() { printf("Hello World"); return 0; }
`;
fs.writeFileSync(testFile, testCode);

async function run() {
    try {
        console.log('Testing compile...');
        const result = await tracer.compile(testCode, 'c');
        console.log('Compile success.');
        console.log('Executable:', result.executable);

        console.log('Running executable manually...');
        try {
            const output = execSync(result.executable, { encoding: 'utf-8' });
            console.log('Output:', output);
        } catch (err) {
            console.error('Execution failed:', err.message);
        }

        // await tracer.cleanup([result.executable, result.sourceFile, result.traceOutput, result.headerCopy]);
    } catch (e) {
        console.error('Compile failed:', e);
    }
}
run();
