// frontend/src/components/canvas/layout/LayoutEngine.ts

// A very basic layout engine to place globals and stack frames.
// This is a placeholder and would need to be much more sophisticated.

export const LayoutEngine = {
    calculateLayout: (state: any, width: number, height: number, prevLayout: any) => {
        const globals: any[] = [];
        const stack: any[] = [];
        const heap: any[] = [];

        // Layout globals
        let yOffset = 50;
        Object.entries(state.globals || {}).forEach(([name, data], index) => {
            globals.push({
                id: `global-${name}`,
                x: 50,
                y: yOffset,
                width: 200,
                height: 50,
                name: name,
                ...data,
            });
            yOffset += 60;
        });

        // Layout stack frames
        let stackXOffset = 300;
        (state.callStack || []).forEach((frame: any, frameIndex: number) => {
            const frameWidth = 250;
            const frameHeight = 80 + Object.keys(frame.locals).length * 50;
            const frameLayout = {
                id: `frame-${frame.func_name}-${frameIndex}`,
                x: stackXOffset,
                y: 50,
                width: frameWidth,
                height: frameHeight,
                name: frame.func_name,
                return_address: frame.returnAddress,
                active: frame.isActive,
                locals: [],
                output: [],
            };
            
            let localYOffset = 80;
            Object.entries(frame.locals || {}).forEach(([name, data]) => {
                frameLayout.locals.push({
                    id: `local-${frame.func_name}-${name}`,
                    x: stackXOffset + 10,
                    y: 50 + localYOffset,
                    width: frameWidth - 20,
                    height: 40,
                    name: name,
                    ...data
                } as any);
                localYOffset += 50;
            });

            stack.push(frameLayout);
            stackXOffset += frameWidth + 20;
        });

        // Layout heap blocks
        let heapYOffset = 50;
        Object.entries(state.heap || {}).forEach(([address, blockData]) => {
            heap.push({
                id: `heap-${address}`,
                x: stackXOffset + 50, // Place heap to the right
                y: heapYOffset,
                width: 250,
                height: 90,
                address: address,
                ...blockData,
            });
            heapYOffset += 100;
        });

        return { globals, stack, heap };
    }
};