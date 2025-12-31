// frontend/src/canvas/elements/Loop.ts
import { CanvasElement } from "../core/CanvasElement";
import Konva from 'konva';
import { Animation, LoopIterationAnimation, VariableCreateAnimation } from "../../types/animation.types";
import { COLORS } from '../../config/theme.config';
import { LoopSubtype } from '../../types/element.types';

// Color scheme from specifications
const LOOP_COLORS = {
    single: {
        border: '#2196f3',          // Blue
        background: 'rgba(33, 150, 243, 0.05)',
        text: '#1976d2',
    },
    nested_outer: {
        border: '#2196f3',          // Blue
        background: 'rgba(33, 150, 243, 0.05)',
        text: '#1976d2',
    },
    nested_inner: {
        border: '#ff9800',          // Orange
        background: 'rgba(255, 152, 0, 0.05)',
        text: '#f57c00',
    },
    compressed: {
        border: '#9e9e9e',          // Gray
        background: 'rgba(158, 158, 158, 0.1)',
        text: '#757575',
        pattern: 'diagonal_stripes',
    }
};

export class Loop extends CanvasElement {
    private background: Konva.Rect;
    private title: Konva.Text;
    private iterationCounter: Konva.Text | null = null;
    private compressionIndicator: Konva.Group | null = null;
    private subType: LoopSubtype = 'loop_single';
    private nestingLevel: number = 0;

    constructor(id: string, parentId: string, layer: Konva.Layer, payload: any) {
        super(id, parentId, layer);
        this.elementType = 'Loop';
        this.subType = payload.subtype || 'loop_single';
        this.nestingLevel = payload.nestingLevel || 0;
        
        this.layout = {
            x: 0,
            y: 0,
            width: 520, // Slightly smaller than parent
            height: 40, // Will grow
            cursorY: 40,
        };

        const colors = this.getColorsForSubtype(this.subType);
        const borderWidth = this.subType === 'loop_nested' ? 3 : 3;
        
        this.background = new Konva.Rect({
            width: this.layout.width,
            height: this.layout.height,
            fill: colors.background,
            stroke: colors.border,
            strokeWidth: borderWidth,
            cornerRadius: 8,
            id: `${this.id}-background`,
            dash: (this.subType === 'loop_skip' || this.subType === 'loop_compression') ? [5, 5] : [],
        });

        const condition = payload.condition || 'true';
        const loopLabel = this.getLoopLabel(this.subType, condition);
        
        this.title = new Konva.Text({
            text: loopLabel,
            x: 10,
            y: 10,
            fill: colors.text,
            fontFamily: 'Arial',
            fontSize: 12,
            fontStyle: 'bold',
            id: `${this.id}-title`
        });

        this.container.add(this.background, this.title);

        // Add iteration counter for single/nested loops
        if (this.subType === 'loop_single' || this.subType === 'loop_nested') {
            this.iterationCounter = new Konva.Text({
                text: 'Iteration: 0',
                x: this.layout.width - 100,
                y: 10,
                fill: colors.text,
                fontFamily: 'Arial',
                fontSize: 12,
                align: 'right',
            });
            this.container.add(this.iterationCounter);
        }

        // Add compression indicator for skip/compression
        if (this.subType === 'loop_skip' || this.subType === 'loop_compression') {
            this.createCompressionIndicator(payload);
        }

        // Set initial state for non-animated rendering
        this.container.opacity(1);
        this.container.scaleX(1);
        this.container.scaleY(1);
    }

    private getColorsForSubtype(subtype: LoopSubtype, isInner: boolean = false): typeof LOOP_COLORS.single {
        switch (subtype) {
            case 'loop_nested':
                return isInner ? LOOP_COLORS.nested_inner : LOOP_COLORS.nested_outer;
            case 'loop_skip':
            case 'loop_compression':
                return LOOP_COLORS.compressed;
            default:
                return LOOP_COLORS.single;
        }
    }

    private getLoopLabel(subtype: LoopSubtype, condition: string): string {
        switch (subtype) {
            case 'loop_nested':
                return `Nested Loop (${condition})`;
            case 'loop_skip':
            case 'loop_compression':
                return `⚡ Loop Compressed`;
            default:
                return `Loop (${condition})`;
        }
    }

    private createCompressionIndicator(payload: any): void {
        const colors = LOOP_COLORS.compressed;
        const compressedCount = payload.compressedIterations || payload.skipCount || 0;
        
        this.compressionIndicator = new Konva.Group({
            x: 10,
            y: 30,
        });

        const indicatorText = new Konva.Text({
            text: `⚡ ${compressedCount} iterations compressed`,
            fill: colors.text,
            fontFamily: 'Arial',
            fontSize: 14,
            fontStyle: 'bold',
        });

        this.compressionIndicator.add(indicatorText);
        this.container.add(this.compressionIndicator);
    }

    // Non-animating creation: set the final state immediately
    create(payload: any): void {
        console.log('[Loop] Creating loop (non-animated) with payload:', payload);
        this.subType = payload.subtype || this.subType;
        const condition = payload.condition || 'true';
        const loopLabel = this.getLoopLabel(this.subType, condition);
        
        this.title.text(loopLabel);
        this.container.opacity(1);
        this.container.scaleX(1);
        this.container.scaleY(1);
        
        // Update iteration counter if exists
        if (this.iterationCounter && payload.iteration !== undefined) {
            const total = payload.totalIterations || '?';
            this.iterationCounter.text(`Iteration: ${payload.iteration}/${total}`);
        }
    }

    // Non-animating update: set the final state immediately
    update(payload: any): void {
        console.log('[Loop] Updating loop (non-animated) with payload:', payload);
        if (payload.condition) {
            const loopLabel = this.getLoopLabel(this.subType, payload.condition);
            this.title.text(loopLabel);
        }
        
        // Update iteration counter
        if (this.iterationCounter && payload.iteration !== undefined) {
            const total = payload.totalIterations || '?';
            this.iterationCounter.text(`Iteration: ${payload.iteration}/${total}`);
        }
    }

    getCreateAnimation(payload: any): Animation {
        this.container.opacity(0);
        this.container.scaleX(0.8);
        this.container.scaleY(0.8);
        this.create(payload);

        const animation: VariableCreateAnimation = {
            type: 'variable_create', 
            target: this.id,
            duration: 400, // Expand border animation
            konvaObject: this.container,
        };
        return animation;
    }

    getUpdateAnimation(payload: any): Animation {
        this.update(payload);

        // For loop iterations, pulse animation
        if (this.subType === 'loop_single' || this.subType === 'loop_nested') {
            const pulseAnim = new Konva.Tween({
                node: this.background,
                strokeWidth: 4,
                duration: 0.15,
                yoyo: true,
                repeat: 1,
                onFinish: () => {
                    this.background.strokeWidth(3);
                }
            });
            pulseAnim.play();
        }

        const animation: LoopIterationAnimation = {
            type: 'loop_iteration', 
            target: this.id,
            duration: 300,
            konvaObject: this.background,
            iteration: payload.iteration || 0,
            totalIterations: payload.totalIterations || 0,
        };
        return animation;
    }
}
