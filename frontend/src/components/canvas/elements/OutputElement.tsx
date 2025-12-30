// frontend/src/components/canvas/elements/OutputElement.tsx
import React from 'react';
import { Rect, Text } from 'react-konva';

const OutputElement = (props: any) => {
    const { x, y, width, height, content } = props;
    return (
        <>
            <Rect x={x} y={y} width={width} height={height} fill="#000" />
            <Text text={content} x={x+5} y={y+5} fill="white" fontFamily="monospace" />
        </>
    )
}
export default OutputElement;
