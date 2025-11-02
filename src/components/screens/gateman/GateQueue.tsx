import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { HallticketChip } from '../../HallticketChip';
import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface QueueEntry {
  id: string;
  hallticket: string;
  name: string;
  reason: string;
  destination: string;
  requestedAt: string;
  priority: 'NORMAL' | 'EMERGENCY';
}

export function GateQueue() {
  const [queue, setQueue] = useState<QueueEntry[]>([
    {
      id: '1',
      hallticket: 'HT012',
      name: 'Rahul Verma',
      reason: 'Medical Emergency',
      destination: 'City Hospital',
      requestedAt: '2025-10-31T10:45:00Z',
      priority: 'EMERGENCY',
    },
    {
      id: '2',
      hallticket: 'HT034',
      name: 'Sneha Patel',
      reason: 'Family Function',
      destination: 'Home',
      requestedAt: '2025-10-31T10:50:00Z',
      priority: 'NORMAL',
    },
    {
      id: '3',
      hallticket: 'HT056',
      name: 'Amit Kumar',
      reason: 'College Library',
      destination: 'Main Campus',
      requestedAt: '2025-10-31T10:55:00Z',
      priority: 'NORMAL',
    },
  ]);

  const handleVerify = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
    toast.success('Student verified and allowed to exit');
  };

  const handleReject = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
    toast.error('Entry/Exit request rejected');
  };

  const getWaitTime = (requestedAt: string) => {
    const diff = Date.now() - new Date(requestedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    return `${minutes} min`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Gate Queue</h1>
        <p className="text-muted-foreground">Students waiting for verification</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">In Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{queue.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Emergency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600 dark:text-red-400">
              {queue.filter(q => q.priority === 'EMERGENCY').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Average Wait</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">2 min</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No students in queue</p>
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`border rounded-lg p-4 ${entry.priority === 'EMERGENCY' ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 px-3 py-1 rounded-lg">
                        <span className="font-bold">#{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <HallticketChip hallticket={entry.hallticket} name={entry.name} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.priority === 'EMERGENCY' && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          EMERGENCY
                        </Badge>
                      )}
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {getWaitTime(entry.requestedAt)}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Reason</p>
                      <p className="font-medium">{entry.reason}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Destination</p>
                      <p className="font-medium">{entry.destination}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleVerify(entry.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Verify & Allow
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReject(entry.id)}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
