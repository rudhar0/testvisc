import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import tracer from './src/services/instrumentation-tracer.service.js';

const __filename = fileURLToPath(import.meta.url);
const testFile = 'loop_test.c';
const testCode = `
#include <stdio.h>
int main() { printf("Hello"); return 0; }
`;
fs.writeFileSync(testFile, testCode);

async function run() {
    try {
        console.log('Testing compile...');
        const result = await tracer.compile(testCode, 'c');
        console.log('Compile success:', result.executable);
        await tracer.cleanup([result.executable, result.sourceFile, result.traceOutput, result.headerCopy]);
    } catch (e) {
        console.error('Compile failed:', e);
    }
}
run();
