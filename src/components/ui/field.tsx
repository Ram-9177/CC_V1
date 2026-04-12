import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { FieldControlIdContext } from "@/components/ui/field-context"

/**
 * Groups a single labeled control. The generated id is shared between `FieldLabel` (htmlFor)
 * and the first `Input` / `Textarea` / `SelectTrigger` inside this subtree (unless they set `id` explicitly).
 * Use one Field per control — do not place multiple primary inputs in the same Field.
 */
export function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const id = React.useId()
  return (
    <FieldControlIdContext.Provider value={id}>
      <div className={cn("space-y-2", className)} {...props} />
    </FieldControlIdContext.Provider>
  )
}

export const FieldLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, htmlFor: _ignored, ...props }, ref) => {
  const controlId = React.useContext(FieldControlIdContext)
  if (!controlId) {
    throw new Error("FieldLabel must be used within Field")
  }
  return <Label ref={ref} className={className} htmlFor={controlId} {...props} />
})
FieldLabel.displayName = "FieldLabel"
