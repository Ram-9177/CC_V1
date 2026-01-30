import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type ApiErrorObject = Record<string, unknown>

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
    return Object.entries(value)
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
    if (responseData.detail) {
      return formatApiErrorValue(responseData.detail) || fallback
    }
    if (responseData.error) {
      return formatApiErrorValue(responseData.error) || fallback
    }
  }

  const message = formatApiErrorValue(responseData)
  return message || fallback
}
