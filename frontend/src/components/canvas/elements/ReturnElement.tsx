// frontend/src/components/canvas/elements/ReturnElement.tsx
// COMPLETE - Return visualization component

import React, { useRef, useEffect, memo } from 'react';
import { Group, Rect, Text, Circle } from 'react-konva';
import Konva from 'konva';

export interface ReturnElementProps {
  id: string;
  x: number;
  y: number;
  returnValue?: any;
  functionName: string;
  frameId: string;
  isNew?: boolean;
  stepNumber?: number;
  enterDelay?: number;
}

const BOX_WIDTH = 200;
const BOX_HEIGHT = 60;
const PADDING = 12;
const CORNER_RADIUS = 8;

const COLORS = {
  primary: '#EF4444',
  light: '#FCA5A5',
  bg: 'rgba(239, 68, 68, 0.15)',
  glow: 'rgba(239, 68, 68, 0.6)'
};

export const ReturnElement: React.FC<ReturnElementProps> = memo(({
  id,
  x,
  y,
  returnValue,
  functionName,
  frameId,
  isNew = false,
  stepNumber,
  enterDelay = 0
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const group = groupRef.current;

    if (!group) return;

    if (isNew && isInitialMount.current) {
      group.opacity(0);
      group.scaleX(0.8);
      group.scaleY(0.8);
      const origY = group.y();
      group.y(origY + 20);

      const playAnim = () => {
        new Konva.Tween({
          node: group,
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
          y: origY,
          duration: 0.4,
          easing: Konva.Easings.BackEaseOut
        }).play();
      };

      if (enterDelay > 0) {
        const t = setTimeout(playAnim, enterDelay);
        return () => clearTimeout(t);
      } else {
        playAnim();
      }
    } else if (isInitialMount.current) {
      group.opacity(1);
      group.scaleX(1);
      group.scaleY(1);
      isInitialMount.current = false;
    }
  }, [isNew, enterDelay]);

  return (
    <Group
      ref={groupRef}
      id={`${id}-step-${stepNumber || 0}`}
      x={x}
      y={y}
    >
      {/* Glow Effect */}
      <Rect
        x={-3}
        y={-3}
        width={BOX_WIDTH + 6}
        height={BOX_HEIGHT + 6}
        fill="transparent"
        cornerRadius={CORNER_RADIUS + 2}
        shadowColor={COLORS.glow}
        shadowBlur={12}
        shadowOpacity={0.5}
        opacity={0.7}
      />

      {/* Main Background */}
      <Rect
        width={BOX_WIDTH}
        height={BOX_HEIGHT}
        fill="rgba(15, 23, 42, 0.96)"
        stroke={COLORS.primary}
        strokeWidth={2}
        cornerRadius={CORNER_RADIUS}
        shadowColor="rgba(0, 0, 0, 0.3)"
        shadowBlur={10}
        shadowOffsetY={2}
      />

      {/* Header Background */}
      <Rect
        width={BOX_WIDTH}
        height={25}
        fill={COLORS.bg}
        cornerRadius={[CORNER_RADIUS, CORNER_RADIUS, 0, 0]}
      />

      {/* Return Icon */}
      <Circle
        x={PADDING + 8}
        y={BOX_HEIGHT / 2}
        radius={12}
        fill={COLORS.primary}
        opacity={0.2}
      />
      <Text
        text="↩"
        x={PADDING}
        y={BOX_HEIGHT / 2 - 8}
        fontSize={16}
        fill={COLORS.light}
        fontStyle="bold"
      />

      {/* Function Name */}
      <Text
        text={functionName}
        x={PADDING + 25}
        y={5}
        fontSize={10}
        fontStyle="bold"
        fill={COLORS.light}
        fontFamily="'SF Mono', monospace"
      />

      {/* Return Value */}
      <Text
        text={`Returns: ${returnValue !== undefined ? returnValue : 'void'}`}
        x={PADDING + 25}
        y={25}
        fontSize={12}
        fill="#F1F5F9"
        fontFamily="'SF Mono', monospace"
      />

      {/* Frame ID */}
      <Text
        text={`Frame: ${frameId}`}
        x={PADDING + 25}
        y={40}
        fontSize={8}
        fill="#94A3B8"
        fontFamily="'SF Mono', monospace"
      />

      {/* Step Number */}
      {stepNumber !== undefined && (
        <Text
          text={`#${stepNumber}`}
          x={BOX_WIDTH - 35}
          y={BOX_HEIGHT - 15}
          fontSize={8}
          fontStyle="bold"
          fill="#475569"
          fontFamily="'SF Mono', monospace"
        />
      )}
    </Group>
  );
});

ReturnElement.displayName = 'ReturnElement';

export default ReturnElement;