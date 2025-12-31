import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Line, Text } from 'react-konva';
import Konva from 'konva';
import { ZoomIn, ZoomOut, Maximize2, Move, Hand } from 'lucide-react';
import { useExecutionStore } from '@store/slices/executionSlice';
import { useCanvasStore } from '@store/slices/canvasSlice';
import AnimationEngine from '../../animations/AnimationEngine';
import { Animation } from '../../types/animation.types';
import { NewLayoutEngine } from './layout/NewLayoutEngine';
import { LayoutElement } from './layout/LayoutEngine';

// Import element components
import { VariableBox } from './elements/VariableBox';
import { ArrayView } from './elements/ArrayView';
import { PointerBox } from './elements/PointerBox';
import { PointerArrow } from './elements/PointerArrow';
import { StackFrame } from './elements/StackFrame';
import { InputDialog } from './InputDialog';
import { socketService } from '../../api/socket.service';

const COLORS = {
  bg: '#0F172A',
  grid: '#1E293B',
};

export default function VisualizationCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Store selectors
  const visualizationSteps = useExecutionStore((state) => state.visualizationSteps);
  const { setCanvasSize, zoom, setZoom, position, setPosition } = useCanvasStore();

  // Layout engine
  const layoutEngine = useMemo(() => new NewLayoutEngine(), []);
  const layoutElements = useMemo(() => layoutEngine.calculateLayout(visualizationSteps), [visualizationSteps, layoutEngine]);
  const prevLayoutElementsRef = useRef<LayoutElement[]>([]);

  // Local state
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [dragMode, setDragMode] = useState(false);

  // Initialize Animation Engine
  useEffect(() => {
    if (stageRef.current) {
      AnimationEngine.initialize(stageRef.current);
    }
  }, []);
  
  // Animate new and updated steps
  useEffect(() => {
    const prevElementsMap = new Map(prevLayoutElementsRef.current.map(el => [el.id, el]));
    const newAnimations: Animation[] = [];

    layoutElements.forEach(element => {
      const prevElement = prevElementsMap.get(element.id);
      if (!prevElement) {
        // New element
        newAnimations.push({
          type: element.subtype as any,
          duration: 500,
          target: element.id,
        });
      } else if (JSON.stringify(element.data) !== JSON.stringify(prevElement.data)) {
        // Updated element
        newAnimations.push({
          type: element.subtype as any,
          duration: 500,
          target: element.id,
        });
      }
    });

    if (newAnimations.length > 0) {
      const sequence = AnimationEngine.createSequence(newAnimations);
      AnimationEngine.addSequence(sequence);
    }

    prevLayoutElementsRef.current = layoutElements;
  }, [layoutElements]);

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
    return () => window.removeEventListener('resize', updateSize);
  }, [setCanvasSize]);
  
  const handleZoomIn = useCallback(() => setZoom(Math.min(zoom + 0.1, 3)), [zoom, setZoom]);
  const handleZoomOut = useCallback(() => setZoom(Math.max(zoom - 0.1, 0.3)), [zoom, setZoom]);
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
  
    // Render element based on type
  const renderLayoutElement = (element: LayoutElement): JSX.Element | null => {
    const { id, type, subtype, x, y, width, height, data, children } = element;
    
    switch (type) {
      case 'variable':
        return (
          <VariableBox
            key={id}
            id={id}
            name={data.name}
            type={data.type}
            value={data.value}
            address={data.address}
            x={x}
            y={y}
            width={width}
            height={height}
            section="stack"
            isUpdated={subtype === 'variable_value_change'}
          />
        );

      case 'array':
        return (
          <ArrayView
            key={id}
            id={id}
            name={data.name}
            type={data.type}
            values={data.elements || []}
            address={data.address}
            x={x}
            y={y}
            width={width}
            height={height}
            isUpdated={subtype === 'array_element_update'}
          />
        );
    
        case 'pointer':
            return (
                <PointerBox
                    key={id}
                    id={id}
                    name={data.name}
                    type={data.type}
                    value={data.value}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    isUpdated={subtype === 'pointer_value_assign'}
                />
            );
        
        case 'function':
            return (
                <StackFrame
                    key={id}
                    id={id}
                    functionName={data.functionName}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                >
                    {children?.map(child => renderLayoutElement(child))}
                </StackFrame>
            );

      default:
        return null;
    }
  };
  
  const renderArrows = () => {
    const arrows: JSX.Element[] = [];
    layoutElements.forEach(element => {
        if (element.type === 'pointer' && element.metadata?.arrowTo) {
            const source = element;
            const target = layoutElements.find(el => el.id === element.metadata.arrowTo);
            if (source && target) {
                arrows.push(
                    <PointerArrow
                        key={`arrow-${source.id}`}
                        id={`arrow-${source.id}`}
                        fromX={source.x + source.width / 2}
                        fromY={source.y + source.height / 2}
                        toX={target.x + target.width / 2}
                        toY={target.y + target.height / 2}
                    />
                );
            }
        }
    });
    return arrows;
  };

  if (layoutElements.length === 0) {
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
          <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>🎨</div>
          <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#F1F5F9' }}>
            Visualization Canvas
          </div>
          <div style={{ fontSize: '14px', color: '#64748B' }}>
            Run your code to see the animated visualization.
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
            onDragMove={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
            onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
          >
            <Layer>
              {/* Grid */}
              <Group>
                {Array.from({ length: Math.floor(dimensions.width / 20) }).map((_, i) => (
                  <Line key={`v-grid-${i}`} points={[i * 20, 0, i * 20, dimensions.height]} stroke={COLORS.grid} strokeWidth={0.5} />
                ))}
                {Array.from({ length: Math.floor(dimensions.height / 20) }).map((_, i) => (
                  <Line key={`h-grid-${i}`} points={[0, i * 20, dimensions.width, i * 20]} stroke={COLORS.grid} strokeWidth={0.5} />
                ))}
              </Group>
              
              {/* Render Layout Elements */}
              {layoutElements.filter(el => !el.parentId).map(renderLayoutElement)}

              {/* Render Arrows */}
              {renderArrows()}
            </Layer>
          </Stage>
        )}
      </div>
    </>
  );
}
