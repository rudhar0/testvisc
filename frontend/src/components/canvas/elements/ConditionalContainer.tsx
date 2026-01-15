
import React from 'react';
import { Group, Rect, Text } from 'react-konva';

interface ConditionalContainerProps {
  id: string;
  condition: string;
  branchTaken: 'if' | 'else';
  x: number;
  y: number;
  width: number;
  height: number;
  ifChildren?: React.ReactNode;
  elseChildren?: React.ReactNode;
}

const CONDITIONAL_COLORS = {
  bg: '#0F3B3D',
  border: '#047857',
  header: '#065F46',
  text: '#A7F3D0',
  inactive: '#374151',
};

export const ConditionalContainer: React.FC<ConditionalContainerProps> = ({
  id,
  condition,
  branchTaken,
  x,
  y,
  width,
  height,
  ifChildren,
  elseChildren
}) => {
  const headerHeight = 30;
  const halfWidth = width / 2;

  return (
    <Group id={id} x={x} y={y}>
      <Rect
        width={width}
        height={height}
        fill={CONDITIONAL_COLORS.bg}
        stroke={CONDITIONAL_COLORS.border}
        strokeWidth={2}
        cornerRadius={8}
        opacity={0.5}
      />
      <Rect
        width={width}
        height={headerHeight}
        fill={CONDITIONAL_COLORS.header}
        cornerRadius={[8, 8, 0, 0]}
      />
      <Text
        x={10}
        y={8}
        text={`if (${condition})`}
        fontSize={12}
        fontStyle="bold"
        fill={CONDITIONAL_COLORS.text}
      />
      {/* If Branch */}
      <Group x={0} y={headerHeight} opacity={branchTaken === 'if' ? 1 : 0.5}>
        <Rect
          width={halfWidth}
          height={height - headerHeight}
          fill={branchTaken === 'if' ? CONDITIONAL_COLORS.bg : CONDITIONAL_COLORS.inactive}
        />
        {ifChildren}
      </Group>
      {/* Else Branch */}
      <Group x={halfWidth} y={headerHeight} opacity={branchTaken === 'else' ? 1 : 0.5}>
        <Rect
          width={halfWidth}
          height={height - headerHeight}
          fill={branchTaken === 'else' ? CONDITIONAL_COLORS.bg : CONDITIONAL_COLORS.inactive}
        />
        {elseChildren}
      </Group>
    </Group>
  );
};

export default ConditionalContainer;
