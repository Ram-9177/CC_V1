import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  variant?: 'default' | 'error' | 'success' | 'info'
}

const variantStyles = {
  default: {
    icon: "text-muted-foreground",
    title: "text-foreground",
    description: "text-muted-foreground"
  },
  error: {
    icon: "text-destructive",
    title: "text-destructive",
    description: "text-destructive/70"
  },
  success: {
    icon: "text-success",
    title: "text-success",
    description: "text-success/70"
  },
  info: {
    icon: "text-primary",
    title: "text-primary",
    description: "text-primary/70"
  }
}

const defaultIcons = {
  default: Info,
  error: XCircle,
  success: CheckCircle2,
  info: AlertCircle
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  variant = 'default'
}: EmptyStateProps) {
  const Icon = icon || defaultIcons[variant]
  const styles = variantStyles[variant]

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className={cn(
        "mb-4 p-3 rounded-full bg-muted/50",
        styles.icon
      )}>
        <Icon className="h-8 w-8" />
      </div>
      <h3 className={cn("text-lg font-semibold mb-2", styles.title)}>
        {title}
      </h3>
      {description && (
        <p className={cn("text-sm mb-4 max-w-md", styles.description)}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
