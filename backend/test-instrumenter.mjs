import codeInstrumenter from './src/services/code-instrumenter.service.js';

const testCode = `
#include <stdio.h>

void modify(int* arr) {
    arr[0] = 99;
}

int main() {
    int data[3] = {1, 2, 3};
    modify(data);
    
    for (int i = 0; i < 3; i++) {
        printf("%d ", data[i]);
    }
    
    return 0;
}
`;

console.log('Original code:');
console.log(testCode);
console.log('\nInstrumented code:');
const instrumented = await codeInstrumenter.instrumentCode(testCode, 'c');
console.log(instrumented);