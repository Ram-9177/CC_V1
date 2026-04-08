import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { getApiErrorMessage, cn } from '@/lib/utils';

export function SpecialRequestForm() {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [requestDate, setRequestDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const COMMON_ITEMS = ['Chapati', 'Hot Water', 'Extra Rice', 'Milk', 'Butter', 'Jam', 'Extra Vegetables', 'Pickle', 'Bread', 'Tea'];

  const mutation = useMutation({
    mutationFn: async (data: { item_name: string; quantity: number; requested_for_date: string; notes?: string }) => {
      await api.post('/meals/special-requests/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] });
      toast.success('Special request submitted successfully!');
      setItemName('');
      setQuantity(1);
      setRequestDate(undefined);
      setNotes('');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to submit request'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !requestDate) {
      toast.error('Please fill required fields');
      return;
    }
    mutation.mutate({
        item_name: itemName,
        quantity,
        requested_for_date: format(requestDate, 'yyyy-MM-dd'),
        notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="item-name" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
          Select Item
        </Label>
        
        {/* Desktop Buttons Filter */}
        <div className="hidden sm:flex gap-2 flex-wrap mb-2">
          {COMMON_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setItemName(item)}
              className={cn(
                'px-4 py-2 rounded-sm text-xs font-bold transition-all border-2 active:scale-90',
                itemName === item
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105'
                  : 'bg-white text-foreground border-gray-100 hover:border-primary/30'
              )}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Mobile Dropdown Select */}
        <div className="sm:hidden mb-2">
          <Select value={itemName} onValueChange={setItemName}>
            <SelectTrigger className="h-12 rounded-sm border-0 bg-gray-50 focus:ring-primary shadow-sm font-bold">
              <SelectValue placeholder="Quick select item..." />
            </SelectTrigger>
            <SelectContent className="rounded-sm border-0 shadow-2xl">
              {COMMON_ITEMS.map((item) => (
                <SelectItem key={item} value={item} className="font-bold rounded-sm my-1">
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          id="item-name"
          placeholder="Or type custom item..."
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="quantity" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
            Quantity
          </Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            max="10"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="request-date" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
            Requested For
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                type="button"
                className={cn(
                  "w-full justify-start text-left font-medium border-0 h-12 rounded-sm bg-gray-50 px-4 transition-all hover:bg-gray-100",
                  !requestDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {requestDate ? format(requestDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-sm" align="start">
              <Calendar
                mode="single"
                selected={requestDate}
                onSelect={setRequestDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
          Additional Notes (Optional)
        </Label>
        <Textarea
          id="notes"
          placeholder="e.g., Hot water for tea, Extra spicy, etc..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-sm border-0 bg-gray-50 focus-visible:ring-primary p-4 min-h-[100px] font-medium"
        />
      </div>

      <Button
        type="submit"
        disabled={mutation.isPending}
        className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all mt-2"
      >
        <Plus className="h-5 w-5 mr-1" />
        {mutation.isPending ? 'Submitting...' : 'Submit Request'}
      </Button>
    </form>
  );
}
