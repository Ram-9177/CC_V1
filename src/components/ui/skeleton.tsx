import * as React from "react"
import { cn } from "@/lib/utils"

const Skeleton = React.memo(({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn("animate-shimmer rounded-sm bg-muted/20 relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent transform-gpu", className)}
      {...props}
    />
  )
})
Skeleton.displayName = "Skeleton"

export { Skeleton }
