import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bed, User, Move, XCircle, Home, CheckCircle, Plus, Trash2, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { isManagement } from '@/lib/rbac';
import { StudentSearch } from '@/components/common/StudentSearch';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { BrandedLoading } from '@/components/common/BrandedLoading';


interface Occupant {
    id: number;
    name: string;
    reg_no?: string;
    registration_number?: string;
    hall_ticket?: string;
    phone?: string;
    phone_number?: string;
    college_code?: string | null;
    college_name?: string | null;
    father_name?: string;
    father_phone?: string;
    mother_name?: string;
    mother_phone?: string;
    guardian_name?: string;
    guardian_phone?: string;
}

interface BedData {
    id: number;
    bed_number: string;
    is_occupied: boolean;
    occupant: Occupant | null;
}

interface RoomData {
    id: number;
    room_number: string;
    type: string;
    capacity: number;
    occupancy: number;
    beds: BedData[];
}

interface FloorData {
    floor_number: number;
    rooms: RoomData[];
}

interface HostelData {
    id: number;
    name: string;
    college: number;
    college_name: string;
    is_active: boolean;
    disabled_reason?: string;
    block_count: number;
}

interface BuildingData {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
    disabled_reason?: string;
    resident_count: number;
    hostel?: number;
    hostel_name?: string;
    hostel_is_active?: boolean;
    disabled_floors?: number[];
    floors: FloorData[];
}

export default function RoomMapping() {
    const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
    const [selectedBed, setSelectedBed] = useState<BedData | null>(null);
    const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
    const [moveModalOpen, setMoveModalOpen] = useState(false);
    const [targetStudentId, setTargetStudentId] = useState<string>('');
    const [moveStudentOpen, setMoveStudentOpen] = useState(false);
    const [targetBedId, setTargetBedId] = useState<string>('');
    const [createBuildingOpen, setCreateBuildingOpen] = useState(false);
    const [createHostelOpen, setCreateHostelOpen] = useState(false);
    const [createRoomOpen, setCreateRoomOpen] = useState(false);
    const [selectedFloorForRoom, setSelectedFloorForRoom] = useState<number | null>(null);
    const [confirmVacate, setConfirmVacate] = useState(false);
    const [toggleBuildingTarget, setToggleBuildingTarget] = useState<BuildingData | null>(null);
    const [toggleHostelTarget, setToggleHostelTarget] = useState<HostelData | null>(null);
    const [hostelToggleReason, setHostelToggleReason] = useState('');
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const canManage = isManagement(user?.role);

    const { data: buildings, isLoading: buildingsLoading, isError: buildingsError } = useQuery<BuildingData[]>({
        queryKey: ['room-mapping'],
        queryFn: async () => {
            const response = await api.get('/rooms/mapping/');
            return response.data;
        },
    });

    const { data: hostels, isLoading: hostelsLoading, isError: hostelsError } = useQuery<HostelData[]>({
        queryKey: ['hostels'],
        queryFn: async () => {
            const response = await api.get('/rooms/hostels/');
            return response.data;
        },
    });

    const isLoading = buildingsLoading || hostelsLoading;
    const isError = buildingsError || hostelsError;

    // Real-time updates for room mapping
    useRealtimeQuery('room_updated', 'room-mapping');
    useRealtimeQuery('room_allocated', 'room-mapping');
    useRealtimeQuery('room_deallocated', 'room-mapping');


    const allocateMutation = useMutation({
        mutationFn: async ({ roomId, bedId, studentId }: { roomId: number, bedId: number, studentId: number }) => {
            return api.post(`/rooms/${roomId}/allocate/`, { bed_id: bedId, user_id: studentId });
        },
        onSuccess: () => {
            toast.success('Student allocated successfully');
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
            setMoveModalOpen(false);
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to allocate'));
        }
    });

    const toggleFloorMutation = useMutation({
        mutationFn: async ({ blockId, floorNum }: { blockId: number, floorNum: number }) => {
            return api.post(`/rooms/buildings/${blockId}/toggle_floor_active/`, { floor: floorNum });
        },
        onSuccess: (data) => {
            toast.success(data.data.detail);
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to toggle floor'));
        }
    });

    const bulkFloorActionMutation = useMutation({
        mutationFn: async ({ blockId, action }: { blockId: number, action: 'disable_all' | 'enable_all' }) => {
            return api.post(`/rooms/buildings/${blockId}/bulk_toggle_floors/`, { action });
        },
        onSuccess: (data) => {
            toast.success(data.data.detail);
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to update all floors'));
        }
    });

    const toggleHostelMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: number, reason: string }) => {
            return api.post(`/rooms/hostels/${id}/toggle_active/`, { reason });
        },
        onSuccess: (data) => {
            toast.success(data.data.detail);
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
            queryClient.invalidateQueries({ queryKey: ['hostels'] });
            setToggleHostelTarget(null);
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to toggle hostel status'));
        }
    });

    const createHostelMutation = useMutation({
        mutationFn: async (data: { name: string, college: number }) => {
            return api.post('/rooms/hostels/', data);
        },
        onSuccess: () => {
            toast.success('Hostel created successfully');
            queryClient.invalidateQueries({ queryKey: ['hostels'] });
            setCreateHostelOpen(false);
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to create hostel'));
        }
    });

    const deallocateMutation = useMutation({
        mutationFn: async ({ roomId, studentId }: { roomId: number, studentId: number }) => {
            return api.post(`/rooms/${roomId}/deallocate/`, { user_id: Number(studentId) });
        },
        onSuccess: () => {
            toast.success('Bed vacated successfully');
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            setConfirmVacate(false);
            setSelectedBed(null);
        },
        onError: (error: unknown) => {
             toast.error(getApiErrorMessage(error, 'Failed to vacate'));
        }
    });

    const moveMutation = useMutation({
        mutationFn: async ({ studentId, targetBedId }: { studentId: number, targetBedId: number }) => {
            return api.post('/rooms/allocations/move/', { student_id: studentId, target_bed_id: targetBedId });
        },
        onSuccess: () => {
            toast.success('Student moved successfully');
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
            setMoveStudentOpen(false);
            setTargetBedId('');
            setSelectedBed(null);
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to move student'));
        }
    });

    const createBuildingMutation = useMutation({
        mutationFn: async (data: { name: string; code: string; total_floors: number; hostel: number }) => {
            return api.post('/rooms/buildings/', data);
        },
        onSuccess: () => {
             toast.success('Building created successfully');
             queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
             setCreateBuildingOpen(false);
        },
        onError: (error: unknown) => {
             toast.error(getApiErrorMessage(error, 'Failed to create building'));
        }
    });

    const createRoomMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            return api.post('/rooms/', data);
        },
        onSuccess: () => {
             toast.success('Room created successfully');
             queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
             queryClient.invalidateQueries({ queryKey: ['rooms'] });
             setCreateRoomOpen(false);
        },
        onError: (error: unknown) => {
             toast.error(getApiErrorMessage(error, 'Failed to create room'));
        }
    });

    const syncInventoryMutation = useMutation({
        mutationFn: async (roomId: number) => {
            return api.post(`/rooms/${roomId}/sync_inventory/`);
        },
        onSuccess: () => {
            toast.success('Room inventory synchronized');
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to sync inventory'));
        }
    });

    const generateBedsMutation = useMutation({
        mutationFn: async (roomId: number) => {
            return api.post(`/rooms/${roomId}/generate_beds/`);
        },
        onSuccess: (data) => {
             const created = data.data.created;
             if (created > 0) {
                 toast.success(`Generated ${created} new bed(s)`);
             } else {
                 toast.info('All beds are already generated');
             }
             queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to generate beds'));
        }
    });

    const deleteRoomMutation = useMutation({
        mutationFn: async (roomId: number) => {
            return api.delete(`/rooms/${roomId}/`);
        },
        onSuccess: () => {
             toast.success('Room deleted successfully');
             queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
             queryClient.invalidateQueries({ queryKey: ['rooms'] }); // Sync with Rooms table
        },
        onError: (error: unknown) => {
             // Handle safety rail errors nicely
             toast.error(getApiErrorMessage(error, 'Failed to delete room'));
        }
    });

    const toggleBuildingMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
            return api.post(`/rooms/buildings/${id}/toggle_active/`, { reason });
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
            toast.success(data.data.detail);
            setToggleBuildingTarget(null);
            setHostelToggleReason('');
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to toggle building status'));
        }
    });

    const currentBuilding = selectedBuilding 
        ? buildings?.find(b => b.id === selectedBuilding) 
        : buildings?.[0];

    const availableBedOptions = useMemo(() => {
        if (!buildings) return [];
        const options: Array<{ id: number; label: string }> = [];
        for (const building of buildings) {
            for (const floor of building.floors) {
                for (const room of floor.rooms) {
                    for (const bed of room.beds) {
                        if (bed.is_occupied) continue;
                        options.push({
                            id: bed.id,
                            label: `${building.code} · Floor ${floor.floor_number} · Room ${room.room_number} · Bed ${bed.bed_number}`,
                        });
                    }
                }
            }
        }
        return options;
    }, [buildings]);

    if (isLoading) {
        return <BrandedLoading fullScreen title="Loading Campus Map" message="Synchronizing physical layout and resident data..." />;
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="p-4 bg-destructive/10 rounded-full">
                    <XCircle className="h-10 w-10 text-destructive" />
                </div>
                <div className="text-center">
                    <h2 className="text-lg font-bold">Failed to load room map</h2>
                    <p className="text-sm text-muted-foreground">This could be due to a server error or heavy traffic.</p>
                </div>
                <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['room-mapping'] })}>
                    Try Again
                </Button>
            </div>
        );
    }

    // Confirm Delete Room Dialog
    const confirmDeleteRoom = (room: RoomData) => {
        if (room.occupancy > 0) {
            toast.error(`Cannot delete Room ${room.room_number} because it has active students.`);
            return;
        }
        if (confirm(`Are you sure you want to delete Room ${room.room_number}? This action cannot be undone.`)) {
            deleteRoomMutation.mutate(room.id);
        }
    };

    const handleBedClick = (room: RoomData, bed: BedData) => {
        // Prevent interaction if building or hostel is disabled
        if (currentBuilding && (!currentBuilding.is_active || !currentBuilding.hostel_is_active)) {
             toast.error('This block is currently disabled for maintenance.');
             return;
        }
        
        setSelectedRoom(room);
        setSelectedBed(bed);
    };

    const handleAllocate = () => {
        if (!selectedRoom || !selectedBed || !targetStudentId) return;
        // In real app, search for student ID properly
        allocateMutation.mutate({
            roomId: selectedRoom.id,
            bedId: selectedBed.id,
            studentId: parseInt(targetStudentId) // ID entered
        });
    };

    const handleVacate = () => {
        if (!selectedRoom || !selectedBed?.occupant) {
            return;
        }
        
        deallocateMutation.mutate({
            roomId: selectedRoom.id,
            studentId: selectedBed.occupant.id
        });
    };


    return (
        <div className="container mx-auto px-4 py-6 space-y-6 scroll-smooth animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Room Mapping</h1>
                <div className="flex gap-2">
                    {buildings?.map(b => (
                        <div key={b.id} className="relative flex items-center">
                            <Button 
                                variant={currentBuilding?.id === b.id ? 'default' : 'outline'}
                                onClick={() => setSelectedBuilding(b.id)}
                            >
                                <Home className="mr-2 h-4 w-4"/> {b.name}
                                {!b.is_active && (
                                    <span className="ml-2 w-2 h-2 rounded-full bg-red-500 animate-pulse ring-2 ring-red-200" title="Block Offline" />
                                )}
                            </Button>
                        </div>
                    ))}
                    {canManage && (
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setCreateHostelOpen(true)} title="Add Hostel">
                                <Home className="h-4 w-4 text-muted-foreground mr-1" />+
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setCreateBuildingOpen(true)} title="Add Block">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Building Header */}
            {currentBuilding && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-br from-card to-muted/30 border shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${currentBuilding.is_active ? 'bg-primary/10' : 'bg-red-50 ring-1 ring-red-100'}`}>
                            <Home className={`h-6 w-6 ${currentBuilding.is_active ? 'text-primary' : 'text-red-500'}`} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold">{currentBuilding.name}</h2>
                                <span className="text-[10px] text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded uppercase font-bold tracking-tight">
                                    {currentBuilding.hostel_name || 'No Hostel'}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    currentBuilding.is_active 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                        : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                    {currentBuilding.is_active ? '🟢 ACTIVE' : '🔴 DISABLED'}
                                </span>
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                                <span>{currentBuilding.code}</span>
                                <span>•</span>
                                <span>{currentBuilding.resident_count} Residents</span>
                                {!currentBuilding.is_active && currentBuilding.disabled_reason && (
                                    <>
                                        <span>•</span>
                                        <span className="text-red-500 font-medium italic">Reason: {currentBuilding.disabled_reason}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {user?.role === 'super_admin' && (
                        <div className="flex flex-wrap items-center gap-2">
                            {currentBuilding.is_active && (
                                <div className="flex items-center gap-1 bg-white/50 p-1 rounded-full border border-white/50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="rounded-full text-[9px] font-black uppercase px-3 h-7"
                                        onClick={() => bulkFloorActionMutation.mutate({ blockId: currentBuilding.id, action: 'disable_all' })}
                                        disabled={bulkFloorActionMutation.isPending}
                                    >
                                        Disable All Floors
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="rounded-full text-[9px] font-black uppercase px-3 h-7 bg-white shadow-sm"
                                        onClick={() => bulkFloorActionMutation.mutate({ blockId: currentBuilding.id, action: 'enable_all' })}
                                        disabled={bulkFloorActionMutation.isPending}
                                    >
                                        Enable All Floors
                                    </Button>
                                </div>
                            )}

                            <Button
                                variant={currentBuilding.is_active ? "destructive" : "default"}
                                size="sm"
                                className="rounded-full px-4"
                                onClick={() => setToggleBuildingTarget(currentBuilding)}
                            >
                                {currentBuilding.is_active ? (
                                    <> <XCircle className="w-4 h-4 mr-2" /> Disable Block </>
                                ) : (
                                    <> <CheckCircle className="w-4 h-4 mr-2" /> Enable Block </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Map Area */}
            <div className="space-y-8">
                {currentBuilding?.floors.map(floor => {
                    const isFloorDisabled = !currentBuilding.hostel_is_active || !currentBuilding.is_active || currentBuilding.disabled_floors?.includes(floor.floor_number);
                    const buildingDisabled = !currentBuilding.hostel_is_active || !currentBuilding.is_active;
                    
                    return (
                        <div key={floor.floor_number} className={`border rounded-xl p-4 transition-all duration-300 ${
                            isFloorDisabled 
                                ? 'bg-red-50/40 border-red-200 shadow-inner' 
                                : 'bg-muted/20 border-border'
                        } ${buildingDisabled ? 'grayscale-[50%] opacity-80' : ''}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold shadow-sm ${
                                        isFloorDisabled ? 'bg-red-500 text-white' : 'bg-primary/10 text-primary'
                                    }`}>
                                        Floor {floor.floor_number}
                                    </span>
                                    {isFloorDisabled && (
                                        <Badge variant="destructive" className="animate-pulse font-black text-[9px] px-2">
                                            {buildingDisabled ? 'BLOCK OFFLINE' : 'FLOOR OFFLINE'}
                                        </Badge>
                                    )}
                                </h3>
                                
                                {user?.role === 'super_admin' && !buildingDisabled && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={`h-8 rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all text-[11px] font-bold ${
                                            isFloorDisabled 
                                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' 
                                                : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                                        }`}
                                        onClick={() => toggleFloorMutation.mutate({ 
                                            blockId: currentBuilding.id, 
                                            floorNum: floor.floor_number 
                                        })}
                                        disabled={toggleFloorMutation.isPending}
                                    >
                                        {isFloorDisabled ? (
                                            <><CheckCircle className="w-3 h-3 mr-1" /> ENABLE FLOOR</>
                                        ) : (
                                            <><Power className="w-3 h-3 mr-1" /> DISABLE FLOOR</>
                                        )}
                                    </Button>
                                )}
                            </div>

                            {/* Floor Actions */}
                            {canManage && (
                                <div className="flex justify-end mb-2">
                                    <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-primary" onClick={() => {
                                        setSelectedFloorForRoom(floor.floor_number);
                                        setCreateRoomOpen(true);
                                    }}>
                                        <Plus className="h-3 w-3 mr-1" /> Add Room
                                    </Button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {floor.rooms.map(room => (
                                    <div key={room.id} className={`border p-3 rounded-lg bg-card shadow-sm transition-opacity ${isFloorDisabled ? 'opacity-50 pointer-events-none grayscale-[50%]' : ''}`}>
                                        <div className="flex justify-between items-center mb-3 pb-2 border-b">
                                            <div>
                                                <span className="font-bold text-lg mr-2">{room.room_number}</span>
                                                <span className="text-xs text-muted-foreground capitalize bg-secondary px-2 py-0.5 rounded-full">
                                                    {room.type} ({room.occupancy}/{room.capacity})
                                                </span>
                                            </div>
                                            {canManage && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                                                    onClick={() => confirmDeleteRoom(room)}
                                                    title="Delete Room"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {room.beds.map(bed => (
                                                <div 
                                                    key={bed.id}
                                                    onClick={() => handleBedClick(room, bed)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            handleBedClick(room, bed);
                                                        }
                                                    }}
                                                    className={`
                                                        group relative cursor-pointer p-2 rounded border text-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-ring
                                                        ${bed.is_occupied 
                                                            ? 'bg-primary/10 border-primary/20 text-primary' 
                                                            : 'bg-accent/10 border-accent/30 text-accent-foreground hover:bg-accent/20'}
                                                    `}
                                                >
                                                    {bed.occupant ? (
                                                        <div className="pointer-events-none absolute left-1/2 top-0 z-20 w-64 -translate-x-1/2 -translate-y-3 rounded-xl border bg-popover p-3 text-left text-popover-foreground opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus:opacity-100">
                                                            <div className="text-sm font-bold leading-tight">{bed.occupant.name}</div>
                                                            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                                                <div>
                                                                    ID / Roll:{' '}
                                                                    <span className="font-semibold text-foreground">
                                                                        {(bed.occupant.hall_ticket || bed.occupant.registration_number || bed.occupant.reg_no || '').toUpperCase()}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    College:{' '}
                                                                    <span className="font-semibold text-foreground">
                                                                        {bed.occupant.college_name || bed.occupant.college_code || '—'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    Student Mobile:{' '}
                                                                    <span className="font-semibold text-foreground">
                                                                        {bed.occupant.phone || bed.occupant.phone_number || '—'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    Parents:{' '}
                                                                    <span className="font-semibold text-foreground">
                                                                        {bed.occupant.father_phone || '—'}
                                                                        {bed.occupant.mother_phone ? ` / ${bed.occupant.mother_phone}` : ''}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                    <Bed className="h-5 w-5 mx-auto mb-1" />
                                                    <div className="text-xs font-medium">Bed {bed.bed_number}</div>
                                                    {bed.occupant && (
                                                        <div className="text-[10px] truncate w-full mt-1 font-semibold">
                                                            {bed.occupant.name.split(' ')[0]}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {room.beds.length === 0 && Array.from({ length: room.capacity }).map((_, i) => (
                                                <div key={i} className="p-2 rounded border text-center bg-muted/40 text-muted-foreground">
                                                    <Bed className="h-5 w-5 mx-auto mb-1" />
                                                    <span className="text-xs">No Bed Data</span>
                                                </div>
                                            ))}
                                            {canManage && room.beds.length < room.capacity && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        generateBedsMutation.mutate(room.id);
                                                    }}
                                                    className="p-2 rounded border-2 border-dashed border-primary/30 text-center transition-all hover:bg-primary/5 hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring flex flex-col items-center justify-center min-h-[70px]"
                                                    title="Generate missing beds"
                                                >
                                                    <Plus className="h-5 w-5 mb-1 text-primary" />
                                                    <span className="text-xs font-medium text-primary">Add Bed</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bed Details Dialog */}
            <Dialog open={!!selectedBed} onOpenChange={(open) => {
                if (!open) {
                    setSelectedBed(null);
                    setConfirmVacate(false);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Room {selectedRoom?.room_number} - Bed {selectedBed?.bed_number}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-4">
                         {selectedBed?.is_occupied ? (
                             selectedBed.occupant ? (
                                 <div className="text-center space-y-4">
                                     <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                                        <User className="h-10 w-10" />
                                     </div>
                                     <div>
                                         <h3 className="text-xl font-bold">{selectedBed.occupant.name}</h3>
                                         <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest">
                                            {(selectedBed.occupant.hall_ticket || selectedBed.occupant.registration_number || selectedBed.occupant.reg_no || 'No ID')}
                                         </p>
                                     </div>
                                     <div className="grid grid-cols-1 gap-2 rounded-xl border bg-muted/30 p-4 text-left text-sm">
                                         <div className="flex items-center justify-between gap-4">
                                             <span className="text-muted-foreground">College</span>
                                             <span className="font-semibold">
                                                {selectedBed.occupant.college_name || selectedBed.occupant.college_code || '—'}
                                             </span>
                                         </div>
                                         <div className="flex items-center justify-between gap-4">
                                             <span className="text-muted-foreground">Student Mobile</span>
                                             <span className="font-semibold">
                                                {selectedBed.occupant.phone || selectedBed.occupant.phone_number || '—'}
                                             </span>
                                         </div>
                                         <div className="flex items-start justify-between gap-4 pt-2 border-t mt-1">
                                             <span className="text-muted-foreground text-[10px] uppercase font-bold">Parental Info</span>
                                             <span className="font-semibold text-right text-xs">
                                                {(selectedBed.occupant.father_name || selectedBed.occupant.father_phone) && (
                                                    <div className="mb-1">
                                                        <span className="text-[10px] text-muted-foreground block uppercase">{selectedBed.occupant.father_name || 'Father'}</span>
                                                        <span className="font-mono">{selectedBed.occupant.father_phone || '—'}</span>
                                                    </div>
                                                )}
                                                {(selectedBed.occupant.mother_name || selectedBed.occupant.mother_phone) && (
                                                    <div className="mb-1">
                                                        <span className="text-[10px] text-muted-foreground block uppercase">{selectedBed.occupant.mother_name || 'Mother'}</span>
                                                        <span className="font-mono">{selectedBed.occupant.mother_phone || '—'}</span>
                                                    </div>
                                                )}
                                                {selectedBed.occupant.guardian_phone && (
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground block uppercase">{selectedBed.occupant.guardian_name || 'Guardian'}</span>
                                                        <span className="font-mono">{selectedBed.occupant.guardian_phone}</span>
                                                    </div>
                                                )}
                                                {!selectedBed.occupant.father_phone && !selectedBed.occupant.mother_phone && !selectedBed.occupant.guardian_phone && '—'}
                                             </span>
                                         </div>
                                     </div>
                                     {confirmVacate ? (
                                         <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
                                             <p className="text-sm font-semibold text-destructive">Are you sure you want to vacate this student?</p>
                                             <div className="flex gap-2 justify-center">
                                                 <Button 
                                                     size="sm"
                                                     variant="destructive" 
                                                     onClick={handleVacate} 
                                                     disabled={deallocateMutation.isPending}
                                                 >
                                                     {deallocateMutation.isPending ? 'Vacating...' : 'Yes, Vacate'}
                                                 </Button>
                                                 <Button 
                                                     size="sm"
                                                     variant="outline" 
                                                     onClick={() => setConfirmVacate(false)}
                                                     disabled={deallocateMutation.isPending}
                                                 >
                                                     Cancel
                                                 </Button>
                                             </div>
                                         </div>
                                     ) : (
                                         <div className="flex gap-2 justify-center pt-4">
                                             <Button 
                                                 variant="destructive" 
                                                 onClick={() => setConfirmVacate(true)} 
                                             >
                                                 <XCircle className="w-4 h-4 mr-2" /> Vacate Bed
                                             </Button>
                                             <Button
                                                variant="outline"
                                                onClick={() => setMoveStudentOpen(true)}
                                             >
                                                 <Move className="w-4 h-4 mr-2" /> Move Student
                                             </Button>
                                         </div>
                                     )}
                                 </div>
                             ) : (
                                 <div className="text-center space-y-4 py-8">
                                     <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-500">
                                         <XCircle className="h-8 w-8" />
                                     </div>
                                     <p className="text-sm font-medium">Record Locked or Missing</p>
                                     <p className="text-xs text-muted-foreground px-8">The bed is marked as occupied but the student record is unavailable. Please refresh or contact support.</p>
                                     <div className="flex flex-col gap-2 px-8">
                                         <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['room-mapping'] })}>
                                             Refresh Map
                                         </Button>
                                         {canManage && (
                                             <Button 
                                                 variant="secondary" 
                                                 size="sm" 
                                                 className="text-xs"
                                                 onClick={() => {
                                                     if (selectedRoom) {
                                                         syncInventoryMutation.mutate(selectedRoom.id);
                                                         setSelectedBed(null);
                                                     }
                                                 }}
                                                 disabled={syncInventoryMutation.isPending}
                                             >
                                                 {syncInventoryMutation.isPending ? 'Syncing...' : 'Force Reset Bed Status'}
                                             </Button>
                                         )}
                                     </div>
                                 </div>
                             )
                         ) : (
                             <div className="text-center space-y-4">
                                 <div className="h-20 w-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                                     <CheckCircle className="h-10 w-10" />
                                 </div>
                                 <p className="text-lg font-medium text-foreground">Bed Available</p>
                                 <Button onClick={() => setMoveModalOpen(true)}>
                                     Allocate Student
                                 </Button>
                             </div>
                         )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Allocation Modal */}
            <Dialog open={moveModalOpen} onOpenChange={setMoveModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Allocate Bed</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                             <Label>Search Student</Label>
                             <StudentSearch 
                                onSelect={(id) => setTargetStudentId(id)}
                                placeholder="Search by name, reg no, or hall ticket..."
                                excludeAllocated
                             />
                             <p className="text-xs text-muted-foreground">Select a student from the list.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAllocate} disabled={!targetStudentId || allocateMutation.isPending}>
                            {allocateMutation.isPending ? 'Allocating...' : 'Confirm Allocation'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Move Student Modal */}
            <Dialog open={moveStudentOpen} onOpenChange={setMoveStudentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move Student</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {selectedBed?.occupant ? (
                            <div className="text-sm text-muted-foreground">
                                Moving: <span className="font-medium text-foreground">{selectedBed.occupant.name}</span>
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            <Label>Target Bed</Label>
                            <Select value={targetBedId} onValueChange={setTargetBedId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an available bed" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableBedOptions.map((opt) => (
                                        <SelectItem key={opt.id} value={String(opt.id)}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Only currently available beds are shown.</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            onClick={() => {
                                if (!selectedBed?.occupant?.id || !targetBedId) return;
                                moveMutation.mutate({ studentId: selectedBed.occupant.id, targetBedId: Number(targetBedId) });
                            }}
                            disabled={!selectedBed?.occupant?.id || !targetBedId || moveMutation.isPending}
                        >
                            {moveMutation.isPending ? 'Moving...' : 'Confirm Move'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* Create Room Dialog (With Mixed Config) */}
            <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
                 <DialogContent className="max-w-md">
                     <DialogHeader>
                         <DialogTitle>Add Room to Floor {selectedFloorForRoom}</DialogTitle>
                     </DialogHeader>
                     <form onSubmit={(e) => {
                         e.preventDefault();
                         if (!currentBuilding || selectedFloorForRoom === null) return;
                         
                         const formData = new FormData(e.currentTarget);
                         const bunkCount = Number(formData.get('bunk_count') || 0);
                         const singleCount = Number(formData.get('single_count') || 0);
                         
                         // Determine bed type
                         let bedType = 'standard';
                         if (bunkCount > 0 && singleCount > 0) bedType = 'combined';
                         else if (bunkCount > 0) bedType = 'bunk';
                         
                         // Calculate capacity
                         const capacity = (bunkCount * 2) + singleCount;
                         
                         // Determine room type based on capacity
                         let inferRoomType = 'double';
                         if (capacity === 1) inferRoomType = 'single';
                         else if (capacity === 3) inferRoomType = 'triple';
                         else if (capacity >= 4) inferRoomType = 'quad';
                         
                         const selectedType = formData.get('room_type') as string;

                         createRoomMutation.mutate({
                             building: currentBuilding.id,
                             floor: selectedFloorForRoom,
                             room_number: formData.get('room_number'),
                             room_type: selectedType || inferRoomType,
                             bed_type: bedType,
                             capacity: capacity,
                             bunk_count: bunkCount,
                             single_count: singleCount,
                             amenities: {}, 
                         });
                     }} className="space-y-4 py-4">
                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                  <Label>Room Number</Label>
                                  <Input name="room_number" placeholder="e.g. 101" required />
                             </div>
                             <div className="space-y-2">
                                  <Label>Room Type</Label>
                                  <Select name="room_type" defaultValue="">
                                      <SelectTrigger>
                                          <SelectValue placeholder="Auto (based on beds)" />
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
                         </div>
                         
                         <div className="p-4 bg-muted/30 rounded-lg space-y-4 border border-dashed border-primary/20">
                             <h4 className="font-medium text-sm flex items-center gap-2">
                                 <Bed className="h-4 w-4" /> Bed Configuration
                             </h4>
                             <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                      <Label className="text-xs">Bunk Beds (Double Tier)</Label>
                                      <Input name="bunk_count" type="number" min="0" defaultValue="0" placeholder="0" />
                                      <p className="text-[10px] text-muted-foreground">x2 capacity (e.g. 1 bunk = 2 beds)</p>
                                 </div>
                                 <div className="space-y-2">
                                      <Label className="text-xs">Single Beds</Label>
                                      <Input name="single_count" type="number" min="0" defaultValue="0" placeholder="0" />
                                      <p className="text-[10px] text-muted-foreground">x1 capacity</p>
                                 </div>
                             </div>
                         </div>
                         
                         <DialogFooter>
                             <Button type="submit" disabled={createRoomMutation.isPending}>
                                 {createRoomMutation.isPending ? 'Creating Room...' : 'Create Room & Generate Beds'}
                             </Button>
                         </DialogFooter>
                     </form>
                 </DialogContent>
            </Dialog>
            {/* Block (Building) Toggle Dialog */}
            <Dialog open={!!toggleBuildingTarget} onOpenChange={(open) => !open && setToggleBuildingTarget(null)}>
                <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">
                            {toggleBuildingTarget?.is_active ? 'Suspend Block' : 'Restore Block'}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {toggleBuildingTarget?.name} · {toggleBuildingTarget?.code}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-6 space-y-5">
                        <div className={`p-4 rounded-2xl border-2 ${toggleBuildingTarget?.is_active ? 'bg-red-50/50 border-red-100 shadow-sm' : 'bg-emerald-50/50 border-emerald-100 shadow-sm'}`}>
                            <p className="text-sm font-bold leading-relaxed">
                                {toggleBuildingTarget?.is_active 
                                    ? `Are you sure you want to suspend this block?` 
                                    : `Do you want to restore access to this block?`}
                            </p>
                            <p className="text-xs mt-2 font-medium opacity-80">
                                {toggleBuildingTarget?.is_active 
                                    ? `All ${toggleBuildingTarget.resident_count} residents will be locked out immediately.` 
                                    : `Residents in this block will be able to access the system again.`}
                            </p>
                        </div>

                        {toggleBuildingTarget?.is_active && (
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-black ml-1">Reason for Suspension</Label>
                                <Input 
                                    value={hostelToggleReason}
                                    onChange={(e) => setHostelToggleReason(e.target.value)}
                                    placeholder="e.g. Renovation, End of Semester..."
                                    className="rounded-xl border-2 focus-visible:ring-primary h-12"
                                />
                                <p className="text-[10px] text-muted-foreground italic px-1">This message will be shown to residents when they attempt to access their dashboard.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" className="rounded-full font-bold" onClick={() => setToggleBuildingTarget(null)}>Cancel</Button>
                        <Button
                            variant={toggleBuildingTarget?.is_active ? "destructive" : "default"}
                            disabled={toggleBuildingMutation.isPending}
                            className="rounded-full px-8 font-black shadow-lg"
                            onClick={() => {
                                if (toggleBuildingTarget) {
                                    toggleBuildingMutation.mutate({ 
                                        id: toggleBuildingTarget.id, 
                                        reason: hostelToggleReason 
                                    });
                                }
                            }}
                        >
                            {toggleBuildingMutation.isPending ? 'Processing...' : toggleBuildingTarget?.is_active ? 'SUSPEND BLOCK' : 'RESTORE BLOCK'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hostel Toggle Dialog */}
            <Dialog open={!!toggleHostelTarget} onOpenChange={(open) => !open && setToggleHostelTarget(null)}>
                <DialogContent className="max-w-md rounded-3xl border-orange-100">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black flex items-center gap-2">
                            <Home className="h-6 w-6 text-primary" />
                            {toggleHostelTarget?.is_active ? 'Suspend Hostel' : 'Restore Hostel'}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {toggleHostelTarget?.name} · {toggleHostelTarget?.block_count} Blocks Affected
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-6 space-y-5">
                        <div className={`p-4 rounded-2xl border-2 ${toggleHostelTarget?.is_active ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                            <p className="text-sm font-bold">
                                {toggleHostelTarget?.is_active 
                                    ? `This will lock out ALL blocks in "${toggleHostelTarget.name}".` 
                                    : `This will restore the hierarchy for "${toggleHostelTarget?.name}".`}
                            </p>
                        </div>

                        {toggleHostelTarget?.is_active && (
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black ml-1">Reason for Suspension</Label>
                                <Input 
                                    value={hostelToggleReason}
                                    onChange={(e) => setHostelToggleReason(e.target.value)}
                                    placeholder="e.g. Summer Break, Maintenance..."
                                    className="rounded-xl border-2 h-12"
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" className="rounded-full" onClick={() => setToggleHostelTarget(null)}>Cancel</Button>
                        <Button
                            variant={toggleHostelTarget?.is_active ? "destructive" : "default"}
                            disabled={toggleHostelMutation.isPending}
                            className="rounded-full px-8 shadow-md"
                            onClick={() => {
                                if (toggleHostelTarget) {
                                    toggleHostelMutation.mutate({ 
                                        id: toggleHostelTarget.id, 
                                        reason: hostelToggleReason 
                                    });
                                }
                            }}
                        >
                            {toggleHostelMutation.isPending ? 'Processing...' : toggleHostelTarget?.is_active ? 'SUSPEND HOSTEL' : 'RESTORE HOSTEL'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Hostel Dialog */}
            <Dialog open={createHostelOpen} onOpenChange={setCreateHostelOpen}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Create New Hostel</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Hostels group multiple blocks for easier management.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        createHostelMutation.mutate({
                            name: formData.get('name') as string,
                            college: typeof user?.college === 'object' ? user.college.id : 0
                        });
                    }} className="space-y-6 pt-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black ml-1">Hostel Name</Label>
                            <Input name="name" required placeholder="e.g. North Campus Hostel" className="rounded-xl border-2 h-12" />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setCreateHostelOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createHostelMutation.isPending} className="rounded-full px-8 shadow-lg">
                                {createHostelMutation.isPending ? 'Creating...' : 'CREATE HOSTEL'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Create Building (Block) Dialog */}
            <Dialog open={createBuildingOpen} onOpenChange={setCreateBuildingOpen}>
                <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Register New Block</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Add a physical block/building to a hostel.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        createBuildingMutation.mutate({
                            name: formData.get('name') as string,
                            code: formData.get('code') as string,
                            total_floors: Number(formData.get('floors')),
                            hostel: Number(formData.get('hostel'))
                        });
                    }} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black ml-1">Parent Hostel</Label>
                            <Select name="hostel" required>
                                <SelectTrigger className="rounded-xl border-2 h-12">
                                    <SelectValue placeholder="Select a Hostel" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {hostels?.map(h => (
                                        <SelectItem key={h.id} value={h.id.toString()}>
                                            {h.name} {h.is_active ? '' : '(Disabled)'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black ml-1">Block Name</Label>
                                <Input name="name" required placeholder="e.g. Block A" className="rounded-xl border-2 h-12" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black ml-1">Block Code</Label>
                                <Input name="code" required placeholder="e.g. BLA" className="rounded-xl border-2 h-12" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black ml-1">Total Floors</Label>
                            <Input name="floors" type="number" min="1" max="25" defaultValue="1" className="rounded-xl border-2 h-12" />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setCreateBuildingOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createBuildingMutation.isPending} className="rounded-full px-8 shadow-lg">
                                {createBuildingMutation.isPending ? 'Registering...' : 'REGISTER BLOCK'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Hostel Management List */}
            {canManage && hostels && hostels.length > 0 && (
                <div className="mt-12 bg-secondary/10 p-6 rounded-3xl border border-secondary/20">
                    <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                        <Home className="h-5 w-5 text-primary" /> Hostel Hierarchy Management
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {hostels.map(hostel => (
                            <div key={hostel.id} className="bg-card border rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                <div>
                                    <h4 className="font-bold">{hostel.name}</h4>
                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{hostel.block_count} Blocks Attached</p>
                                </div>
                                <Button 
                                    variant={hostel.is_active ? "outline" : "default"}
                                    size="sm"
                                    className="rounded-full text-[10px] font-black h-8"
                                    onClick={() => setToggleHostelTarget(hostel)}
                                >
                                    {hostel.is_active ? 'SUSPEND' : 'RESTORE'}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
