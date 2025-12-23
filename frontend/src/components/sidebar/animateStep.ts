import Konva from 'konva';

/**
 * Triggers transient animations when a step changes.
 * e.g., highlighting a variable that was just updated.
 */
export const animateStepChange = (stage: Konva.Stage, traceStep: any) => {
  if (!stage || !traceStep) return;

  // Example: Highlight variable if declaration or assignment
  if (traceStep.type === 'variable_declaration' || traceStep.type === 'assignment') {
    // We need to find the node. Since IDs are dynamic (var-frameIndex-name),
    // we might need a more robust lookup or pass the ID from RenderRegistry.
    // For now, we search by name suffix which is common in Konva.
    const shape = stage.findOne((node: Konva.Node) => {
      return node.id()?.endsWith(`-${traceStep.variable}`);
    });

    if (shape) {
      const tween = new Konva.Tween({
        node: shape,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 0.1,
        yoyo: true,
        onFinish: () => {
          shape.scale({ x: 1, y: 1 });
        }
      });
      tween.play();
    }
  }
};