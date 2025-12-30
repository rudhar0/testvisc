import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import Konva from 'konva';

interface ArrayViewProps {
  id: string;
  name: string;
  type: string;
  values: any[];
  address: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isNew?: boolean;
  isUpdated?: boolean;
  accessedIndex?: number;
  onClick?: () => void;
}

const COLORS = {
  bg: '#1E293B',
  border: '#3B82F6',
  borderLight: '#60A5FA',
  text: { primary: '#F1F5F9', secondary: '#94A3B8' },
  highlight: '#FCD34D',
  cellBg: '#0F172A',
};

export const ArrayView: React.FC<ArrayViewProps> = ({
  id,
  name,
  type,
  values,
  address,
  x,
  y,
  width,
  height,
  isNew = false,
  isUpdated = false,
  accessedIndex,
  onClick
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const cellWidth = 60;
  const cellHeight = 40;
  const headerHeight = 50;

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    if (isNew) {
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
      });
      anim.play();
    }
  }, [isNew]);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  return (
    <Group
      ref={groupRef}
      id={id}
      x={x}
      y={y}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onTap={onClick}
    >
      {/* Header */}
      <Rect
        width={width}
        height={headerHeight}
        fill={COLORS.bg}
        stroke={COLORS.border}
        strokeWidth={2}
        cornerRadius={[8, 8, 0, 0]}
      />
      
      <Text
        text={`${type} ${name}[${values.length}]`}
        x={12}
        y={15}
        fontSize={14}
        fontStyle="bold"
        fill={COLORS.text.primary}
        fontFamily="monospace"
      />

      {/* Array Cells */}
      {values.map((value, index) => {
        const cellX = (index % Math.floor(width / cellWidth)) * cellWidth;
        const cellY = headerHeight + Math.floor(index / Math.floor(width / cellWidth)) * cellHeight;
        const isHighlighted = accessedIndex === index;

        return (
          <Group key={index}>
            <Rect
              x={cellX}
              y={cellY}
              width={cellWidth}
              height={cellHeight}
              fill={isHighlighted ? COLORS.highlight : COLORS.cellBg}
              stroke={isHighlighted ? COLORS.borderLight : COLORS.border}
              strokeWidth={isHighlighted ? 2 : 1}
            />
            <Text
              x={cellX + 5}
              y={cellY + 12}
              text={index.toString()}
              fontSize={10}
              fill={COLORS.text.secondary}
              fontFamily="monospace"
            />
            <Text
              x={cellX + 5}
              y={cellY + 25}
              text={String(value)}
              fontSize={12}
              fill={COLORS.text.primary}
              fontFamily="monospace"
            />
          </Group>
        );
      })}

      {/* Border around array */}
      <Rect
        x={0}
        y={headerHeight}
        width={width}
        height={height - headerHeight}
        fill="transparent"
        stroke={COLORS.border}
        strokeWidth={2}
        cornerRadius={[0, 0, 8, 8]}
      />
    </Group>
  );
};

export default ArrayView;
