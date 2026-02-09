
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, CheckCircle2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface DisciplinaryAction {
  id: number;
  student_name: string;
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
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  
  const { data: actions, isLoading } = useQuery<DisciplinaryAction[]>({
    queryKey: ['disciplinary'],
    queryFn: async () => {
      const response = await api.get('/disciplinary/');
      return response.data;
    }
  });

  const payFineMutation = useMutation({
    mutationFn: async (id: number) => {
      // Allow user to mark as paid? Or specific endpoint?
      // In real world, this would verify payment gateway.
      // Here we assume admin or student with "Pay" button (simulate).
      // Logic: Update `is_paid=True` via PATCH
      const response = await api.patch(`/disciplinary/${id}/`, { is_paid: true });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disciplinary'] });
      toast.success('Fine marked as paid');
    },
    onError: (error: any) => {
      toast.error('Failed to process payment');
    }
  });

  const pendingActions = actions?.filter(a => !a.is_paid && parseFloat(a.fine_amount) > 0) || [];
  const historyActions = actions?.filter(a => a.is_paid || parseFloat(a.fine_amount) === 0) || [];
  
  const currentList = activeTab === 'pending' ? pendingActions : historyActions;
  const totalDue = pendingActions.reduce((sum, a) => sum + parseFloat(a.fine_amount), 0);

  const isAdmin = ['admin', 'super_admin', 'warden'].includes(user?.role || '');

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            Disciplinary & Fines
          </h1>
          <p className="text-muted-foreground">Track disciplinary actions and penalties</p>
        </div>
        
        {totalDue > 0 && (
           <Card className="bg-destructive/10 border-destructive/20">
               <CardContent className="p-4 flex items-center gap-4">
                   <div className="p-2 bg-destructive/20 rounded-full text-destructive">
                       <DollarSign className="h-6 w-6" />
                   </div>
                   <div>
                       <p className="text-sm font-medium text-destructive">Total Outstanding Fines</p>
                       <p className="text-2xl font-bold text-destructive">₹{totalDue}</p>
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
        
        <TabsContent value={activeTab} className="space-y-4">
            {isLoading ? (
                <div className="text-center py-8">Loading...</div>
            ) : currentList.length === 0 ? (
                <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No records found</h3>
                    <p className="text-muted-foreground">
                        {activeTab === 'pending' 
                        ? "You have no pending fines. Great job!" 
                        : "No disciplinary history found."}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {currentList.map(action => (
                        <Card key={action.id} className="overflow-hidden">
                            <div className={`h-1 w-full ${action.severity === 'severe' ? 'bg-red-600' : action.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline" className="capitalize mb-2">{action.action_type}</Badge>
                                    {!action.is_paid && parseFloat(action.fine_amount) > 0 && (
                                        <Badge variant="destructive">Unpaid</Badge>
                                    )}
                                </div>
                                <CardTitle className="text-lg">{action.title}</CardTitle>
                                <CardDescription>
                                    {format(new Date(action.created_at), 'PPP')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-2">
                                <p className="text-sm text-muted-foreground mb-4">{action.description}</p>
                                {parseFloat(action.fine_amount) > 0 && (
                                    <div className="flex items-center gap-2 font-medium text-lg">
                                        <DollarSign className="h-4 w-4" />
                                        ₹{action.fine_amount}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="pt-2 bg-muted/20 flex justify-between items-center">
                                <div className="text-xs text-muted-foreground">
                                    Student: <span className="font-medium">{action.student_name}</span>
                                </div>
                                {!action.is_paid && parseFloat(action.fine_amount) > 0 && isAdmin && (
                                    <Button size="sm" variant="default" onClick={() => payFineMutation.mutate(action.id)}>
                                        Mark Paid
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </TabsContent>
        </Tabs>
    </div>
  );
}
