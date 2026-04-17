import { ReactNode, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { animationConfig } from '@/lib/animation-config';

/**
 * PageTransitionWrapper - Smooth fade-in for page transitions
 * Uses location.key to trigger animation on route change
 * Lightweight CSS-only animation without JS overhead
 */

interface PageTransitionWrapperProps {
  children: ReactNode;
  monitorPerformance?: boolean;
}

export function PageTransitionWrapper({ children, monitorPerformance = false }: PageTransitionWrapperProps) {
  const location = useLocation();

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (monitorPerformance && containerRef.current) {
      const startTime = performance.now();
      const observer = new PerformanceObserver(() => {
        const duration = performance.now() - startTime;
        if (duration > 1000) {
          console.warn(`⚠️ Page transition took ${duration.toFixed(0)}ms`);
        }
      });
      
      try {
        observer.observe({ entryTypes: ['paint'] });
      } catch (e) {
        // Performance API might not support this entry type in some browsers
      }
      
      return () => observer.disconnect();
    }
  }, [location.pathname, monitorPerformance]);

  return (
    <div
      ref={containerRef}
      key={location.pathname}
      className="animate-in fade-in duration-300 ease-out"
      style={{
        animation: `fadeInSmooth ${animationConfig.pageTransition.duration}s ${animationConfig.pageTransition.easing} forwards`,
      }}
    >
      <style>{`
        @keyframes fadeInSmooth {
          from {
            opacity: 0;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Optimize for smooth rendering */
        .animate-in {
          will-change: opacity, transform;
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
          transform: translateZ(0);
        }
      `}</style>
      {children}
    </div>
  );
}
