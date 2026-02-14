import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Mobile-first responsive page container
 * Handles safe area insets, proper padding, and vertical scrolling
 */
export function MobilePageContainer({
  children,
  className,
  title,
  subtitle,
}: {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
}) {
  return (
    <div className={cn('w-full', className)}>
      {/* Page header - mobile optimized */}
      {(title || subtitle) && (
        <div className="mb-5 sm:mb-6 md:mb-8">
          {title && (
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="w-full">
        {children}
      </div>
    </div>
  )
}

/**
 * Mobile section divider
 * Adds proper spacing between sections on mobile
 */
export function MobileSection({
  children,
  title,
  subtitle,
  className,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
  className?: string
}) {
  return (
    <section className={cn('mb-6 sm:mb-8', className)}>
      {title && (
        <div className="mb-4 sm:mb-5">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * Mobile action bar
 * Sticky at bottom on mobile, fixed controls
 * Min height 44px for touch targets
 */
export function MobileActionBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 sm:gap-3 md:gap-4',
      'flex-wrap sm:flex-nowrap',
      'p-3 sm:p-4',
      'bg-background/95 backdrop-blur-sm',
      'border-t border-border/50',
      'rounded-t-2xl sm:rounded-lg',
      className
    )}>
      {children}
    </div>
  )
}

/**
 * Mobile form container
 * Optimized spacing and full-width inputs for mobile
 */
export function MobileFormContainer({
  children,
  onSubmit,
  className,
}: {
  children: ReactNode
  onSubmit?: (e: React.FormEvent) => void
  className?: string
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'w-full space-y-4 sm:space-y-5 md:space-y-6',
        className
      )}
    >
      {children}
    </form>
  )
}

/**
 * Mobile form field wrapper
 * Ensures consistent spacing and sizing on mobile
 */
export function MobileFormField({
  label,
  error,
  required,
  children,
}: {
  label?: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm sm:text-base font-semibold text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <div className="w-full">
        {children}
      </div>
      {error && (
        <p className="text-xs sm:text-sm text-destructive font-medium mt-1">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Mobile list item
 * Proper spacing and touch targets for list items
 */
export function MobileListItem({
  children,
  onClick,
  className,
  href,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  href?: string
}) {
  const baseStyles = cn(
    'w-full p-4 sm:p-5',
    'border-b border-border/50 last:border-0',
    'hover:bg-primary/5',
    'transition-all duration-200',
    'active:scale-95',
    onClick && 'cursor-pointer',
    className
  )

  if (href) {
    return (
      <a href={href} className={baseStyles}>
        {children}
      </a>
    )
  }

  return (
    <div
      className={baseStyles}
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
 * Mobile modal/dialog overlay
 * Full screen on mobile, centered on desktop
 */
export function MobileModal({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  actions?: ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:bg-black/25">
      <div className="fixed inset-0 overflow-y-auto lg:flex lg:items-center lg:justify-center">
        <div className="flex h-screen flex-col lg:h-auto lg:rounded-2xl lg:border lg:border-border/50 lg:shadow-2xl w-full lg:max-w-md bg-background">
          {/* Header */}
          {title && (
            <div className="border-b border-border/50 px-4 py-4 sm:px-5 sm:py-5">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                {title}
              </h2>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6">
            {children}
          </div>

          {/* Actions */}
          {actions && (
            <div className="border-t border-border/50 px-4 py-4 sm:px-5 sm:py-5 flex gap-3">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
