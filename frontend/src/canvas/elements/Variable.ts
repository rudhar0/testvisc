// frontend/src/canvas/elements/Variable.ts
import { CanvasElement } from "../core/CanvasElement";
import Konva from 'konva';
import { Animation, VariableCreateAnimation, VariableUpdateAnimation } from '../../types/animation.types';
import { COLORS } from '../../config/theme.config';
import { VariableSubtype } from '../../types/element.types';

// Color scheme from specifications
const VARIABLE_COLORS = {
    single_initial: {
        background: '#e3f2fd',  // Light blue
        border: '#1976d2',      // Blue
        text: '#333',
        uninitialized: '#999',
    },
    multiple_initial: {
        background: '#e3f2fd',
        border: '#90caf9',      // Lighter blue for grouped
        borderStyle: 'dashed',
        text: '#333',
    },
    value_change: {
        background: '#e3f2fd',
        border: '#4caf50',      // Green for change
        text: '#333',
        highlight: '#ffeb3b',   // Yellow for pulse
    }
};

export class Variable extends CanvasElement {
    private textNode: Konva.Text;
    private nameLabel: Konva.Text;
    private valueLabel: Konva.Text;
    private backgroundRect: Konva.Rect;
    private subType: VariableSubtype = 'variable_single_init';

    constructor(id: string, parentId: string, layer: Konva.Layer, payload: any) {
        super(id, parentId, layer);
        this.elementType = 'Variable';
        this.subType = payload.subtype || 'variable_single_init';
        this.layout = {
            x: 0,
            y: 0,
            width: 200,
            height: 40,
        };

        // Initial state for non-animated rendering
        this.container.opacity(1); 
        this.container.scaleX(1);
        this.container.scaleY(1);

        const colors = this.getColorsForSubtype(this.subType);
        
        // Create background rectangle with appropriate styling
        const borderStyle = this.subType === 'variable_multiple_init' ? [5, 5] : [];
        this.backgroundRect = new Konva.Rect({
            name: 'box-bg',
            width: this.layout.width,
            height: this.layout.height,
            fill: colors.background,
            stroke: colors.border,
            strokeWidth: 2,
            cornerRadius: 4,
            dash: borderStyle,
            shadowColor: 'black',
            shadowBlur: 5,
            shadowOpacity: 0.2,
        });

        // Name label on the left
        this.nameLabel = new Konva.Text({
            name: 'variable-name',
            text: `${payload.type || payload.primitive || 'int'} ${payload.name || ''}`,
            x: 10,
            y: 13,
            fill: colors.text,
            fontFamily: "'Courier New', monospace",
            fontSize: 14,
        });

        // Value label on the right
        const value = payload.value !== undefined ? String(payload.value) : 'uninitialized';
        this.valueLabel = new Konva.Text({
            name: 'variable-value',
            text: value,
            x: this.layout.width - 10,
            y: 13,
            fill: value === 'uninitialized' ? colors.uninitialized : colors.text,
            fontFamily: "'Courier New', monospace",
            fontSize: 14,
            fontStyle: value === 'uninitialized' ? 'italic' : 'normal',
            align: 'right',
        });
        
        this.container.add(this.backgroundRect, this.nameLabel, this.valueLabel);
    }

    private getColorsForSubtype(subtype: VariableSubtype): typeof VARIABLE_COLORS.single_initial {
        switch (subtype) {
            case 'variable_multiple_init':
                return VARIABLE_COLORS.multiple_initial;
            case 'variable_value_change':
                return VARIABLE_COLORS.value_change;
            default:
                return VARIABLE_COLORS.single_initial;
        }
    }
    
    // Non-animating creation: set the final state immediately
    create(payload: any): void {
        console.log('[Variable] Creating variable (non-animated) with payload:', payload);
        this.subType = payload.subtype || this.subType;
        const type = payload.type || payload.primitive || 'int';
        const name = payload.name || '';
        const value = payload.value !== undefined ? String(payload.value) : 'uninitialized';
        
        this.nameLabel.text(`${type} ${name}`);
        this.valueLabel.text(value);
        this.valueLabel.fill(value === 'uninitialized' ? '#999' : '#333');
        this.valueLabel.fontStyle(value === 'uninitialized' ? 'italic' : 'normal');
        
        // Update colors if subtype changed
        const colors = this.getColorsForSubtype(this.subType);
        this.backgroundRect.fill(colors.background);
        this.backgroundRect.stroke(colors.border);
        if (this.subType === 'variable_multiple_init') {
            this.backgroundRect.dash([5, 5]);
        } else {
            this.backgroundRect.dash([]);
        }
        
        this.container.opacity(1);
        this.container.scaleX(1);
        this.container.scaleY(1);
    }

    // Non-animating update: set the final state immediately
    update(payload: any): void {
        console.log('[Variable] Updating variable (non-animated) with payload:', payload);
        const type = payload.type || payload.primitive || 'int';
        const name = payload.name || '';
        const value = payload.value !== undefined ? String(payload.value) : 'uninitialized';
        
        this.nameLabel.text(`${type} ${name}`);
        this.valueLabel.text(value);
        this.valueLabel.fill(value === 'uninitialized' ? '#999' : '#333');
        this.valueLabel.fontStyle(value === 'uninitialized' ? 'italic' : 'normal');
        
        // If value changed, update subtype and colors
        if (payload.subtype === 'variable_value_change') {
            this.subType = 'variable_value_change';
            const colors = this.getColorsForSubtype(this.subType);
            this.backgroundRect.fill(colors.background);
            this.backgroundRect.stroke(colors.border);
        }
    }

    // Returns an animation description for creating the variable
    getCreateAnimation(payload: any): Animation {
        // Initial properties for animated rendering (fade-in)
        this.container.opacity(0);
        this.container.scaleX(1);
        this.container.scaleY(1);

        this.create(payload); // Apply final state for text, etc.
        
        const animation: VariableCreateAnimation = {
            type: 'variable_create',
            target: this.id,
            duration: 300, // ms - fade-in duration
            konvaObject: this.container,
        };
        return animation;
    }

    // Returns an animation description for updating the variable
    getUpdateAnimation(payload: any): Animation {
        const oldValue = this.valueLabel.text();
        const oldSubtype = this.subType;
        
        this.update(payload); // Apply final state for text
        const newValue = this.valueLabel.text();
        
        // If this is a value change, add highlight animation
        if (payload.subtype === 'variable_value_change' || oldSubtype !== 'variable_value_change') {
            const colors = this.getColorsForSubtype('variable_value_change');
            // Pulse animation for value change
            const pulseAnim = new Konva.Tween({
                node: this.backgroundRect,
                stroke: colors.highlight,
                duration: 0.2,
                yoyo: true,
                repeat: 1,
                onFinish: () => {
                    this.backgroundRect.stroke(colors.border);
                }
            });
            pulseAnim.play();
        }

        const animation: VariableUpdateAnimation = {
            type: 'variable_update',
            target: this.id,
            duration: 500, // ms - morph duration
            from: oldValue,
            to: newValue,
            konvaContainer: this.container,
            valueTextNode: this.valueLabel,
            backgroundRect: this.backgroundRect,
        };
        return animation;
    }
}
