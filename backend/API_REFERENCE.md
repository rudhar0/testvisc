# Quick Reference: Clang + LibTooling API

## Core Service: clangAnalyzerService

### 1. Comprehensive Analysis
```javascript
const result = await clangAnalyzerService.analyzeCode(code, language);

// Result Structure:
{
  success: boolean,
  errors: Array<{line, column, message, severity}>,
  analysis: {
    semantic: { functions, classes, variables, pointers, templates },
    pointers: { pointers, dereferences, patterns },
    templates: { templates, instantiations },
    hierarchy: { classes, inheritance },
    callGraph: { functions, calls, virtualCalls },
    variables: Array,
    inputRequirements: Array,
    metadata: { hasSemanticInfo, counts }
  }
}
```

### 2. Syntax Validation
```javascript
const result = await clangAnalyzerService.validateCode(code, language);

// Result:
{
  valid: boolean,
  errors: Array<{line, column, message}>
}
```

### 3. Visualization Data
```javascript
const result = await clangAnalyzerService.extractVisualInfo(code, language);

// Result:
{
  success: boolean,
  visualization: {
    classes: Array<{name, members, methods}>,
    functions: Array<{name, returnType, calls}>,
    variables: Object<lineNum, Array<{name, type, isPointer}>>,
    pointerChains: Array<{pointer, type, derefs}>
  }
}
```

### 4. Memory Issue Detection
```javascript
const result = await clangAnalyzerService.detectMemoryIssues(code, language);

// Result:
{
  issues: Array<{
    severity: 'info'|'warning',
    type: 'double_pointer'|'void_pointer_cast'|'null_dereference_risk'|'pointer_arithmetic',
    message: string
  }>
}
```

### 5. Code Summary
```javascript
const result = await clangAnalyzerService.getSummary(code, language);

// Result:
{
  success: boolean,
  summary: {
    hasSemanticInfo: boolean,
    functionCount: number,
    classCount: number,
    variableCount: number,
    templateCount: number
  }
}
```

## Low-level Service: ClangService

### Pointer Analysis
```javascript
const result = await ClangService.analyzePointers(code, language);

// Returns: { pointers, dereferences, patterns }
```

### Template Analysis
```javascript
const result = await ClangService.analyzeTemplates(code, language);

// Returns: { templates, instantiations }
```

### Class Hierarchy
```javascript
const result = await ClangService.analyzeClassHierarchy(code, language);

// Returns: { classes, inheritance }
```

### Call Graph
```javascript
const result = await ClangService.buildCallGraph(code, language);

// Returns: { functions, calls, virtualCalls }
```

### Variables
```javascript
const result = await ClangService.extractVariables(code, language);

// Returns: Array<{name, type, isPointer, isArray, isStatic, ...}>
```

### AST Generation
```javascript
const result = await ClangService.generateAst(code, language);

// Returns: { success, ast, errors, metadata }
```

## API Endpoints

### POST /api/analyze/syntax
```bash
Request:
{
  "code": "int main(){return 0;}",
  "language": "c"
}

Response:
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "language": "c",
    "analyzer": "clang+libtooling"
  }
}
```

### POST /api/analyze/ast
```bash
Request:
{
  "code": "int x = 5; int* p = &x;",
  "language": "c"
}

Response:
{
  "success": true,
  "data": {
    "semantic": { "functions": 0, "variables": 2, "pointers": 1, ... },
    "pointers": { "pointers": [...], "dereferences": [...], ... },
    "variables": [...],
    ...
  }
}
```

### POST /api/analyze/visual
```bash
Request:
{
  "code": "class Foo { public: int x; };",
  "language": "cpp"
}

Response:
{
  "success": true,
  "data": {
    "classes": [{ "name": "Foo", "members": [...] }],
    "functions": [...],
    "variables": {...},
    "pointerChains": [...]
  }
}
```

### POST /api/analyze/memory-issues
```bash
Request:
{
  "code": "void* p = malloc(10); int* x = (int*)p;",
  "language": "c"
}

Response:
{
  "success": true,
  "data": {
    "issues": [
      {
        "severity": "warning",
        "type": "void_pointer_cast",
        "message": "Void pointer casts - type safety risk"
      }
    ]
  }
}
```

### GET /api/compiler/status
```bash
Response:
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

### GET /api/compiler/info
```bash
Response:
{
  "success": true,
  "data": {
    "compiler": "Clang + LibTooling",
    "standard": "Industry standard (VSCode, CLion, clangd)",
    "features": [
      "Full semantic analysis (not just syntax)",
      "Pointer analysis & dereferencing chains",
      "Template instantiation tracking",
      ...
    ]
  }
}
```

## WebSocket Events

### Connect
```javascript
// Client receives on connect:
socket.on('connect', () => {
  // Server emits:
  socket.emit('compiler:status', {
    compiler: 'clang',
    available: true,
    ready: true
  });
});
```

### Request Status
```javascript
socket.emit('compiler:status:request');

socket.on('compiler:status', (data) => {
  console.log(data.compiler); // "clang"
  console.log(data.ready);    // true
});
```

### Analyze Code
```javascript
socket.emit('code:analyze:syntax', {
  code: 'int main(){return 0;}',
  language: 'c'
});

socket.on('code:syntax:result', (data) => {
  console.log(data.valid);      // boolean
  console.log(data.errors);     // array
  console.log(data.analyzer);   // "clang+libtooling"
});
```

### Analyze with Chunks
```javascript
// For large files, send in chunks
socket.emit('code:analyze:chunk', {
  code: 'chunk1...',
  chunkIndex: 0,
  totalChunks: 3,
  language: 'cpp'
});

// Wait for completion
socket.on('code:trace:complete', (data) => {
  console.log(data.totalChunks);
  console.log(data.totalSteps);
});
```

## Response Data Structures

### Pointer Info
```javascript
{
  pointers: [
    {
      name: 'ptr',
      type: 'int*',
      line: 5,
      isPointer: true
    }
  ],
  dereferences: [
    {
      operator: '*',
      line: 10,
      type: 'dereference'
    }
  ],
  patterns: ['pointer_arithmetic', 'double_pointer', ...]
}
```

### Variable Info
```javascript
{
  name: 'count',
  type: 'int',
  isPointer: false,
  isArray: false,
  isStatic: false,
  isConstexpr: false,
  line: 5
}
```

### Function Info
```javascript
{
  name: 'processData',
  returnType: 'void',
  parameters: ['int*', 'std::vector<T>'],
  isVirtual: false,
  line: 10
}
```

### Class Info
```javascript
{
  name: 'MyClass',
  type: 'class',
  members: [
    { name: 'x', type: 'int', access: 'private' }
  ],
  methods: [
    { name: 'getValue', returnType: 'int', access: 'public', isVirtual: false }
  ],
  line: 1
}
```

### Call Graph Info
```javascript
{
  functions: [
    { name: 'main', returnType: 'int', ... }
  ],
  calls: [
    { callee: 'printf', line: 15, arguments: 2 }
  ],
  virtualCalls: [
    { callee: 'process', line: 20, arguments: 1 }
  ]
}
```

## Error Format

### Syntax/Semantic Errors
```javascript
[
  {
    line: 5,
    column: 10,
    message: 'variable 'x' was not declared in this scope',
    severity: 'error'
  },
  {
    line: 8,
    column: 2,
    message: 'unused variable 'y'',
    severity: 'warning'
  }
]
```

## Language Support

### C
```javascript
const result = await clangAnalyzerService.analyzeCode(code, 'c');
// Standard: -std=c99
```

### C++
```javascript
const result = await clangAnalyzerService.analyzeCode(code, 'cpp');
// Standard: -std=c++20
```

## Common Patterns

### Check if code is valid
```javascript
const validation = await clangAnalyzerService.validateCode(code, 'cpp');
if (!validation.valid) {
  console.log('Errors:', validation.errors);
}
```

### Get all classes and inheritance
```javascript
const analysis = await clangAnalyzerService.analyzeCode(code, 'cpp');
const hierarchy = analysis.analysis.hierarchy;
console.log('Classes:', hierarchy.classes);
console.log('Inheritance:', hierarchy.inheritance);
```

### Find all functions and their calls
```javascript
const analysis = await clangAnalyzerService.analyzeCode(code, 'cpp');
const calls = analysis.analysis.callGraph;
calls.functions.forEach(func => {
  console.log(`${func.name} (line ${func.line})`);
});
```

### Detect memory safety issues
```javascript
const issues = await clangAnalyzerService.detectMemoryIssues(code, 'c');
issues.issues.forEach(issue => {
  console.log(`[${issue.severity}] ${issue.type}: ${issue.message}`);
});
```

### Get code statistics
```javascript
const summary = await clangAnalyzerService.getSummary(code, 'cpp');
console.log(`Functions: ${summary.summary.functionCount}`);
console.log(`Classes: ${summary.summary.classCount}`);
console.log(`Variables: ${summary.summary.variableCount}`);
```

---

**API Version**: 2.0
**Last Updated**: December 2024
**Status**: Stable
