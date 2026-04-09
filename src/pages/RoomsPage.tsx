import { useState, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Home, Filter, UserPlus, UserMinus, Search, Plus, Bed, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import {
  useBuildings,
  useRoomsList,
  useMyActiveAllocation,
  useAllocateRoom,
  useDeallocateRoom,
  useDeleteRoom,
  useUpdateRoom,
  useAutoAllocate,
  useCreateRoom,
  useEditBed,
  useSyncBeds,
} from '@/hooks/features/useRooms';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { getApiErrorMessage } from '@/lib/utils';
import { isManagement, isTopLevelManagement } from '@/lib/rbac';
import { StudentSearch } from '@/components/common/StudentSearch';
import { SEO } from '@/components/common/SEO';
import { DeleteConfirmation } from '@/components/common/DeleteConfirmation';
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

interface MyRoomAllocation {
  id: number;
  allocated_date: string;
  room: {
    id: number;
    room_number: string;
    floor: number;
    building?: {
      id: number | null;
      code?: string | null;
      name?: string | null;
    };
  };
  bed?: {
    id: number | null;
    bed_number?: string | null;
  };
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
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const isStudentSelfView = user?.role === 'student';

  const parentRef = useRef<HTMLDivElement>(null);

  const { data: buildings } = useBuildings<Building>(!isStudentSelfView);

  const { data: rooms, isLoading } = useRoomsList<Room>(
    { floor: floorFilter, type: typeFilter, status: statusFilter },
    !isStudentSelfView
  );

  const { data: myAllocation, isLoading: myAllocationLoading } = useMyActiveAllocation<MyRoomAllocation>(isStudentSelfView);

  // Real-time updates for rooms
  useRealtimeQuery('room_updated', 'rooms');
  useRealtimeQuery('room_allocated', 'rooms');
  useRealtimeQuery('room_deallocated', 'rooms');

  const allocateMutation = useAllocateRoom();
  const deallocateMutation = useDeallocateRoom();

  const [editRoomDialogOpen, setEditRoomDialogOpen] = useState(false);
  const [bedsDialogOpen, setBedsDialogOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const deleteRoomMutation = useDeleteRoom();
  const updateRoomMutation = useUpdateRoom();
  const autoAllocateMutation = useAutoAllocate();
  const createRoomMutation = useCreateRoom();
  const editBedMutation = useEditBed();
  const syncBedsMutation = useSyncBeds();

  const filteredRooms = rooms?.filter((room) =>
    room.room_number.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const availableFloors = useMemo(() => {
    if (!rooms?.length) return [];
    const floors = [...new Set(rooms.map(r => r.floor))].filter(Boolean).sort((a, b) => a - b);
    return floors;
  }, [rooms]);

  const rowVirtualizer = useVirtualizer({
    count: filteredRooms.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Adjusted for Room card height
    overscan: 2, // Strict minimal dom count
  });

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

  if (isStudentSelfView) {
    return (
      <div className="w-full max-w-4xl px-3 py-3 sm:py-4 space-y-3">
        <SEO
          title="My Room"
          description="View your current hostel room and bed allocation."
        />
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2 tracking-tight">
            <div className="p-2 bg-blue-100 rounded-sm text-blue-600 shrink-0">
              <Home className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            My Room
          </h1>
          <p className="text-muted-foreground font-medium pl-1 text-sm">Your active hostel allocation and bed details</p>
        </div>

        {myAllocationLoading ? (
          <ListSkeleton rows={3} />
        ) : myAllocation ? (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-6 pb-4">
              <span className="text-xl font-black tracking-tight">
                Room {myAllocation.room.room_number}
              </span>
              <Badge className="bg-primary/15 text-black border border-primary/30 font-bold">
                Active Allocation
              </Badge>
            </div>
            <div className="px-6 pb-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-sm bg-slate-50 p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Block</p>
                  <p className="mt-2 text-lg font-bold">{myAllocation.room.building?.name || 'Not assigned'}</p>
                </div>
                <div className="rounded-sm bg-slate-50 p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Floor</p>
                  <p className="mt-2 text-lg font-bold">Floor {myAllocation.room.floor}</p>
                </div>
                <div className="rounded-sm bg-slate-50 p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bed</p>
                  <p className="mt-2 text-lg font-bold flex items-center gap-2">
                    <Bed className="h-4 w-4 text-primary" />
                    {myAllocation.bed?.bed_number || 'Not assigned'}
                  </p>
                </div>
              </div>

              <div className="rounded-sm bg-primary/5 border border-primary/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Allocated On</p>
                <p className="mt-2 text-sm font-semibold">
                  {new Date(myAllocation.allocated_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Home}
            title="No room allocated yet"
            description="Your room and bed allocation will appear here once the hostel team assigns you."
            variant="default"
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-3 py-3 sm:py-4 space-y-3 overflow-x-hidden">
      <SEO 
        title="Room Management" 
        description="Oversee hostel room allocations, floor statuses, and bed availability. Detailed inventory management for SMG CampusCore blocks."
      />
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2 tracking-tight">
            <div className="p-2 bg-blue-100 rounded-sm text-blue-600 shrink-0">
                <Home className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            Room Management
          </h1>
          {isWarden && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => autoAllocateMutation.mutate(undefined, {
                onSuccess: (data: { detail?: string }) => toast.success(data?.detail || 'Auto-allocation complete'),
                onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to auto-allocate rooms')),
              })} disabled={autoAllocateMutation.isPending} variant="outline" className="rounded-sm font-bold border-2 hover:bg-muted transition-all active:scale-95 text-xs sm:text-sm flex-1 sm:flex-initial">
                {autoAllocateMutation.isPending ? 'Allocating...' : 'Auto Allocate'}
              </Button>
              <Button onClick={() => setCreateRoomDialogOpen(true)} className="rounded-sm shadow-sm bg-primary hover:bg-primary/90 text-white font-bold transition-all active:scale-95 text-xs sm:text-sm flex-1 sm:flex-initial">
                <Plus className="h-4 w-4 mr-1" />
                Add Room
              </Button>
            </div>
          )}
        </div>
        <p className="text-muted-foreground font-medium pl-1 text-sm">Manage room allocations and availability</p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="flex items-center gap-2 text-sm uppercase tracking-wider font-black text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters
          </p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search room number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-sm border-gray-200 bg-gray-50/50 focus:bg-white transition-all"
              />
            </div>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="rounded-sm border-gray-200 bg-white/80 backdrop-blur-sm border-2 transition-all hover:border-primary/50">
                <SelectValue placeholder="Floor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                {availableFloors.map(f => (
                  <SelectItem key={f} value={String(f)}>Floor {f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="rounded-sm border-gray-200 bg-white/80 backdrop-blur-sm border-2 transition-all hover:border-primary/50">
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
              <SelectTrigger className="rounded-sm border-gray-200 bg-white/80 backdrop-blur-sm border-2 transition-all hover:border-primary/50">
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
        </div>
      </div>

      {/* Rooms Table */}
      <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
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
                            "px-2 py-1 rounded-sm",
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
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-sm"
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
                                className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10 rounded-sm"
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
                                  className="h-8 px-3 primary-gradient text-white text-[10px] font-black uppercase tracking-wider rounded-sm hover:opacity-90 active:scale-95 transition-all"
                                  onClick={() => handleAllocate(room)}
                                >
                                  Allot
                                </Button>
                              )}
                              {canAllocate && room.status !== 'offline' && room.residents.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-3 border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-wider rounded-sm hover:bg-red-50 hover:text-red-700 active:scale-95 transition-all"
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

              {/* Mobile Card List View - DOM VIRTUALIZED FOR ULTRA-LIGHT PERFORMANCE */}
              <div ref={parentRef} className="lg:hidden h-[600px] overflow-auto relative space-y-0 rounded-sm bg-slate-50/50 p-2 border border-black/5" style={{ scrollBehavior: 'smooth' }}>
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const room = filteredRooms[virtualRow.index];
                  return (
                    <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            paddingBottom: '16px', // space-y-4 equivalent
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                    >
                        <Card className="overflow-hidden rounded-xl border border-border shadow-sm bg-card">
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
                                <div className="h-2 rounded-sm bg-muted overflow-hidden">
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
                                <span className="font-bold text-black bg-primary/20 px-2 py-0.5 rounded-sm border border-primary/10">
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
                                    {isTopLevelManagement(user?.role) && (
                                    <>
                                        <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="flex-1 rounded-sm h-10 font-bold"
                                        onClick={() => { setEditingRoom(room); setEditRoomDialogOpen(true); }}
                                        >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                        </Button>
                                        <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="flex-1 rounded-sm h-10 font-bold"
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
                                        className="flex-1 h-10 rounded-sm primary-gradient text-white font-bold"
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
                                        className="flex-1 h-10 rounded-sm border-red-100 text-red-600 hover:bg-red-50"
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
                    </div>
                  );
                })}
                </div>
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
        <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-sm">
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
            
            <div className="bg-primary/5 p-4 rounded-sm border border-primary/10">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Room Info</p>
              <p className="text-sm font-medium">Beds available: {selectedRoom ? selectedRoom.capacity - selectedRoom.current_occupancy : 0} out of {selectedRoom?.capacity}</p>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 px-6 pb-6 border-t flex flex-col gap-3">
            <Button
              className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
              onClick={() => {
                if (selectedRoom && studentId) {
                  allocateMutation.mutate({ roomId: selectedRoom.id, userId: studentId }, {
                    onSuccess: () => {
                      toast.success('Room allocated successfully');
                      setAllocateDialogOpen(false);
                      setStudentId('');
                      setSelectedRoom(null);
                    },
                    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to allocate room')),
                  });
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
        <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-sm text-black">
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
                <SelectTrigger className="h-12 rounded-sm border-0 bg-gray-50 focus:ring-destructive/20">
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
            
            <div className="p-4 rounded-sm bg-destructive/5 border border-destructive/10">
              <p className="text-xs font-bold text-destructive flex items-center gap-2">
                ⚠️ This will mark the bed as available.
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 px-6 pb-6 border-t flex flex-col gap-3">
            <Button
              variant="destructive"
              className="w-full h-14 bg-destructive hover:bg-destructive/90 text-white font-black text-lg uppercase tracking-wider rounded-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all border-0"
              onClick={() => {
                if (selectedRoom && studentId) {
                  deallocateMutation.mutate({
                    roomId: selectedRoom.id,
                    userId: parseInt(studentId),
                  }, {
                    onSuccess: () => {
                      toast.success('Room deallocated successfully');
                      setDeallocateDialogOpen(false);
                      setSelectedRoom(null);
                    },
                    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to deallocate room')),
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
        <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-sm text-black">
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
            onSubmit={(e) => {
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
              
              createRoomMutation.mutate(roomData, {
                onSuccess: () => {
                  setCreateRoomDialogOpen(false);
                  setSelectedBuildingId('');
                  toast.success('Room created successfully');
                },
                onError: (error: unknown) => {
                  toast.error(getApiErrorMessage(error, 'Failed to create room'));
                },
              });
            }}
            className="p-6 space-y-4"
          >
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Building / Block</Label>
              <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId} required>
                <SelectTrigger className="h-12 rounded-sm border-0 bg-gray-50">
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
                <Input name="room_number" placeholder="e.g. 101" className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Floor</Label>
                <Input name="floor" type="number" placeholder="e.g. 1" className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Room Type</Label>
                <Select name="room_type" defaultValue="double" required>
                  <SelectTrigger className="h-12 rounded-sm border-0 bg-gray-50">
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
                <Input name="capacity" type="number" placeholder="e.g. 2" className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Single Beds Qty</Label>
                <Input name="single_beds" type="number" defaultValue="0" min="0" className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Double Beds Qty</Label>
                <Input name="double_beds" type="number" defaultValue="0" min="0" className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Bed Type Style</Label>
              <Select name="bed_type" defaultValue="standard" required>
                <SelectTrigger className="h-12 rounded-sm border-0 bg-gray-50">
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
              <Button type="submit" className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all border-0">
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
        <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-sm text-black shadow-sm">
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
              updateRoomMutation.mutate({ roomId: editingRoom.id, data: roomData }, {
                onSuccess: () => {
                  toast.success('Room updated successfully');
                  setEditRoomDialogOpen(false);
                  setEditingRoom(null);
                },
                onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to update room')),
              });
            }}
            className="p-6 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Room Number</Label>
                <Input name="room_number" defaultValue={editingRoom?.room_number} className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Floor</Label>
                <Input name="floor" type="number" defaultValue={editingRoom?.floor} className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Room Type</Label>
                <Select name="room_type" defaultValue={editingRoom?.room_type} required>
                  <SelectTrigger className="h-12 rounded-sm border-0 bg-gray-50">
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
                <Input name="capacity" type="number" defaultValue={editingRoom?.capacity} className="h-12 rounded-sm border-0 bg-gray-50 focus-visible:ring-primary" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Bed Type Selection</Label>
              <Select name="bed_type" defaultValue={editingRoom?.bed_type || 'single'} required>
                <SelectTrigger className="h-12 rounded-sm border-0 bg-gray-50">
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
              <Button type="submit" disabled={updateRoomMutation.isPending} className="w-full h-14 primary-gradient text-white font-black uppercase tracking-wider rounded-sm active:scale-95 transition-all shadow-sm">
                {updateRoomMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  disabled={updateRoomMutation.isPending}
                  className="flex-1 h-12 border-2 border-red-100 text-red-600 font-bold hover:bg-red-50 rounded-sm"
                  onClick={() => {
                    if (editingRoom) {
                      setDeleteConfirmationOpen(true);
                    }
                  }}
                >
                  Delete Room
                </Button>
                <Button type="button" variant="ghost" className="flex-1 h-12 font-bold text-muted-foreground rounded-sm" onClick={() => setEditRoomDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmation
        isOpen={deleteConfirmationOpen}
        onClose={() => setDeleteConfirmationOpen(false)}
        onConfirm={() => {
          if (editingRoom) {
            deleteRoomMutation.mutate(editingRoom.id, {
              onSuccess: () => toast.success('Room deleted successfully'),
              onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to delete room')),
            });
            setDeleteConfirmationOpen(false);
            setEditRoomDialogOpen(false);
          }
        }}
        isLoading={deleteRoomMutation.isPending}
        title="Delete Room Record"
        description="Are you sure you want to permanently delete this room? All historical allocation links to this room will be archived."
        itemName={`Room ${editingRoom?.room_number}`}
      />

      {/* Beds Management Dialog */}
      <Dialog open={bedsDialogOpen} onOpenChange={setBedsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-sm text-black shadow-sm">
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
                  <div key={bed.id} className="flex items-center justify-between p-3 rounded-sm bg-gray-50 border border-gray-100 hover:border-primary/20 transition-all">
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
                      {isTopLevelManagement(user?.role) && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          aria-label={`Edit bed number ${bed.bed_number}`}
                          className="h-8 w-8 rounded-sm hover:bg-gray-200"
                          onClick={() => {
                             const newNumber = prompt('Enter new bed number:', bed.bed_number);
                             if (newNumber && newNumber !== bed.bed_number) {
                               editBedMutation.mutate({ bedId: bed.id, bedNumber: newNumber }, {
                                 onSuccess: () => toast.success('Bed number updated'),
                                 onError: () => toast.error('Failed to update bed number'),
                               });
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

             {isTopLevelManagement(user?.role) && (
               <div className="pt-4 border-t border-gray-100">
                  <Button 
                    variant="outline" 
                    className="w-full rounded-sm font-bold text-xs uppercase tracking-widest border-2 hover:bg-gray-50 h-12"
                    onClick={() => {
                       syncBedsMutation.mutate(selectedRoom!.id, {
                         onSuccess: () => toast.success('Beds synchronized'),
                         onError: () => toast.error('Failed to sync beds'),
                       });
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
