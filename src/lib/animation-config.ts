/**
 * Animation configuration for smooth page transitions
 * Optimized for 60fps on mobile and desktop devices
 */

export const animationConfig = {
  // Page transitions
  pageTransition: {
    duration: 0.3, // 300ms - fast enough to feel responsive
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)', // smooth acceleration curve
  },
  
  // Card entrance animations
  cardIn: {
    duration: 0.35,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  
  // Dialog/Modal transitions
  dialogIn: {
    duration: 0.25,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  
  // Skeleton pulse (loading state)
  skeleton: {
    duration: 2,
    easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
  
  // GPU optimization flags
  gpu: {
    willChange: 'opacity, transform',
    backfaceVisibility: 'hidden',
    transformZ: 'translateZ(0)',
    fontSmoothing: '-webkit-font-smoothing: antialiased',
  }
} as const;

// Helper to apply animation to element
export function applyAnimationConfig(element: HTMLElement, animationKey: keyof typeof animationConfig) {
  const config = animationConfig[animationKey];
  if ('duration' in config && 'easing' in config) {
    element.style.transition = `all ${config.duration}s ${config.easing}`;
    element.style.willChange = animationConfig.gpu.willChange;
    element.style.backfaceVisibility = animationConfig.gpu.backfaceVisibility;
  }
}
