import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import Konva from 'konva';
import { ArrayBox } from './ArrayBox';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ArrayData {
  id: string;
  name: string;
  baseType: string;
  dimensions: number[];
  values: any[];
  address: string;
  owner: string;
  birthStep: number;
  updatedIndices?: number[][];
}

export interface ArrayPanelProps {
  id: string;
  x: number;
  y: number;
  arrays: ArrayData[];
  isNew?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const HEADER_HEIGHT = 50;
const PADDING = 16;
const ARRAY_SPACING = 20;
const MIN_WIDTH = 300;

// ============================================
// ARRAY PANEL COMPONENT
// ============================================

export const ArrayPanel: React.FC<ArrayPanelProps> = ({
  id,
  x,
  y,
  arrays,
  isNew = false
}) => {
  const groupRef = useRef<Konva.Group>(null);

  // ============================================
  // CALCULATE PANEL DIMENSIONS
  // ============================================
  const calculatePanelSize = () => {
    if (arrays.length === 0) {
      return { width: MIN_WIDTH, height: HEADER_HEIGHT + PADDING * 2 };
    }

    // Calculate max width needed
    let maxWidth = MIN_WIDTH;
    let totalHeight = HEADER_HEIGHT + PADDING;

    arrays.forEach(arr => {
      const { width, height } = calculateArrayBoxSize(arr.dimensions);
      maxWidth = Math.max(maxWidth, width + PADDING * 2);
      totalHeight += height + ARRAY_SPACING;
    });

    totalHeight += PADDING; // Bottom padding

    return { width: maxWidth, height: totalHeight };
  };

  const calculateArrayBoxSize = (dimensions: number[]) => {
    const CELL_WIDTH = 60;
    const CELL_HEIGHT = 50;
    const CELL_SPACING = 4;
    const BOX_HEADER = 50;
    const BOX_PADDING = 12;

    if (dimensions.length === 1) {
      const cols = dimensions[0];
      return {
        width: cols * (CELL_WIDTH + CELL_SPACING) + BOX_PADDING * 2,
        height: BOX_HEADER + CELL_HEIGHT + BOX_PADDING * 2
      };
    }

    if (dimensions.length === 2) {
      const cols = dimensions[1];
      const rows = dimensions[0];
      return {
        width: cols * (CELL_WIDTH + CELL_SPACING) + BOX_PADDING * 2,
        height: BOX_HEADER + rows * (CELL_HEIGHT + CELL_SPACING) + BOX_PADDING * 2
      };
    }

    if (dimensions.length === 3) {
      const cols = dimensions[2];
      const rows = dimensions[1];
      return {
        width: cols * (CELL_WIDTH + CELL_SPACING) + BOX_PADDING * 2,
        height: BOX_HEADER + 30 + rows * (CELL_HEIGHT + CELL_SPACING) + BOX_PADDING * 2
      };
    }

    return { width: 200, height: 100 };
  };

  const { width: panelWidth, height: panelHeight } = calculatePanelSize();

  // ============================================
  // ANIMATION: ENTRANCE
  // ============================================
  useEffect(() => {
    const group = groupRef.current;
    if (!group || !isNew) return;

    group.opacity(0);
    group.x(x + 50);

    const anim = new Konva.Tween({
      node: group,
      opacity: 1,
      x: x,
      duration: 0.6,
      easing: Konva.Easings.BackEaseOut
    });
    anim.play();
  }, [isNew, x]);

  // ============================================
  // RENDER ARRAYS
  // ============================================
  const renderArrays = () => {
    let currentY = HEADER_HEIGHT + PADDING;
    
    return arrays.map(arr => {
      const { height } = calculateArrayBoxSize(arr.dimensions);
      const arrayElement = (
        <ArrayBox
          key={arr.id}
          id={arr.id}
          name={arr.name}
          baseType={arr.baseType}
          dimensions={arr.dimensions}
          values={arr.values}
          address={arr.address}
          x={PADDING}
          y={currentY}
          isNew={arr.birthStep === arr.birthStep} // Will be properly determined by parent
          updatedIndices={arr.updatedIndices}
          owner={arr.owner}
        />
      );
      
      currentY += height + ARRAY_SPACING;
      return arrayElement;
    });
  };

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <Group ref={groupRef} id={id} x={x} y={y}>
      {/* Background */}
      <Rect
        width={panelWidth}
        height={panelHeight}
        fill="rgba(15, 23, 42, 0.95)"
        stroke="#10B981"
        strokeWidth={2}
        cornerRadius={8}
        shadowColor="rgba(0, 0, 0, 0.4)"
        shadowBlur={16}
        shadowOffsetY={4}
      />

      {/* Header Background */}
      <Rect
        width={panelWidth}
        height={HEADER_HEIGHT}
        fill="rgba(16, 185, 129, 0.2)"
        cornerRadius={[8, 8, 0, 0]}
      />

      {/* Header Title */}
      <Text
        text="Arrays"
        x={PADDING}
        y={16}
        fontSize={18}
        fontStyle="bold"
        fill="#F1F5F9"
        fontFamily="'SF Pro Display', system-ui"
      />

      {/* Array Count Badge */}
      <Group x={panelWidth - 80} y={12}>
        <Rect
          width={60}
          height={26}
          fill="#10B981"
          cornerRadius={13}
          opacity={0.3}
        />
        <Text
          text={`${arrays.length} array${arrays.length !== 1 ? 's' : ''}`}
          x={0}
          y={6}
          width={60}
          fontSize={12}
          fontStyle="bold"
          fill="#34D399"
          align="center"
          fontFamily="'SF Pro Display', system-ui"
        />
      </Group>

      {/* Divider */}
      <Line
        points={[0, HEADER_HEIGHT, panelWidth, HEADER_HEIGHT]}
        stroke="#334155"
        strokeWidth={1}
      />

      {/* Arrays */}
      {arrays.length > 0 ? (
        renderArrays()
      ) : (
        <Text
          text="No arrays yet"
          x={PADDING}
          y={HEADER_HEIGHT + 40}
          fontSize={14}
          fill="#64748B"
          fontFamily="system-ui"
        />
      )}
    </Group>
  );
};

export default ArrayPanel;