import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, CheckCircle2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
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
    <Card className="overflow-hidden h-full flex flex-col">
      <div className={`h-1.5 w-full ${action.severity === 'severe' ? 'bg-black' : action.severity === 'high' ? 'bg-primary' : 'bg-secondary'}`} />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <Badge className="capitalize mb-2 bg-primary/20 text-black border border-primary/30 font-bold">{action.action_type}</Badge>
          {!action.is_paid && parseFloat(action.fine_amount) > 0 ? (
             <Badge variant="destructive" className="font-bold">Unpaid</Badge>
          ) : (
             <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 font-bold">Paid / Resolved</Badge>
          )}
        </div>
        <CardTitle className="text-lg line-clamp-1" title={action.title}>{action.title}</CardTitle>
        <CardDescription>
            {format(new Date(action.created_at), 'PPP')}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2 flex-grow">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3" title={action.description}>{action.description}</p>
        {parseFloat(action.fine_amount) > 0 && (
            <div className="flex items-center gap-2 font-medium text-lg">
                <DollarSign className="h-4 w-4" />
                ₹{action.fine_amount}
            </div>
        )}
      </CardContent>
      <CardFooter className="pt-3 pb-3 bg-muted/20 flex justify-between items-center mt-auto">
        <div className="text-xs text-muted-foreground">
            Student: <span className="font-medium">{action.student_details?.name || action.student_name}</span>
        </div>
        {!action.is_paid && parseFloat(action.fine_amount) > 0 && (
            <Badge variant="outline" className="text-xs bg-background">Pay at Office</Badge>
        )}
      </CardFooter>
    </Card>
  );

  const LoadingSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="h-1.5 w-full" />
          <CardHeader className="pb-2">
            <div className="flex justify-between mb-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-6 w-3/4 mb-1" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-16 w-full mb-4" />
            <Skeleton className="h-6 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const EmptyState = ({ type }: { type: 'pending' | 'history' }) => (
    <div className="text-center py-16 bg-muted/20 rounded-xl border-2 border-dashed">
        <div className="text-6xl mb-4">✨</div>
        <h3 className="text-2xl font-bold mb-2">
            {type === 'pending' ? 'No Pending Fines' : 'No History Found'}
        </h3>
        <p className="text-lg text-muted-foreground mb-2">
            {type === 'pending' 
            ? "You don't have any outstanding fines or disciplinary actions at this time." 
            : "No past disciplinary records found for your account."}
        </p>
        <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
            Maintain a good record by following hostel rules and regulations. If you think this is an error, please contact the warden.
        </p>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
            <ShieldAlert className="h-8 w-8 text-primary" />
            Disciplinary & Fines
          </h1>
          <p className="text-muted-foreground">Track disciplinary actions and penalties</p>
        </div>
        
        {totalDue > 0 && (
           <Card className="bg-black border-0 shadow-lg animate-in fade-in slide-in-from-top-2 duration-500">
               <CardContent className="p-4 flex items-center gap-4">
                   <div className="p-2 bg-primary rounded-full text-foreground">
                       <DollarSign className="h-6 w-6" />
                   </div>
                   <div>
                       <p className="text-sm font-bold text-white/70 uppercase tracking-wider">Outstanding Fines</p>
                       <p className="text-2xl font-black text-primary">₹{totalDue}</p>
                   </div>
               </CardContent>
           </Card>
        )}
      </div>

      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="pending">Pending Fines ({pendingActions.length})</TabsTrigger>
          <TabsTrigger value="history">History ({historyActions.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="space-y-4">
            {isLoading ? (
                <LoadingSkeleton />
            ) : pendingActions.length === 0 ? (
                <EmptyState type="pending" />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pendingActions.map(action => (
                        <ActionCard key={action.id} action={action} />
                    ))}
                </div>
            )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
            {isLoading ? (
                <LoadingSkeleton />
            ) : historyActions.length === 0 ? (
                <EmptyState type="history" />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
