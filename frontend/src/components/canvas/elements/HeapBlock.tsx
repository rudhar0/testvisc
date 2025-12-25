interface HeapBlockProps {
  id: string;
  address: string;
  size: number;
  type: string;
  value: any;
  x: number;
  y: number;
  width: number;
  height: number;
  allocated: boolean;
}

const HEAP_COLORS = {
  allocated: { bg: '#1E293B', border: '#10B981', text: '#10B981' },
  freed: { bg: '#0F172A', border: '#64748B', text: '#64748B' },
  text: { primary: '#F1F5F9', secondary: '#94A3B8' }
};

export const HeapBlock: React.FC<HeapBlockProps> = ({
  id,
  address,
  size,
  type,
  value,
  x,
  y,
  width,
  height,
  allocated
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const prevAllocatedRef = useRef(allocated);

  const colors = allocated ? HEAP_COLORS.allocated : HEAP_COLORS.freed;

  // APPEAR ANIMATION (allocation)
  useEffect(() => {
    const node = groupRef.current;
    if (!node || !isInitialMount) return;

    node.opacity(0);
    node.scaleX(0.8);
    node.scaleY(0.8);
    node.to({
      opacity: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 0.4,
      easing: Konva.Easings.BackEaseOut
    });

    setIsInitialMount(false);
  }, [isInitialMount]);

  // FREE ANIMATION
  useEffect(() => {
    if (prevAllocatedRef.current && !allocated) {
      const rect = rectRef.current;
      if (rect) {
        rect.to({
          stroke: HEAP_COLORS.freed.border,
          fill: HEAP_COLORS.freed.bg,
          opacity: 0.5,
          duration: 0.5
        });
      }
    }
    prevAllocatedRef.current = allocated;
  }, [allocated]);

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return 'null';
    if (Array.isArray(val)) return `[${val.length} items]`;
    return String(val).substring(0, 20);
  };

  return (
    <Group
      ref={groupRef}
      id={id}
      x={x}
      y={y}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Rect
        ref={rectRef}
        width={width}
        height={height}
        fill={colors.bg}
        stroke={colors.border}
        strokeWidth={isHovered ? 3 : 2}
        cornerRadius={8}
        shadowColor={colors.border}
        shadowBlur={isHovered ? 12 : 6}
        shadowOpacity={0.4}
        opacity={allocated ? 1 : 0.5}
      />

      {/* Address */}
      <Text
        x={12}
        y={12}
        text={address}
        fontSize={12}
        fontStyle="bold"
        fill={colors.text}
        listening={false}
      />

      {/* Type & Size */}
      <Text
        x={12}
        y={30}
        text={`${type} (${size} bytes)`}
        fontSize={10}
        fill={HEAP_COLORS.text.secondary}
        listening={false}
      />

      {/* Value */}
      <Text
        x={12}
        y={48}
        text={formatValue(value)}
        fontSize={14}
        fontFamily="monospace"
        fill={allocated ? HEAP_COLORS.text.primary : HEAP_COLORS.text.secondary}
        width={width - 24}
        ellipsis={true}
        listening={false}
      />

      {/* Status Badge */}
      <Text
        x={width - 12}
        y={height - 18}
        text={allocated ? 'ALLOC' : 'FREED'}
        fontSize={9}
        fontStyle="bold"
        fill={colors.text}
        align="right"
        width={width - 24}
        listening={false}
      />
    </Group>
  );
};
export default HeapBlock;