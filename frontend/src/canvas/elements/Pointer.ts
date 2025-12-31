// frontend/src/canvas/elements/Pointer.ts
import { CanvasElement } from "../core/CanvasElement";
import Konva from 'konva';
import { Animation, VariableCreateAnimation, VariableUpdateAnimation } from "../../types/animation.types";
import { COLORS } from '../../config/theme.config';
import { PointerSubtype } from '../../types/element.types';

// Color scheme from specifications
const POINTER_COLORS = {
    background: '#fce4ec',      // Pink background
    border: '#e91e63',          // Pink border
    text: '#c2185b',            // Dark pink text
    arrow: '#e91e63',           // Pink arrow
    nullColor: '#999',          // Gray for NULL
};

export class Pointer extends CanvasElement {
    private textNode: Konva.Text;
    private nameLabel: Konva.Text;
    private valueLabel: Konva.Text;
    private backgroundRect: Konva.Rect;
    private pointerIcon: Konva.Text;
    private subType: PointerSubtype = 'pointer_initial';
    private arrowShape: Konva.Arrow | null = null;

    constructor(id: string, parentId: string, layer: Konva.Layer, payload: any) {
        super(id, parentId, layer);
        this.elementType = 'Pointer';
        this.subType = payload.subtype || 'pointer_initial';
        this.layout = {
            x: 0,
            y: 0,
            width: 200,
            height: 40,
        };

        // Set initial state for non-animated rendering
        this.container.opacity(1);
        this.container.scaleX(1);
        this.container.scaleY(1);

        // Background rectangle
        this.backgroundRect = new Konva.Rect({
            name: 'pointer-bg',
            width: this.layout.width,
            height: this.layout.height,
            fill: POINTER_COLORS.background,
            stroke: POINTER_COLORS.border,
            strokeWidth: 2,
            cornerRadius: 4,
            shadowColor: 'black',
            shadowBlur: 5,
            shadowOpacity: 0.2,
        });

        // Pointer icon (*)
        this.pointerIcon = new Konva.Text({
            name: 'pointer-icon',
            text: '*',
            x: 10,
            y: 13,
            fill: POINTER_COLORS.text,
            fontFamily: "'Courier New', monospace",
            fontSize: 16,
            fontStyle: 'bold',
        });

        // Name label
        const type = payload.type || 'int*';
        const name = payload.name || '';
        this.nameLabel = new Konva.Text({
            name: 'pointer-name',
            text: `${type} ${name}`,
            x: 25,
            y: 13,
            fill: POINTER_COLORS.text,
            fontFamily: "'Courier New', monospace",
            fontSize: 14,
        });

        // Value label (address or NULL)
        const value = payload.value || payload.address || 'NULL';
        const displayValue = value === 'NULL' || value === null ? 'NULL' : value;
        this.valueLabel = new Konva.Text({
            name: 'pointer-value',
            text: displayValue,
            x: this.layout.width - 10,
            y: 13,
            fill: value === 'NULL' || value === null ? POINTER_COLORS.nullColor : POINTER_COLORS.text,
            fontFamily: "'Courier New', monospace",
            fontSize: 12,
            align: 'right',
        });
        
        this.container.add(this.backgroundRect, this.pointerIcon, this.nameLabel, this.valueLabel);
    }
    
    // Non-animating creation: set the final state immediately
    create(payload: any): void {
        console.log('[Pointer] Creating pointer (non-animated) with payload:', payload);
        this.subType = payload.subtype || this.subType;
        const type = payload.type || 'int*';
        const name = payload.name || '';
        const value = payload.value || payload.address || 'NULL';
        const displayValue = value === 'NULL' || value === null ? 'NULL' : value;
        
        this.nameLabel.text(`${type} ${name}`);
        this.valueLabel.text(displayValue);
        this.valueLabel.fill(value === 'NULL' || value === null ? POINTER_COLORS.nullColor : POINTER_COLORS.text);
        
        this.container.opacity(1);
        this.container.scaleX(1);
        this.container.scaleY(1);
    }

    // Non-animating update: set the final state immediately
    update(payload: any): void {
        console.log('[Pointer] Updating pointer (non-animated) with payload:', payload);
        const type = payload.type || 'int*';
        const name = payload.name || '';
        const value = payload.value || payload.address || 'NULL';
        const displayValue = value === 'NULL' || value === null ? 'NULL' : value;
        
        this.nameLabel.text(`${type} ${name}`);
        this.valueLabel.text(displayValue);
        this.valueLabel.fill(value === 'NULL' || value === null ? POINTER_COLORS.nullColor : POINTER_COLORS.text);
        
        this.subType = payload.subtype || this.subType;
    }

    // Create arrow to target element
    createArrow(targetElement: CanvasElement, pointsTo: string): void {
        // Remove existing arrow if any
        if (this.arrowShape) {
            this.arrowShape.destroy();
        }

        // Get positions
        const pointerBox = this.container.getClientRect();
        const targetBox = targetElement.container.getClientRect();
        
        // Calculate arrow path (from right edge of pointer to left edge of target)
        const startX = pointerBox.x + pointerBox.width;
        const startY = pointerBox.y + pointerBox.height / 2;
        const endX = targetBox.x;
        const endY = targetBox.y + targetBox.height / 2;
        
        // Create curved arrow path using bezier curve
        const midX = (startX + endX) / 2;
        const controlPoint1X = startX + (endX - startX) * 0.5;
        const controlPoint1Y = startY;
        const controlPoint2X = startX + (endX - startX) * 0.5;
        const controlPoint2Y = endY;
        
        // For now, use a simple straight arrow
        // In a full implementation, you'd use a Path or Shape for curved arrows
        this.arrowShape = new Konva.Arrow({
            name: 'pointer-arrow',
            points: [startX, startY, endX, endY],
            pointerLength: 12,
            pointerWidth: 12,
            fill: POINTER_COLORS.arrow,
            stroke: POINTER_COLORS.arrow,
            strokeWidth: 3,
            dash: [],
            shadowColor: POINTER_COLORS.arrow,
            shadowBlur: 5,
            shadowOpacity: 0.5,
        });
        
        // Add arrow to layer (not container, as it needs to span across elements)
        this.layer.add(this.arrowShape);
        this.arrowShape.moveToBottom(); // Put arrow behind elements
        
        // Animate arrow drawing
        this.arrowShape.opacity(0);
        const arrowTween = new Konva.Tween({
            node: this.arrowShape,
            opacity: 1,
            duration: 0.6,
            easing: Konva.Easings.EaseInOut,
        });
        arrowTween.play();
        
        // Add pulsing particles effect (simplified)
        const pulseTween = new Konva.Tween({
            node: this.arrowShape,
            strokeWidth: 4,
            duration: 0.4,
            yoyo: true,
            repeat: 1,
        });
        pulseTween.play();
    }

    getCreateAnimation(payload: any): Animation {
        this.container.opacity(0);
        this.container.scaleX(1);
        this.container.scaleY(1);
        this.create(payload);

        const animation: VariableCreateAnimation = {
            type: 'variable_create', 
            target: this.id,
            duration: 300,
            konvaObject: this.container,
        };
        return animation;
    }

    getUpdateAnimation(payload: any): Animation {
        const oldValue = this.valueLabel.text();
        this.update(payload);
        const newValue = this.valueLabel.text();

        // If value changed, flash animation
        if (oldValue !== newValue && this.subType === 'pointer_value_change') {
            const flashTween = new Konva.Tween({
                node: this.backgroundRect,
                stroke: '#ffeb3b',
                duration: 0.3,
                yoyo: true,
                repeat: 1,
                onFinish: () => {
                    this.backgroundRect.stroke(POINTER_COLORS.border);
                }
            });
            flashTween.play();
        }

        const animation: VariableUpdateAnimation = {
            type: 'variable_update',
            target: this.id,
            duration: 600,
            from: oldValue,
            to: newValue,
            konvaContainer: this.container,
            valueTextNode: this.valueLabel,
            backgroundRect: this.backgroundRect,
        };
        return animation;
    }

    destroy(): Promise<void> {
        // Clean up arrow
        if (this.arrowShape) {
            this.arrowShape.destroy();
            this.arrowShape = null;
        }
        return super.destroy();
    }
}
