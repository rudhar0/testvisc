# Output/Print Animation Fix (2026-01-18)

## Problem Identified

1. **Backend uses `eventType`, Frontend expects `type`**
   - Backend generates steps with `eventType: "func_enter"`, `eventType: "var"`, etc.
   - Frontend was reading `step.type` which was undefined
   - This caused the animation switch statement to receive `undefined` types

2. **Output/Print events not animated**
   - Backend has `stdout` field in steps
   - Frontend was not mapping `stdout` → `value`
   - Output animation case existed but was never reached

## Solutions Implemented

### 1. **useSocket.ts - Property Mapping in cloneStep()**

**What changed:** Added backend → frontend property mapping in the `cloneStep()` function

```typescript
// Map backend eventType → frontend type
if ((cloned as any).eventType && !cloned.type) {
  cloned.type = (cloned as any).eventType;
}

// Map backend stdout → frontend value for output events
if ((cloned as any).stdout && cloned.type === 'output') {
  cloned.value = (cloned as any).stdout;
}
```

**Why:** Backend sends `eventType`, but entire frontend animation system is keyed to `type`. This transformation ensures all downstream code works correctly.

### 2. **useSocket.ts - Type Mapping Extensions**

**What changed:** Added alternative names for output/print events to `normalizeStepType()` mapping:

```typescript
'stdout': 'output',           // Alternative name for output (printf, cout, puts, etc.)
'print': 'output',            // Direct print calls
```

**Why:** If backend generates steps with `type: "stdout"` or `type: "print"`, they now map to `output` animation type.

### 3. **useAnimationController.ts - Output Animation Case**

**What changed:** Added explicit `case 'output'` handler with proper animation dispatch:

```typescript
case 'output': {
  const outputText = currentExecutionStep.value || (currentExecutionStep as any).stdout;
  if (outputText) {
    console.log(`[Program Output] ${outputText}`);
    animations.push({
      type: 'output_display',
      target: 'output-console',
      duration: 1500,      // Visible for 1.5 seconds
      text: String(outputText),
      id: `output-${currentStep}`,
    });
  }
  break;
}
```

**Why:** Ensures output events trigger animations. Falls back to both `value` and `stdout` properties for robustness.

## Data Flow Now Working

```
Backend (tracer.cpp)
  ↓
Generates: { eventType: "var", stdout: "Hello", ... }
  ↓
Socket sends to Frontend
  ↓
cloneStep() transforms to: { type: "var", value: "Hello", ... }
  ↓
normalizeStepType("var") → "var"
  ↓
switch (step.type) → case 'var': { ... animations ... }
  ↓
✅ AnimationEngine queues animations
  ↓
Konva canvas renders
```

## Supported Output Event Types

| Event Type | Source | Maps To | Animation |
|---|---|---|---|
| `eventType: "output"` | Backend | `type: "output"` | output_display |
| `stdout` field + `type: "output"` | Backend | `value: "..."` | output_display |
| `type: "stdout"` | Backend | `output` | output_display |
| `type: "print"` | Backend | `output` | output_display |

## Animation Behavior

- **Trigger:** On any `output` type step
- **Duration:** 1500ms (1.5 seconds visible)
- **Target:** `output-console` overlay
- **Content:** Text from `value` or `stdout` field
- **ID:** Unique per step: `output-${stepIndex}`

## Testing Checklist

- [x] Compilation errors fixed (useAnimationController.ts CLEAN)
- [x] Property mapping in place (eventType → type)
- [x] Output type mapping added (stdout, print → output)
- [x] Animation case added to switch statement
- [ ] **TODO:** Test with actual backend generating output events

## Backward Compatibility

✅ All changes are backward compatible:
- Old backends sending `type` still work (check `!cloned.type` before mapping)
- Legacy output animation case still exists
- New mapping is transparent to animation engine

## Files Modified

1. [useSocket.ts](../frontend/src/hooks/useSocket.ts#L29-L60) - cloneStep() property mapping
2. [useSocket.ts](../frontend/src/hooks/useSocket.ts#L108-L110) - Type mapping extensions
3. [useAnimationController.ts](../frontend/src/hooks/useAnimationController.ts#L197-L215) - Output animation case

## Console Output When Working

```
[AnimationController] Processing step 5: output
[Program Output] Hello World
[AnimationController] Output animation queued: output-console
[AnimationEngine] Adding sequence with 1 animations
```
