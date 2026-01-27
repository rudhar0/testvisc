// frontend/src/components/canvas/elements/ReturnElement.tsx
// Return visualization component with prominent value display

import React, { useRef, useEffect, memo, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';

export interface ReturnElementProps {
  id: string;
  x: number;
  y: number;
  returnValue?: any;
  functionName: string;
  frameId: string;
  isNew?: boolean;
  stepNumber?: number;
  enterDelay?: number;
}

export const ReturnElement: React.FC<ReturnElementProps> = memo(({
  id,
  x,
  y,
  returnValue,
  functionName,
  frameId,
  isNew = false,
  stepNumber,
  enterDelay = 0
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const glowRef = useRef<Konva.Rect>(null);
  const isInitialMount = useRef(true);
  const [showingExplanation, setShowingExplanation] = useState(true);

  const BOX_WIDTH = 360; // Match other elements
  const BOX_HEIGHT = 70;
  
  const hasValue = returnValue !== undefined && returnValue !== null;
  const displayValue = hasValue ? String(returnValue) : 'void';

  // Animation
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    if (isNew && isInitialMount.current) {
      group.opacity(0);
      group.scaleX(0.8);
      group.scaleY(0.8);
      const origY = group.y();
      group.y(origY + 20);

      const playAnim = () => {
        new Konva.Tween({
          node: group,
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
          y: origY,
          duration: 0.5,
          easing: Konva.Easings.BackEaseOut,
          onFinish: () => {
            if (glowRef.current) {
              glowRef.current.to({ opacity: 0.7, duration: 0.3 });
            }
          }
        }).play();
      };

      if (enterDelay > 0) {
        const t = setTimeout(playAnim, enterDelay);
        return () => clearTimeout(t);
      } else {
        playAnim();
      }
    } else if (isInitialMount.current) {
      group.opacity(1);
      isInitialMount.current = false;
    }
  }, [isNew, enterDelay]);

  // Color transition for explanation
  useEffect(() => {
    if (showingExplanation) {
      const timer = setTimeout(() => {
        setShowingExplanation(false);
        // Transition to darker
        const group = groupRef.current;
        if (group) {
          group.findOne('.main-bg')?.to({
            fill: 'rgba(127, 29, 29, 0.9)',
            duration: 0.5
          });
          
          group.findOne('.explanation-bg')?.to({
            fill: 'rgba(127, 29, 29, 0.9)',
            duration: 0.5
          });
          
          group.findOne('.explanation-text')?.to({
            fill: '#FCA5A5',
            duration: 0.5
          });
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [showingExplanation]);

  return (
    <Group
      ref={groupRef}
      id={`${id}-step-${stepNumber || 0}`}
      x={x}
      y={y}
    >
      {/* Glow */}
      <Rect
        ref={glowRef}
        x={-3}
        y={-3}
        width={BOX_WIDTH + 6}
        height={BOX_HEIGHT + 6}
        fill="transparent"
        cornerRadius={10}
        shadowColor="rgba(239, 68, 68, 0.6)"
        shadowBlur={12}
        shadowOpacity={0.5}
        opacity={0}
      />

      {/* Main Background - Light when showing explanation */}
      <Rect
        name="main-bg"
        width={BOX_WIDTH}
        height={BOX_HEIGHT}
        fill={showingExplanation ? 
              'rgba(239, 68, 68, 0.15)' :  // Light red
              'rgba(127, 29, 29, 0.9)'}    // Dark red
        stroke={showingExplanation ? '#EF4444' : '#7F1D1D'}
        strokeWidth={2}
        cornerRadius={8}
        shadowColor="rgba(0, 0, 0, 0.3)"
        shadowBlur={10}
        shadowOffsetY={2}
      />

      {/* Return Icon */}
      <Text
        text="↩"
        x={16}
        y={12}
        fontSize={20}
        fill="#FCA5A5"
        fontStyle="bold"
      />

      {/* Function Name */}
      <Text
        text={`${functionName}()`}
        x={48}
        y={10}
        fontSize={12}
        fontStyle="bold"
        fill={showingExplanation ? '#7F1D1D' : '#FCA5A5'}
        fontFamily="'SF Mono', monospace"
      />

      {/* Return Value - PROMINENT */}
      <Group y={32}>
        <Text
          text="RETURNS:"
          x={16}
          y={0}
          fontSize={9}
          fontStyle="bold"
          fill={showingExplanation ? '#991B1B' : '#F87171'}
          fontFamily="'SF Pro Display', system-ui"
          letterSpacing={1}
        />
        <Text
          text={displayValue}
          x={80}
          y={-2}
          fontSize={18}
          fontStyle="bold"
          fill={hasValue ? '#10B981' : '#64748B'}
          fontFamily="'SF Mono', monospace"
        />
      </Group>

      {/* Explanation at bottom */}
      <Group y={BOX_HEIGHT - 32}>
        <Rect
          name="explanation-bg"
          width={BOX_WIDTH}
          height={28}
          fill={showingExplanation ? 
                'rgba(239, 68, 68, 0.3)' : 
                'rgba(127, 29, 29, 0.9)'}
          cornerRadius={[0, 0, 8, 8]}
        />
        <Text
          name="explanation-text"
          text={`💡 Returns to ${frameId.split('-')[0]}`}
          x={16}
          y={8}
          width={BOX_WIDTH - 32}
          fontSize={10}
          fill={showingExplanation ? '#7F1D1D' : '#FCA5A5'}
          fontFamily="'SF Pro Display', system-ui"
          align="center"
        />
      </Group>

      {/* Step number */}
      {stepNumber !== undefined && (
        <Text
          text={`#${stepNumber}`}
          x={BOX_WIDTH - 45}
          y={10}
          fontSize={9}
          fontStyle="bold"
          fill="#64748B"
          fontFamily="'SF Mono', monospace"
        />
      )}
    </Group>
  );
});

ReturnElement.displayName = 'ReturnElement';

export default ReturnElement;