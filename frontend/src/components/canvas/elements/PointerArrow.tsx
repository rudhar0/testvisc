
import React from 'react';
import { Arrow } from 'react-konva';

const PointerArrow = () => {
  return (
    <Arrow points={[0, 0, 100, 100]} fill="black" stroke="black" strokeWidth={4} />
  );
};

export default PointerArrow;
