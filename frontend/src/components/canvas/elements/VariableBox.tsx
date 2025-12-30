// frontend/src/components/canvas/elements/VariableBox.tsx
import React, { useRef, useEffect } from 'react';
import { Rect, Text, Group } from 'react-konva';
import Konva from 'konva';
import gsap from 'gsap';

export const VariableBox = (props: any) => {
    const { x, y, width, height, name, value, isNew, isUpdated } = props;
    
    const groupRef = useRef<Konva.Group>(null);
    const rectRef = useRef<Konva.Rect>(null);
    const valueTextRef = useRef<Konva.Text>(null);

    useEffect(() => {
        if (isNew && groupRef.current) {
            gsap.from(groupRef.current, {
                opacity: 0,
                duration: 0.5,
            });
        }
    }, [isNew]);

    useEffect(() => {
        if (isUpdated && rectRef.current) {
            const tl = gsap.timeline();
            tl.to(rectRef.current, {
                fill: '#F59E0B', // Amber color for update
                duration: 0.2,
            }).to(rectRef.current, {
                fill: '#1e293b',
                duration: 0.2,
            });
        }
        
        if (isUpdated && valueTextRef.current) {
            valueTextRef.current.text(`${name}: ${value}`);
        }

    }, [isUpdated, value, name]);

    return (
        <Group x={x} y={y} ref={groupRef}>
            <Rect
                ref={rectRef}
                width={width}
                height={height}
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={1}
                cornerRadius={3}
            />
            <Text
                ref={valueTextRef}
                text={`${name}: ${value}`}
                x={10}
                y={15}
                fontSize={14}
                fill="white"
            />
        </Group>
    );
};
