import { Skeleton } from '@/components/ui/skeleton'

type PageSkeletonVariant = 'dashboard' | 'cards' | 'analytics' | 'table'

interface PageSkeletonProps {
  variant?: PageSkeletonVariant
  title?: boolean
  className?: string
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-36 rounded-3xl" />
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  )
}

function CardsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[28rem] rounded-3xl" />
        ))}
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-[26rem] rounded-3xl" />
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-4 w-60 max-w-full" />
      </div>
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-[32rem] rounded-3xl" />
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ cols = 3, rows = 2 }: { cols?: number; rows?: number }) {
  return (
    <div className={`grid gap-4 grid-cols-1 ${
      cols >= 2 ? 'md:grid-cols-2' : ''
    } ${
      cols >= 3 ? 'lg:grid-cols-3' : ''
    }`}>
      {Array.from({ length: cols * rows }).map((_, index) => (
        <Skeleton key={index} className="h-36 rounded-2xl" />
      ))}
    </div>
  )
}

export function PageSkeleton({ variant = 'cards', className = '' }: PageSkeletonProps) {
  return (
    <div className={className}>
      {variant === 'dashboard' && <DashboardSkeleton />}
      {variant === 'cards' && <CardsSkeleton />}
      {variant === 'analytics' && <AnalyticsSkeleton />}
      {variant === 'table' && <TableSkeleton />}
    </div>
  )
}

export default PageSkeleton