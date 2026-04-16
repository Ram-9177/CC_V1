export const asyncTaskStatuses = [
  'idle',
  'pending',
  'queued',
  'processing',
  'completed',
  'failed',
] as const

export type AsyncTaskStatus = (typeof asyncTaskStatuses)[number]

export type AsyncTaskTerminalStatus = Extract<AsyncTaskStatus, 'completed' | 'failed'>

export interface AsyncTaskSnapshot<TData = unknown, TError = unknown, TMeta = unknown> {
  status: AsyncTaskStatus
  taskId?: string | number | null
  progress?: number | null
  message?: string | null
  result?: TData
  error?: TError
  meta?: TMeta
  createdAt?: number
  updatedAt?: number
  completedAt?: number
}

export type AsyncTaskStatePayload<TData = unknown, TError = unknown, TMeta = unknown> = Partial<
  Omit<AsyncTaskSnapshot<TData, TError, TMeta>, 'status'>
>

export type AsyncTaskServerState<TData = unknown, TError = unknown, TMeta = unknown> = {
  task_id?: string | number | null
  id?: string | number | null
  status?: string | null
  state?: string | null
  progress?: number | null
  message?: string | null
  result?: TData
  error?: TError
  meta?: TMeta
}

const statusAliases: Record<string, AsyncTaskStatus> = {
  idle: 'idle',
  pending: 'pending',
  queued: 'queued',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  success: 'completed',
  done: 'completed',
  complete: 'completed',
  error: 'failed',
  rejected: 'failed',
  queued_for_processing: 'queued',
  in_progress: 'processing',
  started: 'processing',
  running: 'processing',
  retry: 'processing',
  retried: 'processing',
}

export function isAsyncTaskStatus(value: unknown): value is AsyncTaskStatus {
  return typeof value === 'string' && asyncTaskStatuses.includes(value as AsyncTaskStatus)
}

export function normalizeAsyncTaskStatus(value: unknown, fallback: AsyncTaskStatus = 'idle'): AsyncTaskStatus {
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().toLowerCase()
  if (normalized in statusAliases) return statusAliases[normalized]
  if (isAsyncTaskStatus(normalized)) return normalized

  return fallback
}

export function isTerminalAsyncTaskStatus(status: AsyncTaskStatus) {
  return status === 'completed' || status === 'failed'
}

export function isActiveAsyncTaskStatus(status: AsyncTaskStatus) {
  return status === 'pending' || status === 'queued' || status === 'processing'
}

export function createAsyncTaskSnapshot<TData = unknown, TError = unknown, TMeta = unknown>(
  status: AsyncTaskStatus = 'idle',
  payload: AsyncTaskStatePayload<TData, TError, TMeta> = {},
): AsyncTaskSnapshot<TData, TError, TMeta> {
  const now = Date.now()

  return {
    status,
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? now,
    completedAt: status === 'completed' || status === 'failed' ? payload.completedAt ?? now : payload.completedAt,
    ...payload,
  }
}

export function mergeAsyncTaskSnapshot<TData = unknown, TError = unknown, TMeta = unknown>(
  current: AsyncTaskSnapshot<TData, TError, TMeta>,
  status: AsyncTaskStatus,
  payload: AsyncTaskStatePayload<TData, TError, TMeta> = {},
): AsyncTaskSnapshot<TData, TError, TMeta> {
  const now = Date.now()

  return {
    ...current,
    ...payload,
    status,
    updatedAt: now,
    completedAt: status === 'completed' || status === 'failed' ? payload.completedAt ?? now : undefined,
  }
}

export function snapshotFromServerState<TData = unknown, TError = unknown, TMeta = unknown>(
  state: AsyncTaskServerState<TData, TError, TMeta>,
  fallbackStatus: AsyncTaskStatus = 'pending',
): AsyncTaskSnapshot<TData, TError, TMeta> {
  return createAsyncTaskSnapshot(normalizeAsyncTaskStatus(state.status ?? state.state, fallbackStatus), {
    taskId: state.task_id ?? state.id ?? null,
    progress: state.progress ?? null,
    message: state.message ?? null,
    result: state.result,
    error: state.error,
    meta: state.meta,
  })
}
