// Test to verify loop events are NOT filtered out
import StepFilterService from './src/services/step-filter.service.js';

// Simulated raw events from instrumentation-tracer
const rawEvents = [
  {
    type: 'program_start',
    line: 1,
    function: 'main',
    file: 'test.c',
  },
  {
    type: 'var_declare',
    name: 'i',
    line: 5,
    function: 'main',
    file: 'test.c',
  },
  {
    eventType: 'loop_start',  // NOTE: instrumentation-tracer uses eventType
    loopId: 0,
    loopType: 'for',
    line: 6,
    function: 'main',
    file: 'test.c',
  },
  {
    eventType: 'loop_condition',
    loopId: 0,
    result: 1,
    line: 6,
    function: 'main',
    file: 'test.c',
  },
  {
    eventType: 'loop_body_start',
    loopId: 0,
    iteration: 1,
    line: 7,
    function: 'main',
    file: 'test.c',
  },
  {
    type: 'output',
    value: '1',
    line: 7,
    function: 'printf',
    file: 'test.c',
  },
  {
    eventType: 'loop_iteration_end',
    loopId: 0,
    iteration: 1,
    line: 8,
    function: 'main',
    file: 'test.c',
  },
  {
    eventType: 'loop_condition',
    loopId: 0,
    result: 0,
    line: 6,
    function: 'main',
    file: 'test.c',
  },
  {
    eventType: 'loop_end',
    loopId: 0,
    line: 9,
    function: 'main',
    file: 'test.c',
  },
  {
    type: 'program_end',
    line: 10,
    function: 'main',
    file: 'test.c',
  }
];

console.log('='.repeat(80));
console.log('Testing Loop Event Filtering');
console.log('='.repeat(80));

const filter = new StepFilterService();
const filtered = filter.filterAndProcessSteps(rawEvents, 'test.c', '1');

console.log('\n📊 Results:');
console.log(`  Raw events: ${rawEvents.length}`);
console.log(`  Filtered steps: ${filtered.length}`);
console.log(`  Removed: ${rawEvents.length - filtered.length}`);

console.log('\n✅ Filtered steps:');
filtered.forEach((step, idx) => {
  const type = step.type || step.eventType || 'unknown';
  console.log(`  ${idx}: ${type.padEnd(20)} - ${step.explanation || ''}`);
});

// Check for loop events
const loopEventTypes = ['loop_start', 'loop_condition', 'loop_body_start', 'loop_iteration_end', 'loop_end'];
const presentLoopEvents = filtered.filter(s => loopEventTypes.includes(s.type)).map(s => s.type);
const missingLoopEvents = loopEventTypes.filter(t => !presentLoopEvents.includes(t));

console.log('\n🔄 Loop Events Status:');
console.log(`  Present: ${presentLoopEvents.join(', ') || 'NONE'}`);
console.log(`  Missing: ${missingLoopEvents.join(', ') || 'NONE'}`);

if (missingLoopEvents.length === 0) {
  console.log('\n✅ SUCCESS: All loop events are preserved!');
} else {
  console.log('\n❌ FAILURE: Some loop events are missing!');
  process.exit(1);
}

console.log('\n' + '='.repeat(80));
