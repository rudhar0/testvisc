// frontend/src/animations/Timelines.ts
import gsap from 'gsap';
import {
  VariableCreateAnimation,
  VariableUpdateAnimation,
  ArrayAccessAnimation,
  FunctionCallAnimation,
  FunctionReturnAnimation,
  LoopIterationAnimation,
  MemoryAllocationAnimation,
  ElementDestroyAnimation,
  LineExecutionAnimation,
} from '../types/animation.types';
import Konva from 'konva';

export const createVariableAnimation = (animation: VariableCreateAnimation) => {
  const { konvaObject, duration } = animation;
  console.log('[Timelines] createVariableAnimation - konvaObject:', konvaObject, 'duration:', duration);
  
  if (!konvaObject) {
    console.warn('[Timelines] No konvaObject provided for variable animation');
    return gsap.timeline();
  }
  
  const tl = gsap.timeline();
  
  if (konvaObject instanceof Konva.Group) {
    console.log('[Timelines] Animating Konva.Group:', konvaObject.id());
    
    // Animate using GSAP directly on Konva properties
    tl.fromTo(
      konvaObject,
      { 
        opacity: 0, 
        scaleX: 0.8, 
        scaleY: 0.8 
      },
      { 
        opacity: 1, 
        scaleX: 1, 
        scaleY: 1, 
        duration: duration / 1000,
        ease: 'back.out(1.7)',
        onUpdate: () => {
          // Force Konva to recognize the changes
          konvaObject.getLayer()?.batchDraw();
        }
      }
    );
    
    // Flash the border
    const rect = konvaObject.findOne<Konva.Rect>('.box-bg');
    if (rect) {
      const originalStroke = rect.stroke();
      tl.to(rect, {
        stroke: '#4ade80',
        duration: 0.15,
        onUpdate: () => konvaObject.getLayer()?.batchDraw()
      }, "<0.3")
      .to(rect, {
        stroke: originalStroke,
        duration: 0.15,
        onUpdate: () => konvaObject.getLayer()?.batchDraw()
      });
    }
    
    console.log('[Timelines] Variable animation timeline created');
  } else {
    console.warn('[Timelines] konvaObject is not a Konva.Group:', konvaObject);
  }
  
  return tl;
};

export const createLineExecutionAnimation = (animation: LineExecutionAnimation) => {
  const { konvaObject, duration } = animation;
  console.log('[Timelines] createLineExecutionAnimation - duration:', duration);
  
  const tl = gsap.timeline();
  
  if (konvaObject instanceof Konva.Group) {
    const rect = konvaObject.findOne<Konva.Rect>('.box-bg');
    if (rect) {
      const originalFill = rect.fill();
      tl.to(rect, {
        fill: '#facc15',
        duration: 0.15,
        onUpdate: () => rect.getLayer()?.batchDraw()
      })
      .to(rect, {
        fill: originalFill,
        duration: 0.15,
        onUpdate: () => rect.getLayer()?.batchDraw()
      });
    }
  }
  
  return tl;
};

export const createVariableUpdateAnimation = (animation: VariableUpdateAnimation) => {
  const { konvaObject, valueTextNode, backgroundRect, duration, from, to } = animation;
  console.log('[Timelines] createVariableUpdateAnimation - duration:', duration);
  
  const tl = gsap.timeline();
  
  // 1. Flash the background
  if (backgroundRect) {
    const originalFill = backgroundRect.fill();
    tl.to(backgroundRect, {
      fill: '#facc15',
      duration: 0.15,
      onUpdate: () => backgroundRect.getLayer()?.batchDraw()
    })
    .to(backgroundRect, {
      fill: originalFill,
      duration: 0.15,
      onUpdate: () => backgroundRect.getLayer()?.batchDraw()
    });
  }

  // 2. Fade out old value, change text, fade in new value
  if (valueTextNode instanceof Konva.Text) {
    tl.to(valueTextNode, {
      opacity: 0,
      duration: (duration / 1000) / 2,
      onUpdate: () => valueTextNode.getLayer()?.batchDraw(),
      onComplete: () => {
        valueTextNode.text(String(to));
        valueTextNode.getLayer()?.batchDraw();
      }
    }, "<")
    .to(valueTextNode, {
      opacity: 1,
      duration: (duration / 1000) / 2,
      onUpdate: () => valueTextNode.getLayer()?.batchDraw()
    });
  }

  // 3. Pulse the container slightly
  if (konvaObject) {
    tl.to(konvaObject, {
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 0.1,
      onUpdate: () => konvaObject.getLayer()?.batchDraw()
    }, "<")
    .to(konvaObject, {
      scaleX: 1,
      scaleY: 1,
      duration: 0.1,
      onUpdate: () => konvaObject.getLayer()?.batchDraw()
    });
  }
  
  return tl;
};

export const createFunctionCallAnimation = (animation: FunctionCallAnimation) => {
  const { konvaObject, duration } = animation;
  console.log('[Timelines] createFunctionCallAnimation');
  
  const tl = gsap.timeline();
  
  if (konvaObject) {
    const startY = konvaObject.y();
    
    tl.fromTo(konvaObject, 
      {
        y: startY - 100,
        opacity: 0
      },
      {
        y: startY,
        opacity: 1,
        duration: duration / 1000,
        ease: 'power2.out',
        onUpdate: () => konvaObject.getLayer()?.batchDraw()
      }
    );
  }
  
  return tl;
};

export const createFunctionReturnAnimation = (animation: FunctionReturnAnimation) => {
  const { konvaObject, duration } = animation;
  console.log('[Timelines] createFunctionReturnAnimation');
  
  const tl = gsap.timeline();
  
  if (konvaObject) {
    tl.to(konvaObject, {
      y: konvaObject.y() - 100,
      opacity: 0,
      duration: duration / 1000,
      ease: 'power2.in',
      onUpdate: () => konvaObject.getLayer()?.batchDraw()
    });
  }
  
  return tl;
};

export const createLoopIterationAnimation = (animation: LoopIterationAnimation) => {
  const { konvaObject, iteration, totalIterations } = animation;
  console.log('[Timelines] createLoopIterationAnimation');
  
  const tl = gsap.timeline();

  if (konvaObject instanceof Konva.Rect) {
    // Flash the loop container
    const originalFill = konvaObject.fill();
    tl.to(konvaObject, {
      opacity: 0.5,
      duration: 0.15,
      onUpdate: () => konvaObject.getLayer()?.batchDraw()
    })
    .to(konvaObject, {
      opacity: 1,
      duration: 0.15,
      onUpdate: () => konvaObject.getLayer()?.batchDraw()
    });
  }

  return tl;
};

export const createMemoryAllocationAnimation = (animation: MemoryAllocationAnimation) => {
  const { konvaObject, duration } = animation;
  console.log('[Timelines] createMemoryAllocationAnimation');
  
  const tl = gsap.timeline();
  
  if (konvaObject) {
    tl.fromTo(konvaObject,
      {
        opacity: 0,
        scaleX: 0.5,
        scaleY: 0.5
      },
      {
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        duration: duration / 1000,
        ease: 'back.out(1.7)',
        onUpdate: () => konvaObject.getLayer()?.batchDraw()
      }
    );
  }
  
  return tl;
};

export const createArrayAccessAnimation = (animation: ArrayAccessAnimation) => {
  const { konvaObject, index } = animation;
  console.log('[Timelines] createArrayAccessAnimation - index:', index);
  
  const tl = gsap.timeline();
  
  if (konvaObject instanceof Konva.Rect) {
    const originalFill = konvaObject.fill();
    tl.to(konvaObject, {
      fill: '#60a5fa',
      duration: 0.2,
      onUpdate: () => konvaObject.getLayer()?.batchDraw()
    })
    .to(konvaObject, {
      fill: originalFill,
      duration: 0.2,
      onUpdate: () => konvaObject.getLayer()?.batchDraw()
    });
  }
  
  return tl;
};

export const createElementDestroyAnimation = (animation: ElementDestroyAnimation) => {
  const { konvaObject, duration } = animation;
  console.log('[Timelines] createElementDestroyAnimation');
  
  const tl = gsap.timeline();
  
  if (konvaObject) {
    tl.to(konvaObject, {
      opacity: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: duration / 1000,
      ease: 'power2.in',
      onUpdate: () => konvaObject.getLayer()?.batchDraw(),
      onComplete: () => {
        konvaObject.destroy();
        konvaObject.getLayer()?.batchDraw();
      }
    });
  }
  
  return tl;
};