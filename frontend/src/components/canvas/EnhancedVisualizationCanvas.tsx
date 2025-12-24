import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Group, Rect, Text, Line, Arrow } from 'react-konva';
import Konva from 'konva';
import { useExecutionStore } from '@store/slices/executionSlice';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

// Enhanced Layout System with Auto-positioning
class LayoutEngine {
  private static PADDING = 40;
  private static SECTION_GAP = 60;
  private static VAR_WIDTH = 180;
  private static VAR_HEIGHT = 80;
  private static VAR_GAP = 15;
  private static FRAME_PADDING = 20;
  
  static calculateLayout(state: any, canvasWidth: number, canvasHeight: number) {
    const layout: any = {
      globals: [],
      stack: [],
      heap: [],
      output: null,
      input: null,
      loops: [],
      pointers: []
    };

    let currentY = this.PADDING;
    let currentX = this.PADDING;

    // 1. Global Variables Section
    if (state?.globals && Object.keys(state.globals).length > 0) {
      const globals = Object.entries(state.globals).map(([name, data]: [string, any], index) => ({
        id: `global-${name}`,
        name,
        type: data.type || 'int',
        value: data.value,
        address: data.address || `0x${(0x1000 + index * 8).toString(16)}`,
        x: currentX,
        y: currentY + index * (this.VAR_HEIGHT + this.VAR_GAP),
        width: this.VAR_WIDTH,
        height: this.VAR_HEIGHT,
        section: 'global'
      }));
      
      layout.globals = globals;
      currentY += Math.ceil(globals.length) * (this.VAR_HEIGHT + this.VAR_GAP) + this.SECTION_GAP;
    }

    // 2. Call Stack Section
    currentX = this.PADDING;
    if (state?.callStack && state.callStack.length > 0) {
      state.callStack.forEach((frame: any, frameIndex: number) => {
        const locals = Object.entries(frame.locals || {});
        const frameWidth = Math.min(
          canvasWidth - 2 * this.PADDING,
          this.VAR_WIDTH * 2 + this.VAR_GAP + 2 * this.FRAME_PADDING
        );
        const varsPerRow = Math.floor((frameWidth - 2 * this.FRAME_PADDING) / (this.VAR_WIDTH + this.VAR_GAP));
        const rows = Math.ceil(locals.length / varsPerRow);
        const frameHeight = 60 + rows * (this.VAR_HEIGHT + this.VAR_GAP) + this.FRAME_PADDING;

        const frameLayout: any = {
          id: `frame-${frameIndex}`,
          x: currentX,
          y: currentY,
          width: frameWidth,
          height: frameHeight,
          function: frame.function,
          returnType: frame.returnType || 'int',
          isActive: frameIndex === state.callStack.length - 1,
          locals: []
        };

        locals.forEach(([name, data]: [string, any], varIndex) => {
          const col = varIndex % varsPerRow;
          const row = Math.floor(varIndex / varsPerRow);
          
          frameLayout.locals.push({
            id: `local-${frameIndex}-${name}`,
            name,
            type: data.type || 'int',
            value: data.value,
            address: data.address || `0x${(0x7fff0000 + varIndex * 8).toString(16)}`,
            x: currentX + this.FRAME_PADDING + col * (this.VAR_WIDTH + this.VAR_GAP),
            y: currentY + 60 + row * (this.VAR_HEIGHT + this.VAR_GAP),
            width: this.VAR_WIDTH,
            height: this.VAR_HEIGHT,
            section: 'stack'
          });
        });

        layout.stack.push(frameLayout);
        currentY += frameHeight + 20;
      });
    }

    // 3. Heap Section (for dynamic allocations)
    if (state?.heap && Object.keys(state.heap).length > 0) {
      currentX = canvasWidth / 2 + this.PADDING;
      currentY = this.PADDING;
      
      Object.entries(state.heap).forEach(([address, data]: [string, any], index) => {
        layout.heap.push({
          id: `heap-${address}`,
          address,
          value: data.value,
          size: data.size || 4,
          x: currentX,
          y: currentY + index * (this.VAR_HEIGHT + this.VAR_GAP),
          width: this.VAR_WIDTH,
          height: this.VAR_HEIGHT,
          section: 'heap'
        });
      });
    }

    // 4. Output Section
    if (state?.stdout) {
      layout.output = {
        x: this.PADDING,
        y: canvasHeight - 120,
        width: Math.min(500, canvasWidth - 2 * this.PADDING),
        height: 80,
        content: state.stdout
      };
    }

    // 5. Calculate Pointer Arrows
    layout.pointers = this.calculatePointerArrows(layout);

    return layout;
  }

  private static calculatePointerArrows(layout: any) {
    const arrows: any[] = [];
    const allVariables = [
      ...layout.globals,
      ...layout.stack.flatMap((f: any) => f.locals),
      ...layout.heap
    ];

    // Find pointer variables and create arrows to their targets
    allVariables.forEach((variable: any) => {
      if (variable.type?.includes('*') || variable.type?.includes('ptr')) {
        // Find target by address
        const targetAddress = variable.value;
        const target = allVariables.find(v => v.address === targetAddress);
        
        if (target) {
          arrows.push({
            id: `arrow-${variable.id}-${target.id}`,
            from: {
              x: variable.x + variable.width,
              y: variable.y + variable.height / 2
            },
            to: {
              x: target.x,
              y: target.y + target.height / 2
            },
            color: '#F59E0B'
          });
        }
      }
    });

    return arrows;
  }
}

// Enhanced Variable Box Component with animations
const VariableBox: React.FC<any> = ({ data, onUpdate }) => {
  const groupRef = useRef<Konva.Group>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const [isHovered, setIsHovered] = useState(false);
  const prevValue = useRef(data.value);

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    node.to({
      x: data.x,
      y: data.y,
      duration: 0.3,
      easing: Konva.Easings.EaseInOut
    });
  }, [data.x, data.y]);

  useEffect(() => {
    if (prevValue.current !== data.value && rectRef.current) {
      rectRef.current.to({
        fill: '#FCD34D',
        duration: 0.1,
        onFinish: () => {
          rectRef.current?.to({
            fill: data.section === 'global' ? '#1E293B' : '#334155',
            duration: 0.3
          });
        }
      });
      prevValue.current = data.value;
    }
  }, [data.value, data.section]);

  const color = data.section === 'global' ? '#2DD4BF' : '#3B82F6';

  return (
    <Group
      ref={groupRef}
      x={data.x}
      y={data.y}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Rect
        ref={rectRef}
        width={data.width}
        height={data.height}
        fill={isHovered ? '#475569' : data.section === 'global' ? '#1E293B' : '#334155'}
        stroke={color}
        strokeWidth={isHovered ? 3 : 2}
        cornerRadius={8}
        shadowBlur={isHovered ? 12 : 6}
        shadowColor={color}
        shadowOpacity={0.4}
      />
      <Text
        x={12}
        y={12}
        text={data.name}
        fontSize={14}
        fill={color}
        fontStyle="bold"
      />
      <Text
        x={12}
        y={30}
        text={data.type}
        fontSize={11}
        fill="#94A3B8"
      />
      <Text
        x={12}
        y={48}
        text={String(data.value ?? 'undefined')}
        fontSize={18}
        fill="#F1F5F9"
        fontStyle="bold"
        fontFamily="monospace"
      />
      <Text
        x={data.width - 12}
        y={data.height - 18}
        text={data.address}
        fontSize={10}
        fill="#64748B"
        align="right"
        width={data.width - 24}
      />
    </Group>
  );
};

// Stack Frame Component
const StackFrameBox: React.FC<any> = ({ frame }) => {
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    node.to({
      y: frame.y,
      duration: 0.3,
      easing: Konva.Easings.EaseInOut
    });
  }, [frame.y]);

  return (
    <Group ref={groupRef} x={frame.x} y={frame.y}>
      <Rect
        width={frame.width}
        height={frame.height}
        fill="#1E293B"
        stroke={frame.isActive ? '#3B82F6' : '#334155'}
        strokeWidth={frame.isActive ? 3 : 2}
        cornerRadius={8}
        shadowBlur={frame.isActive ? 15 : 5}
        shadowColor="#3B82F6"
        shadowOpacity={frame.isActive ? 0.5 : 0.2}
      />
      <Rect
        width={frame.width}
        height={50}
        fill={frame.isActive ? '#2563EB' : '#334155'}
        cornerRadius={[8, 8, 0, 0]}
      />
      <Text
        x={20}
        y={15}
        text={`${frame.function}()`}
        fontSize={16}
        fill="#F1F5F9"
        fontStyle="bold"
      />
      {frame.isActive && (
        <Rect
          x={frame.width - 80}
          y={13}
          width={60}
          height={24}
          fill="#3B82F6"
          cornerRadius={4}
        />
      )}
      {frame.isActive && (
        <Text
          x={frame.width - 75}
          y={17}
          text="ACTIVE"
          fontSize={10}
          fill="#FFFFFF"
          fontStyle="bold"
        />
      )}
    </Group>
  );
};

// Pointer Arrow Component with curved paths
const PointerArrowComponent: React.FC<any> = ({ arrow }) => {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    // Create curved arrow path
    const dx = arrow.to.x - arrow.from.x;
    const dy = arrow.to.y - arrow.from.y;
    const controlX = arrow.from.x + dx * 0.5;
    const controlY = arrow.from.y + dy * 0.5 + Math.abs(dx) * 0.2;

    setPoints([
      arrow.from.x, arrow.from.y,
      controlX, controlY,
      arrow.to.x, arrow.to.y
    ]);
  }, [arrow]);

  if (points.length === 0) return null;

  return (
    <Arrow
      points={points}
      stroke={arrow.color}
      fill={arrow.color}
      strokeWidth={3}
      pointerLength={12}
      pointerWidth={12}
      bezier
      tension={0.3}
      shadowBlur={8}
      shadowColor={arrow.color}
      shadowOpacity={0.5}
    />
  );
};

// Main Enhanced Visualization Canvas
export default function EnhancedVisualizationCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(false);

  const { getCurrentStep } = useExecutionStore();
  const currentStep = getCurrentStep();
  const state = currentStep?.state;

  // Calculate layout
  const layout = state ? LayoutEngine.calculateLayout(state, dimensions.width, dimensions.height) : null;

  // Canvas Controls
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.1, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.1, 0.3));
  }, []);

  const handleFitToScreen = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

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

    const newScale = e.evt.deltaY > 0 
      ? Math.max(oldScale * 0.95, 0.3) 
      : Math.min(oldScale * 1.05, 3);

    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    });
  }, []);

  // Update dimensions
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
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
  }, []);

  if (!state) {
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
          color: '#94A3B8'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>🎨</div>
          <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#F1F5F9' }}>
            Enhanced Visualization Canvas
          </div>
          <div style={{ fontSize: '14px', color: '#64748B' }}>
            Run your code to see memory visualization with loops, pointers, heap, and more
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#0F172A', position: 'relative' }}>
      {/* Figma-like Controls */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        display: 'flex',
        gap: '8px',
        backgroundColor: '#1E293B',
        padding: '8px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <button
          onClick={() => setDragMode(!dragMode)}
          style={{
            padding: '8px',
            backgroundColor: dragMode ? '#3B82F6' : '#334155',
            border: 'none',
            borderRadius: '4px',
            color: '#F1F5F9',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Pan Mode (Space)"
        >
          <Move size={18} />
        </button>
        <button
          onClick={handleZoomIn}
          style={{
            padding: '8px',
            backgroundColor: '#334155',
            border: 'none',
            borderRadius: '4px',
            color: '#F1F5F9',
            cursor: 'pointer'
          }}
          title="Zoom In (+)"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            padding: '8px',
            backgroundColor: '#334155',
            border: 'none',
            borderRadius: '4px',
            color: '#F1F5F9',
            cursor: 'pointer'
          }}
          title="Zoom Out (-)"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={handleFitToScreen}
          style={{
            padding: '8px',
            backgroundColor: '#334155',
            border: 'none',
            borderRadius: '4px',
            color: '#F1F5F9',
            cursor: 'pointer'
          }}
          title="Fit to Screen (0)"
        >
          <Maximize2 size={18} />
        </button>
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#334155',
          borderRadius: '4px',
          color: '#94A3B8',
          fontSize: '12px',
          fontFamily: 'monospace',
          fontWeight: 600'
        }}>
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Step Info */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 10,
        backgroundColor: '#1E293B',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: '500px'
      }}>
        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px', fontWeight: 600 }}>
          Step {currentStep.id + 1} • Line {currentStep.line}
        </div>
        <div style={{ fontSize: '14px', color: '#F1F5F9' }}>
          {currentStep.explanation}
        </div>
      </div>

      {/* Canvas */}
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={dragMode}
        onWheel={handleWheel}
        onDragEnd={(e) => {
          setPosition({ x: e.target.x(), y: e.target.y() });
        }}
      >
        <Layer>
          {/* Background */}
          <Rect
            x={-position.x / scale}
            y={-position.y / scale}
            width={dimensions.width / scale}
            height={dimensions.height / scale}
            fill="#0F172A"
          />

          {/* Grid */}
          {Array.from({ length: 50 }).map((_, i) => (
            <React.Fragment key={`grid-${i}`}>
              <Line
                points={[i * 50, -position.y / scale, i * 50, dimensions.height / scale]}
                stroke="#1E293B"
                strokeWidth={1 / scale}
                opacity={0.3}
              />
              <Line
                points={[-position.x / scale, i * 50, dimensions.width / scale, i * 50]}
                stroke="#1E293B"
                strokeWidth={1 / scale}
                opacity={0.3}
              />
            </React.Fragment>
          ))}

          {/* Section Labels */}
          {layout?.globals.length > 0 && (
            <Text
              x={40}
              y={20}
              text="GLOBAL MEMORY"
              fontSize={16}
              fill="#2DD4BF"
              fontStyle="bold"
              letterSpacing={1}
            />
          )}

          {layout?.stack.length > 0 && (
            <Text
              x={40}
              y={layout.globals.length > 0 ? layout.globals[layout.globals.length - 1].y + 120 : 20}
              text="CALL STACK"
              fontSize={16}
              fill="#3B82F6"
              fontStyle="bold"
              letterSpacing={1}
            />
          )}

          {/* Global Variables */}
          {layout?.globals.map((variable: any) => (
            <VariableBox key={variable.id} data={variable} />
          ))}

          {/* Stack Frames */}
          {layout?.stack.map((frame: any) => (
            <Group key={frame.id}>
              <StackFrameBox frame={frame} />
              {frame.locals.map((variable: any) => (
                <VariableBox key={variable.id} data={variable} />
              ))}
            </Group>
          ))}

          {/* Heap */}
          {layout?.heap.map((block: any) => (
            <VariableBox key={block.id} data={block} />
          ))}

          {/* Pointer Arrows */}
          {layout?.pointers.map((arrow: any) => (
            <PointerArrowComponent key={arrow.id} arrow={arrow} />
          ))}

          {/* Output Box */}
          {layout?.output && (
            <Group x={layout.output.x} y={layout.output.y}>
              <Rect
                width={layout.output.width}
                height={layout.output.height}
                fill="#1E293B"
                stroke="#10B981"
                strokeWidth={2}
                cornerRadius={8}
              />
              <Text
                x={12}
                y={12}
                text="OUTPUT"
                fontSize={12}
                fill="#10B981"
                fontStyle="bold"
              />
              <Text
                x={12}
                y={32}
                text={layout.output.content}
                fontSize={14}
                fill="#F1F5F9"
                fontFamily="monospace"
                width={layout.output.width - 24}
                wrap="word"
              />
            </Group>
          )}
        </Layer>
      </Stage>
    </div>
  );
}
