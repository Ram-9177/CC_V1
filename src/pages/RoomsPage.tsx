import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Home, Filter, UserPlus, UserMinus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { getApiErrorMessage } from '@/lib/utils';

interface Room {
  id: number;
  room_number: string;
  floor: number;
  room_type: string;
  capacity: number;
  current_occupancy: number;
  status: string;
  residents: Array<{ id: number; name: string; hall_ticket?: string; username?: string }>;
}

export default function RoomsPage() {
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [deallocateDialogOpen, setDeallocateDialogOpen] = useState(false);
  const [studentId, setStudentId] = useState('');

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const { data: rooms, isLoading } = useQuery<Room[]>({
    queryKey: ['rooms', floorFilter, typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (floorFilter !== 'all') params.append('floor', floorFilter);
      if (typeFilter !== 'all') params.append('room_type', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await api.get(`/rooms/?${params.toString()}`);
      return response.data.results || response.data;
    },
  });

  // Real-time updates for rooms
  useRealtimeQuery('room_updated', 'rooms');
  useRealtimeQuery('room_allocated', 'rooms');
  useRealtimeQuery('room_deallocated', 'rooms');

  const allocateMutation = useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: number; userId: string }) => {
      await api.post(`/rooms/${roomId}/allocate/`, { user_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room allocated successfully');
      setAllocateDialogOpen(false);
      setStudentId('');
      setSelectedRoom(null);
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to allocate room'));
    },
  });

  const deallocateMutation = useMutation({
    mutationFn: async ({ roomId, userId }: { roomId: number; userId: number }) => {
      await api.post(`/rooms/${roomId}/deallocate/`, { user_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room deallocated successfully');
      setDeallocateDialogOpen(false);
      setSelectedRoom(null);
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to deallocate room'));
    },
  });

  const filteredRooms = rooms?.filter((room) =>
    room.room_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (room: Room) => {
    if (room.status === 'available') {
      return <Badge className="bg-green-100 text-green-800">Available</Badge>;
    } else if (room.status === 'occupied') {
      return <Badge className="bg-blue-100 text-blue-800">Occupied</Badge>;
    } else if (room.status === 'maintenance') {
      return <Badge className="bg-orange-100 text-orange-800">Maintenance</Badge>;
    }
    return <Badge variant="outline">{room.status}</Badge>;
  };

  const handleAllocate = (room: Room) => {
    setSelectedRoom(room);
    setAllocateDialogOpen(true);
  };

  const handleDeallocate = (room: Room) => {
    setSelectedRoom(room);
    setDeallocateDialogOpen(true);
  };

  const isWarden = user?.role === 'staff' || user?.role === 'admin';

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Home className="h-8 w-8" />
          Room Management
        </h1>
        <p className="text-muted-foreground">Manage room allocations and availability</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search room number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Floor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                <SelectItem value="1">Floor 1</SelectItem>
                <SelectItem value="2">Floor 2</SelectItem>
                <SelectItem value="3">Floor 3</SelectItem>
                <SelectItem value="4">Floor 4</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Room Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="double">Double</SelectItem>
                <SelectItem value="triple">Triple</SelectItem>
                <SelectItem value="quad">Quad</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading rooms...</div>
          ) : filteredRooms && filteredRooms.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room Number</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Occupancy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Residents</TableHead>
                    {isWarden && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.room_number}</TableCell>
                      <TableCell>{room.floor}</TableCell>
                      <TableCell className="capitalize">{room.room_type}</TableCell>
                      <TableCell>{room.capacity}</TableCell>
                      <TableCell>
                        {room.current_occupancy}/{room.capacity}
                      </TableCell>
                      <TableCell>{getStatusBadge(room)}</TableCell>
                      <TableCell>
                        {room.residents.length > 0 ? (
                          <div className="space-y-1">
                            {room.residents.map((resident) => (
                              <div key={resident.id} className="text-sm">
                                {resident.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      {isWarden && (
                        <TableCell>
                          <div className="flex gap-2">
                            {room.current_occupancy < room.capacity && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAllocate(room)}
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Allocate
                              </Button>
                            )}
                            {room.residents.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeallocate(room)}
                              >
                                <UserMinus className="h-4 w-4 mr-1" />
                                Deallocate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No rooms found</div>
          )}
        </CardContent>
      </Card>

      {/* Allocate Dialog */}
      <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Room {selectedRoom?.room_number}</DialogTitle>
            <DialogDescription>
              Enter the student ID to allocate this room.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedRoom && studentId) {
                  allocateMutation.mutate({ roomId: selectedRoom.id, userId: studentId });
                }
              }}
              disabled={!studentId || allocateMutation.isPending}
            >
              {allocateMutation.isPending ? 'Allocating...' : 'Allocate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deallocate Dialog */}
      <Dialog open={deallocateDialogOpen} onOpenChange={setDeallocateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deallocate Room {selectedRoom?.room_number}</DialogTitle>
            <DialogDescription>
              Select a resident to deallocate from this room.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={(value) => setStudentId(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select resident" />
              </SelectTrigger>
              <SelectContent>
                {selectedRoom?.residents.map((resident) => (
                  <SelectItem key={resident.id} value={resident.id.toString()}>
                    {resident.name} ({resident.hall_ticket || resident.username || '—'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeallocateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedRoom && studentId) {
                  deallocateMutation.mutate({
                    roomId: selectedRoom.id,
                    userId: parseInt(studentId),
                  });
                }
              }}
              disabled={!studentId || deallocateMutation.isPending}
            >
              {deallocateMutation.isPending ? 'Deallocating...' : 'Deallocate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
