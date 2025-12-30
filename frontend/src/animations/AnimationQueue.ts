// frontend/src/animations/AnimationQueue.ts
/**
 * AnimationQueue - Pause-aware animation queue system with Konva integration
 */

import gsap from 'gsap';
import Konva from 'konva';

export class AnimationQueue {
  private queue: gsap.core.Timeline[] = [];
  private isPlaying: boolean = false;
  private currentAnimation: gsap.core.Timeline | null = null;
  private pausePosition: number = 0;
  private layer: Konva.Layer | null = null;
  private tickerFn: (() => void) | null = null;

  public setLayer(layer: Konva.Layer): void {
    this.layer = layer;
  }

  private startTicker(): void {
    if (!this.tickerFn && this.layer) {
      this.tickerFn = () => {
        this.layer?.batchDraw();
      };
      gsap.ticker.add(this.tickerFn);
      console.log('[AnimationQueue] GSAP ticker started');
    }
  }

  private stopTicker(): void {
    if (this.tickerFn) {
      gsap.ticker.remove(this.tickerFn);
      this.tickerFn = null;
      console.log('[AnimationQueue] GSAP ticker stopped');
    }
  }

  public addSequence(timeline: gsap.core.Timeline): void {
    if (!timeline) {
      console.warn('[AnimationQueue] Attempted to add null timeline');
      return;
    }
    console.log('[AnimationQueue] Adding sequence to queue, queue length:', this.queue.length);
    this.queue.push(timeline);
    this.playNext();
  }

  private playNext = (): void => {
    if (this.isPlaying) {
      console.log('[AnimationQueue] Already playing, skipping playNext');
      return;
    }
    
    if (this.queue.length === 0) {
      console.log('[AnimationQueue] Queue empty, stopping ticker');
      this.stopTicker();
      return;
    }

    this.startTicker();
    this.isPlaying = true;
    const nextSequence = this.queue.shift();

    if (nextSequence) {
      console.log('[AnimationQueue] Playing next sequence...');
      this.currentAnimation = nextSequence;
      
      // If we paused mid-animation, resume from that position
      if (this.pausePosition > 0) {
        nextSequence.progress(this.pausePosition);
        this.pausePosition = 0;
      }

      nextSequence.eventCallback('onComplete', () => {
        console.log('[AnimationQueue] Sequence complete');
        this.isPlaying = false;
        this.currentAnimation = null;
        
        // Force a final draw
        this.layer?.batchDraw();
        
        // Play next in queue
        setTimeout(() => this.playNext(), 10);
      });

      nextSequence.play();
    } else {
      this.isPlaying = false;
      this.stopTicker();
    }
  };
  
  public pause(): void {
    if (this.currentAnimation && this.isPlaying) {
      this.pausePosition = this.currentAnimation.progress();
      this.currentAnimation.pause();
      this.isPlaying = false;
      this.stopTicker();
      console.log('[AnimationQueue] Paused at progress:', this.pausePosition);
    }
  }
  
  public resume(): void {
    if (this.currentAnimation && !this.isPlaying) {
      this.startTicker();
      this.currentAnimation.play();
      this.isPlaying = true;
      console.log('[AnimationQueue] Resumed from progress:', this.pausePosition);
    } else if (this.queue.length > 0 && !this.isPlaying) {
      this.playNext();
    }
  }

  public clear(): void {
    if (this.currentAnimation) {
      this.currentAnimation.kill();
      this.currentAnimation = null;
    }

    this.queue.forEach(timeline => timeline.kill());
    this.queue = [];
    this.isPlaying = false;
    this.pausePosition = 0;
    this.stopTicker();
    console.log('[AnimationQueue] Queue cleared');
  }
  
  public get isAnimating(): boolean {
    return this.isPlaying;
  }

  public get length(): number {
    return this.queue.length;
  }

  public skipCurrent(): void {
    if (this.currentAnimation) {
      this.currentAnimation.progress(1); 
    }
  }

  public getStatus(): { isPlaying: boolean; queueLength: number } {
    return {
      isPlaying: this.isPlaying,
      queueLength: this.queue.length,
    };
  }

  public async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isPlaying && this.queue.length === 0) {
        resolve();
        return;
      }

      const checkComplete = () => {
        if (!this.isPlaying && this.queue.length === 0) {
          resolve();
        } else {
          setTimeout(checkComplete, 50);
        }
      };

      checkComplete();
    });
  }
}