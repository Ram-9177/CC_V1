/**
 * FadeIn — Smooth micro-interaction wrapper
 *
 * Elements appear with a subtle upward slide + fade.
 * CSS-only — no JS animation libraries needed.
 * Staggered delays make lists/grids feel intentional.
 */

import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

interface FadeInProps {
  children: ReactNode
  /** Delay in ms before the animation starts */
  delay?: number
  /** Duration in ms */
  duration?: number
  className?: string
  /** Start from direction */
  from?: 'bottom' | 'top' | 'left' | 'right' | 'none'
}

const translateMap = {
  bottom: 'translateY(8px)',
  top: 'translateY(-8px)',
  left: 'translateX(-8px)',
  right: 'translateX(8px)',
  none: 'none',
}

export function FadeIn({
  children,
  delay = 0,
  duration = 250,
  className,
  from = 'bottom',
}: FadeInProps) {
  const style: CSSProperties = {
    animationName: 'fadeInUp',
    animationDuration: `${duration}ms`,
    animationDelay: `${delay}ms`,
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
    // CSS custom properties used by the keyframe
    '--fade-in-transform': translateMap[from],
  } as CSSProperties

  return (
    <div className={cn('will-change-[opacity,transform]', className)} style={style}>
      {children}
    </div>
  )
}

/**
 * FadeInStagger — Apply staggered FadeIn to a list of children
 *
 * Usage:
 *   <FadeInStagger stagger={60}>
 *     {items.map(item => <Card key={item.id} />)}
 *   </FadeInStagger>
 */
interface FadeInStaggerProps {
  children: ReactNode[]
  /** Delay between each child (ms) */
  stagger?: number
  /** Base delay before the first child (ms) */
  baseDelay?: number
  className?: string
}

export function FadeInStagger({
  children,
  stagger = 50,
  baseDelay = 0,
  className,
}: FadeInStaggerProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <FadeIn key={index} delay={baseDelay + index * stagger}>
          {child}
        </FadeIn>
      ))}
    </div>
  )
}
