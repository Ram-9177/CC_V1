import type { SidebarCategory } from '@/types'
import type { RoleStats } from '@/hooks/useRoleStats'

export type SidebarCategoryWithCounts = Array<
  Omit<SidebarCategory, 'items'> & {
    items: Array<SidebarCategory['items'][number] & { count: number }>
  }
>

export type AttachCountsInput = {
  categories: SidebarCategory[]
  role: string | null
  routeStats?: RoleStats
}

export function attachCounts({ categories, role, routeStats }: AttachCountsInput): SidebarCategoryWithCounts {
  return categories.map((category) => ({
    ...category,
    items: category.items.map((item) => {
      let count = 0
      if (item.href === '/gate-passes') count = routeStats?.pending_gate_passes || 0
      if (item.href === '/complaints') count = routeStats?.pending_complaints || 0
      if (item.href === '/leaves') count = routeStats?.pending_leaves || 0
      if (item.href === '/meals' && (role === 'warden' || role === 'head_warden')) count = routeStats?.pending_meal_requests || 0
      if (item.href === '/messages') count = routeStats?.unread_messages || 0

      return { ...item, count }
    }),
  }))
}
