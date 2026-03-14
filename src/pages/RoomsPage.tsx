import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Home, Filter, UserPlus, UserMinus, Search, Plus, Bed, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/common/PageSkeleton';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { getApiErrorMessage } from '@/lib/utils';
import { isManagement } from '@/lib/rbac';
import { StudentSearch } from '@/components/common/StudentSearch';
import { SEO } from '@/components/common/SEO';
import type { Building } from '@/types';

interface Room {
  id: number;
  room_number: string;
  floor: number;
  room_type: string;
  bed_type: string;
  capacity: number;
  current_occupancy: number;
  status: string;
  residents: Array<{ id: number; name: string; hall_ticket?: string; username?: string }>;
  beds?: Array<{ id: number; bed_number: string; is_occupied: boolean }>;
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

  const { data: buildings } = useQuery<Building[]>({
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
      try {
        await api.post(`/rooms/${roomId}/allocate/`, { user_id: userId });
      } catch (err: unknown) {
        // Auto-retry once on 409 Conflict (transient lock contention)
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr?.response?.status === 409) {
          toast.info('Room is busy, retrying…');
          await new Promise(r => setTimeout(r, 500));
          await api.post(`/rooms/${roomId}/allocate/`, { user_id: userId });
          return; // retry succeeded
        }
        throw err;
      }
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

  const [editRoomDialogOpen, setEditRoomDialogOpen] = useState(false);
  const [bedsDialogOpen, setBedsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: number) => {
      await api.delete(`/rooms/${roomId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room deleted successfully');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete room'));
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: async ({ roomId, data }: { roomId: number; data: Partial<Room> }) => {
      await api.patch(`/rooms/${roomId}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room updated successfully');
      setEditRoomDialogOpen(false);
      setEditingRoom(null);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to update room'));
    },
  });

  const autoAllocateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/rooms/auto_allocate/');
      return response.data;
    },
    onSuccess: (data: { detail?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success(data?.detail || 'Auto-allocation complete');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to auto-allocate rooms'));
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
    } else if (room.status === 'offline') {
      return <Badge className="bg-red-500 text-white border-0 font-bold animate-pulse">OFFLINE</Badge>;
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

  const isWarden = isManagement(user?.role);
  const canAllocate = user?.role && !['admin', 'super_admin'].includes(user.role);

  return (
    <div className="w-full max-w-full px-4 py-6 space-y-6 overflow-x-hidden">
      <SEO 
        title="Room Management" 
        description="Oversee hostel room allocations, floor statuses, and bed availability. Detailed inventory management for SMG CampusCore blocks."
      />
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2 tracking-tight">
            <div className="p-2 bg-blue-100 rounded-2xl text-blue-600 shrink-0">
                <Home className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            Room Management
          </h1>
          {isWarden && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => autoAllocateMutation.mutate()} disabled={autoAllocateMutation.isPending} variant="outline" className="rounded-full font-bold border-2 hover:bg-muted transition-all active:scale-95 text-xs sm:text-sm flex-1 sm:flex-initial">
                {autoAllocateMutation.isPending ? 'Allocating...' : 'Auto Allocate'}
              </Button>
              <Button onClick={() => setCreateRoomDialogOpen(true)} className="rounded-full shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90 text-white font-bold hover:shadow-md transition-all active:scale-95 text-xs sm:text-sm flex-1 sm:flex-initial">
                <Plus className="h-4 w-4 mr-1" />
                Add Room
              </Button>
            </div>
          )}
        </div>
        <p className="text-muted-foreground font-medium pl-1 text-sm">Manage room allocations and availability</p>
      </div>

      {/* Filters */}
      <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-2 border-b border-gray-100 bg-gray-50/50">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider font-black text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search room number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white transition-all"
              />
            </div>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="rounded-xl border-gray-200 bg-white/80 backdrop-blur-sm border-2 transition-all hover:border-primary/50">
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
              <SelectTrigger className="rounded-xl border-gray-200 bg-white/80 backdrop-blur-sm border-2 transition-all hover:border-primary/50">
                <SelectValue placeholder="Room Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="double">Double</SelectItem>
                <SelectItem value="triple">Triple</SelectItem>
                <SelectItem value="quad">Quad</SelectItem>
                <SelectItem value="dormitory">Dormitory</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl border-gray-200 bg-white/80 backdrop-blur-sm border-2 transition-all hover:border-primary/50">
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
      <Card className="border-0 shadow-none bg-transparent lg:bg-white lg:rounded-3xl lg:shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <ListSkeleton rows={8} />
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
                      <TableRow key={room.id} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="font-black text-primary">{room.room_number}</TableCell>
                        <TableCell className="font-bold">Floor {room.floor}</TableCell>
                        <TableCell className="capitalize font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm">{room.room_type}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{room.bed_type} Bed</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">{room.capacity}</TableCell>
                        <TableCell className="font-bold">
                          <span className={cn(
                            "px-2 py-1 rounded-lg",
                            room.current_occupancy >= room.capacity ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {room.current_occupancy}/{room.capacity}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(room)}</TableCell>
                        <TableCell>
                          {room.residents.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {room.residents.map((resident) => (
                                <Badge key={resident.id} variant="secondary" className="text-[10px] py-0 font-bold bg-gray-100 border-0">
                                  {resident.name.split(' ')[0]}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Empty</span>
                          )}
                        </TableCell>
                        {isWarden && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                                onClick={() => {
                                  setEditingRoom(room);
                                  setEditRoomDialogOpen(true);
                                }}
                                title="Edit Room"
                              >
                                <Plus className="h-4 w-4 rotate-45" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
                                onClick={() => {
                                  setSelectedRoom(room);
                                  setBedsDialogOpen(true);
                                }}
                                title="Manage Beds"
                              >
                                <Bed className="h-4 w-4" />
                              </Button>
                              <div className="w-[1px] h-4 bg-border mx-1" />
                              {canAllocate && room.status !== 'offline' && room.current_occupancy < room.capacity && (
                                <Button
                                  size="sm"
                                  className="h-8 px-3 primary-gradient text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:opacity-90 active:scale-95 transition-all"
                                  onClick={() => handleAllocate(room)}
                                >
                                  Allot
                                </Button>
                              )}
                              {canAllocate && room.status !== 'offline' && room.residents.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-3 border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-red-50 hover:text-red-700 active:scale-95 transition-all"
                                  onClick={() => handleDeallocate(room)}
                                >
                                  Evict
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
                  <Card key={room.id} className="overflow-hidden border-0 shadow-sm rounded-3xl bg-white">
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

                      {isWarden && (
                        <div className="flex flex-col gap-2 pt-2 border-t border-muted/50">
                          <div className="flex gap-2">
                             {(user?.role === 'admin' || user?.role === 'super_admin') && (
                               <>
                                 <Button 
                                   variant="outline" 
                                   size="sm"
                                   className="flex-1 rounded-xl h-10 font-bold"
                                   onClick={() => { setEditingRoom(room); setEditRoomDialogOpen(true); }}
                                 >
                                   <Edit className="h-4 w-4 mr-2" />
                                   Edit
                                 </Button>
                                 <Button 
                                   variant="outline" 
                                   size="sm"
                                   className="flex-1 rounded-xl h-10 font-bold"
                                   onClick={() => { setSelectedRoom(room); setBedsDialogOpen(true); }}
                                 >
                                   <Bed className="h-4 w-4 mr-2" />
                                   Beds
                                 </Button>
                               </>
                             )}
                          </div>
                          <div className="flex gap-2">
                            {canAllocate && room.status !== 'offline' && room.current_occupancy < room.capacity && (
                              <Button
                                size="sm"
                                className="flex-1 h-10 rounded-xl primary-gradient text-white font-bold"
                                onClick={() => handleAllocate(room)}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Allocate
                              </Button>
                            )}
                            {canAllocate && room.status !== 'offline' && room.residents.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-10 rounded-xl border-red-100 text-red-600 hover:bg-red-50"
                                onClick={() => handleDeallocate(room)}
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Evict
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
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
        <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl">
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                <UserPlus className="h-6 w-6 text-primary" />
                Allocate Room {selectedRoom?.room_number}
              </DialogTitle>
              <DialogDescription className="font-medium">
                Select a student to assign to this room.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-4 py-4">
              <StudentSearch 
                  onSelect={(id) => setStudentId(id)} 
                  placeholder="Search student to allocate..."
              />
            </div>
            
            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Room Info</p>
              <p className="text-sm font-medium">Beds available: {selectedRoom ? selectedRoom.capacity - selectedRoom.current_occupancy : 0} out of {selectedRoom?.capacity}</p>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 px-6 pb-6 border-t flex flex-col gap-3">
            <Button
              className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
              onClick={() => {
                if (selectedRoom && studentId) {
                  allocateMutation.mutate({ roomId: selectedRoom.id, userId: studentId });
                }
              }}
              disabled={!studentId || allocateMutation.isPending}
            >
              {allocateMutation.isPending ? 'Allocating...' : 'Confirm Allocation'}
            </Button>
            <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setAllocateDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deallocate Dialog */}
      <Dialog open={deallocateDialogOpen} onOpenChange={setDeallocateDialogOpen}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl text-black">
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                <UserMinus className="h-6 w-6 text-destructive" />
                Deallocate Room {selectedRoom?.room_number}
              </DialogTitle>
              <DialogDescription className="font-medium">
                Remove a resident from this room.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Select Resident</Label>
              <Select onValueChange={(value) => setStudentId(value)}>
                <SelectTrigger className="h-12 rounded-2xl border-0 bg-gray-50 focus:ring-destructive/20">
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
            
            <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
              <p className="text-xs font-bold text-destructive flex items-center gap-2">
                ⚠️ This will mark the bed as available.
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 px-6 pb-6 border-t flex flex-col gap-3">
            <Button
              variant="destructive"
              className="w-full h-14 bg-destructive hover:bg-destructive/90 text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-xl shadow-destructive/20 hover:scale-[1.02] active:scale-95 transition-all border-0"
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
              {deallocateMutation.isPending ? 'Deallocating...' : 'Deallocate Resident'}
            </Button>
            <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setDeallocateDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Create Room Dialog */}
      <Dialog open={createRoomDialogOpen} onOpenChange={setCreateRoomDialogOpen}>
        <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl text-black">
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Plus className="h-6 w-6 text-primary" />
                Add New Room
              </DialogTitle>
              <DialogDescription className="font-medium">
                Create a new dorm unit in the system.
              </DialogDescription>
            </DialogHeader>
          </div>

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
                single_beds: parseInt(formData.get('single_beds') as string || '0', 10),
                double_beds: parseInt(formData.get('double_beds') as string || '0', 10),
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
            className="p-6 space-y-4"
          >
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Building / Block</Label>
              <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId} required>
                <SelectTrigger className="h-12 rounded-2xl border-0 bg-gray-50">
                  <SelectValue placeholder="Select building" />
                </SelectTrigger>
                <SelectContent>
                  {buildings && buildings.length > 0 ? (
                    buildings.map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      No buildings found.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Room Number</Label>
                <Input name="room_number" placeholder="e.g. 101" className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Floor</Label>
                <Input name="floor" type="number" placeholder="e.g. 1" className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Room Type</Label>
                <Select name="room_type" defaultValue="double" required>
                  <SelectTrigger className="h-12 rounded-2xl border-0 bg-gray-50">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                    <SelectItem value="triple">Triple</SelectItem>
                    <SelectItem value="quad">Quad</SelectItem>
                    <SelectItem value="dormitory">Dormitory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Capacity</Label>
                <Input name="capacity" type="number" placeholder="e.g. 2" className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Single Beds Qty</Label>
                <Input name="single_beds" type="number" defaultValue="0" min="0" className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Double Beds Qty</Label>
                <Input name="double_beds" type="number" defaultValue="0" min="0" className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Bed Type Style</Label>
              <Select name="bed_type" defaultValue="standard" required>
                <SelectTrigger className="h-12 rounded-2xl border-0 bg-gray-50">
                  <SelectValue placeholder="Select bed type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Single (1-Tier)</SelectItem>
                  <SelectItem value="bunk">Bunk Beds (2-Tier)</SelectItem>
                  <SelectItem value="combined">Combined (Mixed)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 -mx-6 px-6 -mb-6 pb-6 border-t flex flex-col gap-3">
              <Button type="submit" className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-sm hover:scale-[1.02] active:scale-95 transition-all border-0">
                Create Room
              </Button>
              <Button type="button" variant="ghost" className="font-bold text-muted-foreground" onClick={() => setCreateRoomDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={editRoomDialogOpen} onOpenChange={setEditRoomDialogOpen}>
        <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl text-black shadow-2xl">
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Edit className="h-6 w-6 text-primary" />
                Edit Room {editingRoom?.room_number}
              </DialogTitle>
            </DialogHeader>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editingRoom) return;
              const formData = new FormData(e.currentTarget);
              const roomData: Partial<Room> = {
                room_number: String(formData.get('room_number')),
                floor: Number(formData.get('floor')),
                room_type: String(formData.get('room_type')),
                capacity: Number(formData.get('capacity')),
                bed_type: String(formData.get('bed_type')),
              };
              updateRoomMutation.mutate({ roomId: editingRoom.id, data: roomData });
            }}
            className="p-6 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Room Number</Label>
                <Input name="room_number" defaultValue={editingRoom?.room_number} className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Floor</Label>
                <Input name="floor" type="number" defaultValue={editingRoom?.floor} className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Room Type</Label>
                <Select name="room_type" defaultValue={editingRoom?.room_type} required>
                  <SelectTrigger className="h-12 rounded-2xl border-0 bg-gray-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                    <SelectItem value="triple">Triple</SelectItem>
                    <SelectItem value="quad">Quad</SelectItem>
                    <SelectItem value="dormitory">Dormitory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Capacity</Label>
                <Input name="capacity" type="number" defaultValue={editingRoom?.capacity} className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Bed Type Selection</Label>
              <Select name="bed_type" defaultValue={editingRoom?.bed_type || 'single'} required>
                <SelectTrigger className="h-12 rounded-2xl border-0 bg-gray-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3 pt-4 sticky bottom-0 z-10 bg-white/80 backdrop-blur-md -mx-6 px-6 -mb-6 pb-6 border-t">
              <Button type="submit" disabled={updateRoomMutation.isPending} className="w-full h-14 primary-gradient text-white font-black uppercase tracking-wider rounded-2xl active:scale-95 transition-all shadow-xl shadow-primary/20">
                {updateRoomMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  disabled={updateRoomMutation.isPending}
                  className="flex-1 h-12 border-2 border-red-100 text-red-600 font-bold hover:bg-red-50 rounded-xl"
                  onClick={() => {
                    if (editingRoom && confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
                      deleteRoomMutation.mutate(editingRoom.id);
                      setEditRoomDialogOpen(false);
                    }
                  }}
                >
                  Delete Room
                </Button>
                <Button type="button" variant="ghost" className="flex-1 h-12 font-bold text-muted-foreground rounded-xl" onClick={() => setEditRoomDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Beds Management Dialog */}
      <Dialog open={bedsDialogOpen} onOpenChange={setBedsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl text-black shadow-2xl">
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Bed className="h-6 w-6 text-primary" />
                Manage Beds - Room {selectedRoom?.room_number}
              </DialogTitle>
              <DialogDescription className="font-medium">
                View and edit individual bed assignments and numbers.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rooms?.find(r => r.id === selectedRoom?.id)?.beds?.map((bed) => (
                  <div key={bed.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 hover:border-primary/20 transition-all">
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Bed No</span>
                      <span className="font-bold">{bed.bed_number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {bed.is_occupied ? (
                        <Badge className="bg-blue-100 text-blue-700 border-0 font-bold">Occupied</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-0 font-bold">Free</Badge>
                      )}
                      {(user?.role === 'admin' || user?.role === 'super_admin') && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 rounded-lg hover:bg-gray-200"
                          onClick={() => {
                             const newNumber = prompt('Enter new bed number:', bed.bed_number);
                             if (newNumber && newNumber !== bed.bed_number) {
                               api.patch(`/rooms/beds/${bed.id}/`, { bed_number: newNumber })
                                 .then(() => {
                                   queryClient.invalidateQueries({ queryKey: ['rooms'] });
                                   toast.success('Bed number updated');
                                 })
                                 .catch(() => toast.error('Failed to update bed number'));
                             }
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
             </div>

             {(user?.role === 'admin' || user?.role === 'super_admin') && (
               <div className="pt-4 border-t border-gray-100">
                  <Button 
                    variant="outline" 
                    className="w-full rounded-xl font-bold text-xs uppercase tracking-widest border-2 hover:bg-gray-50 h-12"
                    onClick={() => {
                       api.post(`/rooms/${selectedRoom?.id}/generate_beds/`)
                         .then(() => {
                           queryClient.invalidateQueries({ queryKey: ['rooms'] });
                           toast.success('Beds synchronized');
                         })
                         .catch(() => toast.error('Failed to sync beds'));
                    }}
                  >
                    Sync Beds with Capacity
                  </Button>
               </div>
             )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
