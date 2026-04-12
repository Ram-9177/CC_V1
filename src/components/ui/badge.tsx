import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'premium'
}

const Badge = React.memo(({ className, variant = 'default', ...props }: BadgeProps) => {
  const variants = {
    default: "border border-primary/35 bg-primary/20 text-foreground shadow-sm hover:bg-primary/30 transition-all active:scale-95",
    secondary: "border border-accent/45 bg-accent/35 text-foreground hover:bg-accent/45",
    destructive: "border border-destructive/45 bg-destructive/40 text-foreground shadow-sm hover:bg-destructive/55",
    outline: "text-foreground border border-secondary/70 bg-secondary/20 shadow-sm",
    success: "border border-emerald-300 bg-emerald-100 text-emerald-800 shadow-sm hover:bg-emerald-200",
    premium: "border border-secondary/60 bg-secondary/50 text-foreground shadow-sm font-black tracking-widest uppercase",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
})
Badge.displayName = "Badge"

export { Badge }
