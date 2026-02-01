# 🛠️ Tech Stack

A comprehensive overview of all technologies used in this **C/C++ Program Execution Visualizer** project.

---

## 🖥️ Backend Technologies

### Core Framework

#### Node.js
- **Definition**: An open-source, cross-platform JavaScript runtime environment that executes JavaScript code outside a web browser.
- **Purpose**: Serves as the foundation for our backend, enabling JavaScript execution on the server.
- **Why Used**: Non-blocking I/O model makes it perfect for real-time applications. Single language (JavaScript) across frontend and backend reduces context switching.

#### Express.js `^4.18.2`
- **Definition**: A minimal and flexible Node.js web application framework that provides robust features for web and mobile applications.
- **Purpose**: Handles HTTP requests, routing, and middleware in our API server.
- **Why Used**: Industry standard, lightweight, highly extensible, and has excellent documentation and community support.

#### Socket.IO `^4.7.2`
- **Definition**: A library that enables real-time, bidirectional, and event-based communication between web clients and servers.
- **Purpose**: Enables real-time streaming of execution events from backend to frontend during code visualization.
- **Why Used**: Handles WebSocket connections with automatic fallback to polling, reconnection logic, and room-based broadcasting built-in.

---

### C/C++ Toolchain

#### Clang
- **Definition**: A compiler front end for the C, C++, and Objective-C programming languages, part of the LLVM project.
- **Purpose**: Compiles C/C++ code and provides AST (Abstract Syntax Tree) access for instrumentation.
- **Why Used**: LibTooling integration allows programmatic source code modification. Better error messages and faster compilation than GCC in many cases.

#### LibTooling
- **Definition**: A library within the Clang project that provides infrastructure for building tools that work with C++ code.
- **Purpose**: Instruments source code by inserting trace calls at strategic points (function entry/exit, variable assignments, etc.).
- **Why Used**: Enables compile-time code transformation without runtime overhead. Direct AST manipulation ensures accurate instrumentation.

#### LLDB
- **Definition**: A next-generation, high-performance debugger that is part of the LLVM project.
- **Purpose**: Provides debugging capabilities for stepping through code execution and inspecting program state.
- **Why Used**: Better integration with Clang, scriptable via Python, and provides consistent behavior across platforms.

#### GCC
- **Definition**: GNU Compiler Collection - a compiler system supporting various programming languages including C and C++.
- **Purpose**: Alternative compiler for users who prefer or require GCC over Clang.
- **Why Used**: Wide compatibility and mature optimization capabilities. Standard on many Linux distributions.

---

### Database & Caching

#### Redis `^4.6.13`
- **Definition**: An open-source, in-memory data structure store used as database, cache, message broker, and queue.
- **Purpose**: Caches compilation results, stores session data, and acts as message broker for BullMQ.
- **Why Used**: Extremely fast in-memory operations. Persistence options available. Native support for pub/sub patterns.

#### IORedis `^5.3.2`
- **Definition**: A robust, full-featured Redis client for Node.js with support for Cluster, Sentinel, and Lua scripting.
- **Purpose**: Provides the Node.js interface to communicate with Redis server.
- **Why Used**: Better performance than the default redis client, automatic reconnection, and pipeline support.

#### BullMQ `^5.1.2`
- **Definition**: A Node.js library for handling distributed jobs and messages using Redis.
- **Purpose**: Manages compilation and execution job queues, handling retries and rate limiting.
- **Why Used**: Robust job processing with priorities, delays, rate limiting, and built-in dashboard support.

---

### DevOps & Containerization

#### Docker
- **Definition**: A platform for developing, shipping, and running applications in isolated containers.
- **Purpose**: Provides consistent execution environment for C/C++ compilation with all required dependencies.
- **Why Used**: Ensures reproducibility across development environments. Isolates potentially unsafe user code execution.

#### Dockerode `^4.0.0`
- **Definition**: A Node.js module to interact with Docker's Remote API.
- **Purpose**: Programmatically creates, manages, and destroys Docker containers for code execution.
- **Why Used**: Native JavaScript interface to Docker without spawning shell processes.

#### Docker Compose
- **Definition**: A tool for defining and running multi-container Docker applications.
- **Purpose**: Orchestrates backend, Redis, and execution containers as a single application stack.
- **Why Used**: Simplifies development setup and deployment with a single YAML configuration.

---

### Debugging & Protocol

#### vscode-debugadapter `^1.51.0`
- **Definition**: A npm package that helps implement debug adapters for VS Code following the Debug Adapter Protocol.
- **Purpose**: Enables communication between our debugger and VS Code-compatible interfaces.
- **Why Used**: Standard protocol allows integration with multiple IDEs and editors.

#### vscode-debugprotocol `^1.51.0`
- **Definition**: TypeScript declarations for the VS Code Debug Protocol.
- **Purpose**: Provides type definitions for all Debug Adapter Protocol messages.
- **Why Used**: Type safety when implementing debug adapter functionality.

---

### Logging & Monitoring

#### Winston `^3.11.0`
- **Definition**: A versatile logging library for Node.js with support for multiple transports.
- **Purpose**: Structured logging with different log levels and output formats.
- **Why Used**: Supports multiple outputs (console, file, remote), custom formatting, and log rotation.

#### Pino `^8.17.2`
- **Definition**: A very fast, low-overhead Node.js logger that outputs JSON.
- **Purpose**: High-performance logging for production environments.
- **Why Used**: 5x faster than Winston in benchmarks, ideal for high-throughput scenarios.

#### Morgan `^1.10.0`
- **Definition**: HTTP request logger middleware for Node.js.
- **Purpose**: Logs incoming HTTP requests with method, URL, status, and response time.
- **Why Used**: Simple integration with Express, customizable log formats.

#### prom-client `^15.1.0`
- **Definition**: A Prometheus client for Node.js that supports histograms, summaries, gauges, and counters.
- **Purpose**: Exposes application metrics for monitoring (request latency, queue depth, etc.).
- **Why Used**: Standard way to expose metrics for Prometheus/Grafana monitoring stack.

---

### Utilities

#### Axios `^1.7.2`
- **Definition**: A promise-based HTTP client for the browser and Node.js.
- **Purpose**: Makes HTTP requests to external services.
- **Why Used**: Automatic JSON transformation, request/response interceptors, and better error handling than fetch.

#### UUID `^9.0.1`
- **Definition**: A library for generating RFC-compliant Universally Unique Identifiers.
- **Purpose**: Generates unique IDs for sessions, jobs, and trace events.
- **Why Used**: Cryptographically secure random UUIDs, no collision risk.

#### fs-extra `^11.2.0`
- **Definition**: A drop-in replacement for Node.js fs module with extra methods.
- **Purpose**: Enhanced file system operations like copy, move, and ensureDir.
- **Why Used**: Adds convenient methods missing from native fs (recursive operations, promises).

#### dotenv `^16.4.5`
- **Definition**: A module that loads environment variables from a .env file into process.env.
- **Purpose**: Manages configuration across different environments.
- **Why Used**: Keeps secrets out of code, easy environment switching.

#### cors `^2.8.5`
- **Definition**: A Node.js package for providing Express middleware to enable CORS.
- **Purpose**: Allows frontend to communicate with backend from different origins.
- **Why Used**: Simple configuration, handles preflight requests automatically.

#### compression `^1.7.4`
- **Definition**: Node.js compression middleware for Express.
- **Purpose**: Compresses HTTP responses to reduce bandwidth.
- **Why Used**: Reduces payload sizes by 70-90% for text-based responses.

---

## 🎨 Frontend Technologies

### Core Framework

#### React `^18.3.1`
- **Definition**: A JavaScript library for building user interfaces using a component-based architecture.
- **Purpose**: Renders the entire frontend UI including editor, canvas, and controls.
- **Why Used**: Virtual DOM for efficient updates, huge ecosystem, excellent developer experience with hooks.

#### TypeScript `^5.7.2`
- **Definition**: A strongly typed programming language that builds on JavaScript, adding static type definitions.
- **Purpose**: Provides type safety across the entire frontend codebase.
- **Why Used**: Catches errors at compile time, better IDE support, self-documenting code with types.

#### Vite `^6.0.3`
- **Definition**: A modern frontend build tool that provides fast development server and optimized production builds.
- **Purpose**: Bundles the application and provides hot module replacement during development.
- **Why Used**: 10-100x faster than Webpack due to native ES modules, out-of-box TypeScript support.

---

### State Management

#### Zustand `^5.0.2`
- **Definition**: A small, fast, and scalable state management solution using simplified flux principles.
- **Purpose**: Manages global application state (execution state, UI state, playback state).
- **Why Used**: Minimal boilerplate compared to Redux, excellent TypeScript support, built-in devtools.

#### Immer `^10.1.1`
- **Definition**: A library that lets you work with immutable state in a mutable way.
- **Purpose**: Simplifies state updates by allowing direct mutations on draft states.
- **Why Used**: Zustand integration for complex nested state updates without spread operator chains.

---

### Canvas & Visualization

#### Konva `^9.3.22`
- **Definition**: An HTML5 2D canvas JavaScript framework that enables high-performance animations, transitions, and interactions.
- **Purpose**: Renders the execution visualization canvas with variables, functions, and memory layout.
- **Why Used**: High performance with thousands of shapes, built-in support for drag/drop, events, and animations.

#### react-konva `^18.2.14`
- **Definition**: React bindings for the Konva framework.
- **Purpose**: Allows declarative Konva components in React JSX syntax.
- **Why Used**: React reconciliation for canvas elements, familiar component patterns.

#### ELK.js `^0.9.3`
- **Definition**: A JavaScript port of the Eclipse Layout Kernel, a graph layout engine.
- **Purpose**: Automatically calculates optimal positions for function call graphs and data structures.
- **Why Used**: Sophisticated algorithms for tree/graph layouts, handles complex nested structures.

#### GSAP `^3.12.5`
- **Definition**: GreenSock Animation Platform - a professional-grade JavaScript animation library.
- **Purpose**: Animates transitions between execution steps (variable changes, function calls).
- **Why Used**: Smooth 60fps animations, timeline control, and easing functions for professional feel.

---

### Code Editor

#### Monaco Editor `^0.50.0`
- **Definition**: The code editor that powers VS Code, available as a browser-based component.
- **Purpose**: Provides the source code editing experience with syntax highlighting and error markers.
- **Why Used**: Full VS Code editing experience, syntax highlighting for 70+ languages, IntelliSense support.

#### @monaco-editor/react `^4.6.0`
- **Definition**: Monaco Editor wrapper for React with easy configuration.
- **Purpose**: React component wrapper for Monaco Editor.
- **Why Used**: Simple React integration, handles mounting/unmounting, and theme switching.

#### web-tree-sitter `^0.26.3`
- **Definition**: WebAssembly bindings for tree-sitter, an incremental parsing library.
- **Purpose**: Parses C/C++ code in the browser for syntax-aware features.
- **Why Used**: Fast incremental parsing, accurate AST construction, used for code navigation features.

---

### UI Components

#### Radix UI
- **Definition**: A collection of low-level, unstyled, accessible UI components for React.
- **Purpose**: Provides accessible primitive components (dialogs, dropdowns, sliders, tabs, tooltips).
- **Why Used**: Full accessibility compliance (WAI-ARIA), unstyled for complete customization, keyboard navigation built-in.

| Component | Version | Use Case |
|-----------|---------|----------|
| Dialog | ^1.1.2 | Modal windows and overlays |
| Dropdown Menu | ^2.1.2 | Context menus and dropdowns |
| Slider | ^1.2.1 | Playback speed control |
| Tabs | ^1.1.1 | Panel navigation |
| Tooltip | ^1.1.4 | Hover information |

#### Lucide React `^0.460.0`
- **Definition**: A beautiful, consistent icon library that is a fork of Feather Icons.
- **Purpose**: Provides consistent iconography across the application.
- **Why Used**: Tree-shakeable (only used icons are bundled), consistent design language, customizable size/color.

#### Allotment `^1.20.2`
- **Definition**: A React component for creating resizable split views.
- **Purpose**: Creates the resizable panels between editor and visualization canvas.
- **Why Used**: Smooth resizing, persistent sizes, nested splits supported.

#### react-hot-toast `^2.4.1`
- **Definition**: A lightweight library for showing notifications in React.
- **Purpose**: Displays success/error/loading notifications to users.
- **Why Used**: Minimal footprint, promise-based API, customizable animations.

---

### Styling

#### TailwindCSS `^3.4.15`
- **Definition**: A utility-first CSS framework for rapidly building custom user interfaces.
- **Purpose**: Styles all UI components using utility classes.
- **Why Used**: Rapid development, consistent design tokens, purges unused CSS for tiny bundles.

#### PostCSS `^8.4.49`
- **Definition**: A tool for transforming CSS with JavaScript plugins.
- **Purpose**: Processes Tailwind directives and CSS transformations.
- **Why Used**: Required by Tailwind, enables CSS nesting, and custom plugins.

#### Autoprefixer `^10.4.20`
- **Definition**: A PostCSS plugin that adds vendor prefixes to CSS rules.
- **Purpose**: Ensures CSS works across all browsers without manual prefixing.
- **Why Used**: Automatic browser compatibility, uses Can I Use database for accuracy.

#### clsx `^2.1.1`
- **Definition**: A tiny utility for constructing className strings conditionally.
- **Purpose**: Combines class names based on conditions.
- **Why Used**: Cleaner than template literals for conditional classes, 228 bytes gzipped.

---

### Communication

#### Socket.IO Client `^4.8.1`
- **Definition**: The client-side library for Socket.IO real-time communication.
- **Purpose**: Receives real-time execution events from the backend.
- **Why Used**: Matches backend Socket.IO, automatic reconnection, acknowledgments support.

#### Axios `^1.13.2`
- **Definition**: Promise-based HTTP client for the browser.
- **Purpose**: Makes REST API calls to the backend for compilation and configuration.
- **Why Used**: Consistent API between Node.js and browser, request/response interceptors.

---

### Validation & Utilities

#### Zod `^3.24.1`
- **Definition**: A TypeScript-first schema declaration and validation library.
- **Purpose**: Validates API responses and trace event data structures.
- **Why Used**: TypeScript type inference from schemas, composable validators, excellent error messages.

#### Pako `^2.1.0`
- **Definition**: A high-speed zlib port to JavaScript.
- **Purpose**: Compresses/decompresses trace data for reduced network transfer.
- **Why Used**: Zlib compatibility, streaming support, used for large trace files.

#### browser-fs-access `^0.35.0`
- **Definition**: A library for accessing the file system in the browser.
- **Purpose**: Enables save/load of source files and trace data.
- **Why Used**: Uses modern File System Access API with legacy fallback.

---

## 🧪 Testing & Quality

#### Jest `^30.2.0`
- **Definition**: A JavaScript testing framework with support for snapshot testing and code coverage.
- **Purpose**: Unit and integration testing for both frontend and backend.
- **Why Used**: Zero-config setup, parallel test execution, built-in mocking.

#### ESLint `^9.16.0`
- **Definition**: A static code analysis tool for identifying problematic patterns in JavaScript code.
- **Purpose**: Enforces coding standards and catches potential bugs.
- **Why Used**: Customizable rules, plugin ecosystem, IDE integration.

#### Prettier `^3.4.2`
- **Definition**: An opinionated code formatter that supports many languages.
- **Purpose**: Automatically formats code for consistent style.
- **Why Used**: Eliminates style debates, integrates with ESLint, supports TypeScript and CSS.

#### Husky `^9.1.7`
- **Definition**: A tool for modern native Git hooks.
- **Purpose**: Runs linting and tests before commits and pushes.
- **Why Used**: Prevents broken code from being committed, easy configuration.

#### clang-format `^1.8.0`
- **Definition**: A tool to format C/C++/Objective-C code.
- **Purpose**: Formats C/C++ test files and generated code.
- **Why Used**: Consistent C/C++ code style matching Clang/LLVM standards.

---

## 📦 System Requirements

### Required System Dependencies

```bash
# Ubuntu/Debian
sudo apt-get install clang lldb python3 python3-lldb

# macOS
brew install llvm

# Windows
# Use WSL2 or the provided Docker images
```

### Node.js
- Node.js v18+ recommended

### Docker (Optional)
- Docker and Docker Compose for containerized execution

---

## 📁 Project Structure with Technology Mapping

A detailed breakdown of every directory and file, showing which technologies are used where.

---

### 🖥️ Backend (`backend/`)

```
backend/
├── src/
│   ├── server.js              # 🟢 Express + Socket.IO + Morgan + CORS
│   ├── index.js               # 🟢 Entry point, dotenv
│   │
│   ├── config/                # Configuration files
│   │   ├── index.js           # 🟢 dotenv - Environment config aggregator
│   │   ├── cors.config.js     # 🟢 cors - CORS middleware configuration
│   │   ├── redis.config.js    # 🔴 Redis/IORedis - Redis connection settings
│   │   ├── docker.config.js   # 🐳 Dockerode - Container settings
│   │   ├── socket.config.js   # 🔌 Socket.IO - WebSocket configuration
│   │   ├── dap.config.js      # 🐛 vscode-debugadapter - Debug adapter settings
│   │   └── security.config.js # 🔒 Security middleware config
│   │
│   ├── routes/                # API endpoints
│   │   ├── index.js           # 🟢 Express Router - Route aggregator
│   │   ├── code.routes.js     # 🟢 Express - Code submission endpoints
│   │   ├── compiler.routes.js # 🟢 Express - Compilation endpoints
│   │   ├── analyze.routes.js  # 🟢 Express - Analysis endpoints
│   │   └── health.routes.js   # 🟢 Express - Health check endpoints
│   │
│   ├── services/              # Business logic
│   │   ├── gcc.service.js            # 🔧 GCC - Compilation with GCC
│   │   ├── compiler.service.js       # 🔧 Clang/GCC - Compiler abstraction
│   │   ├── code-instrumenter.service.js    # 🔧 Clang/LibTooling - AST instrumentation
│   │   ├── instrumentation-tracer.service.js # 🔧 Clang - Trace injection
│   │   ├── loop-analyzer.service.js  # 🔧 AST analysis for loops
│   │   ├── step-filter.service.js    # 📝 Trace event filtering
│   │   ├── memory-mapper.service.js  # 🗺️ Memory layout analysis
│   │   ├── variable.service.js       # 📊 Variable tracking
│   │   ├── chunk.service.js          # 📦 Pako - Data chunking
│   │   ├── chunk-streamer.service.js # 📦 Pako + Socket.IO - Streaming chunks
│   │   ├── session-manager.service.js # 🔴 Redis + UUID - Session handling
│   │   ├── worker-pool.service.js    # 🐳 Dockerode - Worker management
│   │   ├── data-security.service.js  # 🔒 Security utilities
│   │   ├── input-manager.service.js  # ⌨️ User input handling
│   │   └── analyze.service.js        # 📊 Code analysis
│   │
│   ├── sockets/               # WebSocket handlers
│   │   ├── index.js                  # 🔌 Socket.IO - Socket setup
│   │   └── handlers/
│   │       ├── trace.handler.js      # 🔌 Socket.IO - Trace event streaming
│   │       ├── debug-session.handler.js # 🐛 Socket.IO + DAP - Debug sessions
│   │       ├── input.handler.js      # 🔌 Socket.IO - User input handling
│   │       ├── code.handler.js       # 🔌 Socket.IO - Code submission
│   │       └── gcc.handler.js        # 🔌 Socket.IO - GCC events
│   │
│   ├── cpp/                   # C++ source files
│   │   └── tracer.cpp         # 🔧 C++ - Runtime trace library
│   │
│   ├── middleware/            # Express middleware
│   │   └── *.js               # 🟢 Express - Auth, validation, error handling
│   │
│   ├── models/                # Data models
│   │   └── *.js               # 📝 Data structures
│   │
│   ├── parsers/               # Output parsers
│   │   └── *.js               # 📝 GDB/LLDB output parsing
│   │
│   ├── utils/                 # Utilities
│   │   └── *.js               # 🔧 fs-extra, UUID, helpers
│   │
│   └── validators/            # Input validation
│       └── *.js               # ✅ Zod - Schema validation
│
├── docker/
│   └── Dockerfile.gateway     # 🐳 Docker - Gateway container
│
├── docker-compose.yml         # 🐳 Docker Compose - Multi-container setup
├── package.json               # 📦 NPM dependencies
├── .env                       # 🔒 dotenv - Environment variables
└── nodemon.json               # 🔄 Nodemon - Dev server config
```

---

### 🎨 Frontend (`frontend/`)

```
frontend/
├── src/
│   ├── main.tsx               # ⚛️ React - Application entry point
│   ├── App.tsx                # ⚛️ React + Allotment - Root component with split panels
│   ├── App.css                # 🎨 CSS - Root styles
│   ├── index.css              # 🎨 TailwindCSS - Global styles & Tailwind imports
│   │
│   ├── store/                 # State management
│   │   ├── index.ts           # 🐻 Zustand - Store configuration
│   │   ├── debugSlice.ts      # 🐻 Zustand + Immer - Debug state
│   │   ├── slices/
│   │   │   ├── executionSlice.ts  # 🐻 Zustand + Immer - Execution trace state
│   │   │   ├── editorSlice.ts     # 🐻 Zustand + Immer - Editor state
│   │   │   ├── canvasSlice.ts     # 🐻 Zustand + Immer - Canvas state
│   │   │   ├── uiSlice.ts         # 🐻 Zustand + Immer - UI state
│   │   │   ├── gccSlice.ts        # 🐻 Zustand + Immer - GCC state
│   │   │   ├── loopSlice.ts       # 🐻 Zustand + Immer - Loop control state
│   │   │   └── inputSlice.ts      # 🐻 Zustand + Immer - Input state
│   │   └── selectors/
│   │       └── *.ts           # 🐻 Zustand - Derived state selectors
│   │
│   ├── components/
│   │   ├── canvas/            # Visualization components
│   │   │   ├── VisualizationCanvas.tsx  # 🎨 Konva + react-konva - Main canvas
│   │   │   ├── FlowArrows.tsx           # 🎨 Konva - Execution flow arrows
│   │   │   ├── AstNode.tsx              # 🎨 Konva - AST node rendering
│   │   │   ├── InputDialog.tsx          # 🎨 Radix Dialog - Input prompts
│   │   │   ├── CanvasControls.tsx       # ⚛️ React - Canvas zoom/pan controls
│   │   │   ├── types.ts                 # 📝 TypeScript - Canvas type definitions
│   │   │   ├── elements/                # Canvas elements
│   │   │   │   ├── VariableBox.tsx      # 🎨 Konva - Variable visualization
│   │   │   │   ├── FunctionFrame.tsx    # 🎨 Konva - Function call frames
│   │   │   │   ├── MemoryBlock.tsx      # 🎨 Konva - Memory visualization
│   │   │   │   ├── PointerArrow.tsx     # 🎨 Konva - Pointer arrows
│   │   │   │   ├── OutputElement.tsx    # 🎨 Konva - Program output
│   │   │   │   ├── ExplanationBox.tsx   # 🎨 Konva - Step explanations
│   │   │   │   └── ...                  # 🎨 Konva - Other elements
│   │   │   ├── animations/              # Animation utilities
│   │   │   │   └── *.ts                 # 🎬 GSAP - Animation definitions
│   │   │   ├── layout/                  # Layout engine
│   │   │   │   ├── LayoutEngine.ts      # 📐 ELK.js - Auto-layout calculations
│   │   │   │   └── *.ts                 # 📐 Layout utilities
│   │   │   └── hooks/
│   │   │       └── *.ts                 # ⚛️ React Hooks - Canvas-specific hooks
│   │   │
│   │   ├── editor/            # Code editor
│   │   │   ├── CodeEditor.tsx           # 📝 Monaco Editor - Main editor
│   │   │   ├── ExecutionHighlighter.tsx # 📝 Monaco - Line highlighting
│   │   │   ├── FileLoader.tsx           # 📂 browser-fs-access - File loading
│   │   │   ├── EditorToolbar.tsx        # ⚛️ React - Editor toolbar
│   │   │   ├── ErrorDisplay.tsx         # ⚛️ React - Error messages
│   │   │   └── LanguageIndicator.tsx    # ⚛️ React - Language badge
│   │   │
│   │   ├── controls/          # Playback controls
│   │   │   ├── PlaybackControls.tsx     # ⚛️ React + Lucide - Play/Pause/Step buttons
│   │   │   ├── SpeedControl.tsx         # 🎚️ Radix Slider - Speed adjustment
│   │   │   ├── TimelineScrubber.tsx     # 🎚️ Radix Slider - Timeline navigation
│   │   │   ├── StepInfo.tsx             # ⚛️ React - Current step information
│   │   │   ├── ProgressBar.tsx          # ⚛️ React - Execution progress
│   │   │   └── LoopControls.tsx         # ⚛️ React - Loop skip/expand controls
│   │   │
│   │   ├── ui/                # Reusable UI components
│   │   │   ├── Button.tsx     # ⚛️ React + TailwindCSS + clsx
│   │   │   ├── Dialog.tsx     # 🎛️ Radix Dialog - Modal wrapper
│   │   │   ├── Slider.tsx     # 🎛️ Radix Slider - Slider wrapper
│   │   │   ├── Tabs.tsx       # 🎛️ Radix Tabs - Tab navigation
│   │   │   ├── Tooltip.tsx    # 🎛️ Radix Tooltip - Tooltip wrapper
│   │   │   ├── Input.tsx      # ⚛️ React + TailwindCSS
│   │   │   ├── Select.tsx     # 🎛️ Radix Select
│   │   │   └── Spinner.tsx    # ⚛️ React - Loading indicator
│   │   │
│   │   ├── layout/            # Layout components
│   │   │   └── *.tsx          # ⚛️ React + Allotment - Split panels
│   │   │
│   │   ├── sidebar/           # Sidebar panels
│   │   │   └── *.tsx          # ⚛️ React + Radix Tabs
│   │   │
│   │   ├── modals/            # Modal dialogs
│   │   │   └── *.tsx          # 🎛️ Radix Dialog
│   │   │
│   │   └── memory/            # Memory visualization
│   │       └── *.tsx          # 🎨 Konva - Memory diagrams
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useSocket.ts       # 🔌 Socket.IO Client - WebSocket connection
│   │   ├── useAnimationController.ts  # 🎬 GSAP - Animation orchestration
│   │   ├── useExecutionTrace.ts       # 🐻 Zustand - Trace state hook
│   │   ├── useDebugSession.ts         # 🐛 Debug session management
│   │   ├── useInputHandler.ts         # ⌨️ User input handling
│   │   ├── useChunkLoader.ts          # 📦 Pako - Chunk loading
│   │   ├── useCodeEditor.ts           # 📝 Monaco - Editor hook
│   │   ├── useAst.ts                  # 🌳 web-tree-sitter - AST parsing
│   │   ├── useExecutionAst.ts         # 🌳 web-tree-sitter - Execution AST
│   │   ├── AnimationEngine.ts         # 🎬 GSAP - Animation engine
│   │   └── ...
│   │
│   ├── api/                   # API clients
│   │   ├── api.service.ts     # 🌐 Axios - REST API client
│   │   └── socket.service.ts  # 🔌 Socket.IO Client - Socket wrapper
│   │
│   ├── services/              # Frontend services
│   │   ├── api.service.ts     # 🌐 Axios - API abstraction
│   │   ├── socket.service.ts  # 🔌 Socket.IO Client
│   │   ├── ast.service.ts     # 🌳 web-tree-sitter - AST service
│   │   ├── chunk-manager.ts   # 📦 Pako - Chunk management
│   │   ├── crypto-helper.ts   # 🔒 Encryption utilities
│   │   ├── protocol-adapter.ts # 📡 Protocol translation
│   │   ├── file.service.ts    # 📂 browser-fs-access
│   │   └── storage.service.ts # 💾 LocalStorage wrapper
│   │
│   ├── types/                 # TypeScript definitions
│   │   └── *.ts               # 📝 TypeScript + Zod - Type definitions
│   │
│   ├── constants/             # Constants
│   │   └── *.ts               # 📝 TypeScript - App constants
│   │
│   ├── config/                # Frontend config
│   │   └── *.ts               # ⚙️ Configuration files
│   │
│   ├── animations/            # Animation definitions
│   │   └── *.ts               # 🎬 GSAP - Animation presets
│   │
│   ├── utils/                 # Utilities
│   │   └── *.ts               # 🔧 Helper functions
│   │
│   ├── styles/                # Additional styles
│   │   └── *.css              # 🎨 TailwindCSS + Custom CSS
│   │
│   └── assets/                # Static assets
│       └── *                  # 🖼️ Images, fonts, etc.
│
├── vite.config.ts             # ⚡ Vite - Build configuration
├── tailwind.config.js         # 🎨 TailwindCSS - Theme configuration
├── postcss.config.js          # 🎨 PostCSS - CSS processing
├── tsconfig.json              # 📝 TypeScript - Compiler options
├── eslint.config.js           # 🔍 ESLint - Linting rules
├── package.json               # 📦 NPM dependencies
└── index.html                 # 📄 HTML entry point
```

---

### 🔑 Technology Legend

| Icon | Technology |
|------|------------|
| ⚛️ | React |
| 🐻 | Zustand + Immer |
| 🎨 | Konva / react-konva |
| 🎬 | GSAP |
| 📝 | Monaco Editor / TypeScript |
| 🌳 | web-tree-sitter |
| 🎛️ | Radix UI |
| 🌐 | Axios |
| 🔌 | Socket.IO |
| 🟢 | Express.js |
| 🔴 | Redis / IORedis |
| 🐳 | Docker / Dockerode |
| 🔧 | Clang / GCC / C++ |
| 🐛 | Debug Adapter Protocol |
| 📦 | Pako (compression) |
| 📐 | ELK.js (layout) |
| 🔒 | Security / Crypto |
| 📂 | browser-fs-access |

---

## 🔗 Quick Reference

| Area | Primary Tech | Why Chosen |
|------|--------------|------------|
| **Runtime** | Node.js | Async I/O, single language stack |
| **Backend Framework** | Express.js | Lightweight, industry standard |
| **Frontend Framework** | React + TypeScript | Component model, type safety |
| **Build Tool** | Vite | 100x faster than Webpack |
| **State Management** | Zustand | Minimal boilerplate |
| **Visualization** | Konva + GSAP | High performance canvas |
| **Real-time** | Socket.IO | Reliable WebSockets |
| **Compiler** | Clang/GCC | AST access via LibTooling |
| **Debugger** | LLDB | Python scriptable |
| **Containerization** | Docker | Consistent environments |
