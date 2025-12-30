// frontend/src/components/canvas/elements/StackFrame.tsx
import React, { useRef, useEffect } from 'react';
import { Rect, Text, Line, Group } from 'react-konva';
import Konva from 'konva';
import gsap from 'gsap';

export const StackFrame = (props: any) => {
  const { x, y, width, height, name, return_address, active, isPush, isPop } = props;
  const groupRef = useRef<Konva.Group>(null);

  const strokeColor = active ? '#A855F7' : '#3B82F6';

  useEffect(() => {
    if (isPush && groupRef.current) {
        gsap.from(groupRef.current, { y: y - 50, opacity: 0, duration: 0.5 });
    }
    if (isPop && groupRef.current) {
        gsap.to(groupRef.current, { y: y - 50, opacity: 0, duration: 0.5 });
    }
  }, [isPush, isPop, y]);


  return (
    <Group x={x} y={y} ref={groupRef}>
      {/* Main frame rectangle */}
      <Rect
        width={width}
        height={height}
        stroke={strokeColor}
        strokeWidth={active ? 3 : 2}
        cornerRadius={5}
        fill="#1e293b"
        shadowBlur={active ? 15 : 0}
        shadowColor={strokeColor}
      />
      {/* Title */}
      <Text
        text={`${name}()`}
        x={10}
        y={10}
        fontSize={16}
        fontStyle="bold"
        fill="white"
      />
      {/* Separator line */}
      <Line
        points={[0, 35, width, 35]}
        stroke={strokeColor}
        strokeWidth={1}
      />
      {/* Return Address */}
      <Text
        text={`Return: ${return_address || '0x...'}`}
        x={10}
        y={45}
        fontSize={12}
        fill="#94a3b8" // slate-400
      />
      {/* Locals header */}
      <Text
        text="Locals:"
        x={10}
        y={65}
        fontSize={12}
        fontStyle="italic"
        fill="#94a3b8" // slate-400
      />
    </Group>
  );
};
