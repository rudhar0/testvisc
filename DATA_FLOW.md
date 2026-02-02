# 🔄 Code Flow & Data Flow Documentation

A comprehensive guide to understanding how data flows through the **C/C++ Program Execution Visualizer**.

---

## 📊 High-Level Architecture

```mermaid
flowchart TB
    subgraph Frontend["🎨 Frontend (React + Vite)"]
        UI[User Interface]
        Editor[Monaco Editor]
        Canvas[Konva Canvas]
        Store[Zustand Store]
    end
    
    subgraph Backend["🖥️ Backend (Express + Node.js)"]
        API[REST API]
        Socket[Socket.IO Server]
        Compiler[Compiler Service]
        Instrumenter[Code Instrumenter]
        Executor[Execution Engine]
    end
    
    subgraph External["🔧 External Tools"]
        Clang[Clang/GCC]
        Docker[Docker Container]
        Redis[Redis Cache]
    end
    
    UI --> Editor
    Editor --> Store
    Store --> Canvas
    
    Editor -->|HTTP: Submit Code| API
    API --> Compiler
    Compiler --> Instrumenter
    Instrumenter --> Clang
    Clang --> Executor
    Executor --> Docker
    Docker -->|Trace Events| Socket
    Socket -->|WebSocket| Store
    
    Compiler -.-> Redis
    Redis -.-> Compiler
```

---

## 🚀 Complete Code Execution Flow

### Step-by-Step Process

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant Editor as Monaco Editor
    participant Store as Zustand Store
    participant API as REST API
    participant Compiler as Compiler Service
    participant Instrumenter as Code Instrumenter
    participant GCC as Clang/GCC
    participant Docker as Docker Container
    participant Socket as Socket.IO
    participant Canvas as Konva Canvas

    User->>Editor: Write C/C++ Code
    Editor->>Store: Update editorSlice.code
    User->>Editor: Click "Run"
    
    Editor->>API: POST /api/compile
    API->>Compiler: compileCode(source)
    Compiler->>Instrumenter: instrumentCode(source)
    
    Note over Instrumenter: Injects trace calls at:<br/>- Function entry/exit<br/>- Variable assignments<br/>- Loop iterations<br/>- Conditionals
    
    Instrumenter->>GCC: Compile instrumented code
    GCC-->>Compiler: Executable binary
    
    Compiler->>Docker: Execute in sandbox
    Docker->>Socket: Stream trace events
    
    loop For each execution step
        Socket->>Store: executionSlice.addEvent()
        Store->>Canvas: Re-render visualization
        Canvas->>User: Show animation
    end
    
    Docker-->>API: Execution complete
    API-->>Editor: Success response
```

---

## 📁 Frontend Data Flow

### 1. User Input Flow

```mermaid
flowchart LR
    subgraph Input["User Input"]
        Keyboard[⌨️ Keyboard Input]
        Mouse[🖱️ Mouse Click]
        File[📂 File Upload]
    end
    
    subgraph Components["React Components"]
        CodeEditor[CodeEditor.tsx]
        PlaybackControls[PlaybackControls.tsx]
        FileLoader[FileLoader.tsx]
    end
    
    subgraph Store["Zustand Store"]
        EditorSlice[editorSlice]
        ExecutionSlice[executionSlice]
        UISlice[uiSlice]
    end
    
    Keyboard --> CodeEditor
    Mouse --> PlaybackControls
    File --> FileLoader
    
    CodeEditor -->|setCode| EditorSlice
    PlaybackControls -->|play/pause/step| ExecutionSlice
    FileLoader -->|loadFile| EditorSlice
```

### 2. State Management Flow

```mermaid
flowchart TB
    subgraph Slices["Zustand Slices"]
        direction TB
        editor[editorSlice<br/>- code<br/>- language<br/>- errors]
        execution[executionSlice<br/>- events[]<br/>- currentStep<br/>- isPlaying]
        canvas[canvasSlice<br/>- zoom<br/>- pan<br/>- selection]
        ui[uiSlice<br/>- theme<br/>- panels<br/>- modals]
        gcc[gccSlice<br/>- status<br/>- errors<br/>- warnings]
        input[inputSlice<br/>- pendingInput<br/>- inputHistory]
        loop[loopSlice<br/>- collapsed[]<br/>- activeLoop]
    end
    
    subgraph Actions["User Actions"]
        write[Write Code]
        run[Run Program]
        step[Step Through]
        zoom[Zoom/Pan]
    end
    
    write --> editor
    run --> execution
    run --> gcc
    step --> execution
    zoom --> canvas
    
    execution -->|getCurrentEvent| canvas
```

### 3. Component Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              App.tsx                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                        Allotment (Split Panels)                      ││
│  │  ┌─────────────────────┐     ┌─────────────────────────────────────┐││
│  │  │   Left Panel        │     │         Right Panel                  │││
│  │  │  ┌───────────────┐  │     │  ┌───────────────────────────────┐  │││
│  │  │  │ CodeEditor    │  │     │  │    VisualizationCanvas        │  │││
│  │  │  │ (Monaco)      │  │     │  │    (Konva + react-konva)      │  │││
│  │  │  │               │  │     │  │                               │  │││
│  │  │  │ Data In:      │──┼─────┼──│ Data In:                      │  │││
│  │  │  │ - code        │  │     │  │ - events[]                    │  │││
│  │  │  │ - language    │  │     │  │ - currentStep                 │  │││
│  │  │  │ - currentLine │  │     │  │ - variables                   │  │││
│  │  │  │               │  │     │  │ - functions                   │  │││
│  │  │  │ Data Out:     │  │     │  │ - memory                      │  │││
│  │  │  │ - onChange    │  │     │  │ - pointers                    │  │││
│  │  │  │ - onRun       │  │     │  │                               │  │││
│  │  │  └───────────────┘  │     │  │ Renders:                      │  │││
│  │  │  ┌───────────────┐  │     │  │ - VariableBox                 │  │││
│  │  │  │PlaybackControl│  │     │  │ - FunctionFrame               │  │││
│  │  │  │               │  │     │  │ - PointerArrow                │  │││
│  │  │  │ Data In:      │  │     │  │ - MemoryBlock                 │  │││
│  │  │  │ - isPlaying   │  │     │  │ - ExplanationBox              │  │││
│  │  │  │ - currentStep │  │     │  │ - OutputElement               │  │││
│  │  │  │ - totalSteps  │  │     │  └───────────────────────────────┘  │││
│  │  │  │               │  │     │                                      ││
│  │  │  │ Data Out:     │  │     │                                      ││
│  │  │  │ - onPlay      │  │     │                                      ││
│  │  │  │ - onPause     │  │     │                                      ││
│  │  │  │ - onStep      │  │     │                                      ││
│  │  │  │ - onSeek      │  │     │                                      ││
│  │  │  └───────────────┘  │     │                                      ││
│  │  └─────────────────────┘     └──────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Backend Data Flow

### 1. Request Processing Flow

```mermaid
flowchart TB
    subgraph Request["Incoming Request"]
        HTTP[HTTP Request]
        WS[WebSocket Message]
    end
    
    subgraph Middleware["Express Middleware"]
        CORS[cors]
        Compression[compression]
        Morgan[morgan]
        Validation[validators]
    end
    
    subgraph Routes["Route Handlers"]
        CodeRoutes[code.routes.js]
        CompilerRoutes[compiler.routes.js]
        AnalyzeRoutes[analyze.routes.js]
    end
    
    subgraph Services["Business Logic"]
        CompilerSvc[compiler.service.js]
        InstrumenterSvc[code-instrumenter.service.js]
        GCCSvc[gcc.service.js]
        SessionSvc[session-manager.service.js]
    end
    
    HTTP --> CORS --> Compression --> Morgan --> Validation
    Validation --> Routes
    Routes --> Services
    
    WS --> SocketHandlers[Socket Handlers]
    SocketHandlers --> Services
```

### 2. Compilation Pipeline

```mermaid
flowchart LR
    subgraph Input["Input"]
        Source[Source Code<br/>main.c]
    end
    
    subgraph Instrumentation["Code Instrumentation"]
        Parse[Parse AST]
        Inject[Inject Trace Calls]
        Generate[Generate Instrumented Code]
    end
    
    subgraph Compilation["Compilation"]
        Preprocess[Preprocess]
        Compile[Compile to Object]
        Link[Link with Tracer]
    end
    
    subgraph Output["Output"]
        Executable[Instrumented<br/>Executable]
    end
    
    Source --> Parse --> Inject --> Generate
    Generate --> Preprocess --> Compile --> Link --> Executable
```

### 3. Trace Event Types

```mermaid
flowchart TB
    subgraph Events["Trace Event Types"]
        direction TB
        
        subgraph Function["Function Events"]
            FuncEnter[func_enter]
            FuncExit[func_exit]
        end
        
        subgraph Variable["Variable Events"]
            VarDecl[var_decl]
            VarAssign[var_assign]
        end
        
        subgraph Control["Control Flow Events"]
            LoopStart[loop_start]
            LoopCond[loop_condition]
            LoopEnd[loop_end]
            CondBranch[condition_branch]
        end
        
        subgraph Memory["Memory Events"]
            PointerDeref[pointer_deref_read]
            PointerWrite[pointer_deref_write]
            ArrayAccess[array_access]
        end
        
        subgraph IO["I/O Events"]
            Output[output]
            Input[input_request]
        end
    end
```

---

## 🔌 WebSocket Communication

### Real-time Event Streaming

```mermaid
sequenceDiagram
    participant Frontend as useSocket.ts
    participant Socket as Socket.IO Server
    participant Handler as trace.handler.js
    participant Executor as Execution Engine
    
    Frontend->>Socket: connect()
    Socket-->>Frontend: connected
    
    Frontend->>Socket: emit("start_execution", {sessionId})
    Socket->>Handler: startExecution()
    Handler->>Executor: run()
    
    loop Execution Loop
        Executor->>Handler: traceEvent
        Handler->>Socket: emit("trace_event", event)
        Socket->>Frontend: receive event
        Frontend->>Frontend: store.addEvent(event)
    end
    
    Executor->>Handler: execution_complete
    Handler->>Socket: emit("execution_complete")
    Socket->>Frontend: execution_complete
```

### Socket Events Reference

| Direction | Event Name | Payload | Description |
|-----------|------------|---------|-------------|
| → Backend | `start_execution` | `{sessionId, code}` | Start code execution |
| → Backend | `step_forward` | `{sessionId}` | Step to next event |
| → Backend | `provide_input` | `{sessionId, input}` | Provide stdin input |
| → Backend | `stop_execution` | `{sessionId}` | Stop execution |
| ← Frontend | `trace_event` | `{type, data, step}` | Execution trace event |
| ← Frontend | `input_request` | `{prompt}` | Request user input |
| ← Frontend | `execution_complete` | `{exitCode}` | Execution finished |
| ← Frontend | `execution_error` | `{error}` | Execution failed |

---

## 🗄️ Data Structures

### Trace Event Structure

```typescript
interface TraceEvent {
  step: number;           // Sequential step number
  type: EventType;        // Event type (see above)
  line: number;           // Source code line
  column?: number;        // Source code column
  timestamp: number;      // Execution timestamp
  
  // Type-specific data
  data: {
    // For func_enter/func_exit
    funcName?: string;
    params?: Parameter[];
    returnValue?: any;
    
    // For var_decl/var_assign
    varName?: string;
    varType?: string;
    value?: any;
    oldValue?: any;
    
    // For loop events
    loopId?: number;
    iteration?: number;
    conditionResult?: boolean;
    
    // For pointer events
    address?: string;
    targetName?: string;
    
    // For output
    text?: string;
  };
  
  explanation?: string;   // Human-readable explanation
}
```

### Frontend State Structure

```typescript
// Zustand Store Shape
interface AppState {
  editor: {
    code: string;
    language: 'c' | 'cpp';
    errors: CompileError[];
    currentLine: number;
  };
  
  execution: {
    events: TraceEvent[];
    currentStep: number;
    isPlaying: boolean;
    playbackSpeed: number;
    status: 'idle' | 'compiling' | 'running' | 'paused' | 'complete';
  };
  
  canvas: {
    zoom: number;
    panX: number;
    panY: number;
    selectedElement: string | null;
  };
  
  ui: {
    theme: 'light' | 'dark';
    leftPanelWidth: number;
    showExplanations: boolean;
  };
}
```

---

## 🔄 Complete Request-Response Cycle

### Example: Running a Simple Program

```
User writes code → Clicks Run → Frontend → Backend → Execution → Frontend → Visualization
```

#### Detailed Flow:

```
1. USER INPUT
   ├── User writes: int x = 5;
   └── Monaco Editor updates editorSlice.code

2. SUBMIT CODE
   ├── User clicks "Run"
   ├── useSocket.ts emits "start_execution"
   └── Payload: { code: "int x = 5;", language: "c" }

3. BACKEND PROCESSING
   ├── Socket handler receives event
   ├── compiler.service.js called
   ├── code-instrumenter.service.js transforms code:
   │   
   │   Original:          Instrumented:
   │   ───────────        ─────────────────────────────────
   │   int x = 5;    →    __trace_var_decl("x", "int");
   │                      int x = 5;
   │                      __trace_var_assign("x", x);
   │   
   ├── gcc.service.js compiles instrumented code
   └── Docker container executes binary

4. TRACE STREAMING
   ├── tracer.cpp captures events:
   │   ├── Event 1: { type: "var_decl", varName: "x", varType: "int" }
   │   └── Event 2: { type: "var_assign", varName: "x", value: 5 }
   │
   ├── trace.handler.js streams via Socket.IO
   └── Each event emitted: socket.emit("trace_event", event)

5. FRONTEND PROCESSING
   ├── useSocket.ts receives "trace_event"
   ├── executionSlice.addEvent(event) called
   ├── Immer produces new immutable state
   └── React re-renders affected components

6. VISUALIZATION
   ├── VisualizationCanvas.tsx receives new state
   ├── LayoutEngine.ts calculates positions
   ├── GSAP animates element creation
   ├── Konva renders:
   │   ├── FunctionFrame for main()
   │   ├── VariableBox for x with value 5
   │   └── ExplanationBox with step description
   └── User sees animated visualization

7. PLAYBACK CONTROL
   ├── PlaybackControls shows step 2/2
   ├── TimelineScrubber updates position
   └── StepInfo displays current event details
```

---

## 📋 File Responsibility Map

| Flow Stage | Frontend Files | Backend Files |
|------------|----------------|---------------|
| **User Input** | `CodeEditor.tsx`, `editorSlice.ts` | - |
| **Code Submission** | `useSocket.ts`, `api.service.ts` | `code.routes.js`, `compiler.routes.js` |
| **Instrumentation** | - | `code-instrumenter.service.js`, `instrumentation-tracer.service.js` |
| **Compilation** | - | `gcc.service.js`, `compiler.service.js` |
| **Execution** | - | `worker-pool.service.js`, Docker |
| **Trace Streaming** | `useSocket.ts` | `trace.handler.js`, `chunk-streamer.service.js` |
| **State Update** | `executionSlice.ts`, `useExecutionTrace.ts` | - |
| **Visualization** | `VisualizationCanvas.tsx`, `LayoutEngine.ts` | - |
| **Animation** | `useAnimationController.ts`, GSAP files | - |
| **Playback** | `PlaybackControls.tsx`, `TimelineScrubber.tsx` | - |

---

## 🎬 Animation Data Flow

```mermaid
flowchart LR
    subgraph Trigger["State Change"]
        Event[New Trace Event]
    end
    
    subgraph Controller["Animation Controller"]
        Hook[useAnimationController]
        Engine[AnimationEngine]
    end
    
    subgraph GSAP["GSAP Timeline"]
        Timeline[gsap.timeline]
        Tweens[Individual Tweens]
    end
    
    subgraph Canvas["Konva Canvas"]
        Elements[Canvas Elements]
        Render[Re-render]
    end
    
    Event --> Hook
    Hook --> Engine
    Engine --> Timeline
    Timeline --> Tweens
    Tweens --> Elements
    Elements --> Render
```

---

## 🔐 Security Data Flow

```mermaid
flowchart TB
    subgraph Input["User Input"]
        Code[User Code]
    end
    
    subgraph Validation["Input Validation"]
        Sanitize[Sanitize Code]
        Validate[Validate Syntax]
        Limit[Check Size Limits]
    end
    
    subgraph Isolation["Execution Isolation"]
        Docker[Docker Container]
        Timeout[Execution Timeout]
        Resources[Resource Limits]
    end
    
    subgraph Output["Safe Output"]
        Filter[Filter Trace Data]
        Compress[Compress with Pako]
        Stream[Stream to Client]
    end
    
    Code --> Sanitize --> Validate --> Limit
    Limit --> Docker
    Docker --> Timeout
    Timeout --> Resources
    Resources --> Filter --> Compress --> Stream
```

---

## 📊 Performance Optimization Flow

```
Trace Events → Chunking → Compression → Streaming → Decompression → Rendering
     │             │           │            │            │            │
     │             │           │            │            │            └── Konva batching
     │             │           │            │            └── Pako inflate
     │             │           │            └── Socket.IO binary frames
     │             │           └── Pako deflate
     │             └── chunk.service.js (1000 events/chunk)
     └── tracer.cpp output
```

---

## 🔗 Quick Reference: Key Files

### Frontend Entry Points
- `main.tsx` → App initialization
- `App.tsx` → Root layout
- `useSocket.ts` → WebSocket connection
- `executionSlice.ts` → Core state

### Backend Entry Points
- `server.js` → Express + Socket.IO setup
- `sockets/index.js` → Socket handler registration
- `compiler.routes.js` → Compile endpoint
- `trace.handler.js` → Event streaming

### Data Transformation
- `code-instrumenter.service.js` → Source → Instrumented
- `LayoutEngine.ts` → Events → Visual positions
- `useAnimationController.ts` → State → Animations
