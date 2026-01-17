#!/usr/bin/env python3
"""
LLDB-based execution tracer - IMPROVED VERSION
Handles both simple and complex programs, including iostream usage
"""
import sys
import os
import signal
import time

if sys.platform == 'win32':
    llvm_path = r'C:\Program Files\LLVM'
    llvm_bin_path = os.path.join(llvm_path, 'bin')
    if os.path.exists(llvm_bin_path):
        if hasattr(os, 'add_dll_directory'):
            os.add_dll_directory(llvm_bin_path)
        else:
            os.environ['PATH'] = llvm_bin_path + os.pathsep + os.environ['PATH']
    
    site_packages = os.path.join(llvm_path, 'lib', 'site-packages')
    if os.path.exists(site_packages):
        sys.path.insert(0, site_packages)

import lldb
import json

class TimeoutException(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutException("Execution timeout")

class LLDBTracer:
    def __init__(self, executable_path, semantic_info=None, timeout_seconds=30):
        self.executable_path = executable_path
        self.semantic_info = semantic_info or {}
        self.timeout_seconds = timeout_seconds
        self.debugger = lldb.SBDebugger.Create()
        self.debugger.SetAsync(False)
        self.target = None
        self.process = None
        self.trace = []
        self.step_id = 0
        
        # Why: To correctly identify a new execution step, we need more than just the line number.
        # This signature captures the function, file, line, and stack depth. A change in any of
        # these indicates a new, distinct step in the execution flow (e.g., function call,
        # return, or moving to a new line). This is critical for capturing global constructors,
        # destructors, and loops.
        self.last_frame_signature = None
        
        # Get user source file path
        self.user_source_file = semantic_info.get('source_file', '')
        if self.user_source_file:
            self.user_source_file = os.path.normpath(os.path.abspath(self.user_source_file))
            self.user_source_basename = os.path.basename(self.user_source_file)
        else:
            self.user_source_basename = None
        
        # Track if we've seen any user code
        self.found_user_code = False
        
    def create_target(self):
        """Create debug target"""
        self.target = self.debugger.CreateTarget(self.executable_path)
        if not self.target:
            raise Exception(f"Failed to create target for {self.executable_path}")
        print(f"✓ Target created: {self.executable_path}", file=sys.stderr)
        
    def set_breakpoints(self):
        """
        No longer setting a breakpoint on main. By launching with stop_at_entry=True,
        we can trace execution from the very beginning, including global static
        initializers and constructors that run before main().
        """
        return []
        
    def launch_process(self):
        """Launch the process and stop at the entry point."""
        error = lldb.SBError()

        # How global/constructor execution is captured:
        # We launch the process with stop_at_entry=True. This makes the debugger
        # halt at the program's very first instruction, before any user code (like main)
        # runs. From there, we can step through the entire program, capturing the
        # execution of global variable initializers and static constructors.
        self.process = self.target.Launch(
            self.debugger.GetListener(),
            None, None, None, None, None,
            os.getcwd(),
            0,  # launch_flags
            True, # stop_at_entry
            error
        )
        
        if not self.process or not self.process.IsValid():
            raise Exception(f"Failed to launch process: {error}")
        
        print(f"✓ Process launched (PID: {self.process.GetProcessID()})", file=sys.stderr)
    
    def is_user_code(self, frame):
        """
        Enhanced detection: Check if frame is in user source code
        More lenient to catch simple programs
        """
        if not frame or not frame.IsValid():
            return False
        
        line_entry = frame.GetLineEntry()
        if not line_entry or not line_entry.IsValid():
            return False
        
        file_spec = line_entry.GetFileSpec()
        if not file_spec or not file_spec.IsValid():
            return False
        
        file_path = file_spec.GetFilename()
        if not file_path:
            return False
        
        # Strategy 1: Exact match with known source file
        if self.user_source_file:
            full_path = os.path.join(file_spec.GetDirectory() or '', file_path)
            full_path = os.path.normpath(os.path.abspath(full_path))
            if full_path == self.user_source_file:
                return True
        
        # Strategy 2: Basename match (for temp files)
        if self.user_source_basename:
            if file_path == self.user_source_basename:
                return True
        
        # Strategy 3: Accept any .cpp/.c file that's not obviously system code
        file_lower = file_path.lower()
        
        # Reject obvious system files
        system_patterns = [
            'crt', 'msvcrt', 'vcruntime', 'ucrtbase',
            'iostream', 'ostream', 'istream', 
            'locale', 'xlocale', 'iosfwd', 'streambuf',
            'kernel32', 'ntdll', 'libc', 'libstdc++',
            'basic_', 'char_traits', '__'
        ]
        
        for pattern in system_patterns:
            if pattern in file_lower:
                return False
        
        # Accept user source files
        if file_path.endswith(('.c', '.cpp', '.cc', '.cxx', '.C')):
            # Additional check: file should not be in system paths
            directory = file_spec.GetDirectory() or ''
            directory_lower = directory.lower()
            
            system_dirs = [
                'include/c++', 'windows kits', 'microsoft visual studio',
                'program files', 'mingw', 'gcc', 'clang', 'llvm',
                '/usr/include', '/usr/lib'
            ]
            
            for sys_dir in system_dirs:
                if sys_dir in directory_lower:
                    return False
            
            return True
        
        return False
    
    def should_record_step(self, frame):
        """
        Determine if this frame represents a new execution step using a detailed signature.
        Why frame signature comparison is required: A simple line number check is insufficient.
        It misses many critical execution steps, such as:
        - Function calls and returns on the same line.
        - Loops where the line number doesn't change.
        - Execution transitioning between different functions at the same line number.
        - Changes in stack depth (indicating function calls or returns).
        By comparing a signature of (function, file, line, stack_depth), we reliably detect
        every meaningful step.
        """
        if not self.is_user_code(frame):
            return False
        
        thread = frame.GetThread()
        if not thread or not thread.IsValid():
            return False

        line_entry = frame.GetLineEntry()
        current_line = line_entry.GetLine()
        current_file = line_entry.GetFileSpec().GetFilename()
        function_name = frame.GetFunctionName() or 'unknown'
        stack_depth = thread.GetNumFrames()

        # The frame signature uniquely identifies a point in execution.
        current_frame_signature = (function_name, current_file, current_line, stack_depth)

        # Mark that we found user code
        self.found_user_code = True
        
        # Record step only if the signature is different from the last one.
        if current_frame_signature != self.last_frame_signature:
            self.last_frame_signature = current_frame_signature
            return True
        
        return False
        
    def get_variable_info(self, variable):
        """Extract detailed variable information"""
        var_info = {
            'name': variable.GetName(),
            'type': variable.GetTypeName(),
            'value': self.get_variable_value(variable),
            'address': hex(variable.GetLoadAddress()) if variable.GetLoadAddress() != lldb.LLDB_INVALID_ADDRESS else '0x0',
            'scope': 'local',
            'isAlive': True
        }
        
        type_class = variable.GetType().GetTypeClass()
        
        if type_class == lldb.eTypeClassClass or type_class == lldb.eTypeClassStruct:
            var_info['primitive'] = 'class'
            var_info['className'] = variable.GetTypeName()
            var_info['value'] = []
            
            for i in range(variable.GetNumChildren()):
                member = variable.GetChildAtIndex(i)
                member_info = {
                    'name': member.GetName(),
                    'type': member.GetTypeName(),
                    'value': self.get_variable_value(member),
                    'address': hex(member.GetLoadAddress()) if member.GetLoadAddress() != lldb.LLDB_INVALID_ADDRESS else '0x0'
                }
                var_info['value'].append(member_info)
        
        elif '*' in variable.GetTypeName():
            var_info['primitive'] = 'pointer'
            
        elif '[' in variable.GetTypeName() or variable.GetType().IsArrayType():
            var_info['primitive'] = 'array'
            var_info['value'] = []
            for i in range(min(variable.GetNumChildren(), 100)):
                elem = variable.GetChildAtIndex(i)
                var_info['value'].append(self.get_variable_value(elem))
        
        return var_info
    
    def get_variable_value(self, variable):
        """Get the value of a variable"""
        value_str = variable.GetValue()
        
        if value_str is None:
            return None
        
        type_name = variable.GetTypeName()
        
        if 'int' in type_name.lower():
            try:
                return int(value_str)
            except:
                return value_str
        elif 'float' in type_name.lower() or 'double' in type_name.lower():
            try:
                return float(value_str)
            except:
                return value_str
        elif 'bool' in type_name.lower():
            return value_str.lower() == 'true'
        
        if value_str.startswith('"') and value_str.endswith('"'):
            return value_str[1:-1]
        
        return value_str
    
    def get_frame_info(self, frame):
        """Extract information from a stack frame"""
        line_entry = frame.GetLineEntry()
        
        frame_info = {
            'function': frame.GetFunctionName() or 'unknown',
            'line': line_entry.GetLine() if line_entry else 0,
            'file': line_entry.GetFileSpec().GetFilename() if line_entry else 'unknown',
            'locals': {}
        }
        
        # Get local variables
        variables = frame.GetVariables(True, True, False, True)
        
        for i in range(variables.GetSize()):
            var = variables.GetValueAtIndex(i)
            var_info = self.get_variable_info(var)
            frame_info['locals'][var_info['name']] = var_info
        
        return frame_info
    
    def detect_step_type(self, frame_info, previous_locals):
        """Detect what type of step this is"""
        current_locals = frame_info['locals']
        
        # Check for new variables
        for var_name, var_info in current_locals.items():
            if var_name not in previous_locals:
                if var_info.get('primitive') == 'class':
                    return {
                        'type': 'object_creation',
                        'className': var_info.get('className'),
                        'objectName': var_name,
                        'variable': var_name
                    }
                elif var_info.get('primitive') == 'pointer':
                    return {
                        'type': 'pointer_declaration',
                        'variable': var_name
                    }
                elif var_info.get('primitive') == 'array':
                    return {
                        'type': 'array_declaration',
                        'variable': var_name
                    }
                else:
                    return {
                        'type': 'variable_declaration',
                        'variable': var_name
                    }
        
        # Check for value changes
        for var_name, var_info in current_locals.items():
            if var_name in previous_locals:
                if str(var_info.get('value')) != str(previous_locals[var_name].get('value')):
                    return {
                        'type': 'assignment',
                        'variable': var_name
                    }
        
        # Check function name for constructor/destructor
        func_name = frame_info['function']
        if '::' in func_name:
            parts = func_name.split('::')
            if len(parts) >= 2:
                class_name = parts[-2]
                method_name = parts[-1]
                
                if method_name == class_name:
                    return {'type': 'object_creation', 'className': class_name}
                elif method_name.startswith('~'):
                    return {'type': 'object_destruction', 'className': class_name}
        
        return {'type': 'line_execution'}
    
    def is_process_running(self):
        """Check if process is still running and in a steppable state"""
        if not self.process or not self.process.IsValid():
            return False
        
        state = self.process.GetState()
        return state in [lldb.eStateStopped, lldb.eStateSuspended]
    
    def generate_trace(self, max_steps=10000):
        """
        Generate execution trace with improved stepping strategy
        """
        print("🎬 Starting LLDB trace generation...", file=sys.stderr)
        
        # Set up timeout (Unix only)
        if sys.platform != 'win32' and self.timeout_seconds > 0:
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(self.timeout_seconds)
        
        start_time = time.time()
        
        try:
            self.create_target()
            self.set_breakpoints()
            self.launch_process()
            
            step_count = 0
            previous_locals = {}
            stuck_count = 0
            max_stuck = 200  # Increased: allow more steps through library code
            
            while step_count < max_steps:
                # Check timeout (manual for Windows)
                if sys.platform == 'win32' and time.time() - start_time > self.timeout_seconds:
                    print(f"⏰ Timeout after {self.timeout_seconds}s", file=sys.stderr)
                    break
                
                # Check if process is still running
                if not self.is_process_running():
                    state = self.process.GetState()
                    print(f"🏁 Process ended (state: {lldb.SBDebugger.StateAsCString(state)})", file=sys.stderr)
                    break
                
                thread = self.process.GetSelectedThread()
                if not thread or not thread.IsValid():
                    print("⚠️  No valid thread", file=sys.stderr)
                    break
                
                frame = thread.GetSelectedFrame()
                if not frame or not frame.IsValid():
                    print("⚠️  No valid frame", file=sys.stderr)
                    break
                
                # Record if this is a new source line in user code
                if self.should_record_step(frame):
                    frame_info = self.get_frame_info(frame)
                    step_type_info = self.detect_step_type(frame_info, previous_locals)
                    
                    # Build step
                    step = {
                        'id': self.step_id,
                        'type': step_type_info['type'],
                        'line': frame_info['line'],
                        'function': frame_info['function'],
                        'explanation': f"Executing line {frame_info['line']}",
                        'state': {
                            'callStack': [frame_info],
                            'globals': {},
                            'stack': [],
                            'heap': {}
                        }
                    }
                    
                    # Add type-specific fields
                    for key, value in step_type_info.items():
                        if key != 'type':
                            step[key] = value
                    
                    # Add variable data if relevant
                    if 'variable' in step_type_info:
                        var_name = step_type_info['variable']
                        if var_name in frame_info['locals']:
                            var_data = frame_info['locals'][var_name]
                            step['name'] = var_name
                            step['dataType'] = var_data.get('type')
                            step['primitive'] = var_data.get('primitive', 'int')
                            step['value'] = var_data.get('value')
                            step['address'] = var_data.get('address')
                            step['scope'] = 'local'
                    
                    self.trace.append(step)
                    self.step_id += 1
                    step_count += 1
                    stuck_count = 0  # Reset stuck counter
                    
                    previous_locals = frame_info['locals'].copy()
                    
                    # Debug output
                    if step_count % 5 == 0:
                        print(f"  Step {step_count}: Line {frame_info['line']}", file=sys.stderr)
                else:
                    stuck_count += 1
                    
                    # If stuck too long but we found user code, we're probably done
                    if stuck_count > max_stuck:
                        if self.found_user_code:
                            print(f"✓ Finished user code after {step_count} steps", file=sys.stderr)
                        else:
                            print(f"⚠️  Stuck in non-user code for {max_stuck} iterations", file=sys.stderr)
                        break
                
                # Step over with eOnlyThisThread
                thread.StepOver(lldb.eOnlyThisThread)
            
            # Add final step if we have any trace
            if self.trace:
                last_line = self.trace[-1]['line']
                self.trace.append({
                    'id': self.step_id,
                    'type': 'program_end',
                    'line': last_line,
                    'explanation': 'Program execution completed',
                    'state': {
                        'callStack': [],
                        'globals': {},
                        'stack': [],
                        'heap': {}
                    }
                })
            
            elapsed = time.time() - start_time
            print(f"✅ Generated {len(self.trace)} steps in {elapsed:.2f}s", file=sys.stderr)
            
        except TimeoutException:
            print(f"⏰ Execution timed out after {self.timeout_seconds}s", file=sys.stderr)
            if self.trace:
                self.trace.append({
                    'id': self.step_id,
                    'type': 'timeout',
                    'line': self.trace[-1]['line'] if self.trace else 0,
                    'explanation': f'Execution timed out after {self.timeout_seconds}s',
                    'state': {'callStack': [], 'globals': {}, 'stack': [], 'heap': {}}
                })
        
        finally:
            # Clean up
            if sys.platform != 'win32' and self.timeout_seconds > 0:
                signal.alarm(0)
            
            if self.process and self.process.IsValid():
                self.process.Kill()
        
        return self.trace

def main():
    if len(sys.argv) < 2:
        print("Usage: lldb-tracer.py <executable> [semantic_info.json]", file=sys.stderr)
        sys.exit(1)
    
    executable = sys.argv[1]
    semantic_info = None
    
    if len(sys.argv) > 2:
        with open(sys.argv[2], 'r') as f:
            semantic_info = json.load(f)
    
    tracer = LLDBTracer(executable, semantic_info, timeout_seconds=30)
    trace = tracer.generate_trace()
    
    # Output trace as JSON to stdout
    print(json.dumps({'steps': trace, 'totalSteps': len(trace)}))

if __name__ == '__main__':
    main()