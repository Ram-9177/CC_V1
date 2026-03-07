
import { useWebSocketEvent } from '@/hooks/useWebSocket';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Star, ChefHat, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MealNotificationManager() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);

  // 1. Menu Published (For Students)
  useWebSocketEvent('menu_published', (data: { meal_type: string; menu_date: string }) => {
    if (user?.role === 'student') {
      toast.custom((t) => (
        <div className="bg-[#0F172A] text-white p-5 rounded-[2rem] shadow-2xl border border-white/10 w-full max-w-sm animate-in fade-in duration-500">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/20 rounded-2xl text-primary">
              <ChefHat className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-black uppercase tracking-widest text-primary">Chef Posted a Menu</h4>
              <p className="text-xs font-bold leading-relaxed">{data.meal_type.toUpperCase()} menu is now live for {data.menu_date}.</p>
              <Button 
                variant="link" 
                className="text-primary p-0 h-auto font-black text-[10px] uppercase tracking-tighter"
                onClick={() => {
                  toast.dismiss(t);
                  navigate('/meals');
                }}
              >
                View Menu Now →
              </Button>
            </div>
          </div>
        </div>
      ), { duration: 8000 });
    }
  });

  // 2. Feedback Requested (For Students)
  useWebSocketEvent('feedback_requested', (data: { prompt: string }) => {
    if (user?.role === 'student') {
      toast.custom((t) => (
        <div className="bg-white border-2 border-primary/20 p-5 rounded-[2rem] shadow-2xl w-full max-w-sm animate-bounce-subtle">
           <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Star className="h-6 w-6 fill-primary" />
            </div>
            <div className="flex-1 space-y-1 text-black">
              <h4 className="text-sm font-black uppercase tracking-widest text-primary">Rate Your Meal</h4>
              <p className="text-xs font-bold leading-relaxed">{data.prompt || "Chef wants to know how you liked your meal today!"}</p>
              <Button 
                className="w-full mt-2 h-9 primary-gradient text-white font-black rounded-xl text-[10px] uppercase tracking-widest"
                onClick={() => {
                  toast.dismiss(t);
                  navigate('/meals');
                }}
              >
                Open Feedback Form
              </Button>
            </div>
          </div>
        </div>
      ), { duration: 10000 });
    }
  });

  // 3. Feedback Submitted (For Management)
  useWebSocketEvent('new_meal_feedback', (data: { student: string; rating: number }) => {
    const isManagement = ['chef', 'head_chef', 'warden', 'head_warden'].includes(user?.role || '');
    if (isManagement) {
      toast(`⭐ New Feedback`, {
        description: `${data.student} rated ${data.rating} stars for a meal.`,
        icon: <Bell className="h-4 w-4 text-emerald-500" />,
        action: {
          label: 'View',
          onClick: () => navigate('/meals')
        }
      });
    }
  });

  return null;
}
