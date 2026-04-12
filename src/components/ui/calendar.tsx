import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  navLayout = "around",
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout={navLayout}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4 relative",
        month_caption: "flex justify-center pt-1 relative items-center px-10",
        caption_label: "text-sm font-semibold text-[#25343F]",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-7 w-7 bg-[#BFC9D1] p-0 opacity-70 hover:opacity-100 hover:bg-[#25343F] absolute left-1 top-1 transition-all border-[#BFC9D1]"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-7 w-7 bg-[#BFC9D1] p-0 opacity-70 hover:opacity-100 hover:bg-[#25343F] absolute right-1 top-1 transition-all border-[#BFC9D1]"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex w-full",
        weekday:
          "text-[#25343F] rounded-sm w-9 font-semibold text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-[#BFC9D1] rounded-sm transition-colors"
        ),
        range_end: "range_end",
        range_start: "range_start",
        range_middle: "range_middle [&>button]:rounded-none [&>button]:bg-[#BFC9D1] [&>button]:text-[#25343F]",
        selected:
          "[&>button]:bg-[#FF9B51] [&>button]:text-white [&>button]:hover:bg-[#25343F] [&>button]:hover:text-white [&>button]:focus:bg-[#25343F] [&>button]:focus:text-white rounded-sm",
        today: "[&>button]:bg-[#BFC9D1] [&>button]:text-[#25343F] rounded-sm",
        outside:
          "text-muted-foreground opacity-50 [&>button]:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }) => {
          // DayPicker passes `disabled` down to `Chevron`. Lucide doesn't need it.
          const { disabled, ...rest } = props as { disabled?: boolean }
          void disabled

          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", className)} {...rest} />
          }
          if (orientation === "up") {
            return <ChevronUp className={cn("h-4 w-4", className)} {...rest} />
          }
          if (orientation === "down") {
            return <ChevronDown className={cn("h-4 w-4", className)} {...rest} />
          }
          return (
            <ChevronRight className={cn("h-4 w-4", className)} {...rest} />
          )
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
