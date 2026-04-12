import { Skeleton } from '@/components/ui/skeleton'

type PageSkeletonVariant = 'dashboard' | 'cards' | 'analytics' | 'table' | 'list' | 'profile' | 'form'

interface PageSkeletonProps {
  variant?: PageSkeletonVariant
  title?: boolean
  className?: string
}

const blockClass = 'bg-muted/35 ring-1 ring-border/30'

function LoadingHeader({ label }: { label: string }) {
  return (
    <div className="rounded-sm border border-border/40 bg-card/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Loading</p>
          <p className="text-sm font-bold text-foreground/90">{label}</p>
          <p className="text-[11px] text-muted-foreground">కాస్త వేచండి... data వస్తోంది</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-primary animate-pulse" />
          <span className="h-2 w-2 rounded-sm bg-primary/70 animate-pulse [animation-delay:120ms]" />
          <span className="h-2 w-2 rounded-sm bg-primary/40 animate-pulse [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingHeader label="Preparing your dashboard data" />
      <div className="space-y-2">
        <Skeleton className={`h-10 w-52 ${blockClass}`} />
        <Skeleton className={`h-4 w-72 max-w-full ${blockClass}`} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className={`h-36 rounded ${blockClass}`} />
        ))}
      </div>
      <Skeleton className={`h-36 rounded ${blockClass}`} />
      <Skeleton className={`h-72 rounded ${blockClass}`} />
    </div>
  )
}

function CardsSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingHeader label="Loading cards and latest records" />
      <div className="space-y-2">
        <Skeleton className={`h-10 w-48 ${blockClass}`} />
        <Skeleton className={`h-4 w-64 max-w-full ${blockClass}`} />
      </div>
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className={`h-[28rem] rounded ${blockClass}`} />
        ))}
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingHeader label="Crunching metrics and charts" />
      <div className="space-y-2">
        <Skeleton className={`h-10 w-56 ${blockClass}`} />
        <Skeleton className={`h-4 w-72 max-w-full ${blockClass}`} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className={`h-28 rounded-sm ${blockClass}`} />
        ))}
      </div>
      <Skeleton className={`h-14 w-full rounded-sm ${blockClass}`} />
      <Skeleton className={`h-[26rem] rounded ${blockClass}`} />
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingHeader label="Fetching table rows" />
      <div className="space-y-2">
        <Skeleton className={`h-10 w-52 ${blockClass}`} />
        <Skeleton className={`h-4 w-60 max-w-full ${blockClass}`} />
      </div>
      <Skeleton className={`h-24 rounded-sm ${blockClass}`} />
      <Skeleton className={`h-[32rem] rounded ${blockClass}`} />
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-sm shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingHeader label="Loading profile details" />
      <div className="flex items-start gap-6">
        <Skeleton className={`h-20 w-20 rounded-full shrink-0 ${blockClass}`} />
        <div className="flex-1 space-y-3">
          <Skeleton className={`h-6 w-48 ${blockClass}`} />
          <Skeleton className={`h-4 w-36 ${blockClass}`} />
          <Skeleton className={`h-4 w-60 ${blockClass}`} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className={`h-12 rounded ${blockClass}`} />
        ))}
      </div>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl">
      <LoadingHeader label="Preparing form" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className={`h-4 w-24 ${blockClass}`} />
            <Skeleton className={`h-10 w-full rounded ${blockClass}`} />
          </div>
        ))}
      </div>
      <Skeleton className={`h-10 w-32 rounded ${blockClass}`} />
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
        <Skeleton key={index} className="h-36 rounded-sm" />
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
      {variant === 'list' && <ListSkeleton />}
      {variant === 'profile' && <ProfileSkeleton />}
      {variant === 'form' && <FormSkeleton />}
    </div>
  )
}

export default PageSkeleton