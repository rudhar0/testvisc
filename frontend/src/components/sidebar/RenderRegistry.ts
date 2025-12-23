/**
 * RenderRegistry.ts
 * Responsible for converting Execution Trace Data into Visual Element Props.
 * Calculates layout positions for Stack Frames and Variables.
 */

export interface VisualElement {
  id: string;
  type: 'variable' | 'frame' | 'pointer';
  props: any;
}

export class RenderRegistry {
  private static FRAME_PADDING = 20;
  private static VAR_HEIGHT = 70;
  private static START_Y = 50;

  /**
   * Parses the trace up to the current step and returns a list of visual elements.
   * @param canvasWidth The current width of the canvas for responsive layout.
   */
  static getElementsForStep(trace: any[], currentStep: number, canvasWidth: number): VisualElement[] {
    if (!trace || trace.length === 0 || canvasWidth <= 0) return [];

    // --- Constants for responsive layout ---
    const START_X = canvasWidth > 400 ? 50 : 20;
    const VAR_WIDTH = canvasWidth > 400 ? 140 : 120;
    const VAR_GAP = 10;
    const MAX_GLOBALS_PER_ROW = Math.max(1, Math.floor((canvasWidth - START_X) / (VAR_WIDTH + VAR_GAP)));
    const elements: VisualElement[] = [];
    const globals: Record<string, any> = {};
    const stack: { name: string; variables: Record<string, any> }[] = [];

    // 1. Reconstruct Memory State
    for (let i = 0; i <= currentStep && i < trace.length; i++) {
      const step = trace[i];

      // Globals
      if (step.type === 'global_declaration') {
        globals[step.variable] = { type: step.dataType, value: step.value ?? '?' };
      }
      if (step.state?.globals) {
        Object.assign(globals, step.state.globals);
      }

      // Stack Operations
      if (step.type === 'function_call') {
        stack.push({ name: step.function, variables: {} });
      } else if (step.type === 'function_return') {
        stack.pop();
      }

      // Local Variables
      if (step.type === 'variable_declaration') {
        const frame = stack[stack.length - 1];
        if (frame) {
          frame.variables[step.variable] = { type: step.dataType, value: step.value ?? '?' };
        }
      }

      // Updates from state snapshot
      if (step.state?.locals && stack.length > 0) {
        Object.assign(stack[stack.length - 1].variables, step.state.locals);
      }
    }

    // 2. Calculate Layout & Generate Elements
    let currentY = this.START_Y;

    // -- Render Globals --
    if (Object.keys(globals).length > 0) {
      Object.entries(globals).forEach(([name, data]: [string, any], index) => {
        const row = Math.floor(index / MAX_GLOBALS_PER_ROW);
        const col = index % MAX_GLOBALS_PER_ROW;
        const globalX = START_X + col * (VAR_WIDTH + VAR_GAP);
        const globalY = currentY + row * (this.VAR_HEIGHT + VAR_GAP);
        elements.push({
          id: `global-${name}`,
          type: 'variable',
          props: {
            id: `global-${name}`,
            x: globalX,
            y: globalY,
            name: name,
            value: data.value,
            type: data.type,
            width: VAR_WIDTH,
            color: '#0f172a', // Darker for globals
          },
        });
      });
      const globalRows = Math.ceil(Object.keys(globals).length / MAX_GLOBALS_PER_ROW);
      currentY += (globalRows * (this.VAR_HEIGHT + VAR_GAP)) + 40; // Spacing after globals
    }

    // -- Render Stack Frames --
    const MAX_VARS_PER_ROW = Math.max(1, Math.floor((canvasWidth - START_X * 2 - 40) / (VAR_WIDTH + VAR_GAP)));
    stack.forEach((frame, index) => {
      const frameVars = Object.entries(frame.variables);
      const frameRows = Math.ceil(frameVars.length / MAX_VARS_PER_ROW);
      const frameHeight = Math.max(100, frameRows * (this.VAR_HEIGHT + VAR_GAP) + 40);
      const frameWidth = Math.min(canvasWidth - START_X * 2, (MAX_VARS_PER_ROW * (VAR_WIDTH + VAR_GAP)) + 20);

      // Frame Container
      elements.push({
        id: `frame-${index}`,
        type: 'frame',
        props: {
          id: `frame-${index}`,
          x: START_X,
          y: currentY,
          width: frameWidth,
          height: frameHeight,
          name: frame.name,
        },
      });

      // Frame Variables
      frameVars.forEach(([name, data]: [string, any], vIndex) => {
        const col = vIndex % MAX_VARS_PER_ROW;
        const row = Math.floor(vIndex / MAX_VARS_PER_ROW);
        
        elements.push({
          id: `var-${index}-${name}`,
          type: 'variable',
          props: {
            id: `var-${index}-${name}`,
            x: START_X + 20 + (col * (VAR_WIDTH + VAR_GAP)),
            y: currentY + 20 + (row * (this.VAR_HEIGHT + VAR_GAP)),
            name: name,
            value: data.value,
            type: data.type,
            width: VAR_WIDTH,
          },
        });
      });

      currentY += frameHeight + 20;
    });

    return elements;
  }
}