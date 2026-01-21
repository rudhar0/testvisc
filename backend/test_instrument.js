import instrumenter from './src/services/code-instrumenter.service.js';

const sample = `#include <stdio.h>
int main() {
    int data[3] = {1, 2, 3};
    for (int i = 0; i < 3; i++) {
        data[i] = data[i] + 1;
    }
    modify(data);
    return 0;
}`;

(async () => {
  const out = await instrumenter.injectBeginnerModeTracing(sample, 'c');
  console.log('--- INSTRUMENTED ---');
  console.log(out);
})();
