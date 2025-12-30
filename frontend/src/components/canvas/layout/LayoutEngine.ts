const PADDING = 20;
const FRAME_PADDING = 20;
const VAR_HEIGHT = 100;
const VAR_WIDTH = 200;

export const LayoutEngine = {
  calculateLayout: (state: any, width: number, height: number, prevLayout: any) => {
    const globals: any[] = [];
    const stack: any[] = [];
    const heap: any[] = [];
    const output: any[] = [];

    let y_cursor = PADDING;

    // Globals
    let x_cursor = width - VAR_WIDTH - PADDING;
    if (state.globals) {
        Object.values(state.globals).forEach((variable: any) => {
            globals.push({
                ...variable,
                id: `global-${variable.name}`,
                x: x_cursor,
                y: y_cursor,
                width: VAR_WIDTH,
                height: VAR_HEIGHT,
                section: 'global',
            });
            y_cursor += VAR_HEIGHT + PADDING;
        });
    }
    
    y_cursor = PADDING;
    x_cursor = PADDING;

    // Stack
    if (state.callStack) {
      state.callStack.forEach((frame: any, frameIndex: number) => {
        const frameHeight = Object.keys(frame.locals).length * (VAR_HEIGHT + PADDING) + FRAME_PADDING * 2;
        const frameLayout = {
          id: `frame-${frameIndex}`,
          x: x_cursor,
          y: y_cursor,
          width: VAR_WIDTH + FRAME_PADDING * 2,
          height: frameHeight,
          name: frame.function,
          locals: [],
        };

        y_cursor += FRAME_PADDING;

        Object.values(frame.locals).forEach((variable: any) => {
          frameLayout.locals.push({
            ...variable,
            id: `local-${frameIndex}-${variable.name}`,
            x: x_cursor + FRAME_PADDING,
            y: y_cursor,
            width: VAR_WIDTH,
            height: VAR_HEIGHT,
            section: 'stack',
          });
          y_cursor += VAR_HEIGHT + PADDING;
        });

        stack.push(frameLayout);
        y_cursor += FRAME_PADDING;
      });
    }

    return {
      globals,
      stack,
      heap,
      output,
    };
  }
};