import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <div className="relative group/toaster-container">
      <Sonner
        className="toaster group"
        closeButton
        duration={8000}
        position="top-center"
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-card/95 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-primary/12 group-[.toaster]:shadow-xl group-[.toaster]:shadow-primary/10 group-[.toaster]:rounded-xl group-[.toaster]:p-4 group-[.toaster]:font-sans",
            description: "group-[.toast]:text-muted-foreground",
            actionButton:
              "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-black rounded-lg min-h-[44px] px-4",
            cancelButton:
              "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground rounded-lg min-h-[44px]",
            closeButton:
              "group-[.toast]:rounded-lg group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:border-primary/20 hover:group-[.toast]:bg-primary/90 transition-colors shadow-sm min-h-[44px] min-w-[44px]",
          },
        }}
        {...props}
      />
    </div>
  )
}

export { Toaster }
