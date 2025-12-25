// ============================================
// frontend/src/components/canvas/elements/ArrayView.tsx
// Array visualization with cell-by-cell animations
// ============================================

import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import Konva from 'konva';

interface ArrayCell {
  index: number;
  value: any;
  address: string;
  isUpdated?: boolean;
  previousValue?: any;
}

interface ArrayViewProps {
  id: string;
  name: string;
  type: string;
  cells: ArrayCell[];
  x: number;
  y: number;
  cellWidth: number;
  cellHeight: number;
  section: 'global' | 'stack' | 'heap';
  onClick?: (index: number) => void;
}

const COLORS = {
  global: { DEFAULT: '#2DD4BF', light: '#5EEAD4', dark: '#14B8A6' },
  stack: { DEFAULT: '#3B82F6', light: '#60A5FA', dark: '#2563EB' },
  heap: { DEFAULT: '#10B981', light: '#34D399', dark: '#059669' },
  text: { primary: '#F1F5F9', secondary: '#94A3B8', tertiary: '#64748B' },
  highlight: '#FCD34D',
  cellBg: '#1E293B',
  cellBorder: '#475569'
};

export const ArrayView: React.FC<ArrayViewProps> = ({
  id,
  name,
  type,
  cells,
  x,
  y,
  cellWidth,
  cellHeight,
  section,
  onClick
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const prevCellsRef = useRef<ArrayCell[]>(cells);
  const isInitialMount = useRef(true);

  const sectionColor = COLORS[section];
  const totalWidth = cells.length * (cellWidth + 5) - 5;
  const labelHeight = 35;

  // APPEAR ANIMATION on initial mount
  useEffect(() => {
    const node = groupRef.current;
    if (!node || !isInitialMount.current) return;

    node.opacity(0);
    node.y(y + 20);
    node.to({
      opacity: 1,
      y: y,
      duration: 0.5,
      easing: Konva.Easings.EaseOut
    });
    
    isInitialMount.current = false;
  }, [y]);

  // POSITION ANIMATION when x or y changes
  useEffect(() => {
    const node = groupRef.current;
    if (!node || isInitialMount.current) return;

    node.to({
      x: x,
      y: y,
      duration: 0.4,
      easing: Konva.Easings.EaseInOut
    });
  }, [x, y]);

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '?';
    if (typeof val === 'string') return val.substring(0, 3);
    return String(val);
  };

  return (
    <Group ref={groupRef} id={id} x={x} y={y}>
      {/* Array Label */}
      <Text
        y={-labelHeight + 5}
        text={`${name}: ${type}`}
        fontSize={14}
        fontStyle="bold"
        fill={sectionColor.light}
        listening={false}
      />

      {/* Bracket - Left */}
      <Line
        points={[-5, 0, -10, 0, -10, cellHeight, -5, cellHeight]}
        stroke={sectionColor.DEFAULT}
        strokeWidth={3}
        lineJoin="miter"
        listening={false}
      />

      {/* Bracket - Right */}
      <Line
        points={[
          totalWidth + 5, 0,
          totalWidth + 10, 0,
          totalWidth + 10, cellHeight,
          totalWidth + 5, cellHeight
        ]}
        stroke={sectionColor.DEFAULT}
        strokeWidth={3}
        lineJoin="miter"
        listening={false}
      />

      {/* Array Cells */}
      {cells.map((cell, index) => (
        <ArrayCell
          key={`${id}-cell-${index}`}
          cell={cell}
          index={index}
          x={index * (cellWidth + 5)}
          y={0}
          width={cellWidth}
          height={cellHeight}
          color={sectionColor}
          isHovered={hoveredIndex === index}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => onClick?.(index)}
          prevValue={prevCellsRef.current[index]?.value}
        />
      ))}

      {/* Index Labels (below cells) */}
      {cells.map((cell, index) => (
        <Text
          key={`${id}-index-${index}`}
          x={index * (cellWidth + 5)}
          y={cellHeight + 8}
          text={`[${index}]`}
          fontSize={10}
          fill={COLORS.text.tertiary}
          width={cellWidth}
          align="center"
          listening={false}
        />
      ))}

      {/* Address Labels (below indices) */}
      {cells.length <= 10 && cells.map((cell, index) => (
        <Text
          key={`${id}-addr-${index}`}
          x={index * (cellWidth + 5)}
          y={cellHeight + 25}
          text={cell.address.substring(cell.address.length - 4)}
          fontSize={8}
          fill={COLORS.text.tertiary}
          width={cellWidth}
          align="center"
          listening={false}
        />
      ))}
    </Group>
  );
};

// Individual Array Cell Component
interface ArrayCellProps {
  cell: ArrayCell;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: any;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  prevValue?: any;
}

const ArrayCell: React.FC<ArrayCellProps> = ({
  cell,
  index,
  x,
  y,
  width,
  height,
  color,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
  prevValue
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const [isInitialMount, setIsInitialMount] = useState(true);

  // APPEAR ANIMATION (staggered by index)
  useEffect(() => {
    const node = groupRef.current;
    if (!node || !isInitialMount) return;

    node.opacity(0);
    node.scaleX(0.5);
    node.scaleY(0.5);

    setTimeout(() => {
      node.to({
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 0.3,
        easing: Konva.Easings.BackEaseOut
      });
    }, index * 50); // Stagger by 50ms per cell

    setIsInitialMount(false);
  }, [index, isInitialMount]);

  // VALUE UPDATE ANIMATION
  useEffect(() => {
    if (cell.isUpdated && rectRef.current && prevValue !== undefined) {
      const rect = rectRef.current;
      const group = groupRef.current;

      // Flash animation
      rect.to({
        fill: COLORS.highlight,
        stroke: COLORS.highlight,
        strokeWidth: 4,
        duration: 0.15,
        onFinish: () => {
          rect.to({
            fill: COLORS.cellBg,
            stroke: color.DEFAULT,
            strokeWidth: 2,
            duration: 0.3
          });
        }
      });

      // Bounce animation
      if (group) {
        group.to({
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 0.1,
          yoyo: true
        });
      }
    }
  }, [cell.value, cell.isUpdated, color.DEFAULT, prevValue]);

  // HOVER ANIMATION
  useEffect(() => {
    if (rectRef.current) {
      rectRef.current.to({
        strokeWidth: isHovered ? 3 : 2,
        shadowBlur: isHovered ? 12 : 6,
        duration: 0.2
      });
    }
  }, [isHovered]);

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '?';
    if (typeof val === 'string') return val.substring(0, 4);
    return String(val);
  };

  return (
    <Group
      ref={groupRef}
      x={x}
      y={y}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onTap={onClick}
    >
      {/* Cell Rectangle */}
      <Rect
        ref={rectRef}
        width={width}
        height={height}
        fill={COLORS.cellBg}
        stroke={color.DEFAULT}
        strokeWidth={2}
        cornerRadius={4}
        shadowColor={color.DEFAULT}
        shadowBlur={6}
        shadowOpacity={0.3}
      />

      {/* Cell Value */}
      <Text
        x={0}
        y={height / 2 - 10}
        text={formatValue(cell.value)}
        fontSize={16}
        fontStyle="bold"
        fontFamily="monospace"
        fill={COLORS.text.primary}
        width={width}
        align="center"
        listening={false}
      />

      {/* Updated Indicator */}
      {cell.isUpdated && prevValue !== undefined && (
        <Text
          x={0}
          y={height - 15}
          text={`←${formatValue(prevValue)}`}
          fontSize={8}
          fontStyle="italic"
          fill={COLORS.text.tertiary}
          width={width}
          align="center"
          listening={false}
        />
      )}
    </Group>
  );
};

export default ArrayView;