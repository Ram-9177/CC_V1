import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import { format as dateFnsFormat } from 'date-fns'

export function formatDate(date: string | Date): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Standard date format for API calls (yyyy-MM-dd)
 */
export function formatDateForAPI(date: Date | string | number = new Date()): string {
  return dateFnsFormat(new Date(date), 'yyyy-MM-dd');
}

export function formatDateTime(date: string | Date): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type ApiErrorObject = Record<string, unknown>

const API_ERROR_META_KEYS = new Set(['success', 'code', 'status', 'status_code'])

const isRecord = (value: unknown): value is ApiErrorObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const formatApiErrorValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return ''
  }
  if (Array.isArray(value)) {
    return value.map(formatApiErrorValue).filter(Boolean).join(', ')
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (isRecord(value)) {
    if ('message' in value) {
      const message = formatApiErrorValue(value.message)
      if (message) return message
    }

    return Object.entries(value)
      .filter(([key]) => !API_ERROR_META_KEYS.has(key))
      .map(([key, nested]) => {
        const nestedMessage = formatApiErrorValue(nested)
        return nestedMessage ? `${key.replace(/_/g, ' ')}: ${nestedMessage}` : ''
      })
      .filter(Boolean)
      .join(' | ')
  }
  return ''
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data
  if (!responseData) {
    return fallback
  }

  if (typeof responseData === 'string') {
    return responseData
  }

  if (isRecord(responseData)) {
    if (responseData.message) {
      return formatApiErrorValue(responseData.message) || fallback
    }
    if (responseData.detail) {
      return formatApiErrorValue(responseData.detail) || fallback
    }
    if (responseData.error) {
      return formatApiErrorValue(responseData.error) || fallback
    }
    if (responseData.errors) {
      return formatApiErrorValue(responseData.errors) || fallback
    }
    if (responseData.details) {
      return formatApiErrorValue(responseData.details) || fallback
    }
  }

  const message = formatApiErrorValue(responseData)
  return message || fallback
}
