// frontend/src/components/canvas/layout/NewLayoutEngine.ts

import { LayoutElement } from './LayoutEngine';

const STACK_FRAME_X = 50;
const STACK_FRAME_Y = 50;
const STACK_FRAME_WIDTH = 500;
const VAR_WIDTH = 200;
const VAR_HEIGHT = 40;
const PADDING = 20;
const COLS = 2; // Number of columns in the grid

export class NewLayoutEngine {
  private elements: Map<string, LayoutElement> = new Map();
  private frameStack: LayoutElement[] = [];
  private processedSteps = 0;

  private get currentFrame(): LayoutElement | null {
    return this.frameStack.length > 0 ? this.frameStack[this.frameStack.length - 1] : null;
  }

  public calculateLayout(visualizationSteps: any[]): LayoutElement[] {
    if (this.processedSteps === 0) {
        // First run, create main frame
        const mainFrame: LayoutElement = {
            id: 'frame-main',
            type: 'function',
            subtype: 'function_call',
            x: STACK_FRAME_X,
            y: STACK_FRAME_Y,
            width: STACK_FRAME_WIDTH,
            height: 100, // Initial height
            data: { functionName: 'main' },
            children: [],
        };
        this.elements.set(mainFrame.id, mainFrame);
        this.frameStack.push(mainFrame);
    }

    const newSteps = visualizationSteps.slice(this.processedSteps);

    newSteps.forEach(step => {
      const { type, element, payload } = step;

      if (type === 'function') {
        if (element === 'function_call') {
          const frameId = `frame-${payload.frameId}`;
          if (!this.elements.has(frameId)) {
            const parentFrame = this.currentFrame;
            const newFrame: LayoutElement = {
              id: frameId,
              type: 'function',
              subtype: element,
              x: parentFrame ? parentFrame.x : STACK_FRAME_X,
              y: parentFrame ? (parentFrame.y + parentFrame.height + PADDING) : STACK_FRAME_Y,
              width: STACK_FRAME_WIDTH,
              height: 100, // Initial height
              data: payload,
              children: [],
              parentId: parentFrame?.id,
            };
            this.elements.set(frameId, newFrame);
            this.frameStack.push(newFrame);
            if (parentFrame) {
                // Cant be a child of another frame in this layout
                // parentFrame.children?.push(newFrame);
            }
          }
        } else if (element === 'function_return') {
          const frameId = `frame-${payload.frameId}`;
          const frameToRemove = this.elements.get(frameId);
          if (frameToRemove) {
            frameToRemove.subtype = 'function_return'; // Mark for removal animation
          }
          this.frameStack.pop();
        }
      } else if (element === 'pointer_arrow') {
        const sourceElement = this.elements.get(payload.sourceId);
        if (sourceElement) {
            if (!sourceElement.metadata) {
                sourceElement.metadata = {};
            }
            sourceElement.metadata.arrowTo = payload.targetId;
        }
      } else {
        const parentFrame = this.currentFrame;
        if (parentFrame) {
            const id = `${payload.frameId}-${payload.name}`;
            if (!this.elements.has(id)) {
                const childCount = parentFrame.children?.length || 0;
                const row = Math.floor(childCount / COLS);
                const col = childCount % COLS;

                const x = parentFrame.x + PADDING + col * (VAR_WIDTH + PADDING);
                const y = parentFrame.y + PADDING + 40 + row * (VAR_HEIGHT + PADDING);
                
                const newElement: LayoutElement = {
                    id,
                    type: type,
                    subtype: element,
                    x,
                    y,
                    width: VAR_WIDTH,
                    height: VAR_HEIGHT,
                    data: payload,
                    parentId: parentFrame.id,
                };
                this.elements.set(id, newElement);
                parentFrame.children?.push(newElement);

                // Adjust parent frame height
                const requiredHeight = y + VAR_HEIGHT + PADDING - parentFrame.y;
                if (requiredHeight > parentFrame.height) {
                    parentFrame.height = requiredHeight;
                }
            } else {
                const existingElement = this.elements.get(id);
                if (existingElement) {
                    existingElement.data = payload;
                    existingElement.subtype = element;
                }
            }
        }
      }
    });

    this.processedSteps = visualizationSteps.length;
    return Array.from(this.elements.values());
  }
}

