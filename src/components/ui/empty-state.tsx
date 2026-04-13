import type { ReactNode } from "react"
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  EmptyStateIllustration,
  ErrorStateIllustration,
  SuccessStateIllustration,
} from "@/components/illustrations"

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  /** When set, shown above the title and replaces the default icon row. */
  illustration?: ReactNode
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
    title: "text-foreground",
    description: "text-foreground/70"
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
  illustration,
  title,
  description,
  action,
  className,
  variant = 'default'
}: EmptyStateProps) {
  const Icon = icon || defaultIcons[variant]
  const styles = variantStyles[variant]
  const resolvedIllustration = illustration ?? (
    variant === "error" ? (
      <ErrorStateIllustration className="w-full" />
    ) : variant === "success" ? (
      <SuccessStateIllustration className="w-full" />
    ) : (
      <EmptyStateIllustration className="w-full" />
    )
  )

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      {resolvedIllustration ? (
        <div
          className={cn(
            "mb-6 w-full max-w-md mx-auto flex justify-center",
            "[&_svg]:shrink-0"
          )}
        >
          {resolvedIllustration}
        </div>
      ) : (
        <div className={cn(
          "mb-4 p-3 rounded-xl border border-border/50 bg-muted/40",
          styles.icon
        )}>
          <Icon className="h-8 w-8" />
        </div>
      )}
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
