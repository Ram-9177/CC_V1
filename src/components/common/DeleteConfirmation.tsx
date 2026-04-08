import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemName?: string;
  isLoading?: boolean;
  variant?: 'destructive' | 'warning';
}

export function DeleteConfirmation({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  description = "This action cannot be undone. Are you sure you want to proceed?",
  itemName,
  isLoading = false,
  variant = 'destructive'
}: DeleteConfirmationProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <div className={cn(
          "h-2 w-full",
          variant === 'destructive' ? "bg-red-500" : "bg-amber-500"
        )} />
        
        <div className="p-8">
          <DialogHeader className="items-center text-center space-y-4">
            <div className={cn(
              "p-4 rounded-2xl",
              variant === 'destructive' ? "bg-red-50" : "bg-amber-50"
            )}>
              {variant === 'destructive' ? (
                <Trash2 className="h-8 w-8 text-red-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              )}
            </div>
            
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">
                {title}
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-medium text-base">
                {description}
                {itemName && (
                  <span className="block mt-2 font-bold text-slate-700 italic">
                    "{itemName}"
                  </span>
                )}
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="mt-8 sm:flex-col gap-3 sm:space-x-0">
            <Button
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "w-full h-12 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-[0.98]",
                variant === 'warning' && "bg-amber-500 hover:bg-amber-600 text-white border-none"
              )}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                "Yes, Delete Record"
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="w-full h-12 rounded-2xl font-bold text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-all border-2"
            >
              Cancel
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
