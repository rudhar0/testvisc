#!/usr/bin/env python3
"""
LLDB-based execution tracer
Provides runtime variable inspection with full class member access
"""
import sys
import os

if sys.platform == 'win32':
    # On Windows, we need to add the LLVM bin directory to the path
    # so that the _lldb.pyd file can find the liblldb.dll.
    # We'll assume a default installation path.
    llvm_path = r'C:\Program Files\LLVM'
    llvm_bin_path = os.path.join(llvm_path, 'bin')
    if os.path.exists(llvm_bin_path):
        if hasattr(os, 'add_dll_directory'):
            os.add_dll_directory(llvm_bin_path)
        else:
            os.environ['PATH'] = llvm_bin_path + os.pathsep + os.environ['PATH']

    # Add LLVM's python site-packages to sys.path
    py_major = sys.version_info.major
    py_minor = sys.version_info.minor
    site_packages = os.path.join(llvm_path, 'lib', 'site-packages')
    if os.path.exists(site_packages):
        sys.path.insert(0, site_packages)


import lldb
import json

class LLDBTracer:
    def __init__(self, executable_path, semantic_info=None):
        self.executable_path = executable_path
        self.semantic_info = semantic_info or {}
        self.debugger = lldb.SBDebugger.Create()
        self.debugger.SetAsync(False)
        self.target = None
        self.process = None
        self.trace = []
        self.step_id = 0
        self.variable_addresses = {}
        
    def create_target(self):
        """Create debug target"""
        self.target = self.debugger.CreateTarget(self.executable_path)
        if not self.target:
            raise Exception(f"Failed to create target for {self.executable_path}")
        print(f"✓ Target created: {self.executable_path}", file=sys.stderr)
        
    def set_breakpoints(self):
        """Set breakpoints on constructors and main"""
        breakpoints = []
        
        # Breakpoint on main
        bp_main = self.target.BreakpointCreateByName("main")
        breakpoints.append({'id': bp_main.GetID(), 'name': 'main', 'line': 0})
        
        # Breakpoints on constructors (from semantic info)
        if 'constructors' in self.semantic_info:
            for ctor in self.semantic_info['constructors']:
                # Try to set by line number
                source_file = self.semantic_info.get('source_file', '')
                if source_file:
                    bp = self.target.BreakpointCreateByLocation(source_file, ctor['line'])
                    breakpoints.append({
                        'id': bp.GetID(),
                        'name': f"{ctor['className']}::constructor",
                        'line': ctor['line']
                    })
        
        print(f"✓ Set {len(breakpoints)} breakpoints", file=sys.stderr)
        return breakpoints
        
    def launch_process(self):
        """Launch the process"""
        error = lldb.SBError()
        self.process = self.target.Launch(
            self.debugger.GetListener(),
            None,  # argv
            None,  # envp
            None,  # stdin
            None,  # stdout
            None,  # stderr
            os.getcwd(),  # working directory
            0,  # launch flags
            False,  # stop at entry
            error  # error
        )
        
        if not self.process or not self.process.IsValid():
            raise Exception(f"Failed to launch process: {error}")
        
        print(f"✓ Process launched (PID: {self.process.GetProcessID()})", file=sys.stderr)
        
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
        
        # Check if it's a class
        type_class = variable.GetType().GetTypeClass()
        
        if type_class == lldb.eTypeClassClass or type_class == lldb.eTypeClassStruct:
            var_info['primitive'] = 'class'
            var_info['className'] = variable.GetTypeName()
            var_info['value'] = []
            
            # Get class members
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
            for i in range(min(variable.GetNumChildren(), 100)):  # Limit to 100 elements
                elem = variable.GetChildAtIndex(i)
                var_info['value'].append(self.get_variable_value(elem))
        
        return var_info
    
    def get_variable_value(self, variable):
        """Get the value of a variable as a string or appropriate type"""
        value_str = variable.GetValue()
        
        if value_str is None:
            return None
        
        type_name = variable.GetTypeName()
        
        # Try to parse numeric types
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
        
        # String values often have quotes
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
        variables = frame.GetVariables(True, True, False, True)  # args, locals, statics, in_scope_only
        
        for i in range(variables.GetSize()):
            var = variables.GetValueAtIndex(i)
            var_info = self.get_variable_info(var)
            frame_info['locals'][var_info['name']] = var_info
        
        return frame_info
    
    def detect_step_type(self, frame_info, previous_locals):
        """Detect what type of step this is"""
        current_locals = frame_info['locals']
        
        # Check for new class objects
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
            class_name = func_name.split('::')[0]
            method_name = func_name.split('::')[1]
            
            if method_name == class_name:
                return {'type': 'object_creation', 'className': class_name}
            elif method_name.startswith('~'):
                return {'type': 'object_destruction', 'className': class_name}
        
        return {'type': 'line_execution'}
    
    def generate_trace(self, max_steps=200):
        """Generate execution trace"""
        print("🎬 Starting LLDB trace generation...", file=sys.stderr)
        
        self.create_target()
        self.set_breakpoints()
        self.launch_process()
        
        step_count = 0
        previous_locals = {}
        
        while self.process.GetState() != lldb.eStateExited and step_count < max_steps:
            thread = self.process.GetSelectedThread()
            if not thread or not thread.IsValid():
                break
            
            frame = thread.GetSelectedFrame()
            if not frame or not frame.IsValid():
                break
            
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
            
            previous_locals = frame_info['locals'].copy()
            
            # Step to next line
            thread.StepOver()
        
        # Add final step
        self.trace.append({
            'id': self.step_id,
            'type': 'program_end',
            'line': frame_info['line'] if frame_info else 0,
            'explanation': 'Program execution completed',
            'state': {
                'callStack': [],
                'globals': {},
                'stack': [],
                'heap': {}
            }
        })
        
        print(f"✅ Generated {len(self.trace)} steps", file=sys.stderr)
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
    
    tracer = LLDBTracer(executable, semantic_info)
    trace = tracer.generate_trace()
    
    # Output trace as JSON to stdout
    print(json.dumps({'steps': trace, 'totalSteps': len(trace)}))

if __name__ == '__main__':
    main()