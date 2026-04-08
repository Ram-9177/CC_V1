/**
 * Main Hooks Export Index
 * Centralized access point for all application hooks
 */

// Core Hooks
export { useAuthStore } from '@/lib/store'
export { useWebSocketEvent, useRealtimeQuery, useNotification } from './useWebSocket'
export { useOfflineProtection } from './useOfflineProtection'
export { useDebounce, useLocalStorage, useCopyToClipboard, useToggle } from './useCommon'

// Performance & Perception Hooks
export { useOptimisticMutation } from './useOptimisticMutation'
export { useSoftError, getSoftMessage } from './useSoftError'
