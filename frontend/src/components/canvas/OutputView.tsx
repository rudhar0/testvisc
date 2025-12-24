import React, { useRef, useEffect } from 'react';
import Konva from 'konva';
import { Group, Rect, Text } from 'react-konva';

// NOTE: These constants are duplicated from VisualizationCanvas.tsx for component isolation.
// In a larger application, they should be moved to a shared theme file.
const COLORS = {
  dark: {
    background: { secondary: '#1E293B' },
    text: { primary: '#F1F5F9', secondary: '#94A3B8' },
    border: { primary: '#334155' }
  }
};

const LAYOUT = {
  fontSize: { title: 16 },
  borderRadius: 8,
};

interface OutputViewProps {
  output: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const OutputView: React.FC<OutputViewProps> = ({ output, x, y, width, height }) => {
  const groupRef = useRef<Konva.Group>(null);
  const [initialPos] = React.useState({ x, y });
  const isInitialMount = useRef(true);

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      node.x(x);
      node.y(y + 20); // Start slightly lower for a slide-in effect
      node.opacity(0);
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

  return (
    <Group ref={groupRef} x={initialPos.x} y={initialPos.y}>
      <Text
        y={-25}
        text="OUTPUT"
        fontSize={LAYOUT.fontSize.title}
        fill={COLORS.dark.text.secondary}
        fontStyle="bold"
        letterSpacing={1}
      />
      <Rect
        width={width}
        height={height}
        fill={COLORS.dark.background.secondary}
        stroke={COLORS.dark.border.primary}
        strokeWidth={1}
        cornerRadius={LAYOUT.borderRadius}
        shadowBlur={10}
        shadowColor="#000000"
        shadowOpacity={0.2}
      />
      {output && output.trim() !== '' ? (
        <Text
          x={15}
          y={15}
          width={width - 30}
          height={height - 30}
          text={output}
          fontSize={14}
          fontFamily="monospace"
          fill={COLORS.dark.text.primary}
          lineHeight={1.5}
          // Clip text to prevent it from overflowing the box
          clipFunc={(ctx) => {
            ctx.rect(0, 0, width - 30, height - 30);
          }}
        />
      ) : (
        <Text
          x={15}
          y={15}
          text="No output..."
          fontSize={14}
          fill={COLORS.dark.text.secondary}
          fontStyle="italic"
        />
      )}
    </Group>
  );
};

export default OutputView;