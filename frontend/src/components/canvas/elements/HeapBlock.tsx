// frontend/src/components/canvas/elements/HeapBlock.tsx
import React, { useRef, useEffect } from 'react';
import { Rect, Text, Group } from 'react-konva';
import Konva from 'konva';
import gsap from 'gsap';

export const HeapBlock = (props: any) => {
  const { x, y, width, height, address, size, type, allocated, values, isNew, isFreed } = props;
  const groupRef = useRef<Konva.Group>(null);

  const statusColor = allocated ? '#10B981' : '#EF4444'; // Green for allocated, Red for freed

  useEffect(() => {
    if (isNew && groupRef.current) {
        gsap.from(groupRef.current, { scaleX: 0, scaleY: 0, opacity: 0, duration: 0.5 });
    }
    if (isFreed && groupRef.current) {
        gsap.to(groupRef.current, { opacity: 0.5, duration: 0.5 });
    }
  }, [isNew, isFreed]);

  return (
    <Group x={x} y={y} ref={groupRef}>
      <Rect
        width={width}
        height={height}
        fill="#1e293b"
        stroke={statusColor}
        strokeWidth={2}
        cornerRadius={3}
        shadowBlur={10}
        shadowColor={statusColor}
      />
      <Text
        text={`Heap Block @ ${address}`}
        x={10}
        y={10}
        fontSize={14}
        fontStyle="bold"
        fill="white"
      />
      <Text
        text={`Size: ${size} bytes | Type: ${type}`}
        x={10}
        y={30}
        fontSize={12}
        fill="#94a3b8"
      />
      <Text
        text={`Status: ${allocated ? 'Allocated' : 'Freed'}`}
        x={10}
        y={45}
        fontSize={12}
        fill={statusColor}
      />
      {/* Optionally render values inside */}
      <Text
        text={`[${(values || []).join(', ')}]`}
        x={10}
        y={65}
        fontSize={12}
        fill="white"
        fontFamily="monospace"
      />
    </Group>
  );
};
