import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useRealtimeQuery } from '@/hooks/useWebSocket';

interface DisciplinaryAction {
  id: number;
  student: number;
  student_details?: {
    name: string;
    hall_ticket: string;
    username: string;
  };
  student_name: string; // Fallback
  action_type: string;
  severity: 'low' | 'medium' | 'high' | 'severe';
  title: string;
  description: string;
  fine_amount: string;
  is_paid: boolean;
  paid_at?: string;
  created_at: string;
}

export default function FinesPage() {
  const [activeTab, setActiveTab] = useState('pending');
  
  // Listen for real-time updates
  useRealtimeQuery('disciplinary', ['disciplinary']);
  
  const { data: actions, isLoading } = useQuery<DisciplinaryAction[]>({
    queryKey: ['disciplinary'],
    queryFn: async () => {
      const response = await api.get('/disciplinary/');
      return response.data.results || response.data;
    }
  });

  const pendingActions = actions?.filter(a => !a.is_paid && parseFloat(a.fine_amount) > 0) || [];
  const historyActions = actions?.filter(a => a.is_paid || parseFloat(a.fine_amount) === 0) || [];
  
  const totalDue = pendingActions.reduce((sum, a) => sum + parseFloat(a.fine_amount), 0);

  const ActionCard = ({ action }: { action: DisciplinaryAction }) => (
    <Card className="rounded-3xl border-0 shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white">
      <div className={`h-1.5 w-full ${action.severity === 'severe' ? 'bg-black' : action.severity === 'high' ? 'bg-red-500' : 'bg-primary'}`} />
      <CardHeader className="pb-3 space-y-2 relative">
        <div className="flex justify-between items-start">
          <Badge className="rounded-lg bg-gray-100 text-gray-600 font-bold uppercase text-[10px] tracking-wider border-0">{action.action_type}</Badge>
          {!action.is_paid && parseFloat(action.fine_amount) > 0 ? (
             <Badge variant="destructive" className="font-black text-[10px] uppercase h-6 rounded-full px-3">Unpaid</Badge>
          ) : (
             <Badge variant="secondary" className="bg-success/10 text-success border-0 font-black text-[10px] uppercase h-6 rounded-full px-3">Resolved</Badge>
          )}
        </div>
        <CardTitle className="text-xl font-black leading-tight text-foreground truncate" title={action.title}>{action.title}</CardTitle>
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
            <DollarSign className="h-3 w-3" />
            {format(new Date(action.created_at), 'PPP')}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="bg-gray-50/80 p-4 rounded-2xl border border-dashed border-gray-200">
            <p className="text-sm font-medium text-foreground/80 line-clamp-3 min-h-[3rem]" title={action.description}>
                {action.description}
            </p>
        </div>
        {parseFloat(action.fine_amount) > 0 && (
            <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Penalty Amount</span>
                <span className="text-2xl font-black text-foreground">₹{action.fine_amount}</span>
            </div>
        )}
      </CardContent>
      <CardFooter className="pt-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center">
        <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account</span>
            <span className="text-xs font-bold text-foreground">{action.student_details?.name || action.student_name}</span>
        </div>
        {!action.is_paid && parseFloat(action.fine_amount) > 0 && (
            <Button size="sm" className="h-8 rounded-full bg-black text-white text-[10px] font-black uppercase px-4 shadow-md shadow-black/10">Pay at Office</Button>
        )}
      </CardFooter>
    </Card>
  );

  const LoadingSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="rounded-3xl border-0 shadow-sm overflow-hidden">
          <Skeleton className="h-1.5 w-full" />
          <CardHeader className="pb-3">
            <div className="flex justify-between mb-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent px-6>
            <Skeleton className="h-20 w-full rounded-2xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const EmptyStateItem = ({ type }: { type: 'pending' | 'history' }) => (
    <div className="text-center py-20 bg-white rounded-[2rem] border-0 shadow-sm">
        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-4xl mb-6">
            {type === 'pending' ? '✨' : '📜'}
        </div>
        <h3 className="text-2xl font-black mb-2 tracking-tight">
            {type === 'pending' ? 'Clean Record!' : 'No History Found'}
        </h3>
        <p className="text-muted-foreground font-medium max-w-sm mx-auto px-6">
            {type === 'pending' 
            ? "You don't have any outstanding fines or disciplinary actions at this time." 
            : "No past disciplinary records found for your account."}
        </p>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black flex items-center gap-3 text-foreground tracking-tight">
            <div className="p-2.5 bg-black rounded-2xl text-primary shadow-xl shadow-black/20">
                <ShieldAlert className="h-8 w-8" />
            </div>
            Fines & Penalties
          </h1>
          <p className="text-muted-foreground font-medium pl-1">Monitor disciplinary actions and clear outstanding dues.</p>
        </div>
        
        {totalDue > 0 && (
           <Card className="bg-white border-0 shadow-2xl rounded-3xl animate-in zoom-in duration-500 overflow-hidden ring-1 ring-black/5">
                <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-red-500 rounded-2xl text-white shadow-lg shadow-red-200">
                        <DollarSign className="h-6 w-6 font-black" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Due Amount</p>
                        <p className="text-3xl font-black text-foreground">₹{totalDue}</p>
                    </div>
                </CardContent>
           </Card>
        )}
      </div>

      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-1 scrollbar-hide">
            <TabsList className="flex w-max sm:w-full bg-gray-100/50 p-1 rounded-2xl border border-gray-100">
                <TabsTrigger value="pending" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Pending Dues ({pendingActions.length})</TabsTrigger>
                <TabsTrigger value="history" className="rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Record History ({historyActions.length})</TabsTrigger>
            </TabsList>
        </div>
        
        <TabsContent value="pending" className="mt-8">
            {isLoading ? (
                <LoadingSkeleton />
            ) : pendingActions.length === 0 ? (
                <EmptyStateItem type="pending" />
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {pendingActions.map(action => (
                        <ActionCard key={action.id} action={action} />
                    ))}
                </div>
            )}
        </TabsContent>

        <TabsContent value="history" className="mt-8">
            {isLoading ? (
                <LoadingSkeleton />
            ) : historyActions.length === 0 ? (
                <EmptyStateItem type="history" />
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {historyActions.map(action => (
                        <ActionCard key={action.id} action={action} />
                    ))}
                </div>
            )}
        </TabsContent>
        </Tabs>
    </div>
  );
}
