// Test file to verify loop instrumentation for both cases
import CodeInstrumenter from './src/services/code-instrumenter.service.js';

// Test Case 1: For loop with variable declared in for statement
const test1 = `
#include <stdio.h>

int main() {
    for (int i = 0; i < 5; i++) {
        printf("%d\\n", i);
    }
    return 0;
}
`;

// Test Case 2: For loop with pre-declared variable (THE FAILING CASE)
const test2 = `
#include <stdio.h>

int main() {
    int i;
    for (i = 1; i <= 3; i++) {
        printf("%d\\n", i);
    }
    return 0;
}
`;

// Test Case 3: While loop
const test3 = `
#include <stdio.h>

int main() {
    int i = 0;
    while (i < 5) {
        printf("%d\\n", i);
        i++;
    }
    return 0;
}
`;

// Test Case 4: Do-while loop
const test4 = `
#include <stdio.h>

int main() {
    int i = 0;
    do {
        printf("%d\\n", i);
        i++;
    } while (i < 5);
    return 0;
}
`;

// Test Case 5: Nested loops
const test5 = `
#include <stdio.h>

int main() {
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            printf("%d,%d\\n", i, j);
        }
    }
    return 0;
}
`;

async function runTests() {
    console.log('='.repeat(80));
    console.log('Testing Loop Instrumentation');
    console.log('='.repeat(80));

    const tests = [
        { name: 'For loop with declaration', code: test1 },
        { name: 'For loop with pre-declared variable (PREVIOUSLY FAILING)', code: test2 },
        { name: 'While loop', code: test3 },
        { name: 'Do-while loop', code: test4 },
        { name: 'Nested loops', code: test5 }
    ];

    for (const test of tests) {
        console.log(`\n📝 Test: ${test.name}`);
        console.log('-'.repeat(80));
        try {
            const instrumented = await CodeInstrumenter.instrumentCode(test.code, 'c');
            
            // Check for loop trace calls
            const hasLoopStart = instrumented.includes('__trace_loop_start');
            const hasLoopCondition = instrumented.includes('__trace_loop_condition');
            const hasLoopBodyStart = instrumented.includes('__trace_loop_body_start');
            const hasLoopIterationEnd = instrumented.includes('__trace_loop_iteration_end');
            const hasLoopEnd = instrumented.includes('__trace_loop_end');
            const hasAssign = instrumented.includes('__trace_assign');

            console.log(`✓ Loop Start:         ${hasLoopStart ? '✅' : '❌'}`);
            console.log(`✓ Loop Condition:     ${hasLoopCondition ? '✅' : '❌'}`);
            console.log(`✓ Loop Body Start:    ${hasLoopBodyStart ? '✅' : '❌'}`);
            console.log(`✓ Loop Iteration End: ${hasLoopIterationEnd ? '✅' : '❌'}`);
            console.log(`✓ Loop End:           ${hasLoopEnd ? '✅' : '❌'}`);
            console.log(`✓ Assignment Trace:   ${hasAssign ? '✅' : '❌'}`);

            if (hasLoopStart && hasLoopCondition && hasLoopBodyStart && hasLoopIterationEnd && hasLoopEnd) {
                console.log('\n✅ PASS: All loop events are present\n');
            } else {
                console.log('\n❌ FAIL: Missing loop events\n');
            }

            console.log('Output snippet:');
            const lines = instrumented.split('\n').slice(0, 30);
            lines.forEach((line, idx) => {
                console.log(`${String(idx + 1).padStart(3)}: ${line}`);
            });
        } catch (error) {
            console.log(`❌ Error: ${error.message}\n`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Testing Complete');
    console.log('='.repeat(80));
}

runTests().catch(console.error);
