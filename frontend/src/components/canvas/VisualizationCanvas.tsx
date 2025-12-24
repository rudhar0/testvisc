
import React, { useRef, useEffect, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer, Group, Rect, Text, Line } from 'react-konva';
import { useExecutionStore } from '@store/slices/executionSlice';
import { useCanvasStore } from '@store/slices/canvasSlice';
import OutputView from './OutputView';

const COLORS = {
  memory: {
    global: { DEFAULT: '#2DD4BF', light: '#5EEAD4', dark: '#14B8A6' },
    stack: { DEFAULT: '#3B82F6', light: '#60A5FA', dark: '#2563EB' },
  },
  dark: {
    background: { primary: '#0F172A', secondary: '#1E293B', tertiary: '#334155' },
    text: { primary: '#F1F5F9', secondary: '#94A3B8', tertiary: '#64748B' },
    border: { primary: '#334155', secondary: '#475569' }
  }
};

const LAYOUT = {
  padding: 40,
  globalSection: { x: 40, y: 60 },
  stackSection: { x: 320, y: 60 },
  variable: { width: 160, height: 75, margin: 15, padding: 10 },
  stackFrame: { width: 400, margin: 25, padding: 20, headerHeight: 50 },
  fontSize: { title: 16, label: 13, value: 20, small: 11 },
  borderRadius: 8,
};

// Helper hook to get the previous value of a prop or state
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

interface VariableBoxProps {
  variable: any;
  x: number;
  y: number;
  color: any;
  onClick?: () => void;
}

const VariableBox: React.FC<VariableBoxProps> = ({ variable, x, y, color, onClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const groupRef = useRef<Konva.Group>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const [initialPos] = React.useState({ x, y });
  const isInitialMount = useRef(true);
  const prevValue = useRef(variable.value);

  // Logic to display an expression instead of a value when appropriate
  let formattedValue = variable.value;
  if (Array.isArray(formattedValue)) {
    formattedValue = `[${formattedValue.join(', ')}]`;
  }
  const valueStr = String(formattedValue ?? 'undefined');
  // An expression is only "shown" if it exists and is different from the final value literal.
  const showExpression = variable.expression && variable.expression !== valueStr;
  const displayContent = showExpression ? variable.expression : valueStr;
  // Use a smaller font for long expressions to prevent overflow
  const fontSize = displayContent.length > 8 ? 16 : LAYOUT.fontSize.value;

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      node.opacity(0);
      node.to({
        opacity: 1,
        duration: 0.4,
        easing: Konva.Easings.EaseOut,
      });
    } else {
      node.to({
        x: x,
        y: y,
        duration: 0.3,
        easing: Konva.Easings.EaseInOut,
      });
    }
  }, [x, y]);

  // Flash animation when value changes (e.g. in loops or output updates)
  useEffect(() => {
    if (prevValue.current !== variable.value) {
      const node = rectRef.current;
      if (node) {
        node.to({
          stroke: '#FCD34D', // Amber highlight for visibility
          strokeWidth: 4,
          shadowColor: '#FCD34D',
          shadowBlur: 15,
          duration: 0.1,
          onFinish: () => {
            node.to({
              stroke: color.DEFAULT,
              strokeWidth: 2,
              shadowColor: color.DEFAULT,
              shadowBlur: 6,
              duration: 0.3,
            });
          },
        });
      }
      prevValue.current = variable.value;
    }
  }, [variable.value, color.DEFAULT]);

  return (
    <Group 
      ref={groupRef}
      x={initialPos.x} 
      y={initialPos.y}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <Rect
        ref={rectRef}
        width={LAYOUT.variable.width}
        height={LAYOUT.variable.height}
        fill={isHovered ? COLORS.dark.background.tertiary : COLORS.dark.background.secondary}
        stroke={color.DEFAULT}
        strokeWidth={isHovered ? 3 : 2}
        cornerRadius={LAYOUT.borderRadius}
        shadowBlur={isHovered ? 12 : 6}
        shadowColor={color.DEFAULT}
        shadowOpacity={isHovered ? 0.5 : 0.3}
      />
      <Text
        x={LAYOUT.variable.padding}
        y={LAYOUT.variable.padding}
        text={variable.name}
        fontSize={LAYOUT.fontSize.label}
        fill={color.DEFAULT}
        fontStyle="bold"
      />
      <Text
        x={LAYOUT.variable.padding}
        y={LAYOUT.variable.padding + 18}
        text={variable.type}
        fontSize={LAYOUT.fontSize.small}
        fill={COLORS.dark.text.tertiary}
      />
      <Text
        x={LAYOUT.variable.padding}
        y={LAYOUT.variable.padding + 35}
        text={displayContent}
        fontSize={fontSize}
        fill={showExpression ? color.light : COLORS.dark.text.primary}
        fontStyle="bold"
        fontFamily="monospace"
      />
      <Text
        x={LAYOUT.variable.width - LAYOUT.variable.padding}
        y={LAYOUT.variable.height - 18}
        text={variable.address}
        fontSize={LAYOUT.fontSize.small}
        fill={COLORS.dark.text.tertiary}
        align="right"
        width={LAYOUT.variable.width - 2 * LAYOUT.variable.padding}
      />
    </Group>
  );
};

interface GlobalViewProps {
  globals: Record<string, any>;
  stdout?: string;
  startX: number;
  startY: number;
}

const GlobalView: React.FC<GlobalViewProps> = ({ globals, stdout, startX, startY }) => {
  const globalVars = Object.values(globals || {});
  const displayItems = [...globalVars];

  // Treat stdout as a variable if it exists
  if (stdout && stdout.trim()) {
    displayItems.push({
      name: 'stdout',
      type: 'stream',
      value: stdout,
      address: 'buffer'
    });
  }

  if (displayItems.length === 0) {
    return (
      <Group x={startX} y={startY}>
        <Text
          text="No global variables"
          fontSize={LAYOUT.fontSize.label}
          fill={COLORS.dark.text.secondary}
          fontStyle="italic"
        />
      </Group>
    );
  }

  return (
    <Group>
      <Text
        x={startX}
        y={startY - 35}
        text="GLOBAL MEMORY"
        fontSize={LAYOUT.fontSize.title}
        fill={COLORS.memory.global.DEFAULT}
        fontStyle="bold"
        letterSpacing={1}
      />
      <Rect
        x={startX - 5}
        y={startY - 10}
        width={LAYOUT.variable.width + 10}
        height={displayItems.length * (LAYOUT.variable.height + LAYOUT.variable.margin) + 10}
        fill="transparent"
        stroke={COLORS.memory.global.dark}
        strokeWidth={1}
        dash={[5, 5]}
        cornerRadius={LAYOUT.borderRadius}
        opacity={0.3}
      />
      {displayItems.map((variable: any, index: number) => (
        <VariableBox
          key={variable.name || index}
          variable={variable}
          x={startX}
          y={startY + index * (LAYOUT.variable.height + LAYOUT.variable.margin)}
          color={COLORS.memory.global}
        />
      ))}
    </Group>
  );
};

interface StackFrameProps {
  frame: any;
  x: number;
  y: number;
  isActive: boolean;
  frameHeight: number;
}

const StackFrame: React.FC<StackFrameProps> = ({ frame, x, y, isActive, frameHeight }) => {
  const groupRef = useRef<Konva.Group>(null);
  const [initialPos] = React.useState({ x, y });
  const isInitialMount = useRef(true);

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      node.opacity(0);
      node.y(y + 20); // Start slightly lower for a slide-in effect
      node.to({
        opacity: 1,
        y: y,
        duration: 0.4,
        easing: Konva.Easings.EaseOut,
      });
    } else {
      node.to({
        x: x,
        y: y,
        duration: 0.3,
        easing: Konva.Easings.EaseInOut,
      });
    }
  }, [x, y]);

  const locals = Object.values(frame.locals || {});

  return (
    <Group ref={groupRef} x={initialPos.x} y={initialPos.y}>
      {/* Frame Container */}
      <Rect
        width={LAYOUT.stackFrame.width}
        height={frameHeight}
        fill={COLORS.dark.background.secondary}
        stroke={isActive ? COLORS.memory.stack.DEFAULT : COLORS.dark.border.primary}
        strokeWidth={isActive ? 3 : 2}
        cornerRadius={LAYOUT.borderRadius}
        shadowBlur={isActive ? 15 : 5}
        shadowColor={COLORS.memory.stack.DEFAULT}
        shadowOpacity={isActive ? 0.4 : 0.1}
      />
      
      {/* Frame Header */}
      <Rect
        width={LAYOUT.stackFrame.width}
        height={LAYOUT.stackFrame.headerHeight}
        fill={isActive ? COLORS.memory.stack.dark : COLORS.dark.background.tertiary}
        cornerRadius={[LAYOUT.borderRadius, LAYOUT.borderRadius, 0, 0]}
      />
      
      <Text
        x={LAYOUT.stackFrame.padding}
        y={15}
        text={`${frame.function}()`}
        fontSize={LAYOUT.fontSize.title}
        fill={COLORS.dark.text.primary}
        fontStyle="bold"
      />
      
      <Text
        x={LAYOUT.stackFrame.padding}
        y={35}
        text={`${frame.frameId} • ${frame.returnType}`}
        fontSize={LAYOUT.fontSize.small}
        fill={COLORS.dark.text.secondary}
      />

      {/* Active Indicator */}
      {isActive && (
        <Rect
          x={LAYOUT.stackFrame.width - 80}
          y={12}
          width={60}
          height={24}
          fill={COLORS.memory.stack.DEFAULT}
          cornerRadius={4}
        />
      )}
      {isActive && (
        <Text
          x={LAYOUT.stackFrame.width - 75}
          y={16}
          text="ACTIVE"
          fontSize={10}
          fill="#FFFFFF"
          fontStyle="bold"
        />
      )}

      {/* Local Variables */}
      {locals.length > 0 ? (
        <Group y={LAYOUT.stackFrame.headerHeight + LAYOUT.stackFrame.padding}>
          {locals.map((variable: any, vIndex: number) => (
            <VariableBox
              key={variable.name || vIndex}
              variable={variable}
              x={10}
              y={vIndex * (LAYOUT.variable.height + 10)}
              color={COLORS.memory.stack}
            />
          ))}
        </Group>
      ) : (
        <Text
          x={LAYOUT.stackFrame.padding}
          y={LAYOUT.stackFrame.headerHeight + 20}
          text="No local variables"
          fontSize={LAYOUT.fontSize.label}
          fill={COLORS.dark.text.tertiary}
          fontStyle="italic"
        />
      )}
    </Group>
  );
};

interface ReturnValueFXProps {
  animation: {
    key: number;
    value: any;
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null;
}

const ReturnValueFX: React.FC<ReturnValueFXProps> = ({ animation }) => {
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    const node = groupRef.current;
    if (!animation || !node) return;

    node.position(animation.from);
    node.opacity(1);
    node.to({
      x: animation.to.x,
      y: animation.to.y,
      duration: 0.6,
      easing: Konva.Easings.CubicEaseInOut,
      onFinish: () => {
        node.to({
          opacity: 0,
          duration: 0.3,
        });
      },
    });
  }, [animation]);

  if (!animation) return null;

  const text = String(animation.value);
  // Estimate box size based on text length
  const boxWidth = text.length * 9 + 24;
  const boxHeight = 32;

  return (
    <Group ref={groupRef} opacity={0} listening={false}>
      <Rect
        width={boxWidth}
        height={boxHeight}
        fill={COLORS.memory.stack.dark}
        stroke={COLORS.memory.stack.light}
        strokeWidth={2}
        cornerRadius={6}
        offsetX={boxWidth / 2}
        offsetY={boxHeight / 2}
        shadowColor={COLORS.memory.stack.DEFAULT}
        shadowBlur={15}
        shadowOpacity={0.7}
      />
      <Text
        text={text}
        fontSize={14}
        fill={COLORS.dark.text.primary}
        fontFamily="monospace"
        fontStyle="bold"
        width={boxWidth}
        height={boxHeight}
        align="center"
        verticalAlign="middle"
        offsetX={boxWidth / 2}
        offsetY={boxHeight / 2}
      />
    </Group>
  );
};

interface StackViewProps {
  callStack: any[];
  startX: number;
  startY: number;
}

const StackView: React.FC<StackViewProps> = ({ callStack, startX, startY }) => {
  if (!callStack || callStack.length === 0) {
    return (
      <Group x={startX} y={startY}>
        <Text
          text="No active stack frames"
          fontSize={LAYOUT.fontSize.label}
          fill={COLORS.dark.text.secondary}
          fontStyle="italic"
        />
      </Group>
    );
  }

  let currentY = startY;

  return (
    <Group>
      <Text
        x={startX}
        y={startY - 35}
        text="CALL STACK"
        fontSize={LAYOUT.fontSize.title}
        fill={COLORS.memory.stack.DEFAULT}
        fontStyle="bold"
        letterSpacing={1}
      />
      {[...callStack].reverse().map((frame: any, frameIndex: number) => {
        const locals = Object.values(frame.locals || {});
        const frameHeight = LAYOUT.stackFrame.headerHeight + 
          LAYOUT.stackFrame.padding + 
          (locals.length > 0 ? locals.length * (LAYOUT.variable.height + 10) + 10 : 40);
        // The active frame is the first one in the reversed list (the top of the stack).
        // The previous logic was highlighting the bottom of the stack (e.g., main).
        const isActive = frameIndex === 0;

        const frameY = currentY;
        currentY += frameHeight + LAYOUT.stackFrame.margin;

        return (
          <StackFrame
            key={frame.frameId || frameIndex}
            frame={frame}
            x={startX}
            y={frameY}
            isActive={isActive}
            frameHeight={frameHeight}
          />
        );
      })}
    </Group>
  );
};

export default function VisualizationCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { getCurrentStep } = useExecutionStore();
  const { setCanvasSize } = useCanvasStore();
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
  const [returnValueAnimation, setReturnValueAnimation] = useState<ReturnValueFXProps['animation']>(null);

  const currentStep = getCurrentStep();
  const prevStep = usePrevious(currentStep);
  const state = currentStep?.state;

  // Calculate layout values based on the current state
  const globals = state?.globals || {};

  // Effect to trigger the return value animation
  useEffect(() => {
    if (!prevStep || !currentStep || !prevStep.state || !currentStep.state) {
      return;
    }

    const prevStack = prevStep.state.callStack || [];
    const currentStack = currentStep.state.callStack || [];

    // A function return is detected when the call stack size decreases.
    // We also check if the previous step had a `returnValue` provided by the backend.
    if (prevStack.length > currentStack.length && prevStep.returnValue !== undefined) {
      
      // This helper duplicates layout logic from StackView to calculate frame positions.
      // This is necessary to know the positions of frames from the *previous* state.
      const calculateStackLayout = (stack: any[]) => {
        const layoutMap = new Map<string, { x: number, y: number, height: number }>();
        let currentY = LAYOUT.stackSection.y;
        [...stack].reverse().forEach(frame => {
          const locals = Object.values(frame.locals || {});
          const frameHeight = LAYOUT.stackFrame.headerHeight +
            LAYOUT.stackFrame.padding +
            (locals.length > 0 ? locals.length * (LAYOUT.variable.height + 10) + 10 : 40);
          layoutMap.set(frame.frameId, { x: LAYOUT.stackSection.x, y: currentY, height: frameHeight });
          currentY += frameHeight + LAYOUT.stackFrame.margin;
        });
        return layoutMap;
      };

      const prevLayout = calculateStackLayout(prevStack);
      const currentLayout = calculateStackLayout(currentStack);

      const poppedFrame = prevStack[prevStack.length - 1];
      const fromLayout = prevLayout.get(poppedFrame.frameId);

      // The destination is the frame that is now on top of the stack.
      const newActiveFrame = currentStack.length > 0 ? currentStack[currentStack.length - 1] : null;

      if (fromLayout) {
        const fromPos = {
          x: fromLayout.x + LAYOUT.stackFrame.width / 2,
          y: fromLayout.y + LAYOUT.stackFrame.headerHeight / 2
        };

        // If there's a new active frame, target it. Otherwise, animate off-screen.
        const toLayout = newActiveFrame ? currentLayout.get(newActiveFrame.frameId) : null;
        const toPos = toLayout 
          ? {
              x: toLayout.x + LAYOUT.stackFrame.width / 2,
              y: toLayout.y + LAYOUT.stackFrame.headerHeight / 2
            }
          : { x: fromPos.x, y: fromPos.y - 100 }; // Animate upwards if stack is empty

        setReturnValueAnimation({
          key: Date.now(), // Use a unique key to re-trigger the animation
          value: prevStep.returnValue,
          from: fromPos,
          to: toPos,
        });
      }
    }
  }, [currentStep, prevStep]);

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
    
    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
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
          <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>🎨</div>
          <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: COLORS.dark.text.primary }}>
            Visualization Canvas Ready
          </div>
          <div style={{ fontSize: '14px', color: COLORS.dark.text.tertiary }}>
            Write and run your C/C++ code to see memory visualization
          </div>
          <div style={{ 
            marginTop: '24px', 
            padding: '12px 24px', 
            backgroundColor: COLORS.dark.background.secondary,
            borderRadius: '8px',
            border: `1px solid ${COLORS.dark.border.primary}`,
            display: 'inline-block'
          }}>
            <div style={{ fontSize: '12px', color: COLORS.dark.text.secondary, marginBottom: '8px' }}>
              Try this sample code:
            </div>
            <pre style={{ 
              textAlign: 'left', 
              fontSize: '12px', 
              fontFamily: 'monospace',
              color: COLORS.dark.text.primary,
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
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        backgroundColor: COLORS.dark.background.primary,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <Stage width={dimensions.width} height={dimensions.height}>
        <Layer>
          {/* Background */}
          <Rect
            x={0}
            y={0}
            width={dimensions.width}
            height={dimensions.height}
            fill={COLORS.dark.background.primary}
          />

          {/* Grid Pattern (Optional) */}
          {Array.from({ length: Math.floor(dimensions.width / 50) }).map((_, i) => (
            <Rect
              key={`vline-${i}`}
              x={i * 50}
              y={0}
              width={1}
              height={dimensions.height}
              fill={COLORS.dark.border.primary}
              opacity={0.1}
            />
          ))}
          {Array.from({ length: Math.floor(dimensions.height / 50) }).map((_, i) => (
            <Rect
              key={`hline-${i}`}
              x={0}
              y={i * 50}
              width={dimensions.width}
              height={1}
              fill={COLORS.dark.border.primary}
              opacity={0.1}
            />
          ))}

          {/* Content */}
          <GlobalView
            globals={globals}
            stdout={state.stdout}
            startX={LAYOUT.globalSection.x}
            startY={LAYOUT.globalSection.y}
          />
          
          <StackView
            callStack={state.callStack || []}
            startX={LAYOUT.stackSection.x}
            startY={LAYOUT.stackSection.y}
          />

          <ReturnValueFX animation={returnValueAnimation} />

          {/* Step Info Overlay */}
          <Group x={20} y={dimensions.height - 80}>
            <Rect
              width={Math.min(500, dimensions.width - 40)}
              height={60}
              fill={COLORS.dark.background.secondary}
              stroke={COLORS.dark.border.secondary}
              strokeWidth={1}
              cornerRadius={LAYOUT.borderRadius}
              shadowBlur={10}
              shadowColor="#000000"
              shadowOpacity={0.3}
            />
            <Text
              x={15}
              y={12}
              text={`Step ${currentStep.id + 1} • Line ${currentStep.line}`}
              fontSize={11}
              fill={COLORS.dark.text.tertiary}
              fontStyle="bold"
            />
            <Text
              x={15}
              y={28}
              text={currentStep.explanation}
              fontSize={14}
              fill={COLORS.dark.text.primary}
              width={Math.min(470, dimensions.width - 70)}
              wrap="word"
            />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}