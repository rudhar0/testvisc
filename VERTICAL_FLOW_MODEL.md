# Vertical Flow Execution Model - Implementation Guide

## 🎯 New Execution Model Overview

The canvas now uses a **TOP → BOTTOM vertical execution flow** instead of traditional stack-based UI.

### Key Principles:
1. **Main Function as Root Container** - Everything flows inside main()
2. **Vertical Flow** - Elements appear step-by-step, top to bottom
3. **Parent-Child Containment** - Every element renders inside a parent
4. **Global Panel (Right Side)** - Globals and outside functions rendered separately
5. **No Hidden Stack** - Clear visual hierarchy

---

## 🏗️ Architecture

### Core Components:

#### 1. VerticalFlowLayout (`frontend/src/canvas/managers/VerticalFlowLayout.ts`)
- Manages vertical positioning of elements
- Each parent maintains `cursorY` for next child
- Handles indentation for nested blocks
- Updates parent sizes automatically

#### 2. VerticalFlowRenderer (`frontend/src/canvas/renderers/VerticalFlowRenderer.ts`)
- Main renderer for vertical flow model
- Manages ProgramRoot, MainFunction, GlobalPanel
- Processes execution steps
- Handles deterministic state rebuilding

#### 3. Canvas Elements:
- **Output** - Green styling, shows stdout
- **Input** - Orange styling, shows scanf input requests
- **Variable** - Blue styling (existing)
- **Loop** - Container for iterations
- **Condition** - Container for branches
- Each element has unique design

---

## 📐 Layout System

### Vertical Flow Rules:
```
ProgramRoot (x: 40, y: 40)
├─ MainFunction (x: 60, y: 60, cursorY: 80)
│  ├─ Variable 1 (x: 80, y: 80)
│  ├─ Variable 2 (x: 80, y: 116)
│  ├─ Loop (x: 80, y: 152, cursorY: 172)
│  │  ├─ Iteration 1 (x: 100, y: 172)
│  │  └─ Iteration 2 (x: 100, y: 208)
│  └─ Output (x: 80, y: 244)
└─ GlobalPanel (x: 720, y: 40, cursorY: 60)
   ├─ Global Var 1 (x: 740, y: 60)
   └─ Global Function (x: 740, y: 116)
```

### Spacing:
- Element spacing: 16px
- Indentation: 20px per level
- Parent padding: 20px

---

## 🎨 Element Designs

### Output Element:
- **Color**: Green (#065f46 background, #10b981 border)
- **Icon**: Console/terminal icon
- **Text**: "Output: {value}"
- **Animation**: Fade in + scale

### Input Element:
- **Color**: Orange (#7c2d12 background, #f97316 border)
- **Icon**: Arrow pointing in
- **Text**: Shows prompt + "Waiting for input..." or entered value
- **Animation**: Fade in + scale, pulse on update

### Variable Element:
- **Color**: Blue (#1e293b background, #475569 border)
- **Design**: Name, value, type, address
- **Animation**: Fade in + scale

### Loop Element:
- **Color**: Purple (container)
- **Design**: Shows loop condition, contains iterations
- **Animation**: Expand container

### Condition Element:
- **Color**: Yellow (container)
- **Design**: Shows condition, contains branches
- **Animation**: Expand container

---

## 🔄 Execution Flow

### Normal Playback:
1. Step forward → Process step → Create/update element → Animate
2. Elements appear top-to-bottom inside main function
3. Parent containers expand to fit children

### Jump to Step:
1. Clear canvas (except root elements)
2. Rebuild from step 0 to target step (no animations)
3. Render final state

### Input Handling:
1. When `input_request` step is reached:
   - Create Input element in flow
   - Pause execution
   - Show InputDialog
2. User enters value → Submit
3. Update Input element → Send to backend → Resume

---

## 📝 Input Dialog System

### Features:
- Modal dialog overlay
- Type validation (int, float, char, string)
- Format display (%d, %f, %c, %s)
- Keyboard shortcuts (Enter to submit, Escape to cancel)
- Auto-focus on input field

### Integration:
- Triggered when `pauseExecution` flag is set
- Or when step type is `input_request`
- Input value sent via `socketService.provideInput()`

---

## 🎯 Code Editor Highlighting

### Fixed Issues:
- Added `inlineClassName` for proper styling
- Added `minimap` color indicators
- Added `overviewRuler` for scrollbar indicator
- Enhanced CSS with `!important` flags
- Fixed glyph margin arrow display

### Colors:
- **Current line**: Yellow (#fefcbf)
- **Executed lines**: Green (#dcfce7)
- **Arrow**: Yellow (#facc15)

---

## 🔧 Usage

### Creating Elements:
```typescript
const element = new Variable(id, parentId, layer, payload);
VerticalFlowLayout.place(element, parent);
parent.addChild(element);
await element.create(payload);
```

### Processing Steps:
```typescript
renderer.processStep(step, true); // true = animate
```

### Rebuilding Canvas:
```typescript
renderer.rebuildToStep(executionTrace, targetStep);
```

---

## 📦 Files Created/Modified

### New Files:
1. `frontend/src/canvas/managers/VerticalFlowLayout.ts`
2. `frontend/src/canvas/renderers/VerticalFlowRenderer.ts`
3. `frontend/src/canvas/elements/Output.ts`
4. `frontend/src/canvas/elements/Input.ts`
5. `frontend/src/components/canvas/InputDialog.tsx`

### Modified Files:
1. `frontend/src/components/canvas/VisualizationCanvas.tsx` - Uses new renderer
2. `frontend/src/canvas/core/CanvasElement.ts` - Added cursorY and indent
3. `frontend/src/components/editor/ExecutionHighlighter.tsx` - Fixed highlighting
4. `frontend/src/styles/globals.css` - Enhanced styles

---

## ✅ Features Implemented

- ✅ Vertical flow layout system
- ✅ Output element in flow
- ✅ Input element with dialog
- ✅ Parent-child containment
- ✅ Code editor line highlighting fixed
- ✅ Unique element designs
- ✅ Deterministic state rebuilding
- ✅ Input handling with backend integration

---

## 🚀 Next Steps

1. **Arrow System** - Visualize relationships (calls, accesses, references)
2. **Function Calls** - Render function bodies inside caller
3. **Loop Iterations** - Show each iteration sequentially
4. **Condition Branches** - Show true/false branches
5. **Global Panel** - Populate with globals and functions
6. **Animation Polish** - Smooth transitions and effects

---

## 🎓 Educational Benefits

- ✅ Clear top-to-bottom learning flow
- ✅ No abstract stack confusion
- ✅ Visual parent-child relationships
- ✅ Globals visually explained
- ✅ Perfect for education & interviews
- ✅ Scales to large programs

