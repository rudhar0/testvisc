import tracer from './src/services/instrumentation-tracer.service.js';
console.log('Tracer loaded successfully');
console.log('Tracer methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tracer)));
