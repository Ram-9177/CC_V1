import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Mobile-optimized input with proper sizing
 * - Min height 44px for iOS touch targets
 * - Full width by default
 * - Better padding on mobile
 */
export function MobileInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full px-4 sm:px-5 py-3 sm:py-4',
        'min-h-[44px] sm:min-h-[42px]',
        'rounded-sm sm:rounded-sm',
        'border border-border/60 hover:border-primary/40 focus:border-primary',
        'bg-background/50 backdrop-blur-sm',
        'text-foreground text-base sm:text-sm',
        'placeholder:text-stone-400 placeholder:font-medium placeholder:text-sm',
        'transition-all duration-300',
        'focus:ring-2 focus:ring-primary/20 focus:outline-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'active:ring-primary/30',
        className
      )}
      {...props}
    />
  )
}

/**
 * Mobile-optimized button with proper touch targets
 */
export function MobileButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  ...props
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const baseStyles = cn(
    'w-full font-semibold transition-all duration-300',
    'rounded-sm sm:rounded-sm',
    'active:scale-95',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
  )

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary/20',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 focus:ring-secondary/20',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive/20',
    ghost: 'bg-transparent hover:bg-primary/10 text-foreground focus:ring-primary/20',
  }

  const sizes = {
    sm: 'px-3 py-2 sm:py-2.5 text-sm min-h-[40px]',
    md: 'px-4 py-3 sm:py-3 text-base min-h-[44px]',
    lg: 'px-5 py-4 sm:py-4 text-lg min-h-[48px]',
  }

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

/**
 * Mobile-optimized select dropdown
 */
export function MobileSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={cn(
        'w-full px-4 sm:px-5 py-3 sm:py-4',
        'min-h-[44px] sm:min-h-[42px]',
        'rounded-sm sm:rounded-sm',
        'border border-border/60 hover:border-primary/40 focus:border-primary',
        'bg-background/50 backdrop-blur-sm',
        'text-foreground text-base sm:text-sm',
        'transition-all duration-300',
        'focus:ring-2 focus:ring-primary/20 focus:outline-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'appearance-none cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

/**
 * Mobile-optimized textarea
 */
export function MobileTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full px-4 sm:px-5 py-3 sm:py-4',
        'rounded-sm sm:rounded-sm',
        'border border-border/60 hover:border-primary/40 focus:border-primary',
        'bg-background/50 backdrop-blur-sm',
        'text-foreground text-base sm:text-sm',
        'placeholder:text-stone-400 placeholder:font-medium placeholder:text-sm',
        'transition-all duration-300',
        'focus:ring-2 focus:ring-primary/20 focus:outline-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'resize-vertical min-h-[120px] sm:min-h-[100px]',
        className
      )}
      {...props}
    />
  )
}

/**
 * Mobile-optimized checkbox
 */
export function MobileCheckbox({
  id,
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input
        id={id}
        type="checkbox"
        className={cn(
          'w-5 h-5 sm:w-4 sm:h-4',
          'rounded border-2 border-border/60',
          'cursor-pointer accent-primary',
          'group-hover:border-primary/40',
          'transition-all duration-300',
          'focus:outline-none focus:ring-2 focus:ring-primary/20',
          className
        )}
        {...props}
      />
      {label && (
        <span className="text-base sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {label}
        </span>
      )}
    </label>
  )
}

/**
 * Mobile-optimized radio button
 */
export function MobileRadio({
  id,
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input
        id={id}
        type="radio"
        className={cn(
          'w-5 h-5 sm:w-4 sm:h-4',
          'rounded-sm border-2 border-border/60',
          'cursor-pointer accent-primary',
          'group-hover:border-primary/40',
          'transition-all duration-300',
          'focus:outline-none focus:ring-2 focus:ring-primary/20',
          className
        )}
        {...props}
      />
      {label && (
        <span className="text-base sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {label}
        </span>
      )}
    </label>
  )
}
