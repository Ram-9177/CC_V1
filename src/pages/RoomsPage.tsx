import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Home, Filter, UserPlus, UserMinus, Search, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
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
import { StudentSearch } from '@/components/common/StudentSearch';

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
  const [createRoomDialogOpen, setCreateRoomDialogOpen] = useState(false);
  const [studentId, setStudentId] = useState('');

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');

  const { data: buildings } = useQuery<any[]>({
    queryKey: ['buildings'],
    queryFn: async () => {
      const response = await api.get('/rooms/buildings/');
      return response.data.results || response.data;
    },
  });

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
    onError: (error: unknown) => {
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
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to deallocate room'));
    },
  });

  const filteredRooms = rooms?.filter((room) =>
    room.room_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (room: Room) => {
    if (room.status === 'available') {
      return <Badge className="bg-primary/20 text-black border border-primary/40 font-bold">Available</Badge>;
    } else if (room.status === 'occupied') {
      return <Badge className="bg-secondary text-black border border-primary/20 font-bold">Occupied</Badge>;
    } else if (room.status === 'maintenance') {
      return <Badge className="bg-black text-white border-0 font-bold">Maintenance</Badge>;
    }
    return <Badge className="bg-muted text-foreground font-bold">{room.status}</Badge>;
  };

  const handleAllocate = (room: Room) => {
    setSelectedRoom(room);
    setAllocateDialogOpen(true);
  };

  const handleDeallocate = (room: Room) => {
    setSelectedRoom(room);
    setDeallocateDialogOpen(true);
  };

  const isWarden = ['admin', 'super_admin', 'warden', 'head_warden'].includes(user?.role || '');

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Home className="h-8 w-8" />
            Room Management
          </h1>
          {isWarden && (
            <Button onClick={() => setCreateRoomDialogOpen(true)} className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Add Room</span>
              </div>
            </Button>
          )}
        </div>
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
      <Card className="border-none lg:border shadow-none lg:shadow-sm bg-transparent lg:bg-card overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <div className="flex-1" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : filteredRooms && filteredRooms.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
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
                                  className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition"
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
                                  className="border-black text-foreground font-bold hover:bg-muted"
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

              {/* Mobile Card List View */}
              <div className="lg:hidden space-y-4">
                {filteredRooms.map((room) => (
                  <Card key={room.id} className="overflow-hidden border shadow-sm rounded-2xl bg-card">
                    <CardHeader className="p-4 bg-muted/20 border-b">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-base leading-tight truncate">
                            Room {room.room_number}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-1">
                            Floor {room.floor} • {room.room_type.toUpperCase()} • {room.current_occupancy}/{room.capacity}
                          </div>
                        </div>
                        {getStatusBadge(room)}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="pt-1">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${Math.min(
                                100,
                                room.capacity ? (room.current_occupancy / room.capacity) * 100 : 0
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="mt-2 flex justify-between items-center text-xs text-foreground">
                          <span className="font-medium text-muted-foreground uppercase tracking-tighter">Occupancy</span>
                          <span className="font-bold text-black bg-primary/20 px-2 py-0.5 rounded-full border border-primary/10">
                            {room.current_occupancy}/{room.capacity}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-muted/50">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
                          Residents
                        </p>
                        {room.residents.length > 0 ? (
                          <div className="space-y-1">
                            {room.residents.slice(0, 3).map((resident) => (
                              <div key={resident.id} className="flex items-center justify-between gap-3 text-xs">
                                <span className="font-semibold truncate">
                                  {resident.name}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                  {(resident.hall_ticket || resident.username || '—').toUpperCase()}
                                </span>
                              </div>
                            ))}
                            {room.residents.length > 3 ? (
                              <div className="text-[10px] text-muted-foreground">
                                +{room.residents.length - 3} more
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">None</p>
                        )}
                      </div>

                      {isWarden ? (
                        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-muted/50">
                          {room.current_occupancy < room.capacity ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-10 rounded-xl"
                              onClick={() => handleAllocate(room)}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Allocate
                            </Button>
                          ) : null}
                          {room.residents.length > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-10 rounded-xl"
                              onClick={() => handleDeallocate(room)}
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Deallocate
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Home}
              title="No rooms found"
              description="Try adjusting your filters or search query"
              variant="default"
            />
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
            <div className="space-y-4 py-4">
              <StudentSearch 
                  onSelect={(id) => setStudentId(id)} 
                  placeholder="Search student to allocate..."
              />
            </div>
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
      
      {/* Create Room Dialog */}
      <Dialog open={createRoomDialogOpen} onOpenChange={setCreateRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Room</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedBuildingId) {
                toast.error('Please select a building');
                return;
              }
              const formData = new FormData(e.currentTarget);
              const roomData = {
                building: selectedBuildingId,
                room_number: formData.get('room_number'),
                floor: formData.get('floor'),
                room_type: formData.get('room_type'),
                capacity: formData.get('capacity'),
                bed_type: formData.get('bed_type'),
              };
              
              try {
                await api.post('/rooms/', roomData);
                queryClient.invalidateQueries({ queryKey: ['rooms'] });
                setCreateRoomDialogOpen(false);
                setSelectedBuildingId('');
                toast.success('Room created successfully');
              } catch (error: unknown) {
                toast.error(getApiErrorMessage(error, 'Failed to create room'));
              }
            }}
            className="space-y-4 py-4"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Building / Block</label>
              <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select building" />
                </SelectTrigger>
                <SelectContent>
                  {buildings?.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Room Number</label>
              <Input name="room_number" placeholder="e.g. 101" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Floor</label>
              <Input name="floor" type="number" placeholder="e.g. 1" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Room Type</label>
              <Select name="room_type" defaultValue="double" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                  <SelectItem value="triple">Triple</SelectItem>
                  <SelectItem value="quad">Quad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bed Type</label>
              <Select name="bed_type" defaultValue="standard" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select bed type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Single (1-Tier)</SelectItem>
                  <SelectItem value="bunk">Bunk Beds (2-Tier)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Capacity</label>
              <Input name="capacity" type="number" placeholder="e.g. 2" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateRoomDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Room</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
