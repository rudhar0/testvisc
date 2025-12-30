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

    if (isNew) {
      console.log(`[VariableBox] Animating new variable: ${name}`);
      node.opacity(0);
      node.scaleX(0.8);
      node.scaleY(0.8);
      
      const anim = new Konva.Tween({
        node,
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 0.5,
        easing: Konva.Easings.EaseOut,
        onFinish: () => {
          const rect = rectRef.current;
          if (rect) {
            rect.to({
              stroke: sectionColors.DEFAULT,
              duration: 0.2,
            });
          }
        }
      });
      anim.play();
      isInitialMount.current = false;
    } else if (isInitialMount.current) {
      // If not new but first mount, just set final state
      node.opacity(1);
      node.scaleX(1);
      node.scaleY(1);
      isInitialMount.current = false;
    }
  }, [isNew, sectionColors.DEFAULT, name]);

  // 2. POSITION ANIMATION (when x or y changes)
  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    if (prevPosRef.current.x !== x || prevPosRef.current.y !== y) {
      const anim = new Konva.Tween({
        node,
        x,
        y,
        duration: 0.3,
        easing: Konva.Easings.EaseInOut,
      });
      anim.play();
      prevPosRef.current = { x, y };
    }
  }, [x, y]);

  // 3. VALUE UPDATE ANIMATION (flash when value changes)
  useEffect(() => {
    if (isUpdated && rectRef.current) {
      const rect = rectRef.current;
      const originalFill = rect.fill();
      
      const flashAnim = new Konva.Tween({
        node: rect,
        fill: COLORS.highlight,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        onFinish: () => {
          rect.fill(originalFill);
        }
      });
      flashAnim.play();
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
        text={name}
        x={12}
        y={8}
        fontSize={14}
        fontStyle="bold"
        fill={sectionColors.light}
        fontFamily="monospace"
      />

      {/* Variable Type */}
      <Text
        text={type}
        x={12}
        y={26}
        fontSize={11}
        fill={COLORS.text.secondary}
        fontFamily="monospace"
      />

      {/* Value */}
      <Text
        text={displayValue}
        x={12}
        y={42}
        fontSize={fontSize}
        fill={COLORS.text.primary}
        fontFamily="monospace"
        fontStyle={isUpdated ? 'bold' : 'normal'}
      />

      {/* Address (small, bottom right) */}
      <Text
        text={address}
        x={width - 8}
        y={height - 18}
        fontSize={9}
        fill={COLORS.text.tertiary}
        fontFamily="monospace"
        align="right"
      />
    </Group>
  );
};

export default VariableBox;
