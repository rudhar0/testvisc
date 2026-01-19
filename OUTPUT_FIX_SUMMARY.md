# Output Event Detection Fix

## Problem
Instead of showing actual output like `"Hello, World!"`, the system was displaying internal function names like `global_sub_i_main()`.

## Root Cause
The output detection logic was too simplistic and couldn't properly identify C++ stream operators and internal output functions that get instrumented by GCC.

## Solution

### 1. Enhanced Output Event Detection
Updated `isOutputEvent()` to detect:
- **C functions**: printf, puts, putchar, fprintf, sprintf, fwrite, fputs, write
- **C++ stream operators**: operator<<, operator>>, std::cout, std::cerr
- **Stream-related functions**: basic_ostream, __ostream_insert
- **Pattern matching**: Any function name containing "stream", "ostream", or "output"

```javascript
// Now detects even obfuscated internal names
isOutputEvent(event, info) {
    const cFunctions = ['printf', 'puts', 'putchar', ...];
    const cppFunctions = ['operator<<', 'std::cout', '__ostream_insert', ...];
    if (fn.includes('stream') || fn.includes('ostream')) return true;
}
```

### 2. Proper Event Type Marking
Changed step creation to mark output operations with `eventType: 'output'` instead of the raw event type:
```javascript
const step = {
    eventType: isOutputOp ? 'output' : ev.type,  // Mark as 'output' if detected
    stdout: capturedOutput,                        // Attach actual output text
    explanation: this.getEventExplanation(...)
}
```

### 3. Improved Explanation Display
Enhanced `getEventExplanation()` to show:
- `📤 Output: Hello, World!` - when actual output captured
- `📤 cout() called` - when output function called but no text captured
- Instead of: `global_sub_i_main ()` - the old confusing function name

```javascript
getEventExplanation(ev, info, output, isOutputOp) {
    if (isOutputOp && output) {
        return `📤 Output: ${output.trim()}`;
    }
    if (isOutputOp) {
        return `📤 ${info.function}() called`;
    }
    // ... other event types
}
```

## Result

### Before
```
std::cout << "Hello, World!" << std::endl;
Step shows: "Entering global_sub_i_main()"
```

### After
```
std::cout << "Hello, World!" << std::endl;
Step shows: "📤 Output: Hello, World!"
eventType: "output"
stdout: "Hello, World!\n"
```

## Files Modified
- `backend/src/services/instrumentation-tracer.service.js`
  - `isOutputEvent()` - Enhanced detection
  - `trackOutputEvent()` - Already correct, no changes needed
  - Step creation in `convertToSteps()` - Added `isOutputOp` flag
  - `getEventExplanation()` - Added output parameter handling

## No Breaking Changes
- All existing functionality preserved
- Backward compatible with frontend
- Output steps seamlessly integrate with existing step types
