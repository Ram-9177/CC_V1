import * as React from "react"

import { cn } from "@/lib/utils"
import { Input, type InputProps } from "@/components/ui/input"

export interface TimePickerProps extends InputProps {}

export const TimePicker = React.forwardRef<HTMLInputElement, TimePickerProps>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        type="time"
        className={cn(
          "w-full h-10 rounded-sm border-stone-200 focus:border-primary focus:ring-4 focus:ring-primary/10 bg-white",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

TimePicker.displayName = "TimePicker"
