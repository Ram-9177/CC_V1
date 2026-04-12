import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { getApiErrorMessage, cn } from '@/lib/utils';

export function MenuUploadDialog({ date: initialDate }: { date: string }) {
    const [open, setOpen] = useState(false);
    const [mealDate, setMealDate] = useState(initialDate);
    const [mealType, setMealType] = useState('breakfast');
    const [menu, setMenu] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [errors, setErrors] = useState<{ mealDate?: string; menu?: string }>({});
    const queryClient = useQueryClient();

    useEffect(() => {
        if (open) {
            setMealDate(initialDate);
            setMealType('breakfast');
            setMenu('');
            setStartTime('');
            setEndTime('');
            setErrors({});
        }
    }, [open, initialDate]);

    const uploadMutation = useMutation({
        mutationFn: async (data: { date: string; meal_type: string; menu: string; start_time?: string; end_time?: string }) => {
            const payload: Record<string, unknown> = {
                meal_date: data.date,
                meal_type: data.meal_type,
                description: data.menu
            };
            if (data.start_time) payload.start_time = data.start_time;
            if (data.end_time) payload.end_time = data.end_time;
            await api.post('/meals/', payload);
        },
        onSuccess: () => {
            toast.success('Menu updated successfully');
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ['meals'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to update menu'));
        }
    });

    const handleSubmit = () => {
        const newErrors: { mealDate?: string; menu?: string } = {};
        if (!mealDate) newErrors.mealDate = 'This field is required.';
        if (!menu.trim()) newErrors.menu = 'This field is required.';
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        uploadMutation.mutate({ 
            date: mealDate, 
            meal_type: mealType, 
            menu, 
            start_time: startTime, 
            end_time: endTime 
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="rounded-sm h-11 primary-gradient text-white font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Menu
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md w-[95vw] p-0 border-none bg-white rounded-sm text-black">
                <div className="p-6 space-y-6">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Upload Menu</DialogTitle>
                        <DialogDescription>Schedule a menu item for your daily plan.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Meal Date</Label>
                            <Input 
                                type="date"
                                value={mealDate}
                                onChange={(e) => {
                                  setMealDate(e.target.value);
                                  if (errors.mealDate) setErrors(prev => ({ ...prev, mealDate: undefined }));
                                }}
                                className={cn("h-12 rounded-sm bg-gray-50 focus-visible:ring-primary", errors.mealDate ? 'border-red-500 border-2' : 'border-0')}
                            />
                            {errors.mealDate && <p className="text-xs font-bold text-red-500 mt-1">{errors.mealDate}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Meal Type</Label>
                            <Select value={mealType} onValueChange={setMealType}>
                                <SelectTrigger className="h-12 rounded-sm border-0 bg-gray-50 focus:ring-primary">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="breakfast">Breakfast</SelectItem>
                                    <SelectItem value="lunch">Lunch</SelectItem>
                                    <SelectItem value="dinner">Dinner</SelectItem>
                                    <SelectItem value="special">Special</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Start Time (Optional)</Label>
                                <Input 
                                    type="time" 
                                    value={startTime} 
                                    onChange={(e) => setStartTime(e.target.value)} 
                                    className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">End Time (Optional)</Label>
                                <Input 
                                    type="time" 
                                    value={endTime} 
                                    onChange={(e) => setEndTime(e.target.value)} 
                                    className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Menu Description</Label>
                            <Textarea 
                                placeholder="e.g. Chicken Biryani, Raita, and Gulab Jamun"
                                value={menu}
                                onChange={(e) => {
                                  setMenu(e.target.value);
                                  if (errors.menu) setErrors(prev => ({ ...prev, menu: undefined }));
                                }}
                                className={cn("h-32 rounded-sm bg-gray-50 focus-visible:ring-primary p-4", errors.menu ? 'border-red-500 border-2' : 'border-0')}
                            />
                            {errors.menu && <p className="text-xs font-bold text-red-500 mt-1">{errors.menu}</p>}
                        </div>
                    </div>

                    <Button 
                        onClick={handleSubmit}
                        disabled={uploadMutation.isPending}
                        className="w-full h-14 primary-gradient text-white font-black rounded-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {uploadMutation.isPending ? 'Uploading...' : 'Save Menu'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
