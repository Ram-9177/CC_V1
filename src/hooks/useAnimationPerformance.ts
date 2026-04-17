/**
 * useAnimationPerformance - Monitor animation frame rates
 * Detects jank and performance issues with page transitions
 */

import { useEffect, useRef } from 'react';

interface AnimationMetrics {
  avgFrameTime: number;
  droppedFrames: number;
  fps: number;
  isJanky: boolean;
}

const FRAME_BUDGET = 16.67; // 60fps = 16.67ms per frame
const JANK_THRESHOLD = 3; // 3+ dropped frames = janky

export function useAnimationPerformance(enabled = true) {
  const metricsRef = useRef<AnimationMetrics>({
    avgFrameTime: 0,
    droppedFrames: 0,
    fps: 60,
    isJanky: false,
  });

  const rafRef = useRef<number>();
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameRef = useRef<number>(performance.now());

  useEffect(() => {
    if (!enabled) return;

    const measureFrame = () => {
      const now = performance.now();
      const frameTime = now - lastFrameRef.current;
      
      frameTimesRef.current.push(frameTime);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Calculate metrics
      const avgTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      const droppedFrames = frameTimesRef.current.filter(t => t > FRAME_BUDGET).length;
      
      metricsRef.current = {
        avgFrameTime: avgTime,
        droppedFrames,
        fps: 1000 / avgTime,
        isJanky: droppedFrames >= JANK_THRESHOLD,
      };

      // Log if janky (debug mode)
      if (droppedFrames >= JANK_THRESHOLD && process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ Animation jank detected: ${droppedFrames} dropped frames, ${avgTime.toFixed(2)}ms avg`);
      }

      lastFrameRef.current = now;
      rafRef.current = requestAnimationFrame(measureFrame);
    };

    rafRef.current = requestAnimationFrame(measureFrame);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [enabled]);

  return metricsRef.current;
}
