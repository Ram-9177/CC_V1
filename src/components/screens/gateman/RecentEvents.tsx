import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { LogIn, LogOut, Search, Download, Filter } from 'lucide-react';

interface GateEvent {
  id: string;
  hallticket: string;
  name: string;
  action: 'ENTRY' | 'EXIT';
  timestamp: string;
  gatePassId?: string;
  verifiedBy: string;
}

export function RecentEvents() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const mockEvents: GateEvent[] = [
    {
      id: '1',
      hallticket: 'HT001',
      name: 'Ravi Kumar',
      action: 'EXIT',
      timestamp: '2025-10-31T10:30:00Z',
      gatePassId: 'GP12345',
      verifiedBy: 'Kumar (Gateman)',
    },
    {
      id: '2',
      hallticket: 'HT045',
      name: 'Anita Sharma',
      action: 'ENTRY',
      timestamp: '2025-10-31T10:25:00Z',
      gatePassId: 'GP12344',
      verifiedBy: 'Kumar (Gateman)',
    },
    {
      id: '3',
      hallticket: 'HT023',
      name: 'Suresh Reddy',
      action: 'EXIT',
      timestamp: '2025-10-31T10:15:00Z',
      gatePassId: 'GP12343',
      verifiedBy: 'Kumar (Gateman)',
    },
    {
      id: '4',
      hallticket: 'HT078',
      name: 'Priya Singh',
      action: 'ENTRY',
      timestamp: '2025-10-31T10:10:00Z',
      gatePassId: 'GP12342',
      verifiedBy: 'Kumar (Gateman)',
    },
    {
      id: '5',
      hallticket: 'HT056',
      name: 'Amit Kumar',
      action: 'EXIT',
      timestamp: '2025-10-31T09:55:00Z',
      gatePassId: 'GP12341',
      verifiedBy: 'Kumar (Gateman)',
    },
    {
      id: '6',
      hallticket: 'HT089',
      name: 'Neha Gupta',
      action: 'ENTRY',
      timestamp: '2025-10-31T09:40:00Z',
      gatePassId: 'GP12340',
      verifiedBy: 'Kumar (Gateman)',
    },
  ];

  const filteredEvents = mockEvents.filter(event => 
    event.hallticket.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const entryEvents = filteredEvents.filter(e => e.action === 'ENTRY');
  const exitEvents = filteredEvents.filter(e => e.action === 'EXIT');

  const stats = {
    totalToday: mockEvents.length,
    entries: entryEvents.length,
    exits: exitEvents.length,
    currentlyOut: exitEvents.length - entryEvents.length,
  };

  const EventList = ({ events }: { events: GateEvent[] }) => (
    <div className="space-y-3">
      {events.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No events found
        </div>
      ) : (
        events.map((event) => (
          <div key={event.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${event.action === 'EXIT' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-green-100 dark:bg-green-900/20'}`}>
                  {event.action === 'EXIT' ? (
                    <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{event.hallticket}</span>
                    <span className="text-muted-foreground">•</span>
                    <span>{event.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Verified by {event.verifiedBy}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={event.action === 'EXIT' ? 'destructive' : 'default'}>
                  {event.action}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            {event.gatePassId && (
              <div className="text-sm text-muted-foreground">
                Pass ID: {event.gatePassId}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Recent Events</h1>
          <p className="text-muted-foreground">Entry/Exit activity log</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600 dark:text-green-400">{stats.entries}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Exits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600 dark:text-red-400">{stats.exits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Currently Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-orange-600 dark:text-orange-400">{stats.currentlyOut}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by hallticket or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                All ({filteredEvents.length})
              </TabsTrigger>
              <TabsTrigger value="entries">
                Entries ({entryEvents.length})
              </TabsTrigger>
              <TabsTrigger value="exits">
                Exits ({exitEvents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <EventList events={filteredEvents} />
            </TabsContent>

            <TabsContent value="entries" className="mt-4">
              <EventList events={entryEvents} />
            </TabsContent>

            <TabsContent value="exits" className="mt-4">
              <EventList events={exitEvents} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
