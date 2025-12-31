import { CanvasElement } from "../core/CanvasElement";
import Konva from 'konva';
import { FunctionCallAnimation as FunctionCallAnimationType, Animation } from "../../types/animation.types";
import { FunctionSubtype } from "../../types/element.types";
import { COLORS } from '../../config/theme.config';

// Color scheme from specifications
const FUNCTION_COLORS = {
    call: {
        background: '#fff3e0',
        border: '#ff9800',
        text: '#e65100',
    },
    body_main: {
        background: '#fffde7',
        border: '#fbc02d',
        header: '#fbc02d',
        text: '#fff',
    },
    body_global: {
        background: '#f3e5f5',
        border: '#9c27b0',
        borderStyle: 'dashed',
        text: '#4a148c',
    }
};

export class FunctionCall extends CanvasElement {
    private text: Konva.Text;
    private backgroundRect: Konva.Rect;
    private headerRect: Konva.Rect | null = null;
    private subType: FunctionSubtype = 'function_call';
    private functionName: string = '';

    constructor(id: string, parentId: string, layer: Konva.Layer, payload: any) {
        super(id, parentId, layer);
        this.elementType = 'FunctionCall';
        this.subType = payload.subtype || 'function_call';
        this.functionName = payload.function || payload.name || 'function';
        
        const isGlobal = this.subType === 'function_body_global';
        const isBody = this.subType === 'function_body_main' || isGlobal;
        
        this.layout = {
            x: 0,
            y: 0,
            width: isGlobal ? 280 : 560,
            height: isBody ? 60 : 30,
            cursorY: isBody ? 60 : 30,
        };

        const colors = this.getColorsForSubtype(this.subType);
        
        // Background rectangle
        const borderStyle = isGlobal ? [5, 5] : [];
        this.backgroundRect = new Konva.Rect({
            width: this.layout.width,
            height: this.layout.height,
            fill: colors.background,
            stroke: colors.border,
            strokeWidth: 2,
            cornerRadius: isBody ? 8 : 4,
            dash: borderStyle,
        });

        // Header for function body
        if (isBody) {
            this.headerRect = new Konva.Rect({
                width: this.layout.width,
                height: 25,
                fill: isGlobal ? colors.background : colors.header,
                cornerRadius: [8, 8, 0, 0],
            });
            this.container.add(this.headerRect);
        }

        // Function label text
        const labelText = this.getLabelText(this.subType, this.functionName);
        this.text = new Konva.Text({
            text: labelText,
            x: 10,
            y: isBody ? (isGlobal ? 10 : 5) : 5,
            fill: isBody && !isGlobal ? colors.text : colors.text,
            fontFamily: "'Courier New', monospace",
            fontSize: isBody ? 12 : 14,
            fontStyle: this.subType === 'function_call' ? 'italic' : 'normal',
        });
        
        this.container.add(this.backgroundRect, this.text);
        
        // Set initial state
        this.container.opacity(1);
        this.container.scaleX(1);
        this.container.scaleY(1);
    }

    private getColorsForSubtype(subtype: FunctionSubtype): typeof FUNCTION_COLORS.call {
        switch (subtype) {
            case 'function_body_main':
                return FUNCTION_COLORS.body_main;
            case 'function_body_global':
                return FUNCTION_COLORS.body_global;
            default:
                return FUNCTION_COLORS.call;
        }
    }

    private getLabelText(subtype: FunctionSubtype, functionName: string): string {
        switch (subtype) {
            case 'function_call':
                return `${functionName}()`;
            case 'function_body_main':
            case 'function_body_global':
                return `${functionName}() { ... }`;
            default:
                return functionName;
        }
    }
    
    create(payload: any): void {
        this.subType = payload.subtype || this.subType;
        this.functionName = payload.function || payload.name || this.functionName;
        const labelText = this.getLabelText(this.subType, this.functionName);
        this.text.text(labelText);
        this.container.opacity(1);
    }

    update(payload: any): void {
        if (payload.function || payload.name) {
            this.functionName = payload.function || payload.name;
            const labelText = this.getLabelText(this.subType, this.functionName);
            this.text.text(labelText);
        }
    }

    getCreateAnimation(payload: any): Animation {
        this.create(payload);
        
        // Set initial state for animation based on subtype
        if (this.subType === 'function_call') {
            // Arrow flow animation for call
            this.container.opacity(0);
        } else if (this.subType === 'function_body_global') {
            // Fly in animation for global function
            this.container.opacity(0);
            this.container.scaleX(0.9);
            this.container.scaleY(0.9);
        } else {
            // Slide down for function body in main
            this.container.opacity(0);
        }
        
        return {
            type: 'function_call',
            target: this.id,
            konvaObject: this.container,
            duration: this.subType === 'function_body_global' ? 800 : (this.subType === 'function_call' ? 600 : 400),
        } as FunctionCallAnimationType;
    }
    
    getUpdateAnimation(payload: any): Animation {
        this.update(payload);
        return null;
    }
}
