import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type IllustrationShellProps = {
  children: ReactNode
  className?: string
  /** When true, hides from assistive tech (default for decorative hero art). */
  decorative?: boolean
  "aria-label"?: string
}

/**
 * Wraps inline SVG illustrations for consistent sizing and a11y.
 */
export function IllustrationShell({
  children,
  className,
  decorative = true,
  "aria-label": ariaLabel = "Illustration",
}: IllustrationShellProps) {
  return (
    <div
      className={cn("w-full h-auto", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : ariaLabel}
    >
      {children}
    </div>
  )
}
