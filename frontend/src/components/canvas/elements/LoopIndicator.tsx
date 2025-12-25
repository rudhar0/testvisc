interface LoopIndicatorProps {
  id: string;
  iteration: number;
  total: number;
  x: number;
  y: number;
}

const LOOP_COLORS = {
  bg: '#A855F7',
  light: '#C084FC',
  dark: '#9333EA',
  text: '#FFFFFF'
};

export const LoopIndicator: React.FC<LoopIndicatorProps> = ({
  id,
  iteration,
  total,
  x,
  y
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const [prevIteration, setPrevIteration] = useState(iteration);

  // PULSE ANIMATION on iteration change
  useEffect(() => {
    if (iteration !== prevIteration && groupRef.current) {
      groupRef.current.to({
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 0.15,
        yoyo: true,
        onFinish: () => setPrevIteration(iteration)
      });
    }
  }, [iteration, prevIteration]);

  // ROTATION ANIMATION (continuous)
  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    const anim = new Konva.Animation((frame) => {
      if (frame) {
        node.rotation((frame.time / 20) % 360);
      }
    }, node.getLayer());

    anim.start();

    return () => anim.stop();
  }, []);

  const progress = total > 0 ? (iteration / total) * 100 : 0;
  const arcAngle = (progress / 100) * 360;

  return (
    <Group ref={groupRef} id={id} x={x} y={y}>
      {/* Background Circle */}
      <Circle
        radius={30}
        fill={LOOP_COLORS.dark}
        stroke={LOOP_COLORS.light}
        strokeWidth={2}
        shadowColor={LOOP_COLORS.bg}
        shadowBlur={15}
        shadowOpacity={0.6}
      />

      {/* Iteration Text */}
      <Text
        x={-25}
        y={-12}
        text={`${iteration}`}
        fontSize={20}
        fontStyle="bold"
        fill={LOOP_COLORS.text}
        width={50}
        align="center"
        listening={false}
      />

      {/* Label */}
      <Text
        x={-25}
        y={6}
        text="iter"
        fontSize={10}
        fill={LOOP_COLORS.light}
        width={50}
        align="center"
        listening={false}
      />

      {/* Spinning Icon (Unicode loop symbol) */}
      <Text
        x={-12}
        y={-40}
        text="⟲"
        fontSize={24}
        fill={LOOP_COLORS.light}
        listening={false}
      />
    </Group>
  );
};

export default LoopIndicator;