import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';

interface OutputElementProps {
  id: string;
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isNew?: boolean;
  subtype?: 'output_printf' | 'output_cout' | 'output_endl';
}

const COLORS = {
  bg: '#1E293B',
  border: '#10B981',
  borderLight: '#34D399',
  text: { primary: '#F1F5F9', secondary: '#94A3B8' },
};

export const OutputElement: React.FC<OutputElementProps> = ({
  id,
  value,
  x,
  y,
  width,
  height,
  isNew = false,
  subtype = 'output_printf'
}) => {
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    if (isNew) {
      console.log(`[OutputElement] Animating new output: ${value}`);
      node.opacity(0);
      const startX = x - 20;
      node.x(startX);
      
      const anim = new Konva.Tween({
        node,
        opacity: 1,
        x: x,
        duration: 0.4,
        easing: Konva.Easings.EaseOut,
      });
      anim.play();
    } else {
      node.opacity(1);
      node.x(x);
    }
  }, [isNew, x, value]);

  const outputLabel = subtype === 'output_cout' ? 'cout <<' : subtype === 'output_endl' ? 'cout << endl' : 'printf';

  return (
    <Group ref={groupRef} id={id} x={x} y={y}>
      <Rect
        width={width}
        height={height}
        fill={COLORS.bg}
        stroke={COLORS.border}
        strokeWidth={2}
        cornerRadius={8}
      />

      <Text
        text={`Output (${outputLabel}):`}
        x={12}
        y={8}
        fontSize={11}
        fill={COLORS.text.secondary}
        fontFamily="monospace"
      />

      <Text
        text={value || '(empty)'}
        x={12}
        y={28}
        fontSize={14}
        fill={COLORS.text.primary}
        fontFamily="monospace"
        fontStyle="bold"
      />
    </Group>
  );
};

export default OutputElement;
