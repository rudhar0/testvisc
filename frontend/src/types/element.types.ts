/**
 * Comprehensive Element Type System
 * Defines all element types and their subtypes for the visualization canvas
 */

export type ElementType = 
  | 'variable'
  | 'function'
  | 'loop'
  | 'condition'
  | 'pointer'
  | 'array'
  | 'output'
  | 'input'
  | 'heap'
  | 'global';

export type VariableSubtype = 
  | 'variable_single_init'      // int a = 10;
  | 'variable_multiple_init'    // int a = 1, b = 2, c = 3;
  | 'variable_value_change';    // a = 20;

export type FunctionSubtype =
  | 'function_call'             // Calling a function
  | 'function_body_main'        // Function body inside main (nested)
  | 'function_body_global';     // Function body outside main (in global panel)

export type LoopSubtype =
  | 'loop_single'               // Single loop (for, while, do-while)
  | 'loop_nested'               // Nested loops
  | 'loop_skip'                 // Skip/continue iteration
  | 'loop_compression';         // Compression/skip iterations

export type ConditionSubtype =
  | 'condition_if'              // if statement
  | 'condition_else'            // else branch
  | 'condition_elseif'          // else if branch
  | 'condition_switch';          // switch statement

export type PointerSubtype =
  | 'pointer_initial'           // Initial pointer declaration
  | 'pointer_value_change'     // Pointer value changed
  | 'pointer_dereference'       // Dereferencing pointer
  | 'pointer_arrow';            // Arrow showing pointer relationship

export type ArraySubtype =
  | 'array_declaration'         // Array declaration
  | 'array_access'              // Accessing array element
  | 'array_modify';             // Modifying array element

export type OutputSubtype =
  | 'output_printf'             // printf output
  | 'output_cout'               // cout output
  | 'output_endl';              // endl/newline

export type InputSubtype =
  | 'input_scanf'               // scanf input
  | 'input_cin';                // cin input

export type HeapSubtype =
  | 'heap_malloc'               // malloc allocation
  | 'heap_free'                 // free deallocation
  | 'heap_realloc';             // realloc

export type GlobalSubtype =
  | 'global_variable'           // Global variable
  | 'global_function'           // Global function declaration
  | 'global_constant';          // Global constant

export type ElementSubtype = 
  | VariableSubtype
  | FunctionSubtype
  | LoopSubtype
  | ConditionSubtype
  | PointerSubtype
  | ArraySubtype
  | OutputSubtype
  | InputSubtype
  | HeapSubtype
  | GlobalSubtype;

export interface ElementMetadata {
  elementType: ElementType;
  subtype: ElementSubtype;
  stepId: number;
  line: number;
  explanation?: string;
  [key: string]: any;
}

/**
 * Element Type Detection Helpers
 */
export class ElementTypeDetector {
  /**
   * Detect variable subtype from execution step
   */
  static detectVariableSubtype(step: any, variable: any, previousVariable?: any): VariableSubtype {
    // Check if variable already existed and value changed (assignment)
    if (previousVariable && 
        previousVariable.isAlive && 
        previousVariable.value !== variable.value) {
      return 'variable_value_change';
    }
    
    // Check if multiple variables declared in same step
    if (step.declarationType === 'multiple' || step.isMultiple) {
      return 'variable_multiple_init';
    }
    
    // Single initialization
    return 'variable_single_init';
  }

  /**
   * Detect function subtype from execution step
   */
  static detectFunctionSubtype(step: any, frame: any, isInMain: boolean): FunctionSubtype {
    // If this is a function call inside main (not the main function itself)
    if (step.type === 'function_call' && isInMain && frame.function !== 'main') {
      return 'function_call';
    }
    
    // If function body is inside main (nested function)
    if (isInMain && frame.function !== 'main') {
      return 'function_body_main';
    }
    
    // If function is in global scope (outside main)
    if (!isInMain || frame.function !== 'main') {
      return 'function_body_global';
    }
    
    return 'function_call';
  }

  /**
   * Detect loop subtype from execution step
   */
  static detectLoopSubtype(step: any, parentLoop?: any): LoopSubtype {
    // Check if there's a parent loop (nested)
    if (parentLoop) {
      return 'loop_nested';
    }
    
    // Check if step indicates compression/skip
    if (step.explanation?.toLowerCase().includes('compress') || 
        step.explanation?.toLowerCase().includes('skip') ||
        step.compressedIterations !== undefined ||
        step.skipCount !== undefined) {
      return step.compressedIterations !== undefined ? 'loop_compression' : 'loop_skip';
    }
    
    return 'loop_single';
  }

  /**
   * Detect pointer subtype from execution step
   */
  static detectPointerSubtype(step: any, previousPointer?: any): PointerSubtype {
    // Check if showing arrow relationship (dereference or assignment)
    if (step.showArrow || step.pointsTo || step.explanation?.includes('arrow') || step.explanation?.includes('points to')) {
      return 'pointer_arrow';
    }
    
    // Check if pointer is being dereferenced
    if (step.type === 'pointer_deref' || step.explanation?.includes('*')) {
      return 'pointer_dereference';
    }
    
    // Check if pointer value changed (address changed)
    if (previousPointer && 
        (previousPointer.address !== step.address || 
         previousPointer.value !== step.value ||
         previousPointer.pointsTo !== step.pointsTo)) {
      return 'pointer_value_change';
    }
    
    return 'pointer_initial';
  }

  /**
   * Detect array subtype from execution step
   */
  static detectArraySubtype(step: any): ArraySubtype {
    if (step.type === 'array_access') {
      return 'array_access';
    }
    
    if (step.type === 'assignment' && step.explanation?.includes('[')) {
      return 'array_modify';
    }
    
    return 'array_declaration';
  }

  /**
   * Detect output subtype from execution step
   */
  static detectOutputSubtype(step: any): OutputSubtype {
    if (step.explanation?.includes('cout') || step.explanation?.includes('<<')) {
      return step.explanation?.includes('endl') ? 'output_endl' : 'output_cout';
    }
    
    return 'output_printf';
  }

  /**
   * Detect input subtype from execution step
   */
  static detectInputSubtype(step: any): InputSubtype {
    if (step.explanation?.includes('cin') || step.explanation?.includes('>>')) {
      return 'input_cin';
    }
    
    return 'input_scanf';
  }
}

