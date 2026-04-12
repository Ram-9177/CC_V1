import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-w-0 shrink items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 overflow-hidden [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary/25 shadow-sm hover:bg-primary/92",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive/40 shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-card shadow-sm hover:bg-muted/80 hover:text-foreground dark:bg-card",
        secondary:
          "bg-accent text-accent-foreground border border-border shadow-sm hover:bg-secondary",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

import { Loader2 } from "lucide-react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.memo(React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(
            buttonVariants({ variant, size, className }),
            "relative",
            (disabled || loading) && "pointer-events-none opacity-50"
          )}
          ref={ref}
          aria-disabled={disabled || loading}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }), "relative")}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded-inherit">
            <Loader2 className="h-4 w-4 animate-spin text-current opacity-80" />
          </div>
        )}
        <span
          className={cn(
            loading ? "opacity-0" : "opacity-100",
            "inline-flex min-w-0 max-w-full items-center justify-center gap-2"
          )}
        >
          {children}
        </span>
      </button>
    )
  }
))
Button.displayName = "Button"

export { Button, buttonVariants }
