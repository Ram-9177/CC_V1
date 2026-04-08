/**
 * useOptimisticMutation — Instant UI updates with silent rollback
 *
 * Wraps useMutation to:
 * 1. Snapshot current query cache
 * 2. Apply an optimistic update immediately (<16ms)
 * 3. On failure, roll back to snapshot + show soft toast
 * 4. On success, invalidate to get server truth
 */

import { useMutation, useQueryClient, type QueryKey, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'

interface OptimisticMutationOptions<TData, TVariables, TContext = unknown> {
  /** The mutation function (API call) */
  mutationFn: (variables: TVariables) => Promise<TData>
  /** Query key(s) to optimistically update */
  queryKey: QueryKey
  /** Transform cache data optimistically before server responds */
  updater: (oldData: TContext, variables: TVariables) => TContext
  /** Query keys to invalidate on success (defaults to queryKey) */
  invalidateKeys?: QueryKey[]
  /** Soft success message (e.g. "Saved", "Updated") */
  successMessage?: string
  /** Soft failure message (e.g. "Couldn't save — rolled back") */
  errorMessage?: string
  /** Extra mutation options */
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn' | 'onMutate' | 'onError' | 'onSettled'>
}

export function useOptimisticMutation<TData, TVariables, TContext = unknown>({
  mutationFn,
  queryKey,
  updater,
  invalidateKeys,
  successMessage,
  errorMessage = 'Something went wrong — reverted',
  options,
}: OptimisticMutationOptions<TData, TVariables, TContext>) {
  const queryClient = useQueryClient()

  return useMutation<TData, Error, TVariables, { snapshot: TContext | undefined }>({
    mutationFn,
    ...options,

    onMutate: async (variables) => {
      // Cancel in-flight refetches so they don't overwrite our optimistic data
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous value
      const snapshot = queryClient.getQueryData<TContext>(queryKey)

      // Optimistically update
      if (snapshot !== undefined) {
        queryClient.setQueryData<TContext>(queryKey, (old) =>
          old !== undefined ? updater(old, variables) : old,
        )
      }

      return { snapshot }
    },

    onError: (_error, _variables, context) => {
      // Roll back to snapshot
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKey, context.snapshot)
      }
      toast.error(errorMessage, { duration: 4000 })
    },

    onSuccess: () => {
      if (successMessage) {
        toast.success(successMessage, { duration: 2500 })
      }
    },

    onSettled: () => {
      // Always re-sync with server truth
      const keys = invalidateKeys ?? [queryKey]
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
    },
  })
}
