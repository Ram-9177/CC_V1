
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Star, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Meal } from '@/types';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';

export function FeedbackRequestCard() {
  const [popupMeal, setPopupMeal] = useState<Meal | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);

  const { data: bundle } = useQuery<{ next_meal: Meal }>({
    queryKey: ['student-bundle', user?.id],
    enabled: false,
  });

  const nextMeal = bundle?.next_meal;

  const feedbackMutation = useMutation({
    mutationFn: async (data: { meal_id: number; rating: number; comment: string }) => {
      await api.post(`/meals/${data.meal_id}/add_feedback/`, { rating: data.rating, comment: data.comment });
    },
    onSuccess: () => {
      toast.success('Feedback submitted! Thank you 🎉');
      setPopupMeal(null);
      setRating(5);
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['meals-today'] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to submit feedback'));
    },
  });

  const activeFeedbackMeals = nextMeal?.is_feedback_active && !dismissed.has(nextMeal.id) ? [nextMeal] : [];

  // Auto-popup: show feedback dialog for the active meal that hasn't been dismissed
  useEffect(() => {
    if (activeFeedbackMeals.length > 0 && !popupMeal) {
      // Small delay to not block page render 
      const timer = setTimeout(() => {
        setPopupMeal(activeFeedbackMeals[0]);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [activeFeedbackMeals.length, popupMeal]);

  const handleDismiss = (mealId: number) => {
    setDismissed(prev => new Set(prev).add(mealId));
    setPopupMeal(null);
    setRating(5);
    setComment('');
  };

  if (activeFeedbackMeals.length === 0 && !popupMeal) return null;

  return (
    <>
      {/* Inline banner cards */}
      <div className="space-y-3">
        {activeFeedbackMeals.map(meal => (
          <Card key={meal.id} className="bg-black border-primary/30 shadow-xl overflow-hidden group">
            <CardContent className="p-0">
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary rounded-2xl text-foreground group-hover:rotate-12 transition-transform">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-primary text-sm uppercase tracking-widest">Chef requested feedback!</h3>
                    <p className="text-white text-base font-bold line-clamp-1">{meal.feedback_prompt || `How was the ${meal.meal_type} today?`}</p>
                  </div>
                </div>
                <Button 
                  className="bg-primary hover:bg-primary/90 text-foreground font-black rounded-xl h-12 px-6 shadow-lg shadow-primary/20"
                  onClick={() => { setPopupMeal(meal); setRating(5); setComment(''); }}
                >
                  <Star className="h-4 w-4 mr-2 fill-current" />
                  RATE NOW
                </Button>
              </div>
              <div className="h-1 w-full bg-white/5">
                <div className="h-full bg-primary w-1/3 animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feedback Popup Dialog */}
      <Dialog open={!!popupMeal} onOpenChange={(open) => { if (!open && popupMeal) handleDismiss(popupMeal.id); }}>
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl text-black">
          {/* Vibrant header */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/20 rounded-2xl">
                    <Star className="h-6 w-6 text-primary fill-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black tracking-tight">
                      Rate Your Meal
                    </DialogTitle>
                    <DialogDescription className="font-medium text-sm mt-0.5">
                      {popupMeal?.feedback_prompt || `How was the ${popupMeal?.meal_type} today?`}
                    </DialogDescription>
                  </div>
                </div>
              </div>
              {popupMeal && (
                <Badge className="w-fit mt-3 bg-primary/10 text-primary border-primary/20 font-black text-[10px] uppercase tracking-widest">
                  {popupMeal.meal_type} · {popupMeal.menu?.slice(0, 40)}{(popupMeal.menu?.length || 0) > 40 ? '...' : ''}
                </Badge>
              )}
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6">
            {/* Star Rating */}
            <div className="flex flex-col items-center gap-4 bg-gray-50/80 p-6 rounded-2xl border border-gray-100">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Your Rating</Label>
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

            {/* Comment */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Comments (Optional)</Label>
              <Textarea
                placeholder="Describe taste, quality, hygiene, or suggestions..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none h-28 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary p-4"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-2xl font-bold"
              onClick={() => popupMeal && handleDismiss(popupMeal.id)}
            >
              Skip
            </Button>
            <Button
              onClick={() => popupMeal && feedbackMutation.mutate({ meal_id: popupMeal.id, rating, comment })}
              disabled={feedbackMutation.isPending}
              className="flex-1 h-12 rounded-2xl font-black primary-gradient text-white shadow-lg shadow-primary/20"
            >
              {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
