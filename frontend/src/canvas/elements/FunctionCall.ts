// frontend/src/canvas/elements/FunctionCall.ts
import { CanvasElement } from "../core/CanvasElement";
import Konva from 'konva';
import AnimationEngine from "../../animations/AnimationEngine";
import { FunctionCallAnimation as FunctionCallAnimationType } from "../../types/animation.types"; // Aliasing to avoid conflict

export class FunctionCall extends CanvasElement {
    constructor(id: string, parentId: string, layer: Konva.Layer, name: string) {
        super(id, parentId, layer);
        this.elementType = 'FunctionCall';
        this.layout = {
            x: 0,
            y: 0,
            width: 560,
            height: 30, // Will expand
            cursorY: 30,
        };

        const text = new Konva.Text({
            text: `call ${name}()`,
            x: 0,
            y: 5,
            fill: '#a855f7',
            fontFamily: 'monospace',
            fontStyle: 'italic',
        });
        
        this.container.add(text);
    }
    
    async create(payload: any): Promise<void> {
        const animation: FunctionCallAnimationType = {
            type: 'function_call',
            target: this.id,
            konvaObject: this.container,
            duration: 300,
        };
        const timeline = AnimationEngine.createSequence([animation]);
        AnimationEngine.addSequence(timeline);
    }
    async update(payload: any): Promise<void> {}
    async animate(type: any, payload?: any): Promise<void> {}
}
