// ============================================
// frontend/src/components/canvas/elements/VariableBox.tsx
// Individual variable visualization with animations
// ============================================

import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';

interface VariableBoxProps {
  id: string;
  name: string;
  type: string;
  value: any;
  address: string;
  x: number;
  y: number;
  width: number;
  height: number;
  section: 'global' | 'stack' | 'heap';
  isNew?: boolean;
  isUpdated?: boolean;
  previousValue?: any;
  expression?: string;
  onClick?: () => void;
}

const COLORS = {
  global: { DEFAULT: '#2DD4BF', light: '#5EEAD4', dark: '#14B8A6', bg: '#0F172A' },
  stack: { DEFAULT: '#3B82F6', light: '#60A5FA', dark: '#2563EB', bg: '#1E293B' },
  heap: { DEFAULT: '#10B981', light: '#34D399', dark: '#059669', bg: '#1E293B' },
  text: { primary: '#F1F5F9', secondary: '#94A3B8', tertiary: '#64748B' },
  highlight: '#FCD34D',
  border: '#334155'
};

export const VariableBox: React.FC<VariableBoxProps> = ({
  id,
  name,
  type,
  value,
  address,
  x,
  y,
  width,
  height,
  section,
  isNew = false,
  isUpdated = false,
  previousValue,
  expression,
  onClick
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [initialPos] = useState({ x, y });
  const isInitialMount = useRef(true);
  const prevValueRef = useRef(value);
  const prevPosRef = useRef({ x, y });

  const sectionColors = COLORS[section];

  // Format value for display
  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return 'undefined';
    if (typeof val === 'string') return `"${val}"`;
    if (Array.isArray(val)) return `[${val.join(', ')}]`;
    if (typeof val === 'number' && val > 999) return `0x${val.toString(16)}`;
    return String(val);
  };

  const displayValue = expression || formatValue(value);
  const showExpression = expression && expression !== formatValue(value);
  const fontSize = displayValue.length > 12 ? 14 : 18;

  // 1. APPEAR ANIMATION (when isNew)
  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    if (isNew && isInitialMount.current) {
      node.opacity(0);
      node.scale({ x: 0.8, y: 0.8 });
      node.to({
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 0.4,
        easing: Konva.Easings.BackEaseOut
      });
      isInitialMount.current = false;
    }
  }, [isNew]);

  // 2. POSITION ANIMATION (when x or y changes)
  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    const posChanged = prevPosRef.current.x !== x || prevPosRef.current.y !== y;
    
    if (posChanged && !isInitialMount.current) {
      node.to({
        x: x,
        y: y,
        duration: 0.5,
        easing: Konva.Easings.EaseInOut
      });
      prevPosRef.current = { x, y };
    }
  }, [x, y]);

  // 3. VALUE UPDATE ANIMATION (flash when value changes)
  useEffect(() => {
    if (isUpdated && rectRef.current) {
      const rect = rectRef.current;
      
      // Flash sequence
      rect.to({
        stroke: COLORS.highlight,
        strokeWidth: 4,
        shadowColor: COLORS.highlight,
        shadowBlur: 20,
        shadowOpacity: 0.8,
        duration: 0.15,
        onFinish: () => {
          rect.to({
            stroke: sectionColors.DEFAULT,
            strokeWidth: 2,
            shadowColor: sectionColors.DEFAULT,
            shadowBlur: 8,
            shadowOpacity: 0.4,
            duration: 0.4
          });
        }
      });

      // Show value transition
      if (previousValue !== undefined) {
        const group = groupRef.current;
        if (group) {
          group.to({
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 0.1,
            yoyo: true
          });
        }
      }
    }
    
    prevValueRef.current = value;
  }, [value, isUpdated, previousValue, sectionColors.DEFAULT]);

  // 4. HOVER ANIMATION
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (rectRef.current) {
      rectRef.current.to({
        strokeWidth: 3,
        shadowBlur: 15,
        duration: 0.2
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (rectRef.current) {
      rectRef.current.to({
        strokeWidth: 2,
        shadowBlur: 8,
        duration: 0.2
      });
    }
  };

  return (
    <Group
      ref={groupRef}
      id={id}
      x={initialPos.x}
      y={initialPos.y}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onTap={onClick}
    >
      {/* Background Rectangle */}
      <Rect
        ref={rectRef}
        name="box-bg"
        width={width}
        height={height}
        fill={isHovered ? COLORS.border : sectionColors.bg}
        stroke={sectionColors.DEFAULT}
        strokeWidth={2}
        cornerRadius={8}
        shadowColor={sectionColors.DEFAULT}
        shadowBlur={8}
        shadowOpacity={isHovered ? 0.6 : 0.4}
      />

      {/* Variable Name */}
      <Text
        x={12}
        y={12}
        text={name}
        fontSize={14}
        fontStyle="bold"
        fill={sectionColors.light}
        listening={false}
      />

      {/* Variable Type */}
      <Text
        x={12}
        y={32}
        text={type}
        fontSize={11}
        fill={COLORS.text.secondary}
        listening={false}
      />

      {/* Value Display */}
      <Text
        x={12}
        y={50}
        text={displayValue}
        fontSize={fontSize}
        fontStyle="bold"
        fontFamily="monospace"
        fill={showExpression ? COLORS.highlight : COLORS.text.primary}
        width={width - 24}
        ellipsis={true}
        listening={false}
      />

      {/* Address */}
      <Text
        x={width - 12}
        y={height - 18}
        text={address}
        fontSize={10}
        fill={COLORS.text.tertiary}
        align="right"
        width={width - 24}
        listening={false}
      />

      {/* New Indicator Badge */}
      {isNew && (
        <>
          <Rect
            x={width - 50}
            y={8}
            width={42}
            height={18}
            fill={sectionColors.DEFAULT}
            cornerRadius={4}
            listening={false}
          />
          <Text
            x={width - 48}
            y={11}
            text="NEW"
            fontSize={10}
            fontStyle="bold"
            fill="#FFFFFF"
            listening={false}
          />
        </>
      )}

      {/* Updated Indicator */}
      {isUpdated && previousValue !== undefined && (
        <Text
          x={12}
          y={height - 35}
          text={`← was: ${formatValue(previousValue)}`}
          fontSize={10}
          fontStyle="italic"
          fill={COLORS.text.tertiary}
          listening={false}
        />
      )}
    </Group>
  );
};

export default VariableBox;