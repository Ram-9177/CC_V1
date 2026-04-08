/**
 * ActionButton — Double-click-safe button with loading → success lifecycle
 *
 * Lifecycle on click:
 *   idle → loading → success (1.2s) → idle
 *   idle → loading → error (toast) → idle
 *
 * Features:
 * - Blocks re-clicks while action is in-flight
 * - Auto-disables during loading
 * - Shows checkmark on success, briefly
 * - Composes with existing shadcn Button variants
 */

import { useCallback, useRef, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ActionState = 'idle' | 'loading' | 'success'

interface ActionButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Async action to perform on click */
  onClick: () => Promise<unknown>
  /** Soft success message (shown in toast) */
  successMessage?: string
  /** Soft error message (shown in toast) */
  errorMessage?: string
  /** Duration to show success state (ms) */
  successDuration?: number
  /** Label shown during loading (replaces children) */
  loadingLabel?: string
}

export function ActionButton({
  onClick,
  successMessage,
  errorMessage = 'Something went wrong — retrying…',
  successDuration = 1200,
  loadingLabel,
  children,
  className,
  disabled,
  ...props
}: ActionButtonProps) {
  const [state, setState] = useState<ActionState>('idle')
  const lockRef = useRef(false)

  const handleClick = useCallback(async () => {
    if (lockRef.current) return
    lockRef.current = true
    setState('loading')

    try {
      await onClick()
      setState('success')
      if (successMessage) toast.success(successMessage, { duration: 2500 })

      setTimeout(() => {
        setState('idle')
        lockRef.current = false
      }, successDuration)
    } catch {
      setState('idle')
      lockRef.current = false
      toast.error(errorMessage, { duration: 4000 })
    }
  }, [onClick, successMessage, errorMessage, successDuration])

  const isDisabled = disabled || state !== 'idle'

  return (
    <Button
      {...props}
      className={cn(
        'relative transition-all duration-200',
        state === 'success' && 'bg-emerald-600 hover:bg-emerald-600 border-emerald-500 text-white',
        className,
      )}
      disabled={isDisabled}
      onClick={handleClick}
    >
      {state === 'loading' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel ? <span className="ml-1.5">{loadingLabel}</span> : children}
        </>
      )}
      {state === 'success' && (
        <>
          <Check className="h-4 w-4" />
          <span className="ml-1.5">Done</span>
        </>
      )}
      {state === 'idle' && children}
    </Button>
  )
}
