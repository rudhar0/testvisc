// import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
// import { Stage, Layer, Group, Rect, Line, Text } from 'react-konva';
// import Konva from 'konva';
// import { ZoomIn, ZoomOut, Maximize2, Move, Hand } from 'lucide-react';
// import { useExecutionStore } from '@store/slices/executionSlice';
// import { useCanvasStore } from '@store/slices/canvasSlice';

// // Import element components
// import { VariableBox } from './elements/VariableBox';
// import { ArrayView } from './elements/ArrayView';
// import { StackFrame } from './elements/StackFrame';
// import { OutputElement } from './elements/OutputElement';
// import { InputElement } from './elements/InputElement';
// import { LayoutEngine, LayoutElement } from './layout/LayoutEngine';
// import { InputDialog } from './InputDialog';
// import { socketService } from '../../api/socket.service';

// const COLORS = {
//   bg: '#0F172A',
//   grid: '#1E293B',
//   mainBorder: '#A855F7',
//   globalBorder: '#2DD4BF',
// };

// export default function VisualizationCanvas() {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const stageRef = useRef<Konva.Stage>(null);

//   // Store selectors
//   const executionTrace = useExecutionStore((state) => state.executionTrace);
//   const currentStep = useExecutionStore((state) => state.currentStep);
//   const getCurrentStep = useExecutionStore((state) => state.getCurrentStep);
//   const isAnalyzing = useExecutionStore((state) => state.isAnalyzing);

//   const { setCanvasSize, zoom, setZoom, position, setPosition } = useCanvasStore();

//   // Local state
//   const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
//   const [dragMode, setDragMode] = useState(false);
//   const [inputDialogOpen, setInputDialogOpen] = useState(false);
//   const [inputDialogProps, setInputDialogProps] = useState<any>(null);
//   const prevLayoutRef = useRef<LayoutElement[] | null>(null);

//   const currentStepData = getCurrentStep();
//   const state = currentStepData?.state;

//   // Calculate layout
//   const layout = useMemo(() => {
//     if (!state || executionTrace.length === 0) return null;
    
//     const newLayout = LayoutEngine.calculateLayout(
//       executionTrace,
//       currentStep,
//       dimensions.width,
//       dimensions.height,
//       prevLayoutRef.current ? { elements: prevLayoutRef.current } as any : null
//     );
    
//     return newLayout;
//   }, [state, currentStep, executionTrace, dimensions.width, dimensions.height]);

//   // Track which elements are new/updated for animations
//   const elementStates = useMemo(() => {
//     if (!layout) {
//       return new Map<string, { isNew: boolean; isUpdated: boolean }>();
//     }

//     const states = new Map<string, { isNew: boolean; isUpdated: boolean }>();
    
//     if (prevLayoutRef.current) {
//       const prevElements = new Map(prevLayoutRef.current.map(el => [el.id, el]));

//       layout.elements.forEach(element => {
//         const prev = prevElements.get(element.id);
//         states.set(element.id, {
//           isNew: !prev,
//           isUpdated: prev ? JSON.stringify(prev.data) !== JSON.stringify(element.data) : false,
//         });
//       });
//     } else {
//       // First render - all elements are new
//       layout.elements.forEach(element => {
//         states.set(element.id, {
//           isNew: true,
//           isUpdated: false,
//         });
//       });
//     }

//     return states;
//   }, [layout, currentStep]);

//   // Update prevLayout after render (use a ref to avoid dependency issues)
//   useEffect(() => {
//     if (layout) {
//       // Deep clone to avoid reference issues
//       prevLayoutRef.current = layout.elements.map(el => ({
//         ...el,
//         data: el.data ? JSON.parse(JSON.stringify(el.data)) : undefined,
//       }));
//     }
//   }, [layout, currentStep]);

//   // Responsive sizing
//   useEffect(() => {
//     const updateSize = () => {
//       if (containerRef.current) {
//         const { width, height } = containerRef.current.getBoundingClientRect();
//         setDimensions({ width, height });
//         setCanvasSize(width, height);
//       }
//     };

//     updateSize();
//     // Observe container size changes (e.g. Allotment pane resize) in addition to window resize
//     const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
//     if (ro && containerRef.current) ro.observe(containerRef.current);
//     window.addEventListener('resize', updateSize);
//     return () => {
//       window.removeEventListener('resize', updateSize);
//       if (ro) ro.disconnect();
//     };
//   }, [setCanvasSize]);

//   // Center canvas initially when layout changes
//   useEffect(() => {
//     if (layout && stageRef.current && dimensions.width > 0 && dimensions.height > 0) {
//       // Calculate bounding box of all content
//       const allElements = [layout.mainFunction, layout.globalPanel, ...layout.elements];
//       let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
//       allElements.forEach(el => {
//         if (el) {
//           minX = Math.min(minX, el.x);
//           minY = Math.min(minY, el.y);
//           maxX = Math.max(maxX, el.x + el.width);
//           maxY = Math.max(maxY, el.y + el.height);
//         }
//       });
      
//       // If no elements, center on main function
//       if (minX === Infinity) {
//         minX = layout.mainFunction.x;
//         minY = layout.mainFunction.y;
//         maxX = layout.mainFunction.x + layout.mainFunction.width;
//         maxY = layout.mainFunction.y + layout.mainFunction.height;
//       }
      
//       const contentWidth = maxX - minX;
//       const contentHeight = maxY - minY;
      
//       // Center with current zoom (default to 1)
//       const currentZoom = zoom || 1;
//       const centerX = (dimensions.width / 2) - (minX + contentWidth / 2) * currentZoom;
//       const centerY = (dimensions.height / 2) - (minY + contentHeight / 2) * currentZoom;
      
//       setPosition({ x: centerX, y: centerY });
      
//       // Reset zoom to 1 if it's not already (for better initial visibility)
//       if (currentZoom !== 1) {
//         setZoom(1);
//       }
      
//       console.log('[VisualizationCanvas] Centering canvas:', { 
//         centerX, 
//         centerY, 
//         contentWidth, 
//         contentHeight, 
//         zoom: currentZoom,
//         mainHeight: layout.mainFunction.height 
//       });
//     }
//   }, [layout?.mainFunction?.height, dimensions.width, dimensions.height, zoom, setPosition, setZoom]);

//   // Zoom & Pan controls
//   const handleZoomIn = useCallback(() => {
//     setZoom(Math.min(zoom + 0.1, 3));
//   }, [zoom, setZoom]);

//   const handleZoomOut = useCallback(() => {
//     setZoom(Math.max(zoom - 0.1, 0.3));
//   }, [zoom, setZoom]);

//   const handleFitToScreen = useCallback(() => {
//     setZoom(1);
//     setPosition({ x: 0, y: 0 });
//   }, [setZoom, setPosition]);

//   const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
//     e.evt.preventDefault();
//     const stage = stageRef.current;
//     if (!stage) return;

//     const oldScale = stage.scaleX();
//     const pointer = stage.getPointerPosition();
//     if (!pointer) return;

//     const mousePointTo = {
//       x: (pointer.x - stage.x()) / oldScale,
//       y: (pointer.y - stage.y()) / oldScale,
//     };

//     const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
//     const clampedScale = Math.max(0.1, Math.min(newScale, 5));

//     setZoom(clampedScale);
//     setPosition({
//       x: pointer.x - mousePointTo.x * clampedScale,
//       y: pointer.y - mousePointTo.y * clampedScale,
//     });
//   }, [setZoom, setPosition]);

//   // Keyboard shortcuts
//   useEffect(() => {
//     const handleKeyDown = (e: KeyboardEvent) => {
//       if (e.key === ' ') {
//         e.preventDefault();
//         setDragMode(!dragMode);
//       } else if (e.key === '+' || e.key === '=') {
//         handleZoomIn();
//       } else if (e.key === '-' || e.key === '_') {
//         handleZoomOut();
//       } else if (e.key === '0') {
//         handleFitToScreen();
//       }
//     };

//     window.addEventListener('keydown', handleKeyDown);
//     return () => window.removeEventListener('keydown', handleKeyDown);
//   }, [dragMode, handleZoomIn, handleZoomOut, handleFitToScreen]);

//   // Listen for input required (during analysis/trace generation)
//   useEffect(() => {
//     const handleInputRequired = (data: any) => {
//       console.log('[VisualizationCanvas] Input required during analysis:', data);
//       // Pause analysis while waiting for input
//       useExecutionStore.getState().pause();
      
//       setInputDialogProps({
//         prompt: data.prompt || `Enter value for ${data.varName || 'variable'}:`,
//         format: data.format || '%d',
//         expectedType: data.type || 'int',
//         varName: data.varName,
//         line: data.line,
//         isAnalysis: isAnalyzing, // Mark that this is during analysis
//       });
//       setInputDialogOpen(true);
//     };

//     socketService.on('execution:input_required', handleInputRequired);
//     return () => {
//       socketService.off('execution:input_required', handleInputRequired);
//     };
//   }, [isAnalyzing]);

//   // Handle input submission
//   const handleInputSubmit = (value: string | number) => {
//     console.log('[VisualizationCanvas] Submitting input:', value);
    
//     // Send input to backend - this will continue trace generation
//     socketService.provideInput(value);
    
//     // Update the input element in the layout if it exists
//     if (layout) {
//       const inputElements = layout.elements.filter(el => el.type === 'input' && el.data?.isWaiting);
//       inputElements.forEach(inputEl => {
//         inputEl.data = {
//           ...inputEl.data,
//           value: value,
//           isWaiting: false,
//         };
//       });
      
//       // Also update in main function children
//       if (layout.mainFunction?.children) {
//         layout.mainFunction.children.forEach(child => {
//           if (child.type === 'input' && child.data?.isWaiting) {
//             child.data = {
//               ...child.data,
//               value: value,
//               isWaiting: false,
//             };
//           }
//         });
//       }
//     }
    
//     setInputDialogOpen(false);
//     setInputDialogProps(null);
    
//     // Backend will continue trace generation automatically after receiving input
//     console.log('[VisualizationCanvas] Input provided, backend will continue trace generation');
//   };

//   // Render element based on type
//   const renderElement = (element: LayoutElement) => {
//     const { type, data, id, x, y, width, height, children, stepId } = element;
//     const elementState = elementStates.get(id) || { isNew: stepId === currentStep, isUpdated: false };
//     const { isNew, isUpdated } = elementState;
    
//     // Debug logging for main function children
//     if (type === 'main' && children) {
//       console.log(`[VisualizationCanvas] Rendering main function with ${children.length} children:`, 
//         children.map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y }))
//       );
//     }

//     switch (type) {
//       case 'main':
//         return (
//           <StackFrame
//             key={id}
//             id={id}
//             functionName="main()"
//             x={x}
//             y={y}
//             width={width}
//             height={height}
//             isNew={isNew}
//           >
//             {children?.map((child) => {
//               // Position children relative to parent (accounting for header height of 40)
//               const relativeX = child.x - x;
//               const relativeY = child.y - y - 40; // 40 is header height
//               console.log(`[VisualizationCanvas] Rendering child ${child.id}:`, {
//                 childX: child.x,
//                 childY: child.y,
//                 parentX: x,
//                 parentY: y,
//                 relativeX,
//                 relativeY,
//                 childType: child.type
//               });
//               return (
//                 <Group key={child.id} x={relativeX} y={relativeY}>
//                   {renderElement(child)}
//                 </Group>
//               );
//             })}
//           </StackFrame>
//         );

//       case 'variable':
//         return (
//           <VariableBox
//             key={id}
//             id={id}
//             name={data?.name || ''}
//             type={data?.type || data?.primitive || 'int'}
//             value={data?.value}
//             address={data?.address || ''}
//             x={0}
//             y={0}
//             width={width}
//             height={height}
//             section="stack"
//             isNew={isNew}
//             isUpdated={isUpdated}
//           />
//         );

//       case 'array':
//         return (
//           <ArrayView
//             key={id}
//             id={id}
//             name={data?.name || ''}
//             type={data?.type || 'int'}
//             values={data?.values || []}
//             address={data?.address || ''}
//             x={0}
//             y={0}
//             width={width}
//             height={height}
//             isNew={isNew}
//             isUpdated={isUpdated}
//           />
//         );

//       case 'output':
//         return (
//           <OutputElement
//             key={id}
//             id={id}
//             value={data?.value || ''}
//             x={0}
//             y={0}
//             width={width}
//             height={height}
//             isNew={isNew}
//             subtype={element.subtype as any}
//           />
//         );

//       case 'input':
//         return (
//           <InputElement
//             key={id}
//             id={id}
//             value={data?.value}
//             prompt={data?.prompt}
//             format={data?.format}
//             varName={data?.varName || data?.variables?.[0]}
//             x={0}
//             y={0}
//             width={width}
//             height={height}
//             isNew={isNew}
//             isWaiting={!data?.value}
//           />
//         );

//       case 'global':
//         return (
//           <VariableBox
//             key={id}
//             id={id}
//             name={data?.name || ''}
//             type={data?.type || data?.primitive || 'int'}
//             value={data?.value}
//             address={data?.address || ''}
//             x={0}
//             y={0}
//             width={width}
//             height={height}
//             section="global"
//             isNew={isNew}
//             isUpdated={isUpdated}
//           />
//         );

//       case 'function':
//         return (
//           <StackFrame
//             key={id}
//             id={id}
//             functionName={data?.function || 'function()'}
//             x={0}
//             y={0}
//             width={width}
//             height={height}
//             isNew={isNew}
//           >
//             {children?.map((child) => {
//               const relativeX = child.x - x;
//               const relativeY = child.y - y - 40;
//               return (
//                 <Group key={child.id} x={relativeX} y={relativeY}>
//                   {renderElement(child)}
//                 </Group>
//               );
//             })}
//           </StackFrame>
//         );

//       case 'loop':
//         return (
//           <Group key={id} x={0} y={0}>
//             <Rect
//               width={width}
//               height={height}
//               fill="#1E293B"
//               stroke="#F59E0B"
//               strokeWidth={2}
//               cornerRadius={8}
//             />
//             <Text
//               text={`Loop: ${data?.condition || data?.explanation || 'for/while'}`}
//               x={12}
//               y={20}
//               fontSize={14}
//               fill="#F1F5F9"
//               fontFamily="monospace"
//             />
//             {children?.map((child) => {
//               const relativeX = child.x - x;
//               const relativeY = child.y - y;
//               return (
//                 <Group key={child.id} x={relativeX} y={relativeY}>
//                   {renderElement(child)}
//                 </Group>
//               );
//             })}
//           </Group>
//         );

//       case 'condition':
//         return (
//           <Group key={id} x={0} y={0}>
//             <Rect
//               width={width}
//               height={height}
//               fill="#1E293B"
//               stroke="#8B5CF6"
//               strokeWidth={2}
//               cornerRadius={8}
//             />
//             <Text
//               text={`Condition: ${data?.explanation || 'if/else'}`}
//               x={12}
//               y={20}
//               fontSize={14}
//               fill="#F1F5F9"
//               fontFamily="monospace"
//             />
//             {children?.map((child) => {
//               const relativeX = child.x - x;
//               const relativeY = child.y - y;
//               return (
//                 <Group key={child.id} x={relativeX} y={relativeY}>
//                   {renderElement(child)}
//                 </Group>
//               );
//             })}
//           </Group>
//         );

//       default:
//         return null;
//     }
//   };

//   if (!state || !layout) {
//     return (
//       <div
//         ref={containerRef}
//         style={{
//       width: '100%',
//       height: '100%',
//       display: 'flex',
//       alignItems: 'center',
//       justifyContent: 'center',
//           backgroundColor: COLORS.bg,
//       color: '#94A3B8',
//       fontFamily: 'system-ui'
//         }}
//       >
//       <div style={{ textAlign: 'center' }}>
//         <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>ðŸŽ¨</div>
//         <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#F1F5F9' }}>
//             Responsive Canvas Ready
//         </div>
//         <div style={{ fontSize: '14px', color: '#64748B' }}>
//             Run your code to see animated visualization
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <>
//       <div
//         ref={containerRef}
//         style={{
//           width: '100%',
//           height: '100%',
//           backgroundColor: COLORS.bg,
//           position: 'relative',
//           overflow: 'hidden'
//         }}
//       >
//         {/* Controls */}
//         <div style={{ 
//           position: 'absolute',
//           top: 16,
//           right: 16,
//           zIndex: 100,
//           display: 'flex',
//           gap: '8px',
//           backgroundColor: '#1E293B',
//           padding: '10px',
//           borderRadius: '10px',
//           boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
//           border: '1px solid #334155'
//         }}>
//           <button
//             onClick={() => setDragMode(!dragMode)}
//             style={{
//               padding: '8px 12px',
//               backgroundColor: dragMode ? '#3B82F6' : '#334155',
//               border: 'none',
//               borderRadius: '6px',
//               color: '#F1F5F9',
//               cursor: 'pointer',
//               display: 'flex',
//               alignItems: 'center',
//               gap: '6px',
//             fontSize: '12px', 
//               fontWeight: 600,
//               transition: 'all 0.2s'
//             }}
//             title="Pan Mode (Space)"
//           >
//             {dragMode ? <Hand size={16} /> : <Move size={16} />}
//             {dragMode ? 'Pan' : 'Select'}
//           </button>

//           <button onClick={handleZoomIn} title="Zoom In (+)">
//             <ZoomIn size={20} color="#F1F5F9" />
//           </button>
//           <button onClick={handleZoomOut} title="Zoom Out (-)">
//             <ZoomOut size={20} color="#F1F5F9" />
//           </button>
//           <button onClick={handleFitToScreen} title="Fit to Screen (0)">
//             <Maximize2 size={20} color="#F1F5F9" />
//           </button>
//         </div>

//         {/* Canvas */}
//         {dimensions.width > 0 && dimensions.height > 0 && (
//           <Stage
//             ref={stageRef}
//             width={dimensions.width}
//             height={dimensions.height}
//             onWheel={handleWheel}
//             scaleX={zoom}
//             scaleY={zoom}
//             x={position.x}
//             y={position.y}
//             draggable={dragMode}
//             onDragMove={(e) => {
//               setPosition({
//                 x: e.target.x(),
//                 y: e.target.y(),
//               });
//             }}
//             onDragEnd={(e) => {
//               setPosition({
//                 x: e.target.x(),
//                 y: e.target.y(),
//               });
//             }}
//           >
//             <Layer>
//               {/* Grid */}
//               <Group>
//                 {Array.from({ length: Math.floor(dimensions.width / 20) }).map((_, i) => (
//                   <Line
//                     key={`v-grid-${i}`}
//                     points={[i * 20, 0, i * 20, dimensions.height]}
//                     stroke={COLORS.grid}
//                     strokeWidth={0.5}
//                   />
//                 ))}
//                 {Array.from({ length: Math.floor(dimensions.height / 20) }).map((_, i) => (
//                   <Line
//                     key={`h-grid-${i}`}
//                     points={[0, i * 20, dimensions.width, i * 20]}
//                     stroke={COLORS.grid}
//                     strokeWidth={0.5}
//                   />
//                 ))}
//               </Group>

//               {/* Main Function Container */}
//               {layout.mainFunction && (
//                 <Group x={0} y={0}>
//                   {renderElement(layout.mainFunction)}
//                 </Group>
//               )}

//               {/* Global Panel */}
//               {layout.globalPanel && (
//                 <Group x={0} y={0}>
//                   <Rect
//                     x={layout.globalPanel.x}
//                     y={layout.globalPanel.y}
//                     width={layout.globalPanel.width}
//                     height={40}
//                     fill={COLORS.globalBorder}
//                     fillOpacity={0.2}
//                     stroke={COLORS.globalBorder}
//                     strokeWidth={2}
//                     cornerRadius={[8, 8, 0, 0]}
//                   />
//                   <Text
//                     text="Globals"
//                     x={layout.globalPanel.x + 12}
//                     y={layout.globalPanel.y + 12}
//                     fontSize={16}
//                     fontStyle="bold"
//                     fill="#F1F5F9"
//                     fontFamily="monospace"
//                   />
//                   {layout.globalPanel.children?.map((child) => {
//                     return (
//                       <Group key={child.id} x={child.x} y={child.y}>
//                         {renderElement(child)}
//                       </Group>
//                     );
//                   })}
//                 </Group>
//               )}
//             </Layer>
//                 </Stage>
//             )}
//         </div>

//       {/* Input Dialog */}
//       {inputDialogOpen && inputDialogProps && (
//         <InputDialog
//           isOpen={inputDialogOpen}
//           prompt={inputDialogProps.prompt}
//           format={inputDialogProps.format}
//           expectedType={inputDialogProps.expectedType}
//           onClose={() => {
//             setInputDialogOpen(false);
//             setInputDialogProps(null);
//           }}
//           onSubmit={handleInputSubmit}
//         />
//       )}
//     </>
//   );
// }

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Line, Text, Arrow } from 'react-konva';
import Konva from 'konva';
import { ZoomIn, ZoomOut, Maximize2, Move, Hand } from 'lucide-react';
import { useExecutionStore } from '@store/slices/executionSlice';
import { useCanvasStore } from '@store/slices/canvasSlice';

// Import element components
import { VariableBox } from './elements/VariableBox';
import { ArrayView } from './elements/ArrayView';
import { StackFrame } from './elements/StackFrame';
import { OutputElement } from './elements/OutputElement';
import { InputElement } from './elements/InputElement';
import { LayoutEngine, LayoutElement } from './layout/LayoutEngine';
import { InputDialog } from './InputDialog';
import { socketService } from '../../api/socket.service';

import { getFocusPosition } from '../../utils/camera';

const COLORS = {
  bg: '#0F172A',
  grid: '#1E293B',
  mainBorder: '#A855F7',
  globalBorder: '#2DD4BF',
};

// Spacing constants
const SPACING = {
  VERTICAL: 16,
  HORIZONTAL: 20,
  CONTAINER_PADDING: 20,
  HEADER_HEIGHT: 40,
};

const VAR_COLORS: Record<string, string> = {
  int: '#3B82F6', // Blue
  float: '#14B8A6', // Teal
  double: '#0891B2', // Cyan
  string: '#8B5CF6', // Purple
  char: '#D946EF', // Magenta
  boolean: '#F59E0B', // Amber
  long: '#6366F1', // Indigo
  short: '#0EA5E9', // Sky
  byte: '#0284C7', // Light Blue
  default: '#64748B', // Slate
};

const getVarColor = (type: string) => {
  const normalized = type?.toLowerCase() || 'default';
  if (normalized.includes('[]') || normalized.includes('array')) return '#10B981'; // Emerald
  return VAR_COLORS[normalized] || VAR_COLORS.default;
};

export default function VisualizationCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Store selectors
  const executionTrace = useExecutionStore((state) => state.executionTrace);
  const currentStep = useExecutionStore((state) => state.currentStep);
  const getCurrentStep = useExecutionStore((state) => state.getCurrentStep);
  const isAnalyzing = useExecutionStore((state) => state.isAnalyzing);

  const { setCanvasSize, zoom, setZoom, position, setPosition } = useCanvasStore();

  // Local state
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [dragMode, setDragMode] = useState(false);
  const [inputDialogOpen, setInputDialogOpen] = useState(false);
  const [inputDialogProps, setInputDialogProps] = useState<any>(null);
  const prevStepRef = useRef<number>(-1);
  const prevElementsRef = useRef<Map<string, any>>(new Map());

  const currentStepData = getCurrentStep();
  const state = currentStepData?.state;

  // Calculate full layout (all elements up to current step)
  const fullLayout = useMemo(() => {
    if (!state || executionTrace.length === 0) return null;
    
    const layout = LayoutEngine.calculateLayout(
      executionTrace,
      currentStep,
      dimensions.width,
      dimensions.height,
      null
    );
    
    return layout;
  }, [state, currentStep, executionTrace, dimensions.width, dimensions.height]);

  // ...existing code...

  // Filter elements to only show those that should be visible at current step
  const visibleLayout = useMemo(() => {
    if (!fullLayout) return null;

    // Helper to filter children recursively
    const filterChildren = (children: LayoutElement[] | undefined): LayoutElement[] => {
      if (!children) return [];
      return children
        .filter(child => {
          const stepId = child.data?.birthStep ?? child.stepId;
          return stepId !== undefined && stepId <= currentStep;
        })
        .map(child => ({
          ...child,
          children: filterChildren(child.children)
        }));
    };

    // Filter main function children
    const filteredMainChildren = filterChildren(fullLayout.mainFunction.children);
    // Filter global panel children
    const filteredGlobalChildren = filterChildren(fullLayout.globalPanel.children);
    // Filter all elements
    const filteredElements = fullLayout.elements.filter(el => {
      const stepId = el.data?.birthStep ?? el.stepId;
      return stepId !== undefined && stepId <= currentStep;
    });

    const filtered = {
      ...fullLayout,
      mainFunction: {
        ...fullLayout.mainFunction,
        children: filteredMainChildren
      },
      globalPanel: {
        ...fullLayout.globalPanel,
        children: filteredGlobalChildren
      },
      elements: filteredElements
    };

    // ...existing code...

    return filtered;
  }, [fullLayout, currentStep]);

  // Debug: log visible layout when it changes
  // ...existing code...

  // Track which elements are NEW in the current step (just appeared)
  const elementAnimationStates = useMemo(() => {
    if (!visibleLayout) return new Map();

    const states = new Map<string, { isNew: boolean; isUpdated: boolean }>();
    const prevStep = prevStepRef.current;
    const prevElements = prevElementsRef.current;

    visibleLayout.elements.forEach(element => {
      // Element is NEW if it's created in this step and we moved forward
      const didExistBefore = prevElements.has(element.id);
      const isNew = element.stepId === currentStep && prevStep < currentStep && !didExistBefore;

      // Element is UPDATED if it existed before and its data changed
      const prev = prevElements.get(element.id);
      const dataChanged = prev ? JSON.stringify(prev.data) !== JSON.stringify(element.data) : false;
      const isUpdated = !isNew && !!prev && dataChanged;

      states.set(element.id, { isNew, isUpdated });

      // ...existing code...
    });

    return states;
  }, [visibleLayout, currentStep]);

  // Compute staggered enter delays for new elements in the current step
  const enterDelayMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!visibleLayout) return map;

    // Collect all visible elements including children to ensure we catch variables inside stack frames
    const visitedIds = new Set<string>();
    const allVisibleElements: LayoutElement[] = [];
    const traverse = (el: LayoutElement) => {
      if (visitedIds.has(el.id)) return;
      visitedIds.add(el.id);
      allVisibleElements.push(el);
      if (el.children) el.children.forEach(traverse);
    };
    
    if (visibleLayout.mainFunction) traverse(visibleLayout.mainFunction);
    if (visibleLayout.globalPanel) traverse(visibleLayout.globalPanel);
    visibleLayout.elements.forEach(traverse);

    // Filter for new ones
    const newElements = allVisibleElements.filter(el => elementAnimationStates.get(el.id)?.isNew);
    newElements.sort((a, b) => (a.y || 0) - (b.y || 0));

    newElements.forEach((el, idx) => {
      // 300ms stagger per element for clearer step-by-step
      map.set(el.id, idx * 300);
    });

    return map;
  }, [visibleLayout, elementAnimationStates]);

  // Keep a snapshot of visible elements for change detection on next step
  useEffect(() => {
    if (!visibleLayout) return;
    const map = new Map<string, any>();
    visibleLayout.elements.forEach(el => {
      map.set(el.id, {
        id: el.id,
        data: el.data ? JSON.parse(JSON.stringify(el.data)) : undefined
      });
    });
    prevElementsRef.current = map;
  }, [visibleLayout]);

  // Update previous step ref
  useEffect(() => {
    prevStepRef.current = currentStep;
  }, [currentStep]);

  // Responsive sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
        setCanvasSize(width, height);
      }
    };

    updateSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      if (ro) ro.disconnect();
    };
  }, [setCanvasSize]);

  // Smoothly auto-focus the camera on the most recent element
  useEffect(() => {
    if (!visibleLayout || !stageRef.current || prevStepRef.current >= currentStep) return;

    // Find all elements that are new in this step
    const newElements = visibleLayout.elements.filter(el => {
      const animState = elementAnimationStates.get(el.id);
      return animState?.isNew;
    });

    if (newElements.length === 0) return;

    // Find the element with the largest `y` value (lowest on screen) among the new ones
    const focusTarget = newElements.reduce((prev, curr) => {
      return (prev && prev.y > curr.y) ? prev : curr;
    });
    
    if (focusTarget) {
      const targetPos = getFocusPosition(focusTarget, dimensions, zoom);
      const stage = stageRef.current;

      // Animate the stage to the new position
      new Konva.Tween({
        node: stage,
        x: targetPos.x,
        y: targetPos.y,
        duration: 0.4,
        easing: Konva.Easings.EaseInOut,
        onFinish: () => {
          // Only update the store when the animation is complete
          if (stage) {
            setPosition({ x: stage.x(), y: stage.y() });
          }
        },
      }).play();
    }
  }, [currentStep, elementAnimationStates, dimensions, zoom, setPosition]);

  // Zoom & Pan controls
  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(zoom + 0.1, 3));
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(zoom - 0.1, 0.3));
  }, [zoom, setZoom]);

  const handleFitToScreen = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [setZoom, setPosition]);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
    const clampedScale = Math.max(0.1, Math.min(newScale, 5));

    setZoom(clampedScale);
    setPosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }, [setZoom, setPosition]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setDragMode(!dragMode);
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleFitToScreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dragMode, handleZoomIn, handleZoomOut, handleFitToScreen]);

  // Listen for input required
  useEffect(() => {
    const handleInputRequired = (data: any) => {
      console.log('[VisualizationCanvas] Input required during analysis:', data);
      useExecutionStore.getState().pause();
      
      setInputDialogProps({
        prompt: data.prompt || `Enter value for ${data.varName || 'variable'}:`,
        format: data.format || '%d',
        expectedType: data.type || 'int',
        varName: data.varName,
        line: data.line,
        isAnalysis: isAnalyzing,
      });
      setInputDialogOpen(true);
    };

    socketService.on('execution:input_required', handleInputRequired);
    return () => {
      socketService.off('execution:input_required', handleInputRequired);
    };
  }, [isAnalyzing]);

  // Handle input submission
  const handleInputSubmit = (value: string | number) => {
    console.log('[VisualizationCanvas] Submitting input:', value);
    socketService.provideInput(value);
    
    if (visibleLayout) {
      const inputElements = visibleLayout.elements.filter(el => el.type === 'input' && el.data?.isWaiting);
      inputElements.forEach(inputEl => {
        inputEl.data = {
          ...inputEl.data,
          value: value,
          isWaiting: false,
        };
      });
      
      if (visibleLayout.mainFunction?.children) {
        visibleLayout.mainFunction.children.forEach(child => {
          if (child.type === 'input' && child.data?.isWaiting) {
            child.data = {
              ...child.data,
              value: value,
              isWaiting: false,
            };
          }
        });
      }
    }
    
    setInputDialogOpen(false);
    setInputDialogProps(null);
  };

  // Helper to filter redundant declaration/initialization pairs
  const filterChildren = (children: LayoutElement[] | undefined) => {
    if (!children) return [];
    
    const idsToExclude = new Set<string>();
    const varGroups = new Map<string, LayoutElement[]>();
    
    children.forEach(child => {
      if (child.type === 'variable' && child.data?.name) {
        const name = child.data.name;
        if (!varGroups.has(name)) varGroups.set(name, []);
        varGroups.get(name)!.push(child);
      }
    });
    
    varGroups.forEach((vars) => {
      if (vars.length > 1) {
        // Sort by stepId to handle sequence
        vars.sort((a, b) => (a.stepId || 0) - (b.stepId || 0));
        
        // Check for declaration + initialization in the SAME step
        for (let i = 0; i < vars.length; i++) {
          const current = vars[i];
          const next = vars[i+1];
          
          // If current has no value and next has value AND they are in the same step, hide current (merge)
          if (next && current.stepId === next.stepId && current.data?.value === undefined && next.data?.value !== undefined) {
             idsToExclude.add(current.id);
          }
        }
      }
    });
    
    return children.filter(c => !idsToExclude.has(c.id));
  };

  // Render element based on type with proper positioning
  const renderElement = (element: LayoutElement, parentX: number = 0, parentY: number = 0) => {
    const { type, data, id, x, y, width, height, children, stepId } = element;
    const animState = elementAnimationStates.get(id) || { isNew: false, isUpdated: false };
    const { isNew, isUpdated } = animState;
    // ...existing code...
    switch (type) {
      case 'main':
        return (
          <StackFrame
            key={id}
            id={id}
            functionName="main()"
            x={x}
            y={y}
            width={width}
            height={height}
            isNew={false} // Main is always there
          >
            {filterChildren(children).map((child, idx) => {
              const relativeX = child.x - x;
              const relativeY = child.y - y - SPACING.HEADER_HEIGHT;
              
              return (
                <Group key={child.id} x={relativeX} y={relativeY}>
                  {renderElement(child, x, y)}
                </Group>
              );
            })}
          </StackFrame>
        );

      case 'variable':
        // Determine variable state: prefer explicit data.state, fall back to subtype/isUpdated
        let varState: 'declared' | 'initialized' | 'multiple-init' | 'updated' = 'initialized';
        if (data?.state === 'declared') {
          varState = 'declared';
        } else if (data?.state === 'multiple-init') {
          varState = 'multiple-init';
        } else if (data?.state === 'updated') {
          varState = 'updated';
        } else if (element.subtype === 'variable_declaration_only') {
          varState = 'declared';
        } else if (element.subtype === 'variable_multiple_declaration') {
          varState = 'multiple-init';
        } else if (element.subtype === 'variable_value_change' || isUpdated) {
          varState = 'updated';
        }

        // For flow view: treat updates as "new" to trigger appearance animation
        const effectiveIsNew = isNew || isUpdated;

        return (
          <VariableBox
            key={`${id}-${stepId}`} // Force new box on update/step change
            id={id}
            name={data?.name || ''}
            type={data?.type || data?.primitive || 'int'}
            value={data?.value}
            address={data?.address || ''}
            x={0}
            y={0}
            width={width}
            height={height}
            section="stack"
            isNew={effectiveIsNew}
            isUpdated={isUpdated}
            state={varState}
            stepNumber={stepId}
            enterDelay={enterDelayMap.get(id) || 0}
            color={getVarColor(data?.type || data?.primitive)}
          />
        );

      case 'array':
        return (
          <ArrayView
            key={id}
            id={id}
            name={data?.name || ''}
            type={data?.type || 'int'}
            values={data?.values || []}
            address={data?.address || ''}
            x={0}
            y={0}
            width={width}
            height={height}
            isNew={isNew}
            isUpdated={isUpdated}
          />
        );

      case 'output':
        return (
          <OutputElement
            key={id}
            id={id}
            value={data?.value || ''}
            x={0}
            y={0}
            width={width}
            height={height}
            isNew={isNew}
            subtype={element.subtype as any}
          />
        );

      case 'input':
        return (
          <InputElement
            key={id}
            id={id}
            value={data?.value}
            prompt={data?.prompt}
            format={data?.format}
            varName={data?.varName || data?.variables?.[0]}
            x={0}
            y={0}
            width={width}
            height={height}
            isNew={isNew}
            isWaiting={!data?.value}
          />
        );

      case 'global':
        // Prefer explicit data.state for globals as well
        let globalState: 'declared' | 'initialized' | 'multiple-init' | 'updated' = 'initialized';
        if (data?.state === 'declared') globalState = 'declared';
        else if (data?.state === 'updated') globalState = 'updated';
        else if (isUpdated) globalState = 'updated';

        const effectiveGlobalIsNew = isNew || isUpdated;

        return (
          <VariableBox
            key={`${id}-${stepId}`}
            id={id}
            name={data?.name || ''}
            type={data?.type || data?.primitive || 'int'}
            value={data?.value}
            address={data?.address || ''}
            x={0}
            y={0}
            width={width}
            height={height}
            section="global"
            isNew={effectiveGlobalIsNew}
            isUpdated={isUpdated}
            state={globalState}
            stepNumber={stepId}
            color={getVarColor(data?.type || data?.primitive)}
          />
        );

      case 'function':
        return (
          <StackFrame
            key={id}
            id={id}
            functionName={data?.function || 'function()'}
            x={0}
            y={0}
            width={width}
            height={height}
            isNew={isNew}
          >
            {filterChildren(children).map((child) => {
              const relativeX = child.x - x;
              const relativeY = child.y - y - SPACING.HEADER_HEIGHT;
              return (
                <Group key={child.id} x={relativeX} y={relativeY}>
                  {renderElement(child, x, y)}
                </Group>
              );
            })}
          </StackFrame>
        );

      case 'loop':
        return (
          <Group key={id} x={0} y={0}>
            <Rect
              width={width}
              height={height}
              fill="#1E293B"
              stroke="#F59E0B"
              strokeWidth={2}
              cornerRadius={8}
            />
            <Text
              text={`Loop: ${data?.condition || data?.explanation || 'for/while'}`}
              x={12}
              y={20}
              fontSize={14}
              fill="#F1F5F9"
              fontFamily="monospace"
            />
            {filterChildren(children).map((child) => {
              const relativeX = child.x - x;
              const relativeY = child.y - y;
              return (
                <Group key={child.id} x={relativeX} y={relativeY}>
                  {renderElement(child, x, y)}
                </Group>
              );
            })}
          </Group>
        );

      case 'condition':
        return (
          <Group key={id} x={0} y={0}>
            <Rect
              width={width}
              height={height}
              fill="#1E293B"
              stroke="#8B5CF6"
              strokeWidth={2}
              cornerRadius={8}
            />
            <Text
              text={`Condition: ${data?.explanation || 'if/else'}`}
              x={12}
              y={20}
              fontSize={14}
              fill="#F1F5F9"
              fontFamily="monospace"
            />
            {filterChildren(children).map((child) => {
              const relativeX = child.x - x;
              const relativeY = child.y - y;
              return (
                <Group key={child.id} x={relativeX} y={relativeY}>
                  {renderElement(child, x, y)}
                </Group>
              );
            })}
          </Group>
        );

      default:
        return null;
    }
  };

  if (!state || !visibleLayout) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: COLORS.bg,
          color: '#94A3B8',
          fontFamily: 'system-ui'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>ðŸŽ¨</div>
          <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#F1F5F9' }}>
            Responsive Canvas Ready
          </div>
          <div style={{ fontSize: '14px', color: '#64748B' }}>
            Run your code to see animated visualization
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: COLORS.bg,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Controls */}
        <div style={{ 
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 100,
          display: 'flex',
          gap: '8px',
          backgroundColor: '#1E293B',
          padding: '10px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          border: '1px solid #334155'
        }}>
          <button
            onClick={() => setDragMode(!dragMode)}
            style={{
              padding: '8px 12px',
              backgroundColor: dragMode ? '#3B82F6' : '#334155',
              border: 'none',
              borderRadius: '6px',
              color: '#F1F5F9',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px', 
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            title="Pan Mode (Space)"
          >
            {dragMode ? <Hand size={16} /> : <Move size={16} />}
            {dragMode ? 'Pan' : 'Select'}
          </button>

          <button onClick={handleZoomIn} title="Zoom In (+)" style={{
            padding: '8px',
            backgroundColor: '#334155',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}>
            <ZoomIn size={20} color="#F1F5F9" />
          </button>
          <button onClick={handleZoomOut} title="Zoom Out (-)" style={{
            padding: '8px',
            backgroundColor: '#334155',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}>
            <ZoomOut size={20} color="#F1F5F9" />
          </button>
          <button onClick={handleFitToScreen} title="Fit to Screen (0)" style={{
            padding: '8px',
            backgroundColor: '#334155',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Maximize2 size={20} color="#F1F5F9" />
          </button>
        </div>

        {/* Step Info */}
        <div style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 100,
          backgroundColor: '#1E293B',
          padding: '10px 16px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          border: '1px solid #334155',
          color: '#F1F5F9',
          fontSize: '14px',
          fontWeight: 600
        }}>
          Step {currentStep + 1} / {executionTrace.length}
        </div>

        {/* Canvas */}
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Stage
            ref={stageRef}
            width={dimensions.width}
            height={dimensions.height}
            onWheel={handleWheel}
            scaleX={zoom}
            scaleY={zoom}
            x={position.x}
            y={position.y}
            draggable={dragMode}
            onDragMove={(e) => {
              setPosition({
                x: e.target.x(),
                y: e.target.y(),
              });
            }}
            onDragEnd={(e) => {
              setPosition({
                x: e.target.x(),
                y: e.target.y(),
              });
            }}
          >
            <Layer>
              {/* Grid */}
              <Group>
                {Array.from({ length: Math.floor(dimensions.width / 20) }).map((_, i) => (
                  <Line
                    key={`v-grid-${i}`}
                    points={[i * 20, 0, i * 20, dimensions.height]}
                    stroke={COLORS.grid}
                    strokeWidth={0.5}
                  />
                ))}
                {Array.from({ length: Math.floor(dimensions.height / 20) }).map((_, i) => (
                  <Line
                    key={`h-grid-${i}`}
                    points={[0, i * 20, dimensions.width, i * 20]}
                    stroke={COLORS.grid}
                    strokeWidth={0.5}
                  />
                ))}
              </Group>

              {/* Main Function Container */}
              {visibleLayout.mainFunction && (
                <Group x={0} y={0}>
                  {renderElement(visibleLayout.mainFunction)}
                </Group>
              )}

              {/* Global Panel with Arrow */}
              {visibleLayout.globalPanel && visibleLayout.globalPanel.children && visibleLayout.globalPanel.children.length > 0 && (
                <Group x={0} y={0}>
                  {/* Arrow from main to globals */}
                  <Arrow
                    points={[
                      visibleLayout.mainFunction.x + visibleLayout.mainFunction.width,
                      visibleLayout.mainFunction.y + visibleLayout.mainFunction.height / 2,
                      visibleLayout.globalPanel.x - 20,
                      visibleLayout.globalPanel.y + 60
                    ]}
                    stroke={COLORS.globalBorder}
                    strokeWidth={2}
                    fill={COLORS.globalBorder}
                    pointerLength={10}
                    pointerWidth={10}
                    dash={[10, 5]}
                    opacity={0.6}
                  />
                  
                  <Rect
                    x={visibleLayout.globalPanel.x}
                    y={visibleLayout.globalPanel.y}
                    width={visibleLayout.globalPanel.width}
                    height={SPACING.HEADER_HEIGHT}
                    fill={COLORS.globalBorder}
                    fillOpacity={0.2}
                    stroke={COLORS.globalBorder}
                    strokeWidth={2}
                    cornerRadius={[8, 8, 0, 0]}
                  />
                  <Text
                    text="Globals"
                    x={visibleLayout.globalPanel.x + 12}
                    y={visibleLayout.globalPanel.y + 12}
                    fontSize={16}
                    fontStyle="bold"
                    fill="#F1F5F9"
                    fontFamily="monospace"
                  />
                  {filterChildren(visibleLayout.globalPanel.children).map((child) => {
                    return (
                      <Group key={child.id} x={child.x} y={child.y}>
                        {renderElement(child)}
                      </Group>
                    );
                  })}
                </Group>
              )}
            </Layer>
          </Stage>
        )}
      </div>

      {/* Input Dialog */}
      {inputDialogOpen && inputDialogProps && (
        <InputDialog
          isOpen={inputDialogOpen}
          prompt={inputDialogProps.prompt}
          format={inputDialogProps.format}
          expectedType={inputDialogProps.expectedType}
          onClose={() => {
            setInputDialogOpen(false);
            setInputDialogProps(null);
          }}
          onSubmit={handleInputSubmit}
        />
      )}
    </>
  );
}