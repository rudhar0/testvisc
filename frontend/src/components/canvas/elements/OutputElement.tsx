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
  explanation?: string;
}

const COLORS = {
  bg: '#1E293B',
  border: '#10B981',
  borderLight: '#34D399',
  text: { primary: '#F1F5F9', secondary: '#94A3B8' },
};

const EXPLANATION_HEIGHT = 30;

export const OutputElement: React.FC<OutputElementProps> = ({
  id,
  value,
  x,
  y,
  width,
  height,
  isNew = false,
  subtype = 'output_printf',
  explanation
}) => {
  const groupRef = useRef<any>(null);

  console.log('[OutputElement] render attempt:', { id, x, y, width, height, value, isNew, subtype });

  useEffect(() => {
    const node = groupRef.current as any;
    console.debug('[OutputElement] render props:', { id, x, y, width, height, value, isNew, subtype });
    if (!node || !node.getLayer()) return;

    let tween: Konva.Tween | null = null;

    if (isNew) {
      console.log(`[OutputElement] Animating new output: ${value}`);
      node.setAttrs({ opacity: 0 });
      const currentX = typeof node.x === 'function' ? node.x() : node.attrs?.x ?? 0;
      const startX = currentX - 20;
      node.setAttrs({ x: startX });

      tween = new Konva.Tween({
        node,
        opacity: 1,
        x: x,
        duration: 0.36,
        easing: Konva.Easings.EaseOut,
      });
      tween.play();
    } else {
      node.setAttrs({ opacity: 1, x });
    }

    return () => {
      if (tween) {
        try { tween.pause(); tween.destroy(); } catch (e) { }
      }
    };
  }, [isNew, x, value, subtype, id]);

  const outputLabel = subtype === 'output_cout' ? 'cout <<' : subtype === 'output_endl' ? 'cout << endl' : 'printf';

  const safeWidth = typeof width === 'number' && isFinite(width) ? width : 200;
  const safeHeight = typeof height === 'number' && isFinite(height) ? height : 50;

  return (
    <Group ref={groupRef} id={id} x={x} y={y}>
      <Rect
        width={safeWidth}
        height={safeHeight}
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

      {explanation && (
        <Group y={safeHeight + 5}>
             <Rect
                width={safeWidth}
                height={EXPLANATION_HEIGHT}
                fill="rgba(30, 41, 59, 0.9)"
                stroke="#64748B"
                strokeWidth={1}
                cornerRadius={8}
             />
             <Text
                text={explanation}
                x={10}
                y={8}
                width={safeWidth - 20}
                fontSize={10}
                fill="#E2E8F0"
                fontFamily="'SF Pro Display', system-ui"
                align="center"
             />
        </Group>
      )}
    </Group>
  );
};

export default OutputElement;
