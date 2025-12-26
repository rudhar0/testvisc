
import React from 'react';
import { Group, Rect, Text } from 'react-konva';

interface LoopContainerProps {
  id: string;
  condition: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children?: React.ReactNode;
}

const LOOP_COLORS = {
  bg: '#3E1C71',
  border: '#6B21A8',
  header: '#4A238A',
  text: '#E9D5FF'
};

export const LoopContainer: React.FC<LoopContainerProps> = ({
  id,
  condition,
  x,
  y,
  width,
  height,
  children
}) => {
  const headerHeight = 30;

  return (
    <Group id={id} x={x} y={y}>
      <Rect
        width={width}
        height={height}
        fill={LOOP_COLORS.bg}
        stroke={LOOP_COLORS.border}
        strokeWidth={2}
        cornerRadius={8}
        opacity={0.5}
      />
      <Rect
        width={width}
        height={headerHeight}
        fill={LOOP_COLORS.header}
        cornerRadius={[8, 8, 0, 0]}
      />
      <Text
        x={10}
        y={8}
        text={`loop (${condition})`}
        fontSize={12}
        fontStyle="bold"
        fill={LOOP_COLORS.text}
      />
      <Group x={0} y={headerHeight}>
        {children}
      </Group>
    </Group>
  );
};

export default LoopContainer;
