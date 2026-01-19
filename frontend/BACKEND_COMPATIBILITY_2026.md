# Frontend Backend Compatibility Layer (2026-01-18)

## Problem Statement

The **new instrumentation-based backend** generates execution steps with types:
- `func_enter` (entering function)
- `func_exit` (exiting function)
- `var` (variable trace event)
- `heap_alloc` (heap allocation)
- `heap_free` (heap deallocation)
- `program_end` (execution complete)

But the **frontend animation system** was expecting:
- `function_call` (→ **NOT** `func_enter`)
- `function_return` (→ **NOT** `func_exit`)
- `assignment` (→ **NOT** `var`)
- Various other legacy types

**Result:** Animations never triggered because the switch statement would hit `default` case and log "unknown type".

---

## Solution: Type Mapping Layer

### 1. **useAnimationController.ts** (Main Animation Dispatcher)

**Changed:** Added new backend type cases at the TOP of the switch statement

**Key Mappings:**
```typescript
// Backend → Animation Action
func_enter     → type: 'function_call'   (stack push)
func_exit      → type: 'function_return' (stack pop)
var            → type: 'variable_update' + 'variable_create' + 'variable_access'
heap_alloc     → type: 'memory_allocation'
heap_free      → type: 'element_destroy'
program_end    → (no animation, just log)
```

**Implementation:** Each backend type reads relevant fields and queues appropriate animation:

```typescript
case 'func_enter': {
  const funcName = currentExecutionStep.function;
  animations.push({
    type: 'function_call',  // ← Existing animation type
    target: `frame-${funcName}`,
    duration: 600,
  });
}

case 'var': {
  const varName = currentExecutionStep.name;
  const updatedVar = findVarInState(currentState, varName);
  animations.push({
    type: 'variable_update',  // ← Reuses existing animation
    target: `var-${updatedVar.address}`,
    duration: 1000,
    from: previousVar.value,
    to: updatedVar.value,
    // ... other fields
  });
}
```

**Why This Works:**
- Reuses existing animation types (no need to rewrite animation engine)
- Each backend type cleanly maps to a visual animation
- Maintains backward compatibility with legacy types

---

### 2. **useSocket.ts** (Type Normalization)

**Changed:** Added new backend types to `normalizeStepType()` mapping

```typescript
const typeMapping: Record<string, string> = {
  // NEW INSTRUMENTATION BACKEND TYPES
  'func_enter': 'func_enter',    // Pass-through
  'func_exit': 'func_exit',      // Pass-through
  'var': 'var',                  // Pass-through
  'heap_alloc': 'heap_alloc',    // Pass-through
  'heap_free': 'heap_free',      // Pass-through
  'program_end': 'program_end',  // Pass-through
  
  // LEGACY TYPES (still supported)
  'function_call': 'function_call',
  'assignment': 'assignment',
  // ... etc
};
```

**Why This Works:**
- New types are recognized immediately when steps arrive from backend
- No type coercion errors
- Supports both old and new backends seamlessly

---

### 3. **VariableLifetime.tsx** (Variable Tracking)

**Changed:** Updated to handle both old and new step types

```typescript
// OLD: Only checked for 'function_call'
// NEW: Checks for both 'function_call' AND 'func_enter'
if (step.type === 'function_call' || step.type === 'func_enter') {
  stackDepth++;
}

// OLD: Only checked for 'variable_declaration'
// NEW: Checks for 'variable_declaration', 'global_declaration', AND 'var'
if (step.type === 'variable_declaration' || step.type === 'global_declaration' || step.type === 'var') {
  // ... track variable
}

// OLD: Only checked for 'function_return'
// NEW: Checks for both 'function_return' AND 'func_exit'
if (step.type === 'function_return' || step.type === 'func_exit') {
  // ... handle death
}
```

**Why This Works:**
- Properly tracks variable lifetimes across function boundaries
- Works with both legacy (line-based) and new (event-based) backends

---

## Animation Trigger Logic

### Before (❌ BROKEN)
```
Step arrives from backend: { type: "func_enter", ... }
         ↓
useAnimationController switch statement
         ↓
No case for "func_enter"
         ↓
Default case: console.warn("Unknown step type")
         ↓
❌ NO ANIMATION QUEUED
```

### After (✅ WORKS)
```
Step arrives from backend: { type: "func_enter", ... }
         ↓
useAnimationController switch statement
         ↓
case 'func_enter': {
  animations.push({ type: 'function_call', target: 'frame-main', duration: 600 })
}
         ↓
AnimationEngine.addSequence(timeline)
         ↓
✅ CALL STACK PUSH ANIMATION EXECUTES
```

---

## Step Type Reference

| Backend Type | Frontend Animation | Visual Effect | Field Read |
|---|---|---|---|
| `func_enter` | `function_call` | Stack frame push | `function` |
| `func_exit` | `function_return` | Stack frame pop | `function` |
| `var` | `variable_update` \| `variable_create` \| `variable_access` | Variable highlight + value transition | `name`, `value` |
| `heap_alloc` | `memory_allocation` | Heap memory grow | `addr` |
| `heap_free` | `element_destroy` | Heap memory shrink | `addr` |
| `program_end` | (none) | (none) | (none) |

---

## Testing the Fix

1. **Compile frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Run backend:**
   ```bash
   cd backend
   npm start
   ```

3. **Submit C++ code with loop:**
   ```cpp
   for (int i = 0; i < 3; i++) {
     int x = i * 2;
   }
   ```

4. **Observe:**
   - ✅ Variable `i` appears → `var` event → animation
   - ✅ Variable `i` updates (0, 1, 2) → `var` events → animations
   - ✅ Variable `x` appears and updates → `var` events → animations
   - ✅ **Multiple steps in timeline** (not just 1)

---

## Backward Compatibility

All changes are **100% backward compatible:**

- Legacy types (`function_call`, `assignment`, etc.) still work
- Old step schema still supported
- Animation engine unchanged (only dispatcher layer updated)
- No breaking changes to types or interfaces

---

## Files Modified

1. `frontend/src/hooks/useAnimationController.ts` (main animation dispatcher)
2. `frontend/src/hooks/useSocket.ts` (type mapper)
3. `frontend/src/components/sidebar/VariableLifetime.tsx` (variable tracking)

No changes to animation engine, backend, or other components.
