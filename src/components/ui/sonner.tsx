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
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl group-[.toaster]:p-4 group-[.toaster]:font-sans",
            description: "group-[.toast]:text-muted-foreground",
            actionButton:
              "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-black rounded-xl",
            cancelButton:
              "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground rounded-xl",
            closeButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:border-primary/20 hover:group-[.toast]:bg-primary/90 transition-colors scale-110 shadow-sm",
          },
        }}
        {...props}
      />
    </div>
  )
}

export { Toaster }
