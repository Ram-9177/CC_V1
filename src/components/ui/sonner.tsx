import { Toaster as Sonner, toast } from "sonner"
import { Button } from "./button"
import { XCircle } from "lucide-react"

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
      
      <style dangerouslySetInnerHTML={{ __html: `
        .dismiss-all-btn {
          display: none;
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 9999;
        }
        body:has([data-sonner-toast]) .dismiss-all-btn {
          display: flex;
        }
        @media (max-width: 640px) {
          body:has([data-sonner-toast]) .dismiss-all-btn {
            bottom: 5.5rem;
          }
        }
      `}} />
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.dismiss()}
        className="dismiss-all-btn gap-2 rounded-full border-2 border-primary/20 bg-background/80 backdrop-blur-md font-black text-[10px] uppercase tracking-tighter shadow-xl hover:bg-primary hover:text-white transition-all active:scale-95 animate-in fade-in slide-in-from-bottom-2"
      >
        <XCircle className="h-3 w-3" />
        Dismiss All
      </Button>
    </div>
  )
}

export { Toaster }
