import React from 'react';
import { Group, Rect, Text } from 'react-konva';

const HeapBlock = () => {
  return (
    <Group>
      <Rect width={100} height={100} fill="blue" />
      <Text text="HeapBlock" />
    </Group>
  );
};

export default HeapBlock;