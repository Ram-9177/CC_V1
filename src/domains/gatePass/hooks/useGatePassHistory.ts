import { useEffect, useState } from 'react'
import type { GatePass } from '@/types'
import type { GatePassListResponse } from '@/domains/gatePass/types'

const MAX_HISTORY_ITEMS = 500

export function useGatePassHistory(queryData: GatePassListResponse | undefined, page: number) {
  const [history, setHistory] = useState<GatePass[]>([])

  useEffect(() => {
    if (!queryData) return

    const currentPageResults = Array.isArray(queryData)
      ? queryData
      : (queryData.results || [])

    if (page === 1) {
      setHistory(currentPageResults.slice(0, MAX_HISTORY_ITEMS))
    } else {
      setHistory((prev) => {
        const newResults = currentPageResults.filter(
          (r: GatePass) => !prev.some((p) => p.id === r.id)
        )
        return [...prev, ...newResults].slice(-MAX_HISTORY_ITEMS)
      })
    }
  }, [queryData, page])

  const hasNextPage = !Array.isArray(queryData) && !!queryData?.next

  return {
    history,
    setHistory,
    hasNextPage,
  }
}
