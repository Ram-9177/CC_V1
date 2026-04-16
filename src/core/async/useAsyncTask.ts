import { useCallback, useMemo, useState } from 'react'
import {
  createAsyncTaskSnapshot,
  isActiveAsyncTaskStatus,
  isTerminalAsyncTaskStatus,
  mergeAsyncTaskSnapshot,
  normalizeAsyncTaskStatus,
  snapshotFromServerState,
  type AsyncTaskServerState,
  type AsyncTaskSnapshot,
  type AsyncTaskStatePayload,
  type AsyncTaskStatus,
} from '@/core/async/taskStatus'

type AsyncTaskMapper<TResponse, TData, TError, TMeta> = (
  response: TResponse,
) => Partial<AsyncTaskServerState<TData, TError, TMeta>>

export interface UseAsyncTaskOptions<TVariables = void, TResponse = unknown, TData = unknown, TError = unknown, TMeta = unknown> {
  execute?: (variables: TVariables) => Promise<TResponse>
  mapResponse?: AsyncTaskMapper<TResponse, TData, TError, TMeta>
  initialState?: Partial<AsyncTaskSnapshot<TData, TError, TMeta>>
  onCompleted?: (snapshot: AsyncTaskSnapshot<TData, TError, TMeta>, response: TResponse) => void
  onFailed?: (snapshot: AsyncTaskSnapshot<TData, TError, TMeta>, error: unknown) => void
}

export interface UseAsyncTaskResult<TVariables = void, TResponse = unknown, TData = unknown, TError = unknown, TMeta = unknown> {
  task: AsyncTaskSnapshot<TData, TError, TMeta>
  status: AsyncTaskStatus
  isIdle: boolean
  isPending: boolean
  isQueued: boolean
  isProcessing: boolean
  isCompleted: boolean
  isFailed: boolean
  isActive: boolean
  isTerminal: boolean
  start: (variables: TVariables) => Promise<TResponse>
  reset: () => void
  hydrate: (state: AsyncTaskServerState<TData, TError, TMeta>) => AsyncTaskSnapshot<TData, TError, TMeta>
  setStatus: (status: AsyncTaskStatus, payload?: AsyncTaskStatePayload<TData, TError, TMeta>) => AsyncTaskSnapshot<TData, TError, TMeta>
  setQueued: (payload?: AsyncTaskStatePayload<TData, TError, TMeta>) => AsyncTaskSnapshot<TData, TError, TMeta>
  setProcessing: (payload?: AsyncTaskStatePayload<TData, TError, TMeta>) => AsyncTaskSnapshot<TData, TError, TMeta>
  setCompleted: (payload?: AsyncTaskStatePayload<TData, TError, TMeta>) => AsyncTaskSnapshot<TData, TError, TMeta>
  setFailed: (payload?: AsyncTaskStatePayload<TData, TError, TMeta>) => AsyncTaskSnapshot<TData, TError, TMeta>
}

export function useAsyncTask<TVariables = void, TResponse = unknown, TData = unknown, TError = unknown, TMeta = unknown>(
  options: UseAsyncTaskOptions<TVariables, TResponse, TData, TError, TMeta> = {},
): UseAsyncTaskResult<TVariables, TResponse, TData, TError, TMeta> {
  const initialTask = useMemo(
    () =>
      createAsyncTaskSnapshot<TData, TError, TMeta>(
        normalizeAsyncTaskStatus(options.initialState?.status, 'idle'),
        options.initialState,
      ),
    [options.initialState],
  )

  const [task, setTask] = useState(initialTask)

  const applyStatus = useCallback(
    (status: AsyncTaskStatus, payload: AsyncTaskStatePayload<TData, TError, TMeta> = {}) => {
      let nextTask = task

      setTask((current) => {
        nextTask = mergeAsyncTaskSnapshot(current, status, payload)
        return nextTask
      })

      return nextTask
    },
    [task],
  )

  const reset = useCallback(() => {
    setTask(initialTask)
  }, [initialTask])

  const hydrate = useCallback(
    (state: AsyncTaskServerState<TData, TError, TMeta>) => {
      const nextTask = snapshotFromServerState(state)
      setTask(nextTask)
      return nextTask
    },
    [],
  )

  const start = useCallback(
    async (variables: TVariables) => {
      if (!options.execute) {
        throw new Error('useAsyncTask.start requires an execute function')
      }

      applyStatus('pending', {
        error: undefined,
        message: null,
        progress: null,
      })

      try {
        const response = await options.execute(variables)
        const mapped = options.mapResponse?.(response)

        const nextTask = mapped
          ? hydrate(mapped)
          : applyStatus('completed', {
              result: response as TData,
            })

        if (nextTask.status === 'completed') {
          options.onCompleted?.(nextTask, response)
        }

        return response
      } catch (error) {
        const failedTask = applyStatus('failed', {
          error: error as TError,
        })
        options.onFailed?.(failedTask, error)
        throw error
      }
    },
    [applyStatus, hydrate, options],
  )

  return {
    task,
    status: task.status,
    isIdle: task.status === 'idle',
    isPending: task.status === 'pending',
    isQueued: task.status === 'queued',
    isProcessing: task.status === 'processing',
    isCompleted: task.status === 'completed',
    isFailed: task.status === 'failed',
    isActive: isActiveAsyncTaskStatus(task.status),
    isTerminal: isTerminalAsyncTaskStatus(task.status),
    start,
    reset,
    hydrate,
    setStatus: applyStatus,
    setQueued: useCallback((payload = {}) => applyStatus('queued', payload), [applyStatus]),
    setProcessing: useCallback((payload = {}) => applyStatus('processing', payload), [applyStatus]),
    setCompleted: useCallback((payload = {}) => applyStatus('completed', payload), [applyStatus]),
    setFailed: useCallback((payload = {}) => applyStatus('failed', payload), [applyStatus]),
  }
}
