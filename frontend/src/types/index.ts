// ============================================
// EXECUTION TYPES
// ============================================

export type StepType =
  | 'program_start'
  | 'global_declaration'
  | 'function_call'
  | 'variable_declaration'
  | 'assignment'
  | 'array_declaration'
  | 'pointer_declaration'
  | 'heap_allocation'
  | 'heap_free'
  | 'loop_start'
  | 'loop_iteration'
  | 'loop_compressed'
  | 'loop_end'
  | 'conditional_start'
  | 'conditional_branch'
  | 'input_request'
  | 'output'
  | 'function_return'
  | 'program_end';

export interface ExecutionStep {
  id: number;
  type: StepType;
  line: number;
  explanation: string;
  state: MemoryState;
  animation: AnimationConfig;
  pauseExecution?: boolean;
  inputRequest?: InputRequest;
}

export interface ExecutionTrace {
  steps: ExecutionStep[];
  totalSteps: number;
  globals: GlobalVariable[];
  functions: FunctionInfo[];
}

// ============================================
// MEMORY TYPES
// ============================================

export interface MemoryState {
  globals: Record<string, Variable>;
  stack: StackFrame[];
  heap: Record<string, HeapBlock>;
  callStack: CallFrame[];
  stdout?: string;
}

export interface Variable {
  name: string;
  type: string;
  value: any;
  address: string;
  scope: 'global' | 'local' | 'parameter';
  primitive: 'int' | 'float' | 'char' | 'double' | 'bool' | 'pointer' | 'array' | 'struct';
  isInitialized: boolean;
  isAlive: boolean;
  birthStep?: number;
  deathStep?: number;
  declarationType: 'with_value' | 'without_value' | 'multiple';
  isAccessed?: boolean; // For highlighting when read/written
  accessType?: 'read' | 'write';
}

export interface GlobalVariable extends Variable {
  scope: 'global';
}

export interface StackFrame {
  frameId: string;
  function: string;
  returnType: string;
  locals: Record<string, Variable>;
  returnAddress?: string;
}

export interface CallFrame {
  function: string;
  returnType: string;
  params: Record<string, Variable>;
  locals: Record<string, Variable>;
  frameId: string;
  returnAddress: string | null;
  isActive: boolean;
}

export interface HeapBlock {
  address: string;
  size: number;
  type: string;
  allocated: boolean;
  values: any[];
}

export interface ArrayVariable extends Variable {
  size: number;
  baseAddress: string;
  values: ArrayCell[];
}

export interface ArrayCell {
  index: number;
  value: any;
  address: string;
}

export interface PointerVariable extends Variable {
  pointsTo: string | null;
  pointerLevel: number; // 1 for *, 2 for **, etc.
}

// ============================================
// ANIMATION TYPES
// ============================================

export type AnimationType =
  | 'appear'
  | 'disappear'
  | 'value_change'
  | 'push_frame'
  | 'pop_frame'
  | 'heap_allocate'
  | 'heap_free'
  | 'array_create'
  | 'array_access'
  | 'array_update'
  | 'pointer_create'
  | 'pointer_update'
  | 'pointer_deref'
  | 'loop_indicator'
  | 'loop_cycle'
  | 'input_dialog'
  | 'program_complete';

export interface AnimationConfig {
  type: AnimationType;
  target: 'global' | 'stack' | 'heap' | 'overlay';
  duration: number;
  effect?: string;
  element?: string;
  frameId?: string;
  from?: any;
  to?: any;
  [key: string]: any;
}

// ============================================
// INPUT/OUTPUT TYPES
// ============================================

export interface InputRequest {
  format: string;
  variables: string[];
  expectedTypes: string[];
  prompt?: string;
}

// ============================================
// FUNCTION TYPES
// ============================================

export interface FunctionInfo {
  name: string;
  returnType: string;
  parameters: Parameter[];
  line: number;
  isMain: boolean;
}

export interface Parameter {
  name: string;
  type: string;
}

// ============================================
// SYMBOL TYPES
// ============================================

export interface Symbol {
  name: string;
  type: 'function' | 'variable' | 'array' | 'pointer' | 'struct';
  dataType: string;
  line: number;
  scope: string;
}

// ============================================
// CANVAS TYPES
// ============================================

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasViewport {
  zoom: number;
  position: CanvasPosition;
}

// ============================================
// LANGUAGE TYPES
// ============================================

export type Language = 'c' | 'cpp';

// ============================================
// UI TYPES
// ============================================

export interface UIState {
  isSidebarOpen: boolean;
  activeTab: string;
  isModalOpen: boolean;
  modalType: string | null;
}

// ============================================
// GCC STATUS TYPES
// ============================================

export interface GCCStatus {
  available: boolean;
  downloading: boolean;
  progress: number;
  stage: 'idle' | 'downloading' | 'extracting' | 'ready' | 'failed';
  gccPath: string | null;
}