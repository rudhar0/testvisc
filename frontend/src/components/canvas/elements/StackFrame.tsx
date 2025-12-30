
import React from 'react';
import { Group, Rect, Text } from 'react-konva';

interface StackFrameProps {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const StackFrame: React.FC<StackFrameProps> = ({ id, name, x, y, width, height }) => {
  return (
    <Group id={id} x={x} y={y}>
      <Rect
        width={width}
        height={height}
        fill="#1E293B"
        stroke="#3B82F6"
        strokeWidth={2}
        cornerRadius={8}
      />
      <Text
        text={name}
        x={10}
        y={10}
        fontSize={16}
        fontStyle="bold"
        fill="#3B82F6"
      />
    </Group>
  );
};

export default StackFrame;
