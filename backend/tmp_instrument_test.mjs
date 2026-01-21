import instrumenter from './src/services/code-instrumenter.service.js';

const sample = `#include <stdio.h>

int modify(int *a) { return 0; }

int main() {
    int data[3] = {1, 2, 3};
    modify(data);
    return 0;
}
`;

(async () => {
  const out = await instrumenter.instrumentCode(sample, 'c');
  console.log('--- INSTRUMENTED OUTPUT ---');
  console.log(out);
})();
