# Frontend Structure & Function Reference

This document provides a detailed breakdown of the frontend codebase structure, including files, components, classes, and exported functions.

## Directory: `.`

Contains source files.

### App.tsx
- **Components**: `App`
- **Functions**: `handleBeforeUnload`

### gcc.service.js
- **Classes**: `GccService`

### main.tsx
- *(No top-level exports detected)*

### setupTests.ts
- *(No top-level exports detected)*

---

## Directory: `adapters`

Contains source files.

### stepTypeAdapter.ts
- **Functions**: `getAnimationAction, shouldAnimate, extractConditionResult, extractLoopIteration, isOutputStep, isInputStep, getAnimationMetadata`
- **Interfaces/Types**: `AnimationMetadata`

---

## Directory: `animations`

Contains source files.

### AnimationEngine.ts
- **Classes**: `AnimationEngine`

### AnimationQueue.ts
- **Classes**: `AnimationQueue`
- **Functions**: `checkComplete`

### SequenceManager.ts
- **Classes**: `SequenceManager`
- **Functions**: `sequenceTimeline`

### Timelines.ts
- **Functions**: `to, getLayerAndRedraw, createVariableAnimation, ticker, createVariableUpdateAnimation, createFunctionCallAnimation, createFunctionReturnAnimation, createLoopIterationAnimation, createMemoryAllocationAnimation, createArrayAccessAnimation, createElementDestroyAnimation, tl`

### Tweens.ts
- **Functions**: `variableCreateTween, variableUpdateTween, valueEl, functionCallTween, functionReturnTween, loopIterationTween, memoryAllocationTween, arrayAccessTween`

---

## Directory: `api`

API communication and external services.

### api.service.ts
- **Classes**: `APIService`

### socket.service.ts
- **Classes**: `SocketService`
- **Functions**: `forwardEvent, listeners`

---

## Directory: `canvas\core`

Core visualization canvas logic and elements.

### CanvasElement.ts
- **Classes**: `CanvasElement`
- **Interfaces/Types**: `LayoutInfo`

---

## Directory: `canvas\elements`

Core visualization canvas logic and elements.

### CanvasArray.ts
- **Classes**: `CanvasArray`
- **Functions**: `cellWidth`

### Class.ts
- **Classes**: `Class, this`

### Condition.ts
- **Classes**: `Condition`

### FunctionCall.ts
- **Classes**: `FunctionCall`

### GlobalFunction.ts
- **Classes**: `GlobalFunction`

### GlobalPanel.ts
- **Classes**: `GlobalPanel`

### Input.ts
- **Classes**: `Input`

### Loop.ts
- **Classes**: `Loop`

### MainFunction.ts
- **Classes**: `MainFunction`

### Output.ts
- **Classes**: `Output`

### Pointer.ts
- **Classes**: `Pointer`

### ProgramRoot.ts
- **Classes**: `ProgramRoot`

### Variable.ts
- **Classes**: `Variable`

---

## Directory: `canvas\managers`

Core visualization canvas logic and elements.

### ArrowManager.ts
- **Classes**: `ArrowManager`
- **Functions**: `arrow`
- **Interfaces/Types**: `ArrowConnection`

### CanvasStateManager.ts
- **Classes**: `CanvasStateManager`
- **Functions**: `elementToUpdate, main`
- **Interfaces/Types**: `CanvasState`

### LayoutManager.ts
- **Classes**: `VerticalFlowLayout`

### VerticalFlowLayout.ts
- **Classes**: `VerticalFlowLayout`
- **Functions**: `childrenHeight, maxChildY`
- **Interfaces/Types**: `LayoutInfo`

---

## Directory: `canvas\renderers`

Core visualization canvas logic and elements.

### VerticalFlowRenderer.test.ts
- *(No top-level exports detected)*

### VerticalFlowRenderer.ts
- **Classes**: `VerticalFlowRenderer`
- **Functions**: `is, frame`
- **Interfaces/Types**: `CanvasState`

---

## Directory: `components\canvas`

Core visualization canvas logic and elements.

### AstNode.tsx
- **Interfaces/Types**: `AstNodeProps`

### CanvasControls.tsx
- *(No top-level exports detected)*

### FlowArrows.tsx
- **Interfaces/Types**: `FlowArrowProps, FlowArrowsContainerProps`

### InputDialog.tsx
- **Functions**: `handleSubmit, handleKeyPress`
- **Interfaces/Types**: `InputDialogProps`

### VisualizationCanvas.tsx
- **Components**: `VisualizationCanvas`
- **Functions**: `getVarColor, executionTrace, currentStep, getCurrentStep, isAnalyzing, fullLayout, visibleLayout, filterChildren, filteredElements, filteredFunctionArrows, elementAnimationStates, prevElements, enterDelayMap, traverse, newElements, map, layer, zIndex, updateSize, targetPos, focusCandidates, stage, focusTarget, newArrows, timeout, handleZoomIn, handleZoomOut, handleFitToScreen, handleWheel, clampedScale, handleKeyDown, handleInputRequired, handleInputSubmit, inputElements, varGroups, name, renderElement, next`

### types.ts
- **Functions**: `types`
- **Interfaces/Types**: `CanvasTransform, VariableData, StackFrameData, ArrayData, ArrayCell, PointerArrowData, HeapBlockData, OutputData, LoopIndicatorData, FunctionParameter, FunctionData, FunctionCallArrowData, LayoutResult`

---

## Directory: `components\canvas\animations`

Core visualization canvas logic and elements.

### AnimationEngine.ts
- **Classes**: `AnimationEngine`
- **Functions**: `timeline`

### VariableAnimationController.tsx
- **Classes**: `VariableAnimationController`
- **Functions**: `easing, duration, useVariableAnimation, previousAnimation`
- **Interfaces/Types**: `VariableAnimationConfig`

### animationPresets.ts
- *(No top-level exports detected)*

### usePointerAnimation.ts
- *(No top-level exports detected)*

### useStackAnimation.ts
- *(No top-level exports detected)*

### useVariableAnimation.ts
- *(No top-level exports detected)*

---

## Directory: `components\canvas\elements`

Core visualization canvas logic and elements.

### ArrayBox.tsx
- **Functions**: `totalSize, normalizedValues, getValueAt, isCellUpdated, render1DGrid, render2DGrid, render3DGrid`
- **Interfaces/Types**: `ArrayBoxProps`

### ArrayCell.tsx
- **Functions**: `getTypeColor, formatValue, totalHeight`
- **Interfaces/Types**: `ArrayCellProps`

### ArrayPanel.tsx
- **Functions**: `calculateArrayBoxSize, renderedArrays`
- **Interfaces/Types**: `ArrayData, ArrayPanelProps`

### ArrayReference.tsx
- **Functions**: `calculatePoints`
- **Interfaces/Types**: `ArrayReferenceProps`

### AstNode.tsx
- **Functions**: `to, signature, getNodeTextAndStyle, rectRef, activeCallFrame, renderNodeContent`
- **Interfaces/Types**: `AstNodeProps`

### CallElement.tsx
- **Components**: `CORNER_RADIUS`
- **Interfaces/Types**: `CallElementProps`

### ClassView.tsx
- **Functions**: `groupRef`
- **Interfaces/Types**: `ClassViewProps`

### ConditionalContainer.tsx
- **Interfaces/Types**: `ConditionalContainerProps`

### FunctionCallArrow.tsx
- **Functions**: `calculateCurvedPoints, color, arrow`
- **Interfaces/Types**: `FunctionCallArrowProps`

### FunctionElement.tsx
- **Functions**: `playAnim, t, pulse`
- **Interfaces/Types**: `Parameter, FunctionElementProps`

### HeapBlock.tsx
- **Functions**: `groupRef`
- **Interfaces/Types**: `HeapBlockProps`

### HeapPointerElement.tsx
- **Functions**: `formatValue, totalHeight, playAnim, t, timer, mainBg, handleMouseEnter, handleMouseLeave`
- **Interfaces/Types**: `HeapPointerElementProps`

### InputElement.tsx
- **Functions**: `groupRef`
- **Interfaces/Types**: `InputElementProps`

### LoopContainer.tsx
- **Interfaces/Types**: `LoopContainerProps`

### LoopIndicator.tsx
- **Functions**: `anim`
- **Interfaces/Types**: `LoopIndicatorProps`

### OutputElement.tsx
- **Functions**: `timer, mainBg`
- **Interfaces/Types**: `OutputElementProps`

### PointerArrow.tsx
- **Functions**: `groupRef`
- **Interfaces/Types**: `PointerArrowProps`

### ReturnElement.tsx
- **Functions**: `displayValue, playAnim, t, timer, explBg`
- **Interfaces/Types**: `ReturnElementProps`

### SmoothUpdateArrow.tsx
- **Functions**: `calculateCurvedPath, pulseAnim, fadeOutAnim`
- **Interfaces/Types**: `SmoothUpdateArrowProps`

### StackFrame.tsx
- **Functions**: `groupRef`
- **Interfaces/Types**: `StackFrameProps`

### StructView.tsx
- **Functions**: `groupRef`
- **Interfaces/Types**: `StructViewProps`

### VariableBox.tsx
- **Functions**: `normalizeType, formatValue, totalHeight, playAnim, t, timer, mainBg, handleMouseEnter, handleMouseLeave`
- **Interfaces/Types**: `VariableBoxProps`

---

## Directory: `components\canvas\hooks`

Custom React hooks.

### useAutoLayout.ts
- *(No top-level exports detected)*

### useCanvasSize.ts
- *(No top-level exports detected)*

### useCanvasTransform.ts
- *(No top-level exports detected)*

---

## Directory: `components\canvas\layout`

Core visualization canvas logic and elements.

### CanvasTransform.ts
- *(No top-level exports detected)*

### LayoutEngine.ts
- **Classes**: `ProgressiveArrayTracker, LayoutEngine`
- **Functions**: `return, exit, call, info, frames, getIndentSize, totalSize, valuesMap, dimensions, arrayRefVars, CELL_HEIGHT, array, updateHeight`
- **Interfaces/Types**: `LayoutElement, LaneState, Layout, ArrayTrackerData`

---

## Directory: `components\controls`

UI Components and views.

### PlaybackControls.tsx
- **Components**: `PlaybackControls`

### ProgressBar.tsx
- *(No top-level exports detected)*

### SpeedControl.tsx
- **Components**: `SpeedControl`

### StepInfo.tsx
- **Components**: `StepInfo`
- **Functions**: `getStepColor`

### TimelineScrubber.tsx
- **Components**: `TimelineScrubber`
- **Functions**: `handleValueChange`

---

## Directory: `components\editor`

UI Components and views.

### CodeEditor.tsx
- **Functions**: `code, language, setCode, currentLine, handleEditorChange`

### EditorToolbar.tsx
- *(No top-level exports detected)*

### ErrorDisplay.tsx
- *(No top-level exports detected)*

### ExecutionHighlighter.tsx
- **Functions**: `last5LinesRef, currentExecutingLine`
- **Interfaces/Types**: `ExecutionHighlighterProps`

### FileLoader.tsx
- **Components**: `FileLoader`
- **Functions**: `handleFileOpen`

### LanguageIndicator.tsx
- *(No top-level exports detected)*

---

## Directory: `components\layout`

UI Components and views.

### CanvasPanel.tsx
- **Components**: `CanvasPanel`

### ControlBar.tsx
- **Components**: `ControlBar`

### EditorPanel.tsx
- **Components**: `EditorPanel`

### MainLayout.tsx
- **Components**: `MainLayout`

### Sidebar.tsx
- **Components**: `Sidebar`

### StatusBar.tsx
- *(No top-level exports detected)*

### TopBar.tsx
- **Components**: `TopBar`
- **Functions**: `handleRun`

---

## Directory: `components\memory`

UI Components and views.

### MemoryCanvas.tsx
- *(No top-level exports detected)*

### MemoryCell.tsx
- **Interfaces/Types**: `MemoryCellProps`

### MemoryRegion.tsx
- **Interfaces/Types**: `MemoryRegionProps`

---

## Directory: `components\modals`

UI Components and views.

### ErrorModal.tsx
- *(No top-level exports detected)*

### GCCDownloadModal.tsx
- *(No top-level exports detected)*

### InputDialog.tsx
- **Functions**: `handleInputChange, handleSubmit`

### InputPromptModal.tsx
- **Components**: `InputPromptModal`
- **Functions**: `handleSubmit, handleKeyPress`

### SettingsModal.tsx
- *(No top-level exports detected)*

---

## Directory: `components\sidebar`

UI Components and views.

### AnimationEngine.ts
- **Classes**: `AnimationEngine`
- **Functions**: `loop`

### FileExplorer.tsx
- *(No top-level exports detected)*

### FunctionFrame.tsx
- **Interfaces/Types**: `FunctionFrameProps`

### KonvaWrapper.tsx
- **Components**: `KonvaWrapper`
- **Functions**: `elements`

### MemoryInspector.tsx
- *(No top-level exports detected)*

### PointerArrow.tsx
- **Interfaces/Types**: `PointerArrowProps`

### RenderRegistry.ts
- **Classes**: `RenderRegistry`
- **Functions**: `step, frames, MAX_VARS_PER_ROW, frameWidth`
- **Interfaces/Types**: `VisualElement`

### SceneManager.tsx
- **Components**: `SceneManager`
- **Functions**: `elements`

### SidebarTabs.tsx
- *(No top-level exports detected)*

### StepController.ts
- **Functions**: `useStepController, nextStep, prevStep, togglePlay`
- **Interfaces/Types**: `StepControllerProps`

### SymbolNavigator.test.tsx
- *(No top-level exports detected)*

### SymbolNavigator.tsx
- **Components**: `SymbolNavigator`
- **Functions**: `formattedGlobals, traceFunctions, toggleSection, handleSymbolClick`

### VariableBox.tsx
- **Interfaces/Types**: `VariableBoxProps`

### VariableLifetime.test.tsx
- *(No top-level exports detected)*

### VariableLifetime.tsx
- **Components**: `VariableLifetime`

### animateStep.ts
- **Functions**: `animateStepChange, tween`

### highlight.ts
- **Functions**: `highlightNode, tween`

### index.ts
- *(No top-level exports detected)*

### useStageSize.ts
- **Functions**: `useStageSize, updateSize, observer`

---

## Directory: `components\ui`

UI Components and views.

### Button.tsx
- **Interfaces/Types**: `ButtonProps`

### Dialog.tsx
- **Components**: `DialogContext`
- **Interfaces/Types**: `DialogContextType, DialogProps, DialogContentProps`

### Input.tsx
- **Interfaces/Types**: `InputProps`

### Select.tsx
- *(No top-level exports detected)*

### Slider.tsx
- *(No top-level exports detected)*

### Spinner.tsx
- *(No top-level exports detected)*

### Tabs.tsx
- *(No top-level exports detected)*

### Tooltip.tsx
- *(No top-level exports detected)*

---

## Directory: `config`

Contains source files.

### api.config.ts
- *(No top-level exports detected)*

### app.config.ts
- *(No top-level exports detected)*

### canvas.config.ts
- *(No top-level exports detected)*

### editor.config.ts
- *(No top-level exports detected)*

### socket.config.ts
- *(No top-level exports detected)*

### theme.config.ts
- **Functions**: `getColor, withOpacity`

---

## Directory: `constants`

Contains source files.

### colors.ts
- *(No top-level exports detected)*

### durations.ts
- *(No top-level exports detected)*

### events.ts
- *(No top-level exports detected)*

### index.ts
- *(No top-level exports detected)*

### limits.ts
- *(No top-level exports detected)*

### sizes.ts
- *(No top-level exports detected)*

---

## Directory: `hooks`

Custom React hooks.

### AnimationEngine.ts
- **Classes**: `AnimationEngine`
- **Functions**: `currentSequence`

### useAnimationController.ts
- **Functions**: `findVarInState, useAnimationController, currentStep, executionTrace`

### useAst.ts
- **Functions**: `useAst`

### useCanvas.ts
- *(No top-level exports detected)*

### useChunkLoader.ts
- **Functions**: `useChunkLoader`

### useCodeEditor.ts
- **Functions**: `useCodeEditor, handleEditorDidMount`

### useDebugSession.ts
- **Functions**: `useDebugSession, sendCode`

### useEventBus.ts
- *(No top-level exports detected)*

### useExecutionAst.ts
- **Functions**: `useExecutionAst, currentStep, findNode`

### useExecutionTrace.ts
- **Functions**: `useExecutionTrace, handleTraceProgress, handleTraceChunk, seenGlobals, globals, handleTraceComplete, handleTraceError`

### useFileLoader.ts
- *(No top-level exports detected)*

### useGCCStatus.ts
- *(No top-level exports detected)*

### useInputHandler.ts
- **Functions**: `useInputHandler, validateInput, submitValues, inputValues, cancelInput`

### useSocket.ts
- **Functions**: `useSocket, calculateFlatIndex, cloneStep, normalizeStepType, normalizeCallStack, normalizeLocals, connect, disconnect, errorMessage, totalSize, validSteps, generateTrace, requestGCCStatus`
- **Interfaces/Types**: `ArrayState`

---

## Directory: `services`

API communication and external services.

### api.service.ts
- *(No top-level exports detected)*

### ast.service.ts
- **Classes**: `AstService`

### chunk-manager.ts
- **Classes**: `ChunkManager`

### crypto-helper.ts
- **Functions**: `deriveKey, decryptAndDecompressChunk, base64ToUint8Array, concatUint8Arrays`

### file.service.ts
- *(No top-level exports detected)*

### protocol-adapter.ts
- **Classes**: `ProtocolAdapter`
- **Interfaces/Types**: `for`

### socket.service.ts
- *(No top-level exports detected)*

### storage.service.ts
- *(No top-level exports detected)*

---

## Directory: `store`

Redux state management slices and store configuration.

### debugSlice.ts
- **Interfaces/Types**: `DebugState`

### index.ts
- *(No top-level exports detected)*

---

## Directory: `store\selectors`

Redux state management slices and store configuration.

### canvasSelectors.ts
- *(No top-level exports detected)*

### executionSelectors.ts
- *(No top-level exports detected)*

---

## Directory: `store\slices`

Redux state management slices and store configuration.

### canvasSlice.ts
- **Functions**: `useCanvasStore`
- **Interfaces/Types**: `CanvasState`

### editorSlice.ts
- **Functions**: `detectLanguageFromCode, useEditorStore`
- **Interfaces/Types**: `EditorState, EditorError, EditorWarning`

### executionSlice.ts
- **Functions**: `useExecutionStore, state`
- **Interfaces/Types**: `ExecutionState`

### gccSlice.ts
- **Functions**: `useGCCStore`
- **Interfaces/Types**: `GCCState`

### inputSlice.ts
- **Functions**: `useInputStore`
- **Interfaces/Types**: `MultiInputRequest, InputState`

### uiSlice.ts
- **Classes**: `for`
- **Functions**: `useUIStore`
- **Interfaces/Types**: `UIState`

---

## Directory: `types`

TypeScript type definitions.

### animation.types.ts
- **Interfaces/Types**: `BaseAnimation, VariableCreateAnimation, VariableUpdateAnimation, LineExecutionAnimation, VariableAccessAnimation, FunctionCallAnimation, FunctionReturnAnimation, LoopIterationAnimation, MemoryAllocationAnimation, ArrayAccessAnimation, ElementDestroyAnimation, for`

### canvas.types.ts
- *(No top-level exports detected)*

### element.types.ts
- **Classes**: `ElementTypeDetector`
- **Functions**: `declaration, subtype, is`
- **Interfaces/Types**: `ElementMetadata`

### execution.types.ts
- **Interfaces/Types**: `ClassInfo, MemberVariable, Variable, StackFrame, MemoryState, ExecutionStep, GlobalVariable, FunctionInfo, TraceMetadata, ExecutionTrace, InputRequest`

### index.ts
- **Classes**: `objects`
- **Interfaces/Types**: `ExecutionStep, ExecutionTrace, ClassInfo, ClassMember, MemoryState, Variable, GlobalVariable, StackFrame, CallFrame, HeapBlock, ArrayVariable, ArrayCell, PointerVariable, AnimationConfig, InputRequest, FunctionInfo, Parameter, Symbol, CanvasPosition, CanvasViewport, UIState, GCCStatus`

### memory.types.ts
- **Interfaces/Types**: `MemoryRegionData, MemoryCellData`

### socket.types.ts
- *(No top-level exports detected)*

---

## Directory: `utils`

Utility functions and helpers.

### animations.ts
- *(No top-level exports detected)*

### arrayUtils.ts
- **Functions**: `isArray, extractDimensions, matches, extractBaseType, createArrayInfo, totalSize, flattenArray, flatten, inferDimensions, flatIndexToMulti, multiIndexToFlat, detectUpdatedIndices, isArrayReference, getReferencedArrayName, matchedArray`
- **Interfaces/Types**: `ArrayInfo`

### camera.ts
- **Functions**: `getFocusPosition`

### colors.ts
- *(No top-level exports detected)*

### eventBus.ts
- *(No top-level exports detected)*

### formatters.ts
- *(No top-level exports detected)*

### helpers.ts
- *(No top-level exports detected)*

### layout.ts
- *(No top-level exports detected)*

### traceDecompressor.ts
- **Classes**: `TraceDecompressor`
- **Functions**: `sortedChunks, allSteps`

### validators.ts
- *(No top-level exports detected)*

### variableProcessor.ts
- **Classes**: `VariableProcessor`
- **Functions**: `varDeclarations, lowerType`
- **Interfaces/Types**: `ProcessedVariable`

### variableSystem.test.ts
- **Functions**: `result, step3, step5, createTestExecutionTrace`

---

