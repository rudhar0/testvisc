import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';

interface OutputBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
}

const COLORS = {
  bg: '#1E293B',
  border: '#10B981',
  text: { primary: '#F1F5F9', secondary: '#10B981' }
};

export const OutputBox: React.FC<OutputBoxProps> = ({ x, y, width, height, content }) => {
  const groupRef = useRef<Konva.Group>(null);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const prevContentRef = useRef(content);

  // APPEAR ANIMATION
  useEffect(() => {
    const node = groupRef.current;
    if (!node || !isInitialMount) return;

    node.opacity(0);
    node.y(y + 15);
    node.to({
      opacity: 1,
      y: y,
      duration: 0.4,
      easing: Konva.Easings.EaseOut
    });

    setIsInitialMount(false);
  }, [y, isInitialMount]);

  // CONTENT UPDATE ANIMATION
  useEffect(() => {
    if (content !== prevContentRef.current && groupRef.current) {
      groupRef.current.to({
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 0.1,
        yoyo: true
      });
    }
    prevContentRef.current = content;
  }, [content]);

  return (
    <Group ref={groupRef} x={x} y={y}>
      <Rect
        width={width}
        height={height}
        fill={COLORS.bg}
        stroke={COLORS.border}
        strokeWidth={2}
        cornerRadius={8}
        shadowColor={COLORS.border}
        shadowBlur={10}
        shadowOpacity={0.4}
      />
      
      <Text
        x={15}
        y={12}
        text="OUTPUT"
        fontSize={12}
        fontStyle="bold"
        fill={COLORS.text.secondary}
        listening={false}
      />

      <Text
        x={15}
        y={35}
        text={content || 'No output'}
        fontSize={14}
        fontFamily="monospace"
        fill={content ? COLORS.text.primary : '#64748B'}
        fontStyle={content ? 'normal' : 'italic'}
        width={width - 30}
        height={height - 50}
        wrap="word"
        listening={false}
      />
    </Group>
  );
};
export default OutputBox;