import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Text, Group, Arrow, Circle } from 'react-konva';
import { useExecutionStore } from '../../store/slices/executionSlice.ts';
import { useCanvasStore } from '../../store/slices/canvasSlice.ts';

// ============================================
// COLOR CONSTANTS (from theme)
// ============================================
const COLORS = {
  memory: {
    global: { DEFAULT: '#2DD4BF', light: '#5EEAD4', dark: '#14B8A6' },
    stack: { DEFAULT: '#3B82F6', light: '#60A5FA', dark: '#2563EB' },
    heap: { DEFAULT: '#10B981', light: '#34D399', dark: '#059669' },
    array: { DEFAULT: '#F59E0B', light: '#FBBF24', dark: '#D97706' }
  },
  flow: {
    pointer: { DEFAULT: '#EF4444' },
    value: { DEFAULT: '#06B6D4' }
  },
  dark: {
    background: { primary: '#0F172A', secondary: '#1E293B' },
    text: { primary: '#F1F5F9', secondary: '#94A3B8' },
    border: { primary: '#334155' }
  }
};

// ============================================
// LAYOUT CONSTANTS
// ============================================
const LAYOUT = {
  padding: 40,
  globalSection: { x: 40, y: 40, width: 200 },
  stackSection: { x: 280, y: 40, width: 400 },
  heapSection: { x: 720, y: 40, width: 300 },
  
  variable: { width: 160, height: 70, margin: 15, padding: 10 },
  stackFrame: { width: 380, height: 'auto', margin: 20, padding: 15 },
  arrayCell: { width: 50, height: 50, spacing: 5 },
  
  fontSize: { title: 16, label: 14, value: 18, small: 12 },
  borderRadius: 8,
  borderWidth: 2
};

// ============================================
// VARIABLE BOX COMPONENT
// ============================================
const VariableBox = ({ variable, x, y, color, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const boxWidth = LAYOUT.variable.width;
  const boxHeight = LAYOUT.variable.height;
  
  return (
    <Group
      x={x}
      y={y}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background */}
      <Rect
        width={boxWidth}
        height={boxHeight}
        fill={isHovered ? color.light : COLORS.dark.background.secondary}
        stroke={color.DEFAULT}
        strokeWidth={LAYOUT.borderWidth}
        cornerRadius={LAYOUT.borderRadius}
        shadowBlur={isHovered ? 10 : 0}
        shadowColor={color.DEFAULT}
      />
      
      {/* Variable Name */}
      <Text
        x={LAYOUT.variable.padding}
        y={LAYOUT.variable.padding}
        text={variable.name}
        fontSize={LAYOUT.fontSize.label}
        fill={color.DEFAULT}
        fontStyle="bold"
      />
      
      {/* Type */}
      <Text
        x={LAYOUT.variable.padding}
        y={LAYOUT.variable.padding + 20}
        text={variable.type}
        fontSize={LAYOUT.fontSize.small}
        fill={COLORS.dark.text.secondary}
      />
      
      {/* Value */}
      <Text
        x={LAYOUT.variable.padding}
        y={LAYOUT.variable.padding + 38}
        text={String(variable.value)}
        fontSize={LAYOUT.fontSize.value}
        fill={COLORS.dark.text.primary}
        fontStyle="bold"
      />
      
      {/* Address Label */}
      <Text
        x={boxWidth - 10}
        y={boxHeight - 20}
        text={variable.address}
        fontSize={LAYOUT.fontSize.small}
        fill={COLORS.dark.text.secondary}
        align="right"
      />
    </Group>
  );
};

// ============================================
// GLOBAL VARIABLES VIEW
// ============================================
const GlobalView = ({ globals, startX, startY }) => {
  if (!globals || Object.keys(globals).length === 0) {
    return (
      <Group x={startX} y={startY}>
        <Text
          text="No global variables"
          fontSize={LAYOUT.fontSize.label}
          fill={COLORS.dark.text.secondary}
        />
      </Group>
    );
  }
  
  const globalVars = Object.values(globals);
  
  return (
    <Group>
      {/* Section Title */}
      <Text
        x={startX}
        y={startY - 30}
        text="GLOBAL MEMORY"
        fontSize={LAYOUT.fontSize.title}
        fill={COLORS.memory.global.DEFAULT}
        fontStyle="bold"
      />
      
      {/* Variables */}
      {globalVars.map((variable, index) => (
        <VariableBox
          key={variable.name}
          variable={variable}
          x={startX}
          y={startY + index * (LAYOUT.variable.height + LAYOUT.variable.margin)}
          color={COLORS.memory.global}
        />
      ))}
    </Group>
  );
};

// ============================================
// STACK FRAME COMPONENT
// ============================================
const StackFrameBox = ({ frame, x, y, isActive }) => {
  const locals = Object.values(frame.locals || {});
  const frameHeight = 80 + locals.length * (LAYOUT.variable.height + 10);
  
  return (
    <Group x={x} y={y}>
      {/* Frame Container */}
      <Rect
        width={LAYOUT.stackFrame.width}
        height={frameHeight}
        fill={COLORS.dark.background.secondary}
        stroke={isActive ? COLORS.memory.stack.DEFAULT : COLORS.dark.border.primary}
        strokeWidth={isActive ? 3 : LAYOUT.borderWidth}
        cornerRadius={LAYOUT.borderRadius}
        shadowBlur={isActive ? 15 : 0}
        shadowColor={COLORS.memory.stack.DEFAULT}
      />
      
      {/* Function Name Header */}
      <Rect
        width={LAYOUT.stackFrame.width}
        height={50}
        fill={COLORS.memory.stack.dark}
        cornerRadius={[LAYOUT.borderRadius, LAYOUT.borderRadius, 0, 0]}
      />
      
      <Text
        x={15}
        y={15}
        text={`${frame.function}()`}
        fontSize={LAYOUT.fontSize.title}
        fill={COLORS.dark.text.primary}
        fontStyle="bold"
      />
      
      <Text
        x={15}
        y={35}
        text={frame.frameId}
        fontSize={LAYOUT.fontSize.small}
        fill={COLORS.dark.text.secondary}
      />
      
      {/* Local Variables */}
      {locals.length > 0 ? (
        <Group y={60}>
          {locals.map((variable, index) => (
            <VariableBox
              key={variable.name}
              variable={variable}
              x={10}
              y={10 + index * (LAYOUT.variable.height + 10)}
              color={COLORS.memory.stack}
            />
          ))}
        </Group>
      ) : (
        <Text
          x={15}
          y={70}
          text="No local variables"
          fontSize={LAYOUT.fontSize.label}
          fill={COLORS.dark.text.secondary}
        />
      )}
    </Group>
  );
};

// ============================================
// STACK VIEW
// ============================================
const StackView = ({ callStack, startX, startY }) => {
  if (!callStack || callStack.length === 0) {
    return (
      <Group x={startX} y={startY}>
        <Text
          text="No active stack frames"
          fontSize={LAYOUT.fontSize.label}
          fill={COLORS.dark.text.secondary}
        />
      </Group>
    );
  }
  
  let currentY = startY;
  
  return (
    <Group>
      {/* Section Title */}
      <Text
        x={startX}
        y={startY - 30}
        text="CALL STACK"
        fontSize={LAYOUT.fontSize.title}
        fill={COLORS.memory.stack.DEFAULT}
        fontStyle="bold"
      />
      
      {/* Stack Frames (bottom to top) */}
      {[...callStack].reverse().map((frame, index) => {
        const frameComponent = (
          <StackFrameBox
            key={frame.frameId}
            frame={frame}
            x={startX}
            y={currentY}
            isActive={index === callStack.length - 1}
          />
        );
        
        const locals = Object.values(frame.locals || {});
        const frameHeight = 80 + locals.length * (LAYOUT.variable.height + 10);
        currentY += frameHeight + LAYOUT.stackFrame.margin;
        
        return frameComponent;
      })}
    </Group>
  );
};

// ============================================
// ARRAY VIEW COMPONENT
// ============================================
const ArrayView = ({ array, x, y }) => {
  const cells = array.values || [];
  const cellWidth = LAYOUT.arrayCell.width;
  const cellHeight = LAYOUT.arrayCell.height;
  const spacing = LAYOUT.arrayCell.spacing;
  
  return (
    <Group x={x} y={y}>
      {/* Array Name */}
      <Text
        x={0}
        y={-25}
        text={`${array.name}[${array.size}]`}
        fontSize={LAYOUT.fontSize.label}
        fill={COLORS.memory.array.DEFAULT}
        fontStyle="bold"
      />
      
      {/* Array Cells */}
      <Group>
        {cells.map((cell, index) => (
          <Group key={index} x={index * (cellWidth + spacing)} y={0}>
            {/* Cell Box */}
            <Rect
              width={cellWidth}
              height={cellHeight}
              fill={COLORS.dark.background.secondary}
              stroke={COLORS.memory.array.DEFAULT}
              strokeWidth={2}
              cornerRadius={4}
            />
            
            {/* Value */}
            <Text
              x={cellWidth / 2}
              y={cellHeight / 2 - 8}
              text={String(cell.value)}
              fontSize={LAYOUT.fontSize.value}
              fill={COLORS.dark.text.primary}
              align="center"
              width={cellWidth}
              fontStyle="bold"
            />
            
            {/* Index */}
            <Text
              x={cellWidth / 2}
              y={cellHeight + 5}
              text={String(index)}
              fontSize={LAYOUT.fontSize.small}
              fill={COLORS.dark.text.secondary}
              align="center"
              width={cellWidth}
            />
          </Group>
        ))}
      </Group>
    </Group>
  );
};

// ============================================
// POINTER ARROW COMPONENT
// ============================================
const PointerArrow = ({ fromX, fromY, toX, toY, color = COLORS.flow.pointer.DEFAULT }) => {
  return (
    <Arrow
      points={[fromX, fromY, toX, toY]}
      stroke={color}
      strokeWidth={3}
      fill={color}
      pointerLength={10}
      pointerWidth={10}
      dash={[10, 5]}
      shadowBlur={5}
      shadowColor={color}
    />
  );
};

// ============================================
// MAIN VISUALIZATION CANVAS
// ============================================
const VisualizationCanvas = () => {
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  
  const { getCurrentStep } = useExecutionStore();
  const { zoom, position, setCanvasSize } = useCanvasStore();
  
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  const currentStep = getCurrentStep();
  const state = currentStep?.state;
  
  // Update canvas size on mount and resize
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
          backgroundColor: COLORS.dark.background.primary,
          color: COLORS.dark.text.secondary
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            Canvas Ready
          </div>
          <div style={{ fontSize: '14px' }}>
            Run your code to visualize execution
          </div>
        </div>
      </div>
    );
  }
  
  // Extract arrays from variables
  const arrays = [];
  if (state.callStack && state.callStack.length > 0) {
    const topFrame = state.callStack[state.callStack.length - 1];
    Object.values(topFrame.locals || {}).forEach((variable) => {
      if (variable.type?.includes('[]') && variable.values) {
        arrays.push(variable);
      }
    });
  }
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        backgroundColor: COLORS.dark.background.primary,
        overflow: 'hidden'
      }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={zoom}
        scaleY={zoom}
        x={position.x}
        y={position.y}
        draggable
      >
        <Layer>
          {/* Background Grid (optional) */}
          <Rect
            x={0}
            y={0}
            width={dimensions.width / zoom}
            height={dimensions.height / zoom}
            fill={COLORS.dark.background.primary}
          />
          
          {/* Global Variables */}
          <GlobalView
            globals={state.globals}
            startX={LAYOUT.globalSection.x}
            startY={LAYOUT.globalSection.y}
          />
          
          {/* Call Stack */}
          <StackView
            callStack={state.callStack}
            startX={LAYOUT.stackSection.x}
            startY={LAYOUT.stackSection.y}
          />
          
          {/* Arrays (if any) */}
          {arrays.map((array, index) => (
            <ArrayView
              key={array.name}
              array={array}
              x={LAYOUT.heapSection.x}
              y={LAYOUT.heapSection.y + index * 120}
            />
          ))}
          
          {/* Step Info Overlay */}
          <Group x={20} y={dimensions.height / zoom - 60}>
            <Rect
              width={300}
              height={50}
              fill={COLORS.dark.background.secondary}
              stroke={COLORS.dark.border.primary}
              strokeWidth={1}
              cornerRadius={8}
              opacity={0.95}
            />
            <Text
              x={15}
              y={10}
              text={currentStep.explanation}
              fontSize={14}
              fill={COLORS.dark.text.primary}
              width={270}
              wrap="word"
            />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
};

export default VisualizationCanvas;