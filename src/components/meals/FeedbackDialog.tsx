import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { isWarden, isTopLevelManagement } from '@/lib/rbac';
import type { Meal } from '@/types';

export function FeedbackDialog({ meal }: { meal: Meal }) {
    const user = useAuthStore(state => state.user);
    const [open, setOpen] = useState(false);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const queryClient = useQueryClient();

    const feedbackMutation = useMutation({
        mutationFn: async (data: { rating: number; comment: string }) => {
            await api.post(`/meals/${meal.id}/add_feedback/`, data);
        },
        onSuccess: () => {
            toast.success('Feedback submitted successfully');
            setOpen(false);
            setRating(5);
            setComment('');
            queryClient.invalidateQueries({ queryKey: ['meals'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to submit feedback'));
        }
    });

    // Unified authority check
    const isAuthority = user && (isTopLevelManagement(user.role) || isWarden(user.role) || ['chef', 'head_chef'].includes(user.role) || user.is_student_hr);
    const isRequested = meal.is_feedback_active;

    const buttonLabel = isRequested ? 'Submit Feedback' : 'Feedback Closed';

    return (
        <Dialog open={open} onOpenChange={(val) => (isRequested || isAuthority) && setOpen(val)}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    disabled={!isRequested && !isAuthority}
                    className={cn(
                    "flex-1 w-full sm:w-auto rounded-sm h-12 font-black transition-all shadow-sm flex items-center justify-center",
                    isRequested ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 animate-pulse ring-2 ring-primary/10" : "opacity-50 grayscale"
                )}>
                    <Star className="h-4 w-4 mr-2" />
                    {buttonLabel}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-sm text-black">
                <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
                  <DialogHeader>
                      <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Star className="h-6 w-6 text-primary fill-primary" />
                        {isRequested ? 'Feedback Requested' : 'Rate Meal Quality'}
                      </DialogTitle>
                      <DialogDescription className="font-medium">
                          {meal.feedback_prompt || `Provide feedback for ${meal.meal_type} on ${new Date(meal.date).toLocaleDateString()}.`}
                      </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col items-center gap-4 bg-gray-50/50 p-6 rounded-sm border border-gray-100">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Rating</Label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className={cn(
                                        "p-1 transition-all active:scale-75 focus:outline-none hover:scale-110",
                                        star <= rating ? "text-primary" : "text-gray-200"
                                    )}
                                >
                                    <Star className={cn("h-10 w-10 fill-current", star <= rating ? "fill-primary" : "")} />
                                </button>
                            ))}
                        </div>
                        <p className="text-xs font-bold text-primary/60">
                          {rating === 5 ? 'Excellent! 😍' : rating === 4 ? 'Very Good! 😊' : rating === 3 ? 'Good! 🙂' : rating === 2 ? 'Fair 😐' : 'Poor ☹️'}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Comments (Optional)</Label>
                        <Textarea
                            placeholder="Describe taste, quality, hygiene, or suggestions..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="resize-none h-32 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary p-4"
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 px-6 pb-6 border-t flex flex-col gap-3">
                    <Button 
                        onClick={() => feedbackMutation.mutate({ rating, comment })}
                        disabled={feedbackMutation.isPending}
                        className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                    <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
