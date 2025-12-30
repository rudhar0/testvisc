
import React from 'react';
import { Group, Rect, Text } from 'react-konva';

interface OutputElementProps {
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
}

const OutputElement: React.FC<OutputElementProps> = ({ x, y, width, height, content }) => {
  return (
    <Group x={x} y={y}>
      <Rect
        width={width}
        height={height}
        fill="#334155"
        cornerRadius={8}
      />
      <Text
        text={content}
        x={10}
        y={10}
        fontSize={14}
        fill="#F1F5F9"
        fontFamily="monospace"
      />
    </Group>
  );
};

export default OutputElement;
