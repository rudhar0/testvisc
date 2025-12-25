// ============================================
// frontend/src/components/canvas/elements/StackFrame.tsx
// Stack frame container with push/pop animations
// ============================================

import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';

interface StackFrameProps {
  id: string;
  function: string;
  returnType: string;
  isActive: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  children?: React.ReactNode;
}

const COLORS = {
  active: { bg: '#2563EB', border: '#3B82F6', text: '#F1F5F9' },
  inactive: { bg: '#334155', border: '#475569', text: '#94A3B8' },
  frameBg: '#1E293B',
  border: '#475569',
  text: { primary: '#F1F5F9', secondary: '#94A3B8', tertiary: '#64748B' },
  shadow: '#000000'
};

export const StackFrame: React.FC<StackFrameProps> = ({
  id,
  function: functionName,
  returnType,
  isActive,
  x,
  y,
  width,
  height,
  children
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const containerRef = useRef<Konva.Rect>(null);
  const headerRef = useRef<Konva.Rect>(null);
  const [initialPos] = useState({ x, y });
  const [isInitialMount, setIsInitialMount] = useState(true);
  const prevActiveRef = useRef(isActive);

  const headerHeight = 55;
  const headerColors = isActive ? COLORS.active : COLORS.inactive;

  // PUSH ANIMATION (when frame first appears)
  useEffect(() => {
    const node = groupRef.current;
    if (!node || !isInitialMount) return;

    // Start from above and slide down
    node.opacity(0);
    node.y(y - 30);
    node.scaleY(0.8);
    
    node.to({
      opacity: 1,
      y: y,
      scaleY: 1,
      duration: 0.5,
      easing: Konva.Easings.EaseOut
    });

    setIsInitialMount(false);
  }, [y, isInitialMount]);

  // POSITION ANIMATION (when moved)
  useEffect(() => {
    const node = groupRef.current;
    if (!node || isInitialMount) return;

    node.to({
      x: x,
      y: y,
      duration: 0.4,
      easing: Konva.Easings.EaseInOut
    });
  }, [x, y, isInitialMount]);

  // ACTIVE STATE ANIMATION
  useEffect(() => {
    if (prevActiveRef.current === isActive) return;

    const container = containerRef.current;
    const header = headerRef.current;
    
    if (container && header) {
      // Animate border color
      container.to({
        stroke: headerColors.border,
        strokeWidth: isActive ? 3 : 2,
        shadowBlur: isActive ? 18 : 8,
        shadowOpacity: isActive ? 0.5 : 0.2,
        duration: 0.3
      });

      // Animate header
      header.to({
        fill: headerColors.bg,
        duration: 0.3
      });

      // Pulse effect when becoming active
      if (isActive) {
        const group = groupRef.current;
        if (group) {
          group.to({
            scaleX: 1.03,
            scaleY: 1.03,
            duration: 0.15,
            yoyo: true
          });
        }
      }
    }

    prevActiveRef.current = isActive;
  }, [isActive, headerColors.border, headerColors.bg]);

  return (
    <Group ref={groupRef} id={id} x={initialPos.x} y={initialPos.y}>
      {/* Frame Container */}
      <Rect
        ref={containerRef}
        width={width}
        height={height}
        fill={COLORS.frameBg}
        stroke={headerColors.border}
        strokeWidth={isActive ? 3 : 2}
        cornerRadius={8}
        shadowColor={COLORS.shadow}
        shadowBlur={isActive ? 18 : 8}
        shadowOpacity={isActive ? 0.5 : 0.2}
        shadowOffsetY={4}
      />

      {/* Header Background */}
      <Rect
        ref={headerRef}
        width={width}
        height={headerHeight}
        fill={headerColors.bg}
        cornerRadius={[8, 8, 0, 0]}
      />

      {/* Function Name */}
      <Text
        x={20}
        y={15}
        text={`${functionName}()`}
        fontSize={16}
        fontStyle="bold"
        fill={COLORS.text.primary}
        listening={false}
      />

      {/* Return Type */}
      <Text
        x={20}
        y={36}
        text={`returns: ${returnType}`}
        fontSize={11}
        fill={COLORS.text.secondary}
        listening={false}
      />

      {/* Active Badge */}
      {isActive && (
        <>
          <Rect
            x={width - 85}
            y={13}
            width={70}
            height={28}
            fill={headerColors.border}
            cornerRadius={6}
            shadowBlur={8}
            shadowColor={headerColors.border}
            shadowOpacity={0.6}
          />
          <Text
            x={width - 80}
            y={18}
            text="ACTIVE"
            fontSize={12}
            fontStyle="bold"
            fill="#FFFFFF"
            listening={false}
          />
        </>
      )}

      {/* Depth Indicator (Frame Index) */}
      <Text
        x={width - 20}
        y={height - 20}
        text={id.split('-')[1]}
        fontSize={10}
        fill={COLORS.text.tertiary}
        align="right"
        listening={false}
      />

      {/* Children (local variables) - rendered by parent */}
    </Group>
  );
};

export default StackFrame;