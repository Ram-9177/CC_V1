/**
 * useSoftError — User-friendly error messages + auto-retry feedback
 *
 * Converts raw API errors into soft, non-alarming messages.
 * All error text is calm and action-oriented.
 */

import { useCallback } from 'react'
import { toast } from 'sonner'

const softMessages: Record<number, string> = {
  400: 'Please check your input and try again',
  401: 'Session expired — signing you back in…',
  403: "You don't have permission for this action",
  404: 'This item may have been moved or deleted',
  408: 'Request timed out — retrying…',
  409: 'This was already updated — refreshing…',
  422: 'Some fields need attention',
  429: 'Too many requests — please wait a moment',
  500: 'Something went wrong on our end — retrying…',
  502: 'Server is updating — retrying shortly…',
  503: 'Service temporarily unavailable — retrying…',
}

function getSoftMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: number } }).response?.status
    if (status && softMessages[status]) return softMessages[status]
  }

  if (error instanceof Error) {
    if (error.message.includes('Network Error')) return 'Connection lost — retrying when back online…'
    if (error.message.includes('timeout')) return 'Request timed out — retrying…'
  }

  return "Something went wrong \u2014 we're on it"
}

type SoftErrorLevel = 'error' | 'warning' | 'info'

function getLevel(error: unknown): SoftErrorLevel {
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: number } }).response?.status
    if (status === 408 || status === 429 || status === 502 || status === 503) return 'warning'
    if (status === 409) return 'info'
  }
  return 'error'
}

export function useSoftError() {
  const showError = useCallback((error: unknown, overrideMessage?: string) => {
    const message = overrideMessage ?? getSoftMessage(error)
    const level = getLevel(error)

    if (level === 'warning') {
      toast.warning(message, { duration: 3500 })
    } else if (level === 'info') {
      toast.info(message, { duration: 3000 })
    } else {
      toast.error(message, { duration: 4000 })
    }
  }, [])

  return { showError, getSoftMessage }
}

export { getSoftMessage }
