import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MobileCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  href?: string
}

/**
 * Mobile-optimized card component
 * - Better tap targets for mobile (44x44px minimum)
 * - Improved spacing on small screens
 * - Active state feedback (scale-95 on tap)
 */
export function MobileCard({
  children,
  className,
  onClick,
  href,
}: MobileCardProps) {
  const baseStyles = cn(
    'rounded-sm sm:rounded-sm',
    'border border-border/50 hover:border-primary/30',
    'bg-card/50 backdrop-blur-sm',
    'shadow-sm hover:shadow-md',
    'transition-all duration-300',
    'active:scale-95 active:shadow-lg',
    className
  )

  if (href) {
    return (
      <a
        href={href}
        className={cn(baseStyles, 'block p-4 sm:p-5')}
      >
        {children}
      </a>
    )
  }

  return (
    <div
      className={cn(baseStyles, 'p-4 sm:p-5', onClick && 'cursor-pointer')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {children}
    </div>
  )
}

/**
 * Mobile grid layout component
 * - Responsive columns: 1 on mobile, 2 on tablet, 3+ on desktop
 * - Auto-adjusts gap based on screen size
 */
export function MobileGrid({
  children,
  className,
  cols = { mobile: 1, sm: 1, md: 2, lg: 3 },
}: {
  children: ReactNode
  className?: string
  cols?: {
    mobile?: number
    sm?: number
    md?: number
    lg?: number
  }
}) {
  return (
    <div
      className={cn(
        'grid w-full gap-3 sm:gap-4',
        {
          'grid-cols-1': cols.mobile === 1,
          'grid-cols-2': cols.mobile === 2,
          'sm:grid-cols-1': cols.sm === 1,
          'sm:grid-cols-2': cols.sm === 2,
          'md:grid-cols-2': cols.md === 2,
          'md:grid-cols-3': cols.md === 3,
          'lg:grid-cols-3': cols.lg === 3,
          'lg:grid-cols-4': cols.lg === 4,
        },
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Mobile stat card component
 * - Shows metric with label
 * - Optimized for small screens
 */
export function MobileStatCard({
  label,
  value,
  icon: Icon,
  color = 'primary',
}: {
  label: string
  value: string | number
  icon?: React.ComponentType<{ className?: string }>
  color?: string
}) {
  return (
    <MobileCard className={cn(
      'flex items-start gap-3 sm:gap-4',
      `border-${color}/20 hover:border-${color}/40 hover:bg-${color}/5`
    )}>
      {Icon && (
        <div className={cn(
          'mt-1 p-2 sm:p-3 rounded-sm flex-shrink-0',
          `bg-${color}/10`
        )}>
          <Icon className={cn('h-5 w-5 sm:h-6 sm:w-6', `text-${color}`)} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
          {value}
        </p>
      </div>
    </MobileCard>
  )
}
