export interface ExecutionStep {
    id: number;
    line: number;
    type: string;
    explanation: string;
    state: MemoryState;
    animation: any; // Define more strictly if format is known
    inputRequest: InputRequest | null;
    stdout: string;
  }
  
  export interface MemoryState {
    globals: Variable[];
    stack: StackFrame[];
    heap: HeapBlock[];
    pointers: Pointer[];
  }
  
  export interface Variable {
    name: string;
    value: any;
    type: string;
    address: string;
  }
  
  export interface StackFrame {
    name: string;
    address: string;
    locals: Variable[];
  }
  
  export interface HeapBlock {
    address: string;
    size: number;
    value: any;
  }
  
  export interface Pointer {
    from: string; // address of pointer variable
    to: string;   // address it points to
  }
  
  export interface InputRequest {
    variable: string;
    type: 'int' | 'float' | 'char' | 'string';
  }

  export const StepType = {
    DECLARATION: 'declaration',
    ASSIGNMENT: 'assignment',
    EXPRESSION: 'expression',
    FUNCTION_CALL: 'function_call',
    FUNCTION_RETURN: 'function_return',
    LOOP_START: 'loop_start',
    LOOP_ITERATION: 'loop_iteration',
    LOOP_COMPRESSED: 'loop_compressed',
    LOOP_END: 'loop_end',
    CONDITION_CHECK: 'condition_check',
    BRANCH_TAKEN: 'branch_taken',
    BRANCH_NOT_TAKEN: 'branch_not_taken',
    ARRAY_ACCESS: 'array_access',
    POINTER_DEREF: 'pointer_deref',
    MALLOC: 'malloc',
    FREE: 'free',
    INPUT_REQUEST: 'input_request',
    OUTPUT: 'output',
    PROGRAM_START: 'program_start',
    PROGRAM_END: 'program_end'
  };
  