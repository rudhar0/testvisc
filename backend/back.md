# Semantic Tracer Architecture

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                             │
│                    { code, language, options }                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INSTRUMENTATION TRACER                         │
│              (instrumentation-tracer.service.js)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌─────────────────┐  ┌──────────────┐
│    CODE       │  │     TRACER      │  │    LOOP      │
│ INSTRUMENTER  │  │   (tracer.cpp)  │  │   ANALYZER   │
│               │  │                 │  │              │
│ • Add trace   │  │ • Track vars    │  │ • Detect     │
│   calls       │  │ • Track arrays  │  │   loops      │
│ • Preserve    │  │ • Track heap    │  │ • Estimate   │
│   semantics   │  │ • Track funcs   │  │   iterations │
└───────┬───────┘  └────────┬────────┘  └──────┬───────┘
        │                   │                   │
        │                   ▼                   │
        │          ┌─────────────────┐          │
        │          │   GCC COMPILE   │          │
        │          │   + LINK        │          │
        │          └────────┬────────┘          │
        │                   │                   │
        │                   ▼                   │
        │          ┌─────────────────┐          │
        │          │    EXECUTE      │          │
        │          │  (with tracing) │          │
        │          └────────┬────────┘          │
        │                   │                   │
        │                   ▼                   │
        │          ┌─────────────────┐          │
        │          │   RAW EVENTS    │          │
        │          │   (JSON file)   │          │
        │          │                 │          │
        │          │ • func_enter    │          │
        │          │ • func_exit     │          │
        │          │ • assign        │          │
        │          │ • array_create  │          │
        │          │ • heap_alloc    │          │
        │          └────────┬────────┘          │
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SEMANTIC ANALYZER                             │
│               (semantic-analyzer.service.js)                     │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Context    │  │     Loop     │  │   Function   │          │
│  │   Tracking   │  │   Tracking   │  │   Tracking   │          │
│  │              │  │              │  │              │          │
│  │ • Function   │  │ • Detect     │  │ • Call stack │          │
│  │ • Scope      │  │   iterations │  │ • Call depth │          │
│  │ • Symbol     │  │ • Summarize  │  │ • Recursion  │          │
│  │   table      │  │ • Control    │  │ • Params     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Input:  Raw events + Source code + Function list               │
│  Output: Semantic events + Metadata                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SEMANTIC EVENTS                              │
│                                                                  │
│  • program_start                                                 │
│  • loop_start → loop_iteration → loop_summary → loop_end        │
│  • function_call → function_enter → ... → function_exit         │
│  • var_declare → var_assign / var_update                        │
│  • array_create → array_index_assign (expanded init)            │
│  • pointer_alias (with decay detection)                         │
│  • heap_alloc → heap_free                                       │
│  • output                                                        │
│  • program_end                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   VISUALIZATION ENGINE                    │  │
│  │                                                            │  │
│  │  Loop Handler:                                            │  │
│  │  • Skip mode  (show summary only)                         │  │
│  │  • Toggle ON  (update values, single render)              │  │
│  │  • Toggle OFF (create elements per iteration)             │  │
│  │                                                            │  │
│  │  Function Handler:                                         │  │
│  │  • Arrow-based layout (keep main panel clean)             │  │
│  │  • Parameter flow visualization                            │  │
│  │  • Recursion depth rendering                               │  │
│  │                                                            │  │
│  │  Memory Visualizer:                                        │  │
│  │  • Stack: local vars, arrays                              │  │
│  │  • Heap: malloc/new allocations                            │  │
│  │  • Pointers: arrows with decay indicators                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Example

### Input Code
```cpp
int fun(int x) {
    if (x == 0) return 1;
    return x * fun(x - 1);
}

int main() {
    int *p = malloc(sizeof(int));
    *p = fun(4);
    free(p);
}
```

### Flow Through System

#### Step 1: Code Instrumenter
```cpp
// BEFORE
int fun(int x) {
    if (x == 0) return 1;
    return x * fun(x - 1);
}

// AFTER (instrumented)
int fun(int x) {
    __trace_declare(x, int, 2);
    if (x == 0) return 1;
    return x * fun(x - 1);
}
```

#### Step 2: Compilation & Execution
```
→ Compile with -g -finstrument-functions
→ Execute with TRACE_OUTPUT=trace.json
→ Capture stdout/stderr
```

#### Step 3: Raw Events (from tracer.cpp)
```json
[
  { "id": 0, "type": "func_enter", "func": "main", "addr": "0x...", "depth": 0 },
  { "id": 1, "type": "heap_alloc", "size": 4, "addr": "0xABC", "isHeap": true },
  { "id": 2, "type": "func_enter", "func": "fun", "addr": "0x...", "depth": 1 },
  { "id": 3, "type": "declare", "name": "x", "varType": "int", "line": 2 },
  { "id": 4, "type": "assign", "name": "x", "value": 4, "line": 2 },
  { "id": 5, "type": "func_enter", "func": "fun", "addr": "0x...", "depth": 2 },
  // ... recursion continues ...
  { "id": 20, "type": "func_exit", "func": "fun", "depth": 1, "returnValue": 24 },
  { "id": 21, "type": "assign", "name": "*p", "value": 24, "line": 11 },
  { "id": 22, "type": "heap_free", "addr": "0xABC" },
  { "id": 23, "type": "func_exit", "func": "main", "depth": 0 }
]
```

#### Step 4: Semantic Analyzer Transforms

**Context Tracking:**
- Maintains call stack: `[main]`, then `[main, fun#1]`, then `[main, fun#1, fun#2]`
- Tracks scopes: block → function → function
- Separates symbols from execution context

**Function Call Transformation:**
```javascript
// Input (raw)
{ type: "func_enter", func: "fun", depth: 1 }

// Output (semantic)
{
  eventType: "function_call",
  function: "fun",        // Context
  callId: "fun#1",        // Unique ID
  callDepth: 1,
  parentCallId: null,
  scope: "function"
}
```

**Heap Event Transformation:**
```javascript
// Input (raw)
{ type: "heap_alloc", size: 4, addr: "0xABC", isHeap: true }

// Output (semantic)
{
  eventType: "heap_alloc",
  function: "main",       // Context
  scope: "block",
  size: 4,
  address: "0xABC",
  allocator: "malloc"
}
```

#### Step 5: Final Semantic Events
```json
{
  "steps": [
    {
      "stepIndex": 0,
      "eventType": "program_start",
      "function": "main",
      "scope": "block"
    },
    {
      "stepIndex": 1,
      "eventType": "heap_alloc",
      "function": "main",
      "scope": "block",
      "size": 4,
      "address": "0xABC"
    },
    {
      "stepIndex": 2,
      "eventType": "function_call",
      "function": "fun",
      "callId": "fun#1",
      "callDepth": 1,
      "parentCallId": null
    },
    {
      "stepIndex": 3,
      "eventType": "function_enter",
      "function": "fun",
      "callId": "fun#1"
    },
    {
      "stepIndex": 4,
      "eventType": "var_declare",
      "function": "fun",
      "symbol": "x",
      "varType": "int",
      "value": null
    },
    {
      "stepIndex": 5,
      "eventType": "var_assign",
      "function": "fun",
      "symbol": "x",
      "value": 4
    },
    {
      "stepIndex": 6,
      "eventType": "function_call",
      "function": "fun",
      "callId": "fun#2",
      "callDepth": 2,
      "parentCallId": "fun#1"
    }
    // ... etc
  ],
  "functions": [
    { "name": "main", "line": 10 },
    { "name": "fun", "line": 1 }
  ],
  "metadata": {
    "hasRecursionSupport": true,
    "hasHeapTracking": true
  }
}
```

#### Step 6: Frontend Consumes

```javascript
// Frontend receives events and renders

steps.forEach(step => {
  switch (step.eventType) {
    case 'function_call':
      // Create arrow from caller to new function panel
      const arrow = createArrow(step.parentCallId, step.callId);
      const panel = createFunctionPanel(step.callId, step.callDepth);
      canvas.add(arrow, panel);
      break;
      
    case 'heap_alloc':
      // Add to heap region (not stack)
      const heapBlock = createHeapBlock(step.address, step.size);
      heapRegion.add(heapBlock);
      break;
      
    case 'var_assign':
      // Update variable in correct context
      const context = findContext(step.function, step.callId);
      context.updateVariable(step.symbol, step.value);
      break;
  }
});
```

---

## 📊 Component Responsibilities

### Code Instrumenter
**Input:** Source code  
**Output:** Instrumented source code  
**Responsibilities:**
- Add trace function calls
- Preserve original semantics
- Detect array initializations
- Extract loop headers

### Tracer (C++)
**Input:** Compiled code  
**Output:** Raw event JSON  
**Responsibilities:**
- Track all memory operations
- Track function calls (via GCC hooks)
- Track variable changes
- Emit minimal, raw events

### Loop Analyzer
**Input:** Source code  
**Output:** Loop metadata  
**Responsibilities:**
- Detect loop types
- Estimate iterations
- Extract loop variables
- Detect break/continue

### Semantic Analyzer ⭐ (NEW - Key Innovation)
**Input:** Raw events + Source + Functions  
**Output:** Semantic events + Metadata  
**Responsibilities:**
- Transform raw → semantic events
- Track execution context
- Maintain call stack
- Detect loop boundaries
- Expand array initialization
- Separate symbols from functions
- Generate unique IDs (callId, loopId)

### Instrumentation Tracer (Orchestrator)
**Input:** User code  
**Output:** Complete trace  
**Responsibilities:**
- Coordinate all components
- Compile and execute
- Parse raw events
- Invoke semantic analyzer
- Format final response

---

## 🎯 Key Design Principles

1. **Separation of Concerns**
   - C++ tracer: raw memory/execution events
   - JavaScript analyzer: semantic understanding
   - Frontend: visualization decisions

2. **Single Responsibility**
   - Each component has ONE job
   - No component does another's work

3. **Pipeline Architecture**
   - Unidirectional data flow
   - Each stage transforms data
   - No circular dependencies

4. **Deterministic Output**
   - Same input → same events
   - Events are replayable
   - No hidden state

5. **Frontend-Friendly**
   - Backend provides truth
   - Frontend decides presentation
   - Clean API contract

---

## 🔍 Critical Innovations

### Innovation #1: Symbol/Context Separation
```javascript
// OLD (broken)
{ eventType: "assign", function: "i", name: "i" }

// NEW (correct)
{ 
  eventType: "var_assign",
  function: "main",  // Execution context
  symbol: "i",       // Variable being assigned
  scope: "loop"      // Semantic scope
}
```

### Innovation #2: Loop Abstraction
```javascript
// Backend provides summary + iteration template
{
  eventType: "loop_summary",
  iterations: 1000,
  bodyEvents: [/* one iteration */]
}

// Frontend chooses rendering mode
// No need for 1000 individual events
```

### Innovation #3: Recursion Tracking
```javascript
// Each call gets unique ID
{
  eventType: "function_call",
  callId: "fact#4",
  parentCallId: "fact#3",
  callDepth: 4
}

// Frontend can render call tree
```

### Innovation #4: Heap/Stack Separation
```javascript
// Stack array (never heap event)
{ eventType: "array_create", region: "stack" }

// Heap allocation (explicit)
{ eventType: "heap_alloc", region: "heap" }

// Pointer can point to either
{ 
  eventType: "pointer_alias",
  pointsTo: { region: "stack", target: "arr" }
}
```

---

## 📈 Performance Characteristics

| Component | Time Complexity | Notes |
|-----------|----------------|-------|
| Code Instrumenter | O(n) | n = lines of code |
| Compilation | O(n) | GCC overhead |
| Execution | O(m) | m = program runtime |
| Event Capture | O(e) | e = events generated |
| Semantic Analysis | O(e) | Single pass over events |
| Loop Analysis | O(n) | Regex-based parsing |
| **Total** | **O(n + e)** | Linear scalability |

**Typical numbers:**
- 100 line program: ~500 raw events → ~150 semantic events
- 1000 line program: ~5000 raw events → ~1500 semantic events

---

## 🛡️ Error Handling

```javascript
try {
  // Compile
  const { executable } = await compile(code);
} catch (error) {
  return {
    success: false,
    error: {
      phase: 'compilation',
      message: error.message,
      stderr: error.stderr
    }
  };
}

try {
  // Execute
  const { stdout, stderr } = await execute(executable);
} catch (error) {
  return {
    success: false,
    error: {
      phase: 'execution',
      message: error.message,
      exitCode: error.code
    }
  };
}

try {
  // Semantic analysis
  const { events } = semanticAnalyzer.analyze(...);
} catch (error) {
  return {
    success: false,
    error: {
      phase: 'analysis',
      message: error.message
    }
  };
}
```

---

## 🎓 Learning Path

For developers new to this system:

1. **Start here:** Read `IMPLEMENTATION_GUIDE.md`
2. **Understand events:** Review event schemas in spec
3. **See it work:** Run `semantic-tracer.test.js`
4. **Trace manually:** Add console.logs to semantic analyzer
5. **Modify:** Try adding new event types
6. **Integrate:** Connect to your frontend

---

**Status:** Production-ready architecture  
**Complexity:** Moderate  
**Maintainability:** High (due to separation of concerns)  
**Scalability:** Linear with code size