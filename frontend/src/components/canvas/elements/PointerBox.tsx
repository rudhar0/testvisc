import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';

interface PointerBoxProps {
  id: string;
  name: string;
  type: string;
  value: any;
  x: number;
  y: number;
  width: number;
  height: number;
  isNew?: boolean;
  isUpdated?: boolean;
  onClick?: () => void;
}

// Colors from user specification for "5A. Pointer - Initial Declaration"
const COLORS = {
  background: "#fce4ec",
  border: "#e91e63",
  text: "#c2185b",
  uninitialized: "#999",
  highlight: {
    flash: "#e91e63",
    glow: "#e91e63",
  },
};

export const PointerBox: React.FC<PointerBoxProps> = ({
  id,
  name,
  type,
  value,
  x,
  y,
  width,
  height,
  isNew = false,
  isUpdated = false,
  onClick
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const rectRef = useRef<Konva.Rect>(null);

  const isInitialized = value !== undefined && value !== null && value !== 'NULL';
  const valueLabel = isInitialized ? String(value) : "NULL";

  // Entry Animation
  useEffect(() => {
    const node = groupRef.current;
    if (isNew && node) {
      node.opacity(0);
      node.to({
        opacity: 1,
        duration: 0.3, // 300ms from spec
        easing: Konva.Easings.EaseOut,
      });
    }
  }, [isNew]);

  // Value Change Animation
  useEffect(() => {
    if (isUpdated && rectRef.current) {
      const rect = rectRef.current;
      rect.to({
        fill: COLORS.highlight.flash,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        onFinish: () => {
          rect.fill(COLORS.background);
        }
      });
    }
  }, [isUpdated, value]);

  return (
    <Group
      ref={groupRef}
      id={id}
      x={x}
      y={y}
      onClick={onClick}
      onTap={onClick}
    >
      {/* Background Rectangle */}
      <Rect
        ref={rectRef}
        width={width}
        height={height}
        fill={COLORS.background}
        stroke={COLORS.border}
        strokeWidth={2}
        cornerRadius={4}
      />

      {/* Pointer Icon */}
      <Text
        text="*"
        x={10}
        y={height / 2 - 10}
        fontSize={20}
        fontFamily="monospace"
        fill={COLORS.text}
        listening={false}
      />

      {/* Name and Type Label */}
      <Text
        text={name}
        x={25}
        y={height / 2 - 7}
        fontSize={14}
        fontFamily="'Courier New', monospace"
        fill={COLORS.text}
        listening={false}
      />
      
      {/* Value (Address) */}
      <Text
        text={valueLabel}
        x={width - 15}
        y={height / 2 - 7}
        fontSize={12}
        fontFamily="'Courier New', monospace"
        fontStyle="italic"
        fill={isInitialized ? COLORS.text : COLORS.uninitialized}
        align="right"
        width={width / 2 - 30}
        listening={false}
      />
    </Group>
  );
};

export default PointerBox;
