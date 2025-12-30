
import React from 'react';
import { Group, Rect, Text } from 'react-konva';

const ArrayView = () => {
  return (
    <Group>
      <Rect width={100} height={100} fill="red" />
      <Text text="ArrayView" />
    </Group>
  );
};

export default ArrayView;
