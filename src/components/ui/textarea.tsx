import * as React from "react"
import { cn } from "@/lib/utils"
import { useFieldControlId } from "@/components/ui/field-context"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, id, name, ...props }, ref) => {
    const fieldControlId = useFieldControlId()
    const generatedId = React.useId()
    const controlId = id ?? fieldControlId ?? generatedId
    const controlName = name ?? controlId

    return (
      <textarea
        id={controlId}
        name={controlName}
        className={cn(
          "flex min-h-[92px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-stone-400 placeholder:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary/40 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
