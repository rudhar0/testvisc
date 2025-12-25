// ============================================
// frontend/src/components/canvas/elements/PointerArrow.tsx
// Animated curved arrows for pointer visualization
// ============================================

import React, { useRef, useEffect, useState } from 'react';
import { Group, Line, Circle, Text } from 'react-konva';
import Konva from 'konva';

interface PointerArrowProps {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  fromVar?: string;
  toVar?: string;
  dashed?: boolean;
}

const COLORS = {
  pointer: '#F59E0B',
  highlight: '#FCD34D',
  text: '#FFFFFF'
};

export const PointerArrow: React.FC<PointerArrowProps> = ({
  id,
  from,
  to,
  color = COLORS.pointer,
  fromVar,
  toVar,
  dashed = false
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const lineRef = useRef<Konva.Line>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [points, setPoints] = useState<number[]>([]);
  const [isInitialMount, setIsInitialMount] = useState(true);

  // Calculate curved path points using quadratic bezier
  useEffect(() => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Control point for curve (perpendicular offset)
    const curvature = Math.min(distance * 0.3, 100);
    const angle = Math.atan2(dy, dx);
    const perpAngle = angle + Math.PI / 2;
    
    const controlX = from.x + dx / 2 + Math.cos(perpAngle) * curvature;
    const controlY = from.y + dy / 2 + Math.sin(perpAngle) * curvature;

    // Generate smooth curve points
    const steps = 30;
    const curvePoints: number[] = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.pow(1 - t, 2) * from.x + 
                2 * (1 - t) * t * controlX + 
                Math.pow(t, 2) * to.x;
      const y = Math.pow(1 - t, 2) * from.y + 
                2 * (1 - t) * t * controlY + 
                Math.pow(t, 2) * to.y;
      curvePoints.push(x, y);
    }

    setPoints(curvePoints);
  }, [from.x, from.y, to.x, to.y]);

  // DRAW ANIMATION (on initial mount)
  useEffect(() => {
    const line = lineRef.current;
    if (!line || !isInitialMount || points.length === 0) return;

    // Calculate total path length
    let totalLength = 0;
    for (let i = 0; i < points.length - 2; i += 2) {
      const dx = points[i + 2] - points[i];
      const dy = points[i + 3] - points[i + 1];
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    // Animate drawing the line
    line.dashOffset(totalLength);
    line.dash([totalLength, totalLength]);
    line.to({
      dashOffset: 0,
      duration: 0.8,
      easing: Konva.Easings.EaseOut,
      onFinish: () => {
        if (dashed) {
          line.dash([10, 5]);
        } else {
          line.dash([]);
        }
      }
    });

    setIsInitialMount(false);
  }, [points, isInitialMount, dashed]);

  // HOVER ANIMATION
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (lineRef.current) {
      lineRef.current.to({
        strokeWidth: 4,
        shadowBlur: 15,
        duration: 0.2
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (lineRef.current) {
      lineRef.current.to({
        strokeWidth: 3,
        shadowBlur: 8,
        duration: 0.2
      });
    }
  };

  // Calculate arrow head position and angle
  const getArrowHead = () => {
    if (points.length < 4) return null;

    const lastX = points[points.length - 2];
    const lastY = points[points.length - 1];
    const prevX = points[points.length - 4];
    const prevY = points[points.length - 3];

    const angle = Math.atan2(lastY - prevY, lastX - prevX);
    const arrowLength = 12;
    const arrowWidth = 8;

    return {
      points: [
        lastX, lastY,
        lastX - arrowLength * Math.cos(angle - Math.PI / 6),
        lastY - arrowLength * Math.sin(angle - Math.PI / 6),
        lastX - arrowLength * Math.cos(angle + Math.PI / 6),
        lastY - arrowLength * Math.sin(angle + Math.PI / 6),
        lastX, lastY
      ]
    };
  };

  const arrowHead = getArrowHead();

  // Calculate midpoint for label
  const getMidpoint = () => {
    if (points.length === 0) return { x: 0, y: 0 };
    const midIdx = Math.floor(points.length / 4) * 2;
    return {
      x: points[midIdx],
      y: points[midIdx + 1] - 20
    };
  };

  const midpoint = getMidpoint();

  return (
    <Group
      ref={groupRef}
      id={id}
      listening={true}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Curved Line */}
      <Line
        ref={lineRef}
        points={points}
        stroke={isHovered ? COLORS.highlight : color}
        strokeWidth={3}
        lineCap="round"
        lineJoin="round"
        shadowColor={color}
        shadowBlur={8}
        shadowOpacity={0.6}
        tension={0.3}
      />

      {/* Arrow Head */}
      {arrowHead && (
        <Line
          points={arrowHead.points}
          fill={isHovered ? COLORS.highlight : color}
          stroke={isHovered ? COLORS.highlight : color}
          strokeWidth={2}
          closed={true}
          lineJoin="round"
        />
      )}

      {/* Dot at start */}
      <Circle
        x={from.x}
        y={from.y}
        radius={4}
        fill={isHovered ? COLORS.highlight : color}
        shadowColor={color}
        shadowBlur={6}
      />

      {/* Label on hover */}
      {isHovered && fromVar && toVar && (
        <>
          <Circle
            x={midpoint.x}
            y={midpoint.y}
            radius={45}
            fill="#1E293B"
            stroke={color}
            strokeWidth={2}
            opacity={0.95}
          />
          <Text
            x={midpoint.x - 40}
            y={midpoint.y - 15}
            text={`${fromVar}`}
            fontSize={11}
            fill={COLORS.text}
            width={80}
            align="center"
            listening={false}
          />
          <Text
            x={midpoint.x - 40}
            y={midpoint.y}
            text="→"
            fontSize={14}
            fill={color}
            width={80}
            align="center"
            listening={false}
          />
          <Text
            x={midpoint.x - 40}
            y={midpoint.y + 10}
            text={`${toVar}`}
            fontSize={11}
            fill={COLORS.text}
            width={80}
            align="center"
            listening={false}
          />
        </>
      )}
    </Group>
  );
};

export default PointerArrow;