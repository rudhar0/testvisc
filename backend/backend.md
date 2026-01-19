# 🔧 Backend API Complete Specification
**C/C++ Visualizer - GCC Instrumentation Backend**  
Version: 1.1  
Last Updated: January 2026

---

## 📡 Server Configuration

### Base URL
```
http://localhost:5000
```

### Transport Protocols
- **HTTP/REST**: `/api/*` routes
- **WebSocket**: Socket.IO on same port

### CORS Configuration
```javascript
{
  origin: [
    'http://localhost:5173',
    'http://localhost:3000', 
    'http://localhost:5174'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}
```

---

## 🌐 REST API Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-19T10:30:00.000Z",
  "uptime": 12345.67
}
```

### Compiler Status
```http
GET /api/compiler/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "compiler": "clang",
    "available": true,
    "ready": true,
    "version": "system-installed",
    "message": "Clang + LibTooling ready for use"
  }
}
```

### Compiler Info
```http
GET /api/compiler/info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "compiler": "Clang + LibTooling",
    "standard": "Industry standard (VSCode, CLion, clangd)",
    "features": [
      "Full semantic analysis (not just syntax)",
      "Pointer analysis & dereferencing chains",
      "Template instantiation tracking",
      "Class inheritance hierarchies",
      "Member access & ownership tracking",
      "Control flow graph generation",
      "Call graph with virtual function resolution",
      "C++20/23 feature support"
    ],
    "available": true
  }
}
```

### Syntax Validation
```http
POST /api/analyze/syntax
Content-Type: application/json
```

**Request:**
```json
{
  "code": "int main() { return 0; }",
  "language": "cpp"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "language": "cpp",
    "analyzer": "clang+libtooling"
  }
}
```

**Error Response:**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "errors": [
      {
        "line": 5,
        "column": 10,
        "type": "error",
        "message": "expected ';' after expression"
      }
    ],
    "language": "cpp",
    "analyzer": "clang+libtooling"
  }
}
```

### Code Validation
```http
POST /api/validate
Content-Type: application/json
```

**Request:**
```json
{
  "code": "int main() { return 0; }",
  "language": "c"
}
```

**Response:**
```json
{
  "valid": true,
  "errors": []
}
```

### Input Requirements Check
```http
POST /api/requirements
Content-Type: application/json
```

**Request:**
```json
{
  "code": "int main() { int x; scanf(\"%d\", &x); }",
  "language": "c"
}
```

**Response:**
```json
{
  "requirements": [],
  "needsInput": false
}
```

---

## 🔌 Socket.IO Events

### Connection
```javascript
const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling'],
  credentials: true
});
```

---

## 📤 Client → Server Events

### 1. Request Compiler Status
```javascript
socket.emit('compiler:status:request');
```

### 2. Generate Execution Trace (PRIMARY EVENT)
```javascript
socket.emit('code:trace:generate', {
  code: "int main() { int x = 5; cout << x; return 0; }",
  language: "cpp"  // or "c"
});
```

**Parameters:**
- `code` (string, required): Source code to execute
- `language` (string, optional): "c" or "cpp" (default: "cpp")

**Code Size Limits:**
- Max: 50 KB (configurable)
- Sent as single payload (no chunking required)

### 3. Provide Input (When Requested)
```javascript
socket.emit('execution:provide_input', {
  value: "42"  // User input as string
});
```

### 4. Execution Control
```javascript
// Pause execution
socket.emit('execution:pause');

// Resume execution
socket.emit('execution:resume');
```

---

## 📥 Server → Client Events

### 1. Compiler Status
```javascript
socket.on('compiler:status', (data) => {
  console.log(data);
  /*
  {
    compiler: 'gcc-instrumentation',
    available: true,
    ready: true,
    features: [
      'Real memory addresses',
      'Heap tracking (new/delete)',
      'Function call tracing',
      'Full C++17 support',
      'Templates, classes, inheritance'
    ],
    message: 'GCC Instrumentation Tracer ready'
  }
  */
});
```

### 2. Trace Progress Updates
```javascript
socket.on('code:trace:progress', (data) => {
  console.log(data);
  /*
  {
    stage: 'compiling',  // or 'executing', 'analyzing', 'formatting'
    progress: 50,        // 0-100
    message: 'Compiling with GCC instrumentation...'
  }
  */
});
```

**Progress Stages:**
1. `compiling` (20%) - Compiling source code
2. `executing` (50%) - Running instrumented binary
3. `analyzing` (70%) - Analyzing execution trace
4. `formatting` (90%) - Formatting trace data

### 3. Trace Data Chunk
```javascript
socket.on('code:trace:chunk', (data) => {
  console.log(data);
  /*
  {
    chunkId: 0,
    totalChunks: 1,
    steps: [...],           // Array of execution steps (see below)
    totalSteps: 150,
    globals: [...],         // Global variables
    functions: [...],       // Function list
    metadata: {
      debugger: 'gcc-instrumentation',
      version: '1.1',
      hasRealMemory: true,
      hasHeapTracking: true,
      hasOutputTracking: true,
      capturedEvents: 500,
      filteredEvents: 350,
      programOutput: "5\n",
      timestamp: 1737282000000,
      socketId: "abc123"
    }
  }
  */
});
```

### 4. Trace Complete
```javascript
socket.on('code:trace:complete', (data) => {
  console.log(data);
  /*
  {
    totalChunks: 1,
    totalSteps: 150,
    success: true,
    message: 'Trace generation complete'
  }
  */
});
```

### 5. Trace Error
```javascript
socket.on('code:trace:error', (error) => {
  console.error(error);
  /*
  {
    message: 'Compilation failed: expected ';' before '}' token',
    details: '...'  // Only in development mode
  }
  */
});
```

### 6. Input Required
```javascript
socket.on('execution:input_required', (data) => {
  console.log(data);
  /*
  {
    line: 5,
    prompt: 'Waiting for scanf on line 5',
    type: 'scanf',  // or 'cin'
    varName: 'x'
  }
  */
});
```

### 7. Execution State Changes
```javascript
socket.on('execution:paused', () => {
  console.log('Execution paused');
});

socket.on('execution:resumed', () => {
  console.log('Execution resumed');
});
```

---

## 📊 Data Structures

### Execution Step Object
```typescript
interface ExecutionStep {
  stepIndex: number;           // Sequential step number
  eventType: string;           // See Event Types below
  line: number;                // Source code line number
  function: string;            // Function name
  file: string;                // Source file name (basename)
  timestamp: number | null;    // Microsecond timestamp
  explanation: string;         // Human-readable description
  
  // Variable-related (when eventType === 'var')
  name?: string | null;        // Variable name
  value?: any | null;          // Variable value
  varType?: string | null;     // Variable type (int, double, etc.)
  
  // Heap-related (when eventType === 'heap_alloc' or 'heap_free')
  size?: number | null;        // Allocation size in bytes
  addr?: string | null;        // Memory address
  
  // Output tracking (NEW in v1.1)
  stdout?: string | null;      // Captured output from this step
  
  // Internal events (filtered but preserved)
  internalEvents?: Array<{
    type: string;
    function: string;
    addr: string;
    timestamp: number;
    name?: string;
    value?: any;
  }>;
  
  // Memory state (optional, may be added by frontend)
  locals?: object;
  globals?: object;
}
```

### Event Types
```typescript
type EventType = 
  | 'program_start'      // ✅ NEW: Explicit program start
  | 'program_end'        // ✅ NEW: Explicit program end
  | 'func_enter'         // Function entry
  | 'func_exit'          // Function exit
  | 'var'                // Variable assignment/change
  | 'heap_alloc'         // Memory allocation (new/malloc)
  | 'heap_free'          // Memory deallocation (delete/free)
```

### Global Variable Object
```typescript
interface GlobalVariable {
  name: string;
  value: any;
  type: string;          // 'number', 'string', 'object', etc.
  scope: 'global';
  alive: boolean;
}
```

### Function Object
```typescript
interface FunctionInfo {
  name: string;
  line: number;          // Line where function is defined
  returnType: string;    // Usually 'auto' (not always detectable)
}
```

---

## 🎯 Key Features & Behavior

### ✅ Step Filtering (NEW in v1.1)

**Problem Solved:**
- Single line `cout << x << endl;` used to create 10+ steps
- Now creates **1 visible step** with internal events preserved

**How It Works:**
1. Events from same source line are **grouped**
2. Only **first event** creates visible step
3. Additional events stored in `step.internalEvents[]`
4. System library code (STL, libc) automatically filtered

**What Gets Filtered:**
- STL internals (`/usr/include/c++/`, `bits/`, `stl_`)
- C runtime internals (`_IO_`, `__libc_`)
- Compiler-generated code
- MinGW system headers (Windows)

**What's Always Visible:**
- ✅ Code from user's source file
- ✅ Variable assignments (`TRACE_INT`, `TRACE_DOUBLE`, etc.)
- ✅ Heap allocations/deallocations
- ✅ Function enter/exit (user functions only)
- ✅ Program start/end markers

### ✅ Output Tracking (NEW in v1.1)

**Feature:**
- `stdout` captured during execution
- Attached to the step that produced it
- Each output line mapped to correct source line

**Example:**
```cpp
cout << "Hello";  // Step 5: stdout = "Hello"
cout << x;        // Step 6: stdout = "42"
cout << endl;     // Step 7: stdout = "\n"
```

**Access:**
```javascript
step.stdout  // "Hello\n" or null
```

### ✅ Program Lifecycle Steps

**Two guaranteed steps:**
1. **Start Step** (always first):
   ```javascript
   {
     stepIndex: 0,
     eventType: 'program_start',
     line: <main line>,
     function: 'main',
     explanation: '🚀 Program execution started'
   }
   ```

2. **End Step** (always last):
   ```javascript
   {
     stepIndex: <last>,
     eventType: 'program_end',
     line: 0,
     function: 'main',
     explanation: '✅ Program execution completed'
   }
   ```

### Memory Tracking

**Real Memory Addresses:**
- All addresses are **actual runtime addresses** (not simulated)
- Heap allocations tracked with real pointers
- Stack frames show actual memory locations

**Example Step:**
```javascript
{
  eventType: 'heap_alloc',
  size: 40,
  addr: '0x55a1b2c3d4e0',  // Real address
  explanation: 'Allocated 40 bytes at 0x55a1b2c3d4e0'
}
```

---

## 🔄 Complete Flow Example

### Frontend Implementation
```javascript
// 1. Connect
const socket = io('http://localhost:5000');

// 2. Listen for status
socket.on('compiler:status', (status) => {
  if (status.ready) {
    console.log('✅ Backend ready');
  }
});

// 3. Setup listeners BEFORE sending code
socket.on('code:trace:progress', (progress) => {
  updateProgressBar(progress.progress, progress.message);
});

socket.on('code:trace:chunk', (chunk) => {
  // This is the main data you need!
  const steps = chunk.steps;
  
  steps.forEach(step => {
    console.log(`Step ${step.stepIndex}: ${step.explanation}`);
    
    if (step.stdout) {
      console.log(`  Output: ${step.stdout}`);
    }
    
    if (step.internalEvents && step.internalEvents.length > 0) {
      console.log(`  (${step.internalEvents.length} internal events)`);
    }
  });
  
  // Store for visualization
  visualizer.loadSteps(steps);
  visualizer.loadGlobals(chunk.globals);
  visualizer.loadFunctions(chunk.functions);
});

socket.on('code:trace:complete', (summary) => {
  console.log(`✅ Got ${summary.totalSteps} steps`);
  hideProgressBar();
  enablePlayback();
});

socket.on('code:trace:error', (error) => {
  console.error('❌ Error:', error.message);
  showError(error.message);
});

// 4. Send code
function executeCode(code) {
  socket.emit('code:trace:generate', {
    code: code,
    language: 'cpp'
  });
}
```

### Input Handling Example
```javascript
// Listen for input requests
socket.on('execution:input_required', (request) => {
  const value = prompt(request.prompt);
  
  socket.emit('execution:provide_input', {
    value: value
  });
});
```

---

## 🐛 Error Handling

### Compilation Errors
```javascript
socket.on('code:trace:error', (error) => {
  if (error.message.includes('Compilation failed')) {
    // Show syntax error to user
    showCompilationError(error.message);
  }
});
```

### Execution Timeout
- Automatic timeout: **10 seconds**
- Error message: "Execution timeout (10 s)"

### Common Errors
```javascript
{
  message: "No code provided"
}

{
  message: "Compilation failed: expected ';' before '}' token"
}

{
  message: "Execution timeout (10 s)"
}

{
  message: "Failed to generate trace"
}
```

---

## 📝 Constants & Limits

### From `backend/src/constants/limits.js`
```javascript
{
  MAX_CODE_SIZE: 1000000,           // 1MB
  CHUNK_SIZE: 5000,                 // 5KB per chunk
  MAX_EXECUTION_STEPS: 10000,       // Maximum steps
  TRACE_CHUNK_SIZE: 100,            // Steps per chunk
  MAX_LOOP_ITERATIONS_SHOWN: 10,    
  MAX_STACK_DEPTH: 100,
  MAX_HEAP_ALLOCATIONS: 1000,
  MAX_ARRAY_SIZE_SHOWN: 100,
  EXECUTION_TIMEOUT: 30000,         // 30 seconds
  ANALYSIS_TIMEOUT: 60000,          // 60 seconds
  MAX_REQUESTS_PER_MINUTE: 30,
  MAX_ANALYSIS_PER_HOUR: 100
}
```

### From `backend/src/constants/events.js`
```javascript
const SOCKET_EVENTS = {
  // Client → Server
  COMPILER_STATUS_REQUEST: 'compiler:status:request',
  CODE_ANALYZE_SYNTAX: 'code:analyze:syntax',
  CODE_ANALYZE_CHUNK: 'code:analyze:chunk',
  CODE_TRACE_GENERATE: 'code:trace:generate',
  EXECUTION_INPUT_PROVIDE: 'execution:provide_input',
  EXECUTION_PAUSE: 'execution:pause',
  EXECUTION_RESUME: 'execution:resume',
  
  // Server → Client
  COMPILER_STATUS: 'compiler:status',
  CODE_SYNTAX_RESULT: 'code:syntax:result',
  CODE_SYNTAX_ERROR: 'code:syntax:error',
  CODE_TRACE_PROGRESS: 'code:trace:progress',
  CODE_TRACE_CHUNK: 'code:trace:chunk',
  CODE_TRACE_COMPLETE: 'code:trace:complete',
  CODE_TRACE_ERROR: 'code:trace:error',
  EXECUTION_INPUT_RECEIVED: 'execution:input:received',
  EXECUTION_PAUSED: 'execution:paused',
  EXECUTION_RESUMED: 'execution:resumed'
}
```

---

## 🔧 Technical Implementation Details

### GCC Instrumentation
- Uses `-finstrument-functions` flag
- Captures function entry/exit at binary level
- Provides **real memory addresses** (not simulated)

### Variable Tracing
- Uses custom `TRACE_INT()`, `TRACE_DOUBLE()`, etc. macros
- Automatically injected by code instrumenter
- Includes source file and line number

### Compilation Process
```
User Code 
  → Code Instrumenter (adds TRACE_* calls)
  → Instrumented Source
  → GCC with -finstrument-functions
  → Linked with tracer.cpp
  → Instrumented Binary
  → Execute
  → trace.json
  → Parse & Filter
  → Clean Steps
```

### Step Generation Pipeline
```
Raw Events (500+)
  → Filter by source file origin
  → Group by (file:line)
  → Attach output
  → Merge internal events
  → Generate explanations
  → Clean Steps (50-150)
```

---

## 🎨 Frontend Integration Guide

### Minimal Required Code
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');
const steps = [];

socket.on('code:trace:chunk', (chunk) => {
  steps.push(...chunk.steps);
});

socket.on('code:trace:complete', () => {
  visualize(steps);
});

function runCode(code) {
  socket.emit('code:trace:generate', { code, language: 'cpp' });
}
```

### Recommended State Management
```javascript
const state = {
  connected: false,
  compiling: false,
  progress: 0,
  steps: [],
  currentStep: 0,
  globals: [],
  functions: [],
  error: null
};
```

### Step Playback
```javascript
function playStep(index) {
  const step = steps[index];
  
  // Highlight source line
  highlightLine(step.line);
  
  // Show explanation
  showExplanation(step.explanation);
  
  // Show output if any
  if (step.stdout) {
    appendOutput(step.stdout);
  }
  
  // Update memory view
  updateMemoryView(step);
}
```

---

## 🚀 Quick Start Checklist

- [ ] Connect to `http://localhost:5000`
- [ ] Listen to `compiler:status` event
- [ ] Setup listeners for progress, chunk, complete, error
- [ ] Emit `code:trace:generate` with user code
- [ ] Collect steps from `code:trace:chunk`
- [ ] Visualize when `code:trace:complete` received
- [ ] Handle errors from `code:trace:error`

---

## 📞 Support & Debugging

### Enable Verbose Logging
Backend logs everything to console:
```bash
npm run dev  # See all logs in terminal
```

### Common Issues

**"Socket not connecting"**
- Check CORS origins match your frontend port
- Ensure backend is running on port 5000

**"No steps generated"**
- Check console for compilation errors
- Verify code has executable statements
- Check if code compiles with `g++` manually

**"Too many steps"**
- This is now fixed in v1.1 with step filtering
- Steps should be 1 per source line

**"Missing output"**
- Output tracking added in v1.1
- Check `step.stdout` field

---

## 🔄 Version History

### v1.1 (Current)
- ✅ Step filtering by source file origin
- ✅ Output tracking (stdout attached to steps)
- ✅ Explicit program_start and program_end steps
- ✅ Internal events preserved in internalEvents array
- ✅ Smart grouping by source location

### v1.0
- Basic GCC instrumentation
- Function enter/exit tracking
- Variable tracing
- Heap tracking
- Real memory addresses

---

**END OF SPECIFICATION**

Use this document as the **single source of truth** for backend integration.  
No need to reference backend code - everything you need is here! 🎯