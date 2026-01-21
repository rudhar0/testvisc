import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import Konva from 'konva';
import { ArrayCell } from './ArrayCell';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ArrayBoxProps {
  id: string;
  name: string;
  baseType: string;
  dimensions: number[];      // [5] for 1D, [3,4] for 2D, [2,3,4] for 3D
  values: any[];             // Flattened array values
  address: string;
  x: number;
  y: number;
  isNew?: boolean;
  updatedIndices?: number[][]; // Which cells were updated this step
  owner?: string;            // 'main', 'function_name', 'global'
}

// ============================================
// CONSTANTS
// ============================================

const CELL_WIDTH = 60;
const CELL_HEIGHT = 50;
const CELL_SPACING = 4;
const HEADER_HEIGHT = 50;
const PADDING = 12;
const TAB_HEIGHT = 30;

// ============================================
// ARRAY BOX COMPONENT
// ============================================

export const ArrayBox: React.FC<ArrayBoxProps> = ({
  id,
  name,
  baseType,
  dimensions,
  values,
  address,
  x,
  y,
  isNew = false,
  updatedIndices = [],
  owner = 'main'
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const [activeTab, setActiveTab] = useState(0); // For 3D arrays
  
  const is1D = dimensions.length === 1;
  const is2D = dimensions.length === 2;
  const is3D = dimensions.length === 3;

  // ============================================
  // CALCULATE DIMENSIONS
  // ============================================
  const calculateBoxSize = () => {
    if (is1D) {
      const cols = dimensions[0];
      const width = cols * (CELL_WIDTH + CELL_SPACING) + PADDING * 2;
      const height = HEADER_HEIGHT + CELL_HEIGHT + PADDING * 2;
      return { width, height };
    }
    
    if (is2D) {
      const cols = dimensions[1];
      const rows = dimensions[0];
      const width = cols * (CELL_WIDTH + CELL_SPACING) + PADDING * 2;
      const height = HEADER_HEIGHT + rows * (CELL_HEIGHT + CELL_SPACING) + PADDING * 2;
      return { width, height };
    }
    
    if (is3D) {
      const cols = dimensions[2];
      const rows = dimensions[1];
      const width = cols * (CELL_WIDTH + CELL_SPACING) + PADDING * 2;
      const height = HEADER_HEIGHT + TAB_HEIGHT + rows * (CELL_HEIGHT + CELL_SPACING) + PADDING * 2;
      return { width, height };
    }
    
    return { width: 200, height: 100 };
  };

  const { width: boxWidth, height: boxHeight } = calculateBoxSize();

  // ============================================
  // HELPER: GET VALUE AT INDEX
  // ============================================
  const getValueAt = (indices: number[]): any => {
    if (is1D) {
      return values[indices[0]];
    }
    if (is2D) {
      const [i, j] = indices;
      return values[i * dimensions[1] + j];
    }
    if (is3D) {
      const [i, j, k] = indices;
      return values[i * dimensions[1] * dimensions[2] + j * dimensions[2] + k];
    }
    return null;
  };

  // ============================================
  // HELPER: CHECK IF CELL WAS UPDATED
  // ============================================
  const isCellUpdated = (indices: number[]): boolean => {
    return updatedIndices.some(updated => 
      updated.length === indices.length &&
      updated.every((val, idx) => val === indices[idx])
    );
  };

  // ============================================
  // ANIMATION: ENTRANCE
  // ============================================
  useEffect(() => {
    const group = groupRef.current;
    if (!group || !isNew) return;

    group.opacity(0);
    group.y(y + 30);

    const anim = new Konva.Tween({
      node: group,
      opacity: 1,
      y: y,
      duration: 0.5,
      easing: Konva.Easings.BackEaseOut
    });
    anim.play();
  }, [isNew, y]);

  // ============================================
  // RENDER: 1D ARRAY
  // ============================================
  const render1DGrid = () => {
    const cells: JSX.Element[] = [];
    
    for (let i = 0; i < dimensions[0]; i++) {
      const cellX = PADDING + i * (CELL_WIDTH + CELL_SPACING);
      const cellY = HEADER_HEIGHT + PADDING;
      
      cells.push(
        <ArrayCell
          key={`${id}-cell-${i}`}
          id={`${id}-cell-${i}`}
          index={[i]}
          value={getValueAt([i])}
          baseType={baseType}
          x={cellX}
          y={cellY}
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          isUpdated={isCellUpdated([i])}
        />
      );
    }
    
    return cells;
  };

  // ============================================
  // RENDER: 2D ARRAY
  // ============================================
  const render2DGrid = () => {
    const cells: JSX.Element[] = [];
    const [rows, cols] = dimensions;
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const cellX = PADDING + j * (CELL_WIDTH + CELL_SPACING);
        const cellY = HEADER_HEIGHT + PADDING + i * (CELL_HEIGHT + CELL_SPACING);
        
        cells.push(
          <ArrayCell
            key={`${id}-cell-${i}-${j}`}
            id={`${id}-cell-${i}-${j}`}
            index={[i, j]}
            value={getValueAt([i, j])}
            baseType={baseType}
            x={cellX}
            y={cellY}
            width={CELL_WIDTH}
            height={CELL_HEIGHT}
            isUpdated={isCellUpdated([i, j])}
          />
        );
      }
    }
    
    return cells;
  };

  // ============================================
  // RENDER: 3D ARRAY (TABBED PLANES)
  // ============================================
  const render3DGrid = () => {
    const cells: JSX.Element[] = [];
    const [planes, rows, cols] = dimensions;
    
    // Render tabs
    const tabs: JSX.Element[] = [];
    for (let p = 0; p < planes; p++) {
      const tabX = PADDING + p * 60;
      const isActive = p === activeTab;
      
      tabs.push(
        <Group key={`tab-${p}`}>
          <Rect
            x={tabX}
            y={HEADER_HEIGHT}
            width={55}
            height={TAB_HEIGHT}
            fill={isActive ? '#3B82F6' : '#334155'}
            stroke={isActive ? '#60A5FA' : '#475569'}
            strokeWidth={1}
            cornerRadius={[4, 4, 0, 0]}
            onClick={() => setActiveTab(p)}
            onTap={() => setActiveTab(p)}
          />
          <Text
            text={`[${p}]`}
            x={tabX}
            y={HEADER_HEIGHT + 8}
            width={55}
            fontSize={12}
            fontStyle="bold"
            fill="#F1F5F9"
            align="center"
            fontFamily="'SF Mono', monospace"
          />
        </Group>
      );
    }
    
    // Render active plane
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const cellX = PADDING + j * (CELL_WIDTH + CELL_SPACING);
        const cellY = HEADER_HEIGHT + TAB_HEIGHT + PADDING + i * (CELL_HEIGHT + CELL_SPACING);
        
        cells.push(
          <ArrayCell
            key={`${id}-cell-${activeTab}-${i}-${j}`}
            id={`${id}-cell-${activeTab}-${i}-${j}`}
            index={[activeTab, i, j]}
            value={getValueAt([activeTab, i, j])}
            baseType={baseType}
            x={cellX}
            y={cellY}
            width={CELL_WIDTH}
            height={CELL_HEIGHT}
            isUpdated={isCellUpdated([activeTab, i, j])}
          />
        );
      }
    }
    
    return [...tabs, ...cells];
  };

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <Group ref={groupRef} id={id} x={x} y={y}>
      {/* Background */}
      <Rect
        width={boxWidth}
        height={boxHeight}
        fill="rgba(30, 41, 59, 0.95)"
        stroke="#10B981"
        strokeWidth={2}
        cornerRadius={8}
        shadowColor="rgba(0, 0, 0, 0.3)"
        shadowBlur={12}
        shadowOffsetY={4}
      />

      {/* Header */}
      <Rect
        width={boxWidth}
        height={HEADER_HEIGHT}
        fill="rgba(16, 185, 129, 0.2)"
        cornerRadius={[8, 8, 0, 0]}
      />

      {/* Array Name */}
      <Text
        text={`${name}[${dimensions.join('][')}]`}
        x={12}
        y={12}
        fontSize={16}
        fontStyle="bold"
        fill="#F1F5F9"
        fontFamily="'SF Pro Display', system-ui"
      />

      {/* Type & Address */}
      <Text
        text={`${baseType} • ${address}`}
        x={12}
        y={32}
        fontSize={11}
        fill="#94A3B8"
        fontFamily="'SF Mono', monospace"
      />

      {/* Divider */}
      <Line
        points={[0, HEADER_HEIGHT, boxWidth, HEADER_HEIGHT]}
        stroke="#334155"
        strokeWidth={1}
      />

      {/* Grid */}
      {is1D && render1DGrid()}
      {is2D && render2DGrid()}
      {is3D && render3DGrid()}
    </Group>
  );
};

export default ArrayBox;