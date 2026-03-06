import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'premium'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/95 transition-all active:scale-95",
    secondary: "border-transparent bg-secondary/80 text-secondary-foreground hover:bg-secondary/100 backdrop-blur-sm",
    destructive: "border-transparent bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20 hover:bg-destructive/90",
    outline: "text-foreground border border-border/60 bg-white/50 backdrop-blur-sm shadow-sm",
    success: "border-transparent bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600",
    premium: "border-transparent bg-gradient-to-br from-primary via-blue-500 to-indigo-600 text-white shadow-lx shadow-primary/30 font-black tracking-widest uppercase",
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
