import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
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

// Colors from user specification for "2A. Array - Initial Declaration"
const COLORS = {
  borderColor: "#1976d2",
  backgroundColor: "#e3f2fd",
  cell: {
    uninitialized: "?",
  },
  indexLabel: {
    font: "10px Arial",
    color: "#666",
  },
};

const CELL_WIDTH = 50;
const CELL_HEIGHT = 40;
const CELL_SPACING = 2;
const INDEX_LABEL_OFFSET = 15;

export const ArrayView: React.FC<ArrayViewProps> = ({
  id,
  name,
  type,
  values,
  x,
  y,
  isNew = false,
  onClick
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const totalWidth = values.length * (CELL_WIDTH + CELL_SPACING) - CELL_SPACING;

  // Entry Animation (expand_from_left)
  useEffect(() => {
    const node = groupRef.current;
    if (isNew && node) {
      node.clipWidth(0);
      node.to({
        clipWidth: totalWidth,
        duration: 0.5, // 500ms from spec
        easing: Konva.Easings.EaseOut,
      });
    }
  }, [isNew, totalWidth]);

  return (
    <Group
      ref={groupRef}
      id={id}
      x={x}
      y={y}
      onClick={onClick}
      onTap={onClick}
      clipX={0}
      clipY={0}
      clipWidth={isNew ? 0 : totalWidth}
      clipHeight={CELL_HEIGHT + INDEX_LABEL_OFFSET + 10}
    >
      {/* Array Cells */}
      {values.map((value, index) => {
        const cellX = index * (CELL_WIDTH + CELL_SPACING);
        const isInitialized = value !== undefined && value !== null;

        return (
          <Group key={index} x={cellX} y={0}>
            {/* Cell Rectangle */}
            <Rect
              width={CELL_WIDTH}
              height={CELL_HEIGHT}
              fill={COLORS.backgroundColor}
              stroke={COLORS.borderColor}
              strokeWidth={1}
            />
            {/* Value */}
            <Text
              text={isInitialized ? String(value) : COLORS.cell.uninitialized}
              width={CELL_WIDTH}
              height={CELL_HEIGHT}
              align="center"
              verticalAlign="middle"
              fontSize={14}
              fontFamily="'Courier New', monospace"
              fill={isInitialized ? '#333' : '#999'}
            />
            {/* Index Label */}
            <Text
              text={String(index)}
              x={0}
              y={CELL_HEIGHT + 5}
              width={CELL_WIDTH}
              align="center"
              fontSize={10}
              fontFamily="Arial"
              fill={COLORS.indexLabel.color}
            />
          </Group>
        );
      })}
    </Group>
  );
};

export default ArrayView;
