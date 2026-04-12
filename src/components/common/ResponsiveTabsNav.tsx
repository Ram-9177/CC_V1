import type { ReactNode } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type ResponsiveTabOption = { value: string; label: string }

type ResponsiveTabsNavProps = {
  value: string
  onValueChange: (value: string) => void
  options: ResponsiveTabOption[]
  /** Screen-reader / mobile label above the dropdown */
  selectLabel?: string
  className?: string
}

/**
 * Mobile / narrow: full-width select (no horizontal tab squeeze).
 * lg+: underline-style tab row (Apple-like segment clarity).
 */
export function ResponsiveTabsNav({
  value,
  onValueChange,
  options,
  selectLabel = 'Report section',
  className,
}: ResponsiveTabsNavProps) {
  return (
    <div className={cn('w-full min-w-0', className)}>
      <div className="lg:hidden">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {selectLabel}
        </p>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger
            aria-label={selectLabel}
            className="h-11 w-full min-w-0 rounded-xl border-border bg-card px-3 text-left text-sm font-semibold shadow-sm"
          >
            <SelectValue placeholder="Choose a report" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-[min(60vh,320px)] w-[var(--radix-select-trigger-width)]">
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="py-3 text-[15px] font-medium">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TabsList className="hidden h-auto w-full flex-nowrap justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 lg:flex">
        {options.map((o) => (
          <TabsTrigger
            key={o.value}
            value={o.value}
            className={cn(
              'min-h-[48px] shrink-0 rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-semibold',
              'data-[state=active]:border-primary data-[state=active]:text-foreground',
              'sm:px-5'
            )}
          >
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  )
}

type ReportSectionHeaderProps = {
  title: string
  /** Toolbar controls (period select, export, etc.) */
  actions?: ReactNode
  className?: string
}

/**
 * Stacked on small screens; aligned row on sm+ so selects/buttons never overlap titles.
 */
export function ReportSectionHeader({ title, actions, className }: ReportSectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-4 border-b border-border/70 px-4 pb-4 pt-5 sm:px-6',
        actions && 'sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className
      )}
    >
      <h3 className="min-w-0 text-lg font-semibold leading-tight tracking-tight text-foreground">{title}</h3>
      {actions ? (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
