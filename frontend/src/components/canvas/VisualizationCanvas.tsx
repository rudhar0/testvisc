// ============================================
// Replace frontend/src/components/canvas/VisualizationCanvas.tsx with this
// COMPLETE INTEGRATED VERSION
// ============================================

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Line, Text, Circle, Arrow } from 'react-konva';
import Konva from 'konva';
import { ZoomIn, ZoomOut, Maximize2, Move, Hand } from 'lucide-react';
import { useExecutionStore } from '@store/slices/executionSlice';
import { useCanvasStore } from '@store/slices/canvasSlice';

// Import individual components (these need to be created as separate files)
import { VariableBox } from './elements/VariableBox';
import { ArrayView } from './elements/ArrayView';
import { StackFrame } from './elements/StackFrame';
import { PointerArrow } from './elements/PointerArrow';
import { OutputBox } from './elements/OutputBox';
import { HeapBlock } from './elements/HeapBlock';
import { LayoutEngine } from './layout/LayoutEngine';

export default function VisualizationCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Real stores
  const { getCurrentStep } = useExecutionStore();
  const { setCanvasSize, zoom, setZoom, position, setPosition } = useCanvasStore();

  // Local state
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [dragMode, setDragMode] = useState(false);
  const [prevLayout, setPrevLayout] = useState<any>(null);

  const currentStep = getCurrentStep();
  const state = currentStep?.state;

  // Calculate layout with animation detection
  const layout = useMemo(() => {
    if (!state) return null;
    const newLayout = LayoutEngine.calculateLayout(
      state, 
      dimensions.width, 
      dimensions.height, 
      prevLayout
    );
    return newLayout;
  }, [state, dimensions.width, dimensions.height, prevLayout]);

  // Update prevLayout after render
  useEffect(() => {
    if (layout) {
      setPrevLayout(layout);
    }
  }, [layout]);

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
    window.addEventListener('resize', updateSize);
    const resizeObserver = new ResizeObserver(updateSize);
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
  }, [setCanvasSize]);

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
      y: (pointer.y - stage.y()) / oldScale
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 
      ? Math.min(oldScale * 1.1, 3) 
      : Math.max(oldScale / 1.1, 0.3);

    setZoom(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    });
  }, [setZoom, setPosition]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setDragMode(true);
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleFitToScreen();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setDragMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleZoomIn, handleZoomOut, handleFitToScreen]);

  if (!state || !layout) {
    return (
      <div 
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0F172A',
          color: '#94A3B8',
          fontFamily: 'system-ui'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>🎨</div>
          <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#F1F5F9' }}>
            Responsive Canvas Ready
          </div>
          <div style={{ fontSize: '14px', color: '#64748B' }}>
            Run your code to see animated visualization
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
    int y = 20;
    int sum = x + y;
    return 0;
}`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ 
      width: '100%', 
      height: '100%', 
      backgroundColor: '#0F172A',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Figma-style Controls */}
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

        <div style={{ width: '1px', backgroundColor: '#475569', margin: '4px 0' }} />

        <button 
          onClick={handleZoomOut} 
          style={buttonStyle} 
          title="Zoom Out (-)"
        >
          <ZoomOut size={16} />
        </button>
        
        <div style={{
          padding: '6px 12px',
          backgroundColor: '#0F172A',
          borderRadius: '6px',
          color: '#F1F5F9',
          fontSize: '13px',
          fontFamily: 'monospace',
          fontWeight: 700,
          minWidth: '60px',
          textAlign: 'center',
          border: '1px solid #334155'
        }}>
          {Math.round(zoom * 100)}%
        </div>

        <button 
          onClick={handleZoomIn} 
          style={buttonStyle} 
          title="Zoom In (+)"
        >
          <ZoomIn size={16} />
        </button>

        <button 
          onClick={handleFitToScreen} 
          style={buttonStyle} 
          title="Fit to Screen (0)"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Step Info */}
      {currentStep && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 100,
          backgroundColor: '#1E293B',
          padding: '16px 20px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          maxWidth: '500px',
          border: '1px solid #334155'
        }}>
          <div style={{ 
            fontSize: '11px', 
            color: '#64748B', 
            marginBottom: '6px', 
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Step {currentStep.id + 1} • Line {currentStep.line} • {currentStep.type}
          </div>
          <div style={{ fontSize: '15px', color: '#F1F5F9', fontWeight: 500 }}>
            {currentStep.explanation}
          </div>
        </div>
      )}

      {/* Canvas Stage */}
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={zoom}
        scaleY={zoom}
        x={position.x}
        y={position.y}
        draggable={dragMode}
        onWheel={handleWheel}
        onDragEnd={(e) => {
          setPosition({ x: e.target.x(), y: e.target.y() });
        }}
        style={{ cursor: dragMode ? 'grab' : 'default' }}
      >
        <Layer>
          {/* Background */}
          <Rect
            x={-position.x / zoom - 1000}
            y={-position.y / zoom - 1000}
            width={dimensions.width / zoom + 2000}
            height={dimensions.height / zoom + 2000}
            fill="#0F172A"
          />

          {/* Grid */}
          {Array.from({ length: 100 }).map((_, i) => (
            <React.Fragment key={`grid-${i}`}>
              <Line
                points={[
                  i * 50 - position.x / zoom,
                  -position.y / zoom,
                  i * 50 - position.x / zoom,
                  dimensions.height / zoom
                ]}
                stroke="#1E293B"
                strokeWidth={1 / zoom}
              />
              <Line
                points={[
                  -position.x / zoom,
                  i * 50 - position.y / zoom,
                  dimensions.width / zoom,
                  i * 50 - position.y / zoom
                ]}
                stroke="#1E293B"
                strokeWidth={1 / zoom}
              />
            </React.Fragment>
          ))}

          {/* Section Labels */}
          {layout.globals.length > 0 && (
            <Text
              x={40}
              y={20}
              text="GLOBAL MEMORY"
              fontSize={16}
              fill="#2DD4BF"
              fontStyle="bold"
              letterSpacing={1}
              listening={false}
            />
          )}

          {layout.stack.length > 0 && (
            <Text
              x={layout.stack[0]?.x || 300}
              y={20}
              text="CALL STACK"
              fontSize={16}
              fill="#3B82F6"
              fontStyle="bold"
              letterSpacing={1}
              listening={false}
            />
          )}

          {/* Render all elements using the actual components */}
          {layout.globals.map((variable: any) => (
            <VariableBox key={variable.id} {...variable} />
          ))}

          {layout.stack.map((frame: any) => (
            <Group key={frame.id}>
              <StackFrame {...frame} />
              {frame.locals.map((variable: any) => (
                <VariableBox key={variable.id} {...variable} />
              ))}
            </Group>
          ))}

          {layout.arrays.map((array: any) => (
            <ArrayView key={array.id} {...array} />
          ))}

          {layout.heap.map((block: any) => (
            <HeapBlock key={block.id} {...block} />
          ))}

          {layout.pointers.map((pointer: any) => (
            <PointerArrow key={pointer.id} {...pointer} />
          ))}

          {layout.output && <OutputBox {...layout.output} />}
        </Layer>
      </Stage>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '8px',
  backgroundColor: '#334155',
  border: 'none',
  borderRadius: '6px',
  color: '#F1F5F9',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s'
};