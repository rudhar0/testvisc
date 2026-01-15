import React, { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text, Circle } from 'react-konva';
import Konva from 'konva';

// ============================================
// TYPE DEFINITIONS
// ============================================

type VariableType = 'int' | 'float' | 'double' | 'char' | 'bool' | 'string';

type VariableState = 
  | 'declared'           // int a;
  | 'initialized'        // int a = 10;
  | 'multiple-init'      // int a = 10, b = 20;
  | 'updated';           // a = 30;

interface VariableBoxProps {
  id: string;
  name: string;
  type: string;
  value: any;
  address: string;
  x: number;
  y: number;
  width: number;
  height: number;
  section: 'global' | 'stack' | 'heap';
  isNew?: boolean;
  isUpdated?: boolean;
  previousValue?: any;
  expression?: string;
  onClick?: () => void;
  // New props for enhanced functionality
  state?: VariableState;
  stepNumber?: number;
  enterDelay?: number; // milliseconds to delay entrance animation
}

// ============================================
// COLOR SYSTEM - Type-based colors
// ============================================

const TYPE_COLORS: Record<string, {
  primary: string;
  light: string;
  dark: string;
  glow: string;
  bg: string;
}> = {
  int: {
    primary: '#3B82F6',
    light: '#60A5FA',
    dark: '#2563EB',
    glow: 'rgba(59, 130, 246, 0.3)',
    bg: 'rgba(59, 130, 246, 0.08)'
  },
  float: {
    primary: '#10B981',
    light: '#34D399',
    dark: '#059669',
    glow: 'rgba(16, 185, 129, 0.3)',
    bg: 'rgba(16, 185, 129, 0.08)'
  },
  double: {
    primary: '#8B5CF6',
    light: '#A78BFA',
    dark: '#7C3AED',
    glow: 'rgba(139, 92, 246, 0.3)',
    bg: 'rgba(139, 92, 246, 0.08)'
  },
  char: {
    primary: '#F59E0B',
    light: '#FBBF24',
    dark: '#D97706',
    glow: 'rgba(245, 158, 11, 0.3)',
    bg: 'rgba(245, 158, 11, 0.08)'
  },
  bool: {
    primary: '#EAB308',
    light: '#FDE047',
    dark: '#CA8A04',
    glow: 'rgba(234, 179, 8, 0.3)',
    bg: 'rgba(234, 179, 8, 0.08)'
  },
  string: {
    primary: '#EC4899',
    light: '#F472B6',
    dark: '#DB2777',
    glow: 'rgba(236, 72, 153, 0.3)',
    bg: 'rgba(236, 72, 153, 0.08)'
  },
  // Fallback for unknown types - changed to pink for easy debugging
  default: {
    primary: '#EC4899',
    light: '#F472B6',
    dark: '#DB2777',
    glow: 'rgba(236, 72, 153, 0.3)',
    bg: 'rgba(236, 72, 153, 0.08)'
  }
};

// State-based visual configuration
const STATE_CONFIG: Record<VariableState, {
  label: string;
  opacity: number;
  labelColor: string;
  glowIntensity: number;
}> = {
  declared: {
    label: 'DECLARED',
    opacity: 0.6,
    labelColor: '#94A3B8',
    glowIntensity: 0.2
  },
  initialized: {
    label: 'INITIALIZED',
    opacity: 1,
    labelColor: '#34D399',
    glowIntensity: 0.4
  },
  'multiple-init': {
    label: 'MULTI-INIT',
    opacity: 1,
    labelColor: '#A78BFA',
    glowIntensity: 0.5
  },
  updated: {
    label: 'UPDATED',
    opacity: 1,
    labelColor: '#FBBF24',
    glowIntensity: 0.6
  }
};

// ============================================
// ENHANCED VARIABLE BOX COMPONENT
// ============================================

export const VariableBox: React.FC<VariableBoxProps> = ({
  id,
  name,
  type,
  value,
  address,
  x,
  y,
  width,
  height,
  section,
  isNew = false,
  isUpdated = false,
  previousValue,
  expression,
  onClick,
  state,
  stepNumber
  , enterDelay = 0
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const bgRef = useRef<Konva.Rect>(null);
  const glowRef = useRef<Konva.Rect>(null);
  const statusDotRef = useRef<Konva.Circle>(null);
  
  const [isHovered, setIsHovered] = useState(false);
  const isInitialMount = useRef(true);
  const prevValueRef = useRef(value);

  // Use provided dimensions
  const BOX_WIDTH = 160;
  const BOX_HEIGHT = height;
  
  // Determine variable state if not provided
  const determinedState: VariableState = state || (() => {
    if (value === undefined || value === null) return 'declared';
    if (isUpdated) return 'updated';
    return 'initialized';
  })();

  // Get colors based on type - normalize type name
  const normalizeType = (t: string): keyof typeof TYPE_COLORS => {
    const lowerT = t.toLowerCase().trim();
    if (lowerT.includes('int')) return 'int';
    if (lowerT.includes('char')) return 'char';
    if (lowerT.includes('bool')) return 'bool';
    if (lowerT.includes('float')) return 'float';
    if (lowerT.includes('double')) return 'double';
    if (lowerT.includes('string')) return 'string';
    return 'default';
  };
  const normalizedType = normalizeType(type);
  const colors = TYPE_COLORS[normalizedType];
  const stateConfig = STATE_CONFIG[determinedState];

  // Make background color state-dependent for better visual feedback
  const boxFill = determinedState === 'declared' ? 'rgba(100, 116, 139, 0.15)' : colors.bg;
  const strokeColor = determinedState === 'declared' ? '#64748B' : colors.primary;

  // Format value for display
  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return 'â€”';
    if (typeof val === 'string') return `"${val}"`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number' && Number.isInteger(val)) return String(val);
    if (typeof val === 'number') return val.toFixed(2);
    if (Array.isArray(val)) return `[${val.length}]`;
    return String(val);
  };

  const displayValue = expression || (determinedState === 'declared' ? 'â€”' : formatValue(value));
  
  // Dynamic font size based on content length
  const valueFontSize = displayValue.length > 8 ? 14 : 18;
  const nameFontSize = name.length > 10 ? 18 : 22;

  // ============================================
  // ANIMATION 1: ENTRANCE (Fade + Scale + Slide)
  // ============================================
  useEffect(() => {
    const group = groupRef.current;
    const glow = glowRef.current;
    
    if (!group || !glow) return;

    if (isNew && isInitialMount.current) {
      console.log(`[VariableBox] Entrance animation for: ${name} at position (${x}, ${y}), delay=${enterDelay}ms`);

      // Initial state - invisible, smaller, and slightly below
      group.opacity(0);
      group.scaleX(0.7);
      group.scaleY(0.7);
      const currentY = group.y();
      group.y(currentY + 20);

      // Prepare entrance animation
      const playEntrance = () => {
        const entranceAnim = new Konva.Tween({
          node: group,
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
          y: currentY,
          duration: 0.5,
          easing: Konva.Easings.BackEaseOut,
          onFinish: () => {
            // Subtle glow pulse after entrance
            const glowAnim = new Konva.Tween({
              node: glow,
              opacity: stateConfig.glowIntensity,
              duration: 0.3,
              easing: Konva.Easings.EaseInOut
            });
            glowAnim.play();
          }
        });
        entranceAnim.play();
      };

      let t: any = null;
      if (enterDelay && enterDelay > 0) {
        t = setTimeout(playEntrance, enterDelay);
      } else {
        playEntrance();
      }

      return () => {
        if (t) clearTimeout(t);
      };
    } else if (isInitialMount.current) {
      // Not new but first render - set to final state immediately
      group.opacity(1);
      group.scaleX(1);
      group.scaleY(1);
      glow.opacity(stateConfig.glowIntensity);
      isInitialMount.current = false;
    }
  }, [isNew, name, stateConfig.glowIntensity]);

  // ============================================
  // ANIMATION 2: UPDATE (Flash + Pulse) - REMOVED
  // This animation is no longer needed as updates are shown by creating new variable boxes
  // in a top-to-bottom flow, as handled by the LayoutEngine.
  // ============================================
  useEffect(() => {
    // Keep prevValueRef updated for other potential uses, but no animation.
    prevValueRef.current = value;
  }, [value]);

  // ============================================
  // ANIMATION 4: HOVER
  // ============================================
  const handleMouseEnter = () => {
    setIsHovered(true);
    
    const bg = bgRef.current;
    const glow = glowRef.current;
    
    if (bg) {
      bg.to({
        strokeWidth: 3,
        duration: 0.2
      });
    }
    
    if (glow) {
      glow.to({
        shadowBlur: 20,
        opacity: 0.6,
        duration: 0.2
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    
    const bg = bgRef.current;
    const glow = glowRef.current;
    
    if (bg) {
      bg.to({
        strokeWidth: 2,
        duration: 0.2
      });
    }
    
    if (glow) {
      glow.to({
        shadowBlur: 15,
        opacity: stateConfig.glowIntensity,
        duration: 0.2
      });
    }
  };

  // ============================================
  // RENDER - Position is relative (0,0) inside parent
  // ============================================
  return (
    <Group
      ref={groupRef}
      id={id}
      x={0}
      y={0}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onTap={onClick}
    >
      {/* Glow Layer - subtle shadow effect */}
      <Rect
        ref={glowRef}
        width={BOX_WIDTH}
        height={BOX_HEIGHT}
        fill="transparent"
        cornerRadius={12}
        shadowColor={colors.primary}
        shadowBlur={15}
        shadowOpacity={stateConfig.glowIntensity}
        opacity={0}
      />

      {/* Main Background */}
      <Rect
        ref={bgRef}
        width={BOX_WIDTH}
        height={BOX_HEIGHT}
        fill={boxFill}
        stroke={strokeColor}
        strokeWidth={2}
        cornerRadius={12}
        shadowColor="rgba(0, 0, 0, 0.3)"
        shadowBlur={8}
        shadowOffsetY={2}
      />

      {/* Status Indicator Dot (Top Right) */}
      <Circle
        ref={statusDotRef}
        x={BOX_WIDTH - 12}
        y={12}
        radius={5}
        fill={stateConfig.labelColor}
        shadowColor={stateConfig.labelColor}
        shadowBlur={8}
        shadowOpacity={0.8}
      />

      {/* State Label (Top Left - Small) */}
      <Text
        text={stateConfig.label}
        x={12}
        y={8}
        fontSize={9}
        fontStyle="bold"
        fill={stateConfig.labelColor}
        fontFamily="'SF Pro Display', -apple-system, system-ui, sans-serif"
        letterSpacing={0.5}
      />

      {/* Variable Name (BIG & BOLD - Primary Info) */}
      <Text
        text={name}
        x={12}
        y={28}
        fontSize={nameFontSize}
        fontStyle="bold"
        fill="#F1F5F9"
        fontFamily="'SF Pro Display', -apple-system, system-ui, sans-serif"
        width={BOX_WIDTH - 24}
        ellipsis={true}
      />

      {/* Value (BIG - Primary Info) */}
      <Text
        text={displayValue}
        x={12}
        y={52}
        fontSize={valueFontSize}
        fontStyle={determinedState === 'declared' ? 'normal' : 'bold'}
        fill={determinedState === 'declared' ? '#64748B' : colors.light}
        fontFamily="'SF Mono', 'Monaco', 'Courier New', monospace"
        width={BOX_WIDTH - 24}
        ellipsis={true}
      />

      {/* Type Badge (Bottom Left - Small, Secondary) */}
      <Rect
        x={10}
        y={BOX_HEIGHT - 20}
        width={type.length * 7 + 12}
        height={16}
        fill={colors.primary}
        cornerRadius={8}
        opacity={0.2}
      />
      <Text
        text={type.toUpperCase()}
        x={16}
        y={BOX_HEIGHT - 18}
        fontSize={10}
        fontStyle="bold"
        fill={colors.light}
        fontFamily="'SF Pro Display', -apple-system, system-ui, sans-serif"
      />

      {/* Step Number (Bottom Right - Small, Secondary) */}
      {stepNumber !== undefined && (
        <Text
          text={`#${stepNumber}`}
          x={BOX_WIDTH - 35}
          y={BOX_HEIGHT - 18}
          fontSize={10}
          fill="#64748B"
          fontFamily="'SF Mono', monospace"
        />
      )}

      {/* Address (Very small, only on hover) */}
      {address && (
        <Text
          text={address}
          x={BOX_WIDTH / 2}
          y={BOX_HEIGHT - 18}
          fontSize={8}
          fill="#475569"
          fontFamily="'SF Mono', monospace"
          opacity={isHovered ? 0.7 : 0}
          align="center"
        />
      )}
    </Group>
  );
};

export default VariableBox;