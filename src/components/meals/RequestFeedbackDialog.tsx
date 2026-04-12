import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { getApiErrorMessage, cn } from '@/lib/utils';
import type { Meal } from '@/types';

export function RequestFeedbackDialog({ meal }: { meal: Meal }) {
    const [open, setOpen] = useState(false);
    const [prompt, setPrompt] = useState(meal.feedback_prompt || '');
    const queryClient = useQueryClient();

    const toggleMutation = useMutation({
        mutationFn: async (data: { is_active: boolean; prompt: string }) => {
            await api.post(`/meals/${meal.id}/toggle_feedback/`, data);
        },
        onSuccess: () => {
            toast.success(meal.is_feedback_active ? 'Feedback closed' : 'Feedback requested from all students');
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ['meals'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to toggle feedback'));
        }
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className={cn(
                    "flex-1 w-full sm:w-auto rounded-sm font-bold h-12 px-4 transition-all active:scale-95 flex items-center justify-center",
                    meal.is_feedback_active ? "bg-black text-white hover:bg-black/90 shadow-lg shadow-black/20" : "bg-gray-100 text-foreground hover:bg-gray-200 border-0"
                )}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {meal.is_feedback_active ? 'Stop Requests' : 'Request Feedback'}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-sm text-black">
                <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
                  <DialogHeader>
                      <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-primary" />
                        Request Student Feedback
                      </DialogTitle>
                      <DialogDescription className="font-medium">
                          Students will see a popup on their dashboard to rate this {meal.meal_type}.
                      </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Feedback Prompt / Question</Label>
                        <Input
                            placeholder="e.g. How was the special Sunday biryani today?"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="h-14 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary text-base px-5"
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 px-6 pb-6 border-t flex flex-col gap-3">
                    <Button 
                        onClick={() => toggleMutation.mutate({ is_active: !meal.is_feedback_active, prompt })}
                        disabled={toggleMutation.isPending}
                        className={cn(
                            "w-full h-14 font-black text-lg uppercase tracking-wider rounded-sm transition-all active:scale-95 shadow-sm",
                            meal.is_feedback_active ? "bg-black text-white" : "primary-gradient text-white"
                        )}
                    >
                        {toggleMutation.isPending ? 'Processing...' : meal.is_feedback_active ? 'Stop Feedback Session' : 'Start Feedback Session'}
                    </Button>
                    <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
