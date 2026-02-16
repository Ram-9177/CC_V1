
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Star, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import type { Meal } from '@/types';
import { format } from 'date-fns';

export function FeedbackRequestCard() {
  const { data: meals } = useQuery<Meal[]>({
    queryKey: ['meals-today', format(new Date(), 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await api.get('/meals/', {
        params: { date: format(new Date(), 'yyyy-MM-dd') },
      });
      return response.data.results || response.data;
    },
  });

  const activeFeedbackMeals = meals?.filter(m => m.is_feedback_active) || [];

  if (activeFeedbackMeals.length === 0) return null;

  return (
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
                asChild
                className="bg-primary hover:bg-primary/90 text-foreground font-black rounded-xl h-12 px-6 shadow-lg shadow-primary/20"
              >
                <Link to="/meals">
                  <Star className="h-4 w-4 mr-2 fill-current" />
                  GIVE FEEDBACK
                </Link>
              </Button>
            </div>
            <div className="h-1 w-full bg-white/5">
              <div className="h-full bg-primary w-1/3 animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
