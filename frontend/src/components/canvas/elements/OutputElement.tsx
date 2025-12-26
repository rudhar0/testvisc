import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';
 
interface OutputBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
}

const COLORS = {
  bg: '#1E293B',
  border: '#10B981',
  text: { primary: '#F1F5F9', secondary: '#10B981' }
};

export const OutputBox: React.FC<OutputBoxProps> = ({ x, y, width, height, content: initialContent }) => {
  console.log('OutputBox render:', { x, y, width, height, content: initialContent });
  const groupRef = useRef<Konva.Group>(null);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [currentContent, setCurrentContent] = useState(initialContent);
  const prevContentRef = useRef(initialContent);

  // Update content and trigger animation
  const updateContent = useCallback((newContent: string) => {
    if (newContent !== prevContentRef.current) {
      setCurrentContent(newContent);
      if (groupRef.current) {
        groupRef.current.to({
          scaleX: 1.02,
          scaleY: 1.02,
          duration: 0.1,
          yoyo: true,
          onFinish: () => {
            // Ensure scale returns to normal after pulse
            groupRef.current?.to({
              scaleX: 1,
              scaleY: 1,
              duration: 0.1
            });
          }
        });
      }
    }
    prevContentRef.current = newContent;
  }, []);

  // APPEAR ANIMATION
  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    if (isInitialMount) {
      node.opacity(0);
      node.y(y + 15);
      node.to({
        opacity: 1,
        y: y,
        duration: 0.4,
        easing: Konva.Easings.EaseOut
      });
      setIsInitialMount(false);
    } else {
      // Position animation for subsequent moves
      node.to({
        x: x,
        y: y,
        duration: 0.3,
        easing: Konva.Easings.EaseInOut,
      });
    }
  }, [x, y, isInitialMount]);

  // CONTENT UPDATE ANIMATION
  useEffect(() => {
    updateContent(initialContent);
  }, [initialContent, updateContent]);

  const lines = currentContent ? currentContent.split('\n').filter(line => line.trim() !== '') : [];
  const displayLines = lines.length > 0 ? lines : [null];

  return (
    <Group ref={groupRef} x={x} y={y}>
      {displayLines.map((line, index) => (
        <Group key={index} y={index * (height + 10)}>
          <Rect
            width={width}
            height={height}
            fill={COLORS.bg}
            stroke={COLORS.border}
            strokeWidth={2}
            cornerRadius={8}
            shadowColor={COLORS.border}
            shadowBlur={10}
            shadowOpacity={0.4}
          />
          
          <Text
            x={15}
            y={12}
            text="OUTPUT"
            fontSize={12}
            fontStyle="bold"
            fill={COLORS.text.secondary}
            listening={false}
          />

          <Text
            x={15}
            y={35}
            text={line || 'No output'}
            fontSize={14}
            fontFamily="monospace"
            fill={line ? COLORS.text.primary : '#64748B'}
            fontStyle={line ? 'normal' : 'italic'}
            width={width - 30}
            height={height - 50}
            wrap="word"
            listening={false}
          />
        </Group>
      ))}
    </Group>
  );
};
export default OutputBox;