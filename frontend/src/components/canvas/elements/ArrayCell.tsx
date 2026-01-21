import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ArrayCellProps {
  id: string;
  index: number[];        // [i] for 1D, [i,j] for 2D, [i,j,k] for 3D
  value: any;
  baseType: string;       // int, float, char, etc.
  x: number;
  y: number;
  width: number;
  height: number;
  isNew?: boolean;        // Just created
  isUpdated?: boolean;    // Value changed
  isHovered?: boolean;
  onClick?: () => void;
}

// ============================================
// COLOR SYSTEM
// ============================================

const TYPE_COLORS: Record<string, string> = {
  int: '#3B82F6',
  float: '#10B981',
  double: '#8B5CF6',
  char: '#F59E0B',
  bool: '#EAB308',
  default: '#64748B'
};

const getTypeColor = (type: string): string => {
  const normalized = type.toLowerCase();
  return TYPE_COLORS[normalized] || TYPE_COLORS.default;
};

// ============================================
// ARRAY CELL COMPONENT
// ============================================

export const ArrayCell: React.FC<ArrayCellProps> = ({
  id,
  index,
  value,
  baseType,
  x,
  y,
  width,
  height,
  isNew = false,
  isUpdated = false,
  isHovered = false,
  onClick
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const bgRef = useRef<Konva.Rect>(null);
  
  const color = getTypeColor(baseType);
  
  // Format value for display
  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'string') return `'${val}'`;
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (typeof val === 'number' && Number.isInteger(val)) return String(val);
    if (typeof val === 'number') return val.toFixed(2);
    return String(val);
  };

  const displayValue = formatValue(value);
  const indexLabel = index.length === 1 
    ? `[${index[0]}]`
    : index.length === 2
    ? `[${index[0]},${index[1]}]`
    : `[${index.join(',')}]`;

  // ============================================
  // ANIMATION: ENTRANCE
  // ============================================
  useEffect(() => {
    const group = groupRef.current;
    if (!group || !isNew) return;

    // Start invisible and scaled down
    group.opacity(0);
    group.scaleX(0.5);
    group.scaleY(0.5);

    const anim = new Konva.Tween({
      node: group,
      opacity: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 0.3,
      easing: Konva.Easings.BackEaseOut
    });
    anim.play();
  }, [isNew]);

  // ============================================
  // ANIMATION: UPDATE
  // ============================================
  useEffect(() => {
    const bg = bgRef.current;
    if (!bg || !isUpdated) return;

    // Flash animation
    const originalFill = bg.fill();
    
    bg.fill('#FBBF24'); // Yellow flash
    bg.to({
      fill: originalFill,
      duration: 0.4,
      easing: Konva.Easings.EaseInOut
    });
  }, [isUpdated, value]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <Group
      ref={groupRef}
      id={id}
      x={x}
      y={y}
      onClick={onClick}
      onTap={onClick}
    >
      {/* Cell Background */}
      <Rect
        ref={bgRef}
        width={width}
        height={height}
        fill={isUpdated ? '#FEF3C7' : '#1E293B'}
        stroke={color}
        strokeWidth={isHovered ? 2 : 1}
        cornerRadius={4}
        shadowColor="rgba(0, 0, 0, 0.2)"
        shadowBlur={isHovered ? 8 : 4}
        shadowOffsetY={2}
      />

      {/* Index Label (Top) */}
      <Text
        text={indexLabel}
        x={4}
        y={4}
        fontSize={9}
        fill="#64748B"
        fontFamily="'SF Mono', monospace"
        width={width - 8}
        align="center"
      />

      {/* Value (Center) */}
      <Text
        text={displayValue}
        x={4}
        y={height / 2 - 8}
        fontSize={14}
        fontStyle="bold"
        fill="#F1F5F9"
        fontFamily="'SF Mono', monospace"
        width={width - 8}
        align="center"
      />
    </Group>
  );
};

export default ArrayCell;