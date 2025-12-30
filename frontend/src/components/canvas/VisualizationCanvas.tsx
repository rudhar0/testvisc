import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Group, Line } from 'react-konva';
import Konva from 'konva';
import { useExecutionStore } from '@store/slices/executionSlice';
import AnimationEngine from '../../animations/AnimationEngine';
import { VerticalFlowRenderer } from '../../canvas/renderers/VerticalFlowRenderer';
import { InputDialog } from './InputDialog';
import { Input } from '../../canvas/elements/Input';
import { socketService } from '../../api/socket.service';
import { SOCKET_EVENTS } from '../../constants/events';
import { useAnimationController } from '@/hooks/useAnimationController';
import { COLORS } from '../../config/theme.config';

const WelcomePlaceholder = () => (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0F172A',
      color: '#94A3B8',
      fontFamily: 'system-ui'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>🎨</div>
        <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#F1F5F9' }}>
          C++ Visualizer
        </div>
        <div style={{ fontSize: '14px', color: '#64748B' }}>
          Run your code to see the new vertical execution flow
        </div>
        <div style={{ 
          marginTop: '24px', 
          padding: '12px 24px', 
          backgroundColor: '#1E293B',
          borderRadius: '8px',
          border: '1px solid #334155',
          display: 'inline-block'
        }}>
          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
            Try this sample:
          </div>
          <pre style={{ 
            textAlign: 'left', 
            fontSize: '12px', 
            fontFamily: 'monospace',
            color: '#F1F5F9',
            margin: 0
          }}>
{`int main() {
    int x = 10;
    int* p = &x;
    *p = 20;
    return 0;
}`}
          </pre>
        </div>
      </div>
    </div>
);


export default function VisualizationCanvas() {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);
    const rendererRef = useRef<VerticalFlowRenderer | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [inputDialogOpen, setInputDialogOpen] = useState(false);
    const [inputDialogProps, setInputDialogProps] = useState<any>(null);
    const [stageScale, setStageScale] = useState(1);
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const lastPointerPosition = useRef({ x: 0, y: 0 });
    
    // Call the animation controller hook
    const { addAnimationSequence } = useAnimationController(stageRef.current, layerRef.current);
    
    // Store selectors
    const executionTrace = useExecutionStore((state) => state.executionTrace);
    const currentStepIndex = useExecutionStore((state) => state.currentStep);
    const isPlaying = useExecutionStore((state) => state.isPlaying);
    const needsCanvasRebuild = useExecutionStore((state) => state.needsCanvasRebuild);
    const markCanvasRebuildComplete = useExecutionStore((state) => state.markCanvasRebuildComplete);
    const previousStep = useRef<number>(-1); // Use a local ref for tracking previous step in this component
    

    // Responsive sizing & renderer initialization
    useEffect(() => {
        if (!containerRef.current) return;

        const updateSize = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setDimensions({ width, height });
            }
        };

        updateSize();
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(containerRef.current);

        if (layerRef.current && !rendererRef.current) {
            rendererRef.current = new VerticalFlowRenderer(layerRef.current);
            rendererRef.current.initialize();
        }

        return () => resizeObserver.disconnect();
    }, []);

    // Handle canvas rebuild when jumping steps or resetting
    useEffect(() => {
        if (!rendererRef.current || !layerRef.current || executionTrace.length === 0) {
            return;
        }

        if (needsCanvasRebuild) {
            console.log(`[VisualizationCanvas] Rebuilding canvas to step ${currentStepIndex}`);
            AnimationEngine.clearQueue();
            
            rendererRef.current
                .rebuildToStep(executionTrace, currentStepIndex)
                .then(() => {
                    markCanvasRebuildComplete();
                    previousStep.current = currentStepIndex;
                })
                .catch((error) => {
                    console.error('[VisualizationCanvas] Error rebuilding canvas:', error);
                    markCanvasRebuildComplete();
                });
        }
    }, [needsCanvasRebuild, currentStepIndex, executionTrace, markCanvasRebuildComplete]);

    // Listen for input_required event from backend (during trace generation)
    useEffect(() => {
        const handleInputRequired = (data: any) => {
            console.log('[VisualizationCanvas] Input required event received:', data);
            // Pause execution while waiting for input
            useExecutionStore.getState().pause();
            
            setInputDialogProps({
                prompt: data.prompt || 'Enter input:',
                format: data.format || '%d',
                expectedType: data.type || 'int',
                varName: data.varName,
                line: data.line,
            });
            setInputDialogOpen(true);
        };

        socketService.on('execution:input_required', handleInputRequired);

        return () => {
            socketService.off('execution:input_required', handleInputRequired);
        };
    }, []);

    // Handle step-by-step updates during normal playback
    useEffect(() => {
        if (
            !rendererRef.current ||
            !layerRef.current ||
            executionTrace.length === 0 ||
            currentStepIndex === previousStep.current ||
            needsCanvasRebuild
        ) {
            return;
        }

        const currentStep = executionTrace[currentStepIndex];
        if (!currentStep) {
            return;
        }

        // Only process if we're moving forward one step (normal playback)
        if (currentStepIndex === previousStep.current + 1) {
            console.log(`[VisualizationCanvas] Processing step ${currentStepIndex}: ${currentStep.type}`);
            
            rendererRef.current
                .processStep(currentStep, true) // true = animate
                .then((animations) => {
                    if (animations && animations.length > 0) {
                        addAnimationSequence(animations); // Use the addAnimationSequence from the hook
                    }
                    previousStep.current = currentStepIndex; // Update the local previousStep ref
                    
                    // Check if this step requires input (for playback mode)
                    if (currentStep.type === 'input_request' || currentStep.pauseExecution) {
                        const inputElement = rendererRef.current?.getWaitingInput();
                        if (inputElement) {
                            setInputDialogProps({
                                prompt: inputElement.prompt || currentStep.inputRequest?.prompt || 'Enter input:',
                                format: inputElement.format || currentStep.inputRequest?.format || '%d',
                                expectedType: inputElement.expectedType || currentStep.inputRequest?.expectedTypes?.[0] || 'int',
                                inputElement: inputElement,
                            });
                            setInputDialogOpen(true);
                        }
                    }
                })
                .catch((error) => {
                    console.error('[VisualizationCanvas] Error processing step:', error);
                });
        }
    }, [currentStepIndex, executionTrace, needsCanvasRebuild, isPlaying, addAnimationSequence]);

    // Handle input dialog submission
    const handleInputSubmit = (value: string | number) => {
        console.log('[VisualizationCanvas] Submitting input:', value);
        
        // Update input element if it exists (for playback mode)
        if (inputDialogProps?.inputElement) {
            const inputElement = inputDialogProps.inputElement as Input;
            inputElement.setValue(value);
        }
        
        // Send input to backend - this will continue trace generation
        socketService.provideInput(value);
        
        // Close dialog
        setInputDialogOpen(false);
        setInputDialogProps(null);
        
        // Note: Don't resume playback here - backend will continue trace generation
        // and send new steps via code:trace:chunk or code:trace:complete
        // The isAnalyzing flag will be cleared when code:trace:complete is received
    };

    const hasTrace = executionTrace.length > 0;

    // Effect to center the canvas initially or when trace changes
    useEffect(() => {
        if (!hasTrace || !stageRef.current || !layerRef.current || dimensions.width === 0 || dimensions.height === 0) {
            return;
        }

        // Use a timeout to ensure elements are rendered before calculating bounding box
        const timeoutId = setTimeout(() => {
            const stage = stageRef.current;
            const layer = layerRef.current;
            if (!stage || !layer) return;

            // Get bounding box of all elements in the layer
            const bbox = layer.getClientRect();

            // Calculate center position
            const centerX = dimensions.width / 2 - (bbox.x + bbox.width / 2);
            const centerY = dimensions.height / 2 - (bbox.y + bbox.height / 2);

            setStagePos({ x: centerX, y: centerY });
            setStageScale(1); // Reset scale to 1 on re-center
        }, 100); // Small delay to allow Konva to render elements

        return () => clearTimeout(timeoutId);
    }, [hasTrace, executionTrace, dimensions]); // Re-center when trace or dimensions change

    // Zoom and Pan Handlers
    const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (!stage) return;

        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1; // Zoom out/in
        const clampedScale = Math.max(0.1, Math.min(newScale, 5)); // Clamp scale between 0.1 and 5

        setStageScale(clampedScale);
        setStagePos({
            x: pointer.x - mousePointTo.x * clampedScale,
            y: pointer.y - mousePointTo.y * clampedScale,
        });
    }, []);

    const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.evt.button === 0) { // Left mouse button
            isDragging.current = true;
            lastPointerPosition.current = { x: e.evt.clientX, y: e.evt.clientY };
        }
    }, []);

    const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isDragging.current || !stageRef.current) return;

        const dx = e.evt.clientX - lastPointerPosition.current.x;
        const dy = e.evt.clientY - lastPointerPosition.current.y;

        setStagePos((prevPos) => ({
            x: prevPos.x + dx,
            y: prevPos.y + dy,
        }));

        lastPointerPosition.current = { x: e.evt.clientX, y: e.evt.clientY };
    }, []);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);


    return (
        <>
            <div 
                ref={containerRef} 
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    backgroundColor: '#0F172A',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {!hasTrace ? (
                    <WelcomePlaceholder />
                ) : (
                    dimensions.width > 0 && dimensions.height > 0 && (
                        <Stage 
                            ref={stageRef}
                            width={dimensions.width} 
                            height={dimensions.height}
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            scaleX={stageScale}
                            scaleY={stageScale}
                            x={stagePos.x}
                            y={stagePos.y}
                        >
                            <Layer ref={layerRef}>
                                {/* Grid Lines */}
                                <Group>
                                    {Array.from({ length: Math.floor(dimensions.width / 20) }).map((_, i) => (
                                        <Line
                                            key={`v-grid-${i}`}
                                            points={[i * 20, 0, i * 20, dimensions.height]}
                                            stroke={COLORS.dark.border.secondary}
                                            strokeWidth={0.5}
                                        />
                                    ))}
                                    {Array.from({ length: Math.floor(dimensions.height / 20) }).map((_, i) => (
                                        <Line
                                            key={`h-grid-${i}`}
                                            points={[0, i * 20, dimensions.width, i * 20]}
                                            stroke={COLORS.dark.border.secondary}
                                            strokeWidth={0.5}
                                        />
                                    ))}
                                </Group>
                            </Layer>
                        </Stage>
                    )
                )}
            </div>
            
            {/* Input Dialog */}
            <InputDialog
                isOpen={inputDialogOpen}
                prompt={inputDialogProps?.prompt || 'Enter input:'}
                format={inputDialogProps?.format || '%d'}
                expectedType={inputDialogProps?.expectedType || 'int'}
                onClose={() => {
                    setInputDialogOpen(false);
                    setInputDialogProps(null);
                }}
                onSubmit={handleInputSubmit}
            />
        </>
    );
}