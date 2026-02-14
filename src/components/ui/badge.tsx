import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
    secondary: "border-transparent bg-accent text-accent-foreground hover:bg-accent/80",
    destructive: "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline: "text-foreground border border-border/60 from-muted/50 to-muted bg-gradient-to-tr",
    success: "border-transparent bg-green-500 text-white shadow-sm hover:bg-green-600",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
