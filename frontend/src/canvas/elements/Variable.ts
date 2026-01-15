// frontend/src/canvas/elements/Variable.ts
import { CanvasElement } from "../core/CanvasElement";
import Konva from 'konva';
import { Animation, VariableCreateAnimation, VariableUpdateAnimation } from '../../types/animation.types';
import { COLORS } from '../../config/theme.config';

export class Variable extends CanvasElement {
    private textNode: Konva.Text;
    private backgroundRect: Konva.Rect;

    constructor(id: string, parentId: string, layer: Konva.Layer, payload: any) {
        super(id, parentId, layer);
        this.elementType = 'Variable';
        this.layout = {
            x: 0,
            y: 0,
            width: 540,
            height: 50,
        };

        // Initial state for non-animated rendering (e.g., rebuildToStep)
        this.container.opacity(1); 
        this.container.scaleX(1);
        this.container.scaleY(1);

        this.backgroundRect = new Konva.Rect({
            name: 'box-bg',
            width: this.layout.width,
            height: this.layout.height,
            fill: COLORS.memory.stack.DEFAULT, // Using theme color
            stroke: COLORS.memory.stack.dark, // Using theme color
            strokeWidth: 2,
            cornerRadius: 6,
            shadowColor: 'black',
            shadowBlur: 5,
            shadowOpacity: 0.2,
        });

        this.textNode = new Konva.Text({
            name: 'variable-value',
            text: `${payload.type || payload.primitive || 'int'} ${payload.name} = ${payload.value};`,
            x: 10,
            y: 15,
            fill: COLORS.dark.text.primary, // Using theme color
            fontFamily: 'monospace',
            fontSize: 14,
        });
        
        this.container.add(this.backgroundRect, this.textNode);
    }
    
    // Non-animating creation: set the final state immediately
    create(payload: any): void {
        console.log('[Variable] Creating variable (non-animated) with payload:', payload);
        const type = payload.type || payload.primitive || 'int';
        const name = payload.name || '';
        const value = payload.value !== undefined ? String(payload.value) : '?';
        this.textNode.text(`${type} ${name} = ${value};`);
        this.container.opacity(1);
        this.container.scaleX(1);
        this.container.scaleY(1);
    }

    // Non-animating update: set the final state immediately
    update(payload: any): void {
        console.log('[Variable] Updating variable (non-animated) with payload:', payload);
        const type = payload.type || payload.primitive || 'int';
        const name = payload.name || '';
        const value = payload.value !== undefined ? String(payload.value) : '?';
        this.textNode.text(`${type} ${name} = ${value};`);
    }

    // Returns an animation description for creating the variable
    getCreateAnimation(payload: any): Animation {
        // Initial properties for animated rendering
        this.container.opacity(0);
        this.container.scaleX(0.8);
        this.container.scaleY(0.8);

        this.create(payload); // Apply final state for text, etc.
        
        const animation: VariableCreateAnimation = {
            type: 'variable_create',
            target: this.id,
            duration: 500, // ms
            konvaObject: this.container,
        };
        return animation;
    }

    // Returns an animation description for updating the variable
    getUpdateAnimation(payload: any): Animation {
        const oldValue = this.textNode.text();
        this.update(payload); // Apply final state for text
        const newValue = this.textNode.text();

        const animation: VariableUpdateAnimation = {
            type: 'variable_update',
            target: this.id,
            duration: 600, // ms
            from: oldValue,
            to: newValue,
            konvaContainer: this.container,
            valueTextNode: this.textNode,
            backgroundRect: this.backgroundRect,
        };
        return animation;
    }
}
