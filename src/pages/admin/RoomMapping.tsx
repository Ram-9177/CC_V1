import { useState, useMemo, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bed, User as UserIcon, Move, XCircle, Home, CheckCircle, Plus, Trash2, Power, Edit } from 'lucide-react';
import type { User } from '@/types';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { isManagement } from '@/lib/rbac';
import { StudentSearch } from '@/components/common/StudentSearch';
import { DragDropContext, Droppable, Draggable, type DropResult, type DragStart } from '@hello-pangea/dnd';
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
    const [isDraggingStudent, setIsDraggingStudent] = useState(false);
    const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
    const [selectedBed, setSelectedBed] = useState<BedData | null>(null);
    const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
    const [targetStudentId, setTargetStudentId] = useState<string>('');
    const [moveStudentOpen, setMoveStudentOpen] = useState(false);
    const [targetBedId, setTargetBedId] = useState<string>('');
    const [createBuildingOpen, setCreateBuildingOpen] = useState(false);
    const [createHostelOpen, setCreateHostelOpen] = useState(false);
    const [createRoomOpen, setCreateRoomOpen] = useState(false);
    const [editRoomOpen, setEditRoomOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<RoomData | null>(null);
    const [editingRoomNumber, setEditingRoomNumber] = useState('');
    const [editingRoomType, setEditingRoomType] = useState('double');
    const [editingRoomCapacity, setEditingRoomCapacity] = useState(1);
    const [selectedFloorForRoom, setSelectedFloorForRoom] = useState<number | null>(null);
    const [confirmVacate, setConfirmVacate] = useState(false);
    const [hostelToggleReason, setHostelToggleReason] = useState('');
    const [toggleBuildingTarget, setToggleBuildingTarget] = useState<BuildingData | null>(null);

    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const canManage = isManagement(user?.role);

    // 1. Fetch Buildings Summary (for sidebar/tabs)
    const { data: buildingsSummary, isLoading: summaryLoading, isError: buildingsError } = useQuery<BuildingData[]>({
        queryKey: ['room-mapping', 'summary'],
        queryFn: async () => {
            const response = await api.get('/rooms/mapping/');
            return response.data;
        },
    });

    // 2. Fetch full detail for ONLY the selected building
    const { data: buildingDetail, isLoading: detailLoading, isError: detailError } = useQuery<BuildingData>({
        queryKey: ['room-mapping', 'detail', selectedBuilding || buildingsSummary?.[0]?.id],
        queryFn: async () => {
            const id = selectedBuilding || buildingsSummary?.[0]?.id;
            if (!id) return null as unknown as BuildingData;
            const response = await api.get(`/rooms/mapping/?building_id=${id}`);
            return response.data[0];
        },
        enabled: !!buildingsSummary && buildingsSummary.length > 0,
    });

    const { data: hostels, isLoading: hostelsLoading, isError: hostelsError } = useQuery<HostelData[]>({
        queryKey: ['hostels'],
        queryFn: async () => {
            const response = await api.get('/rooms/hostels/');
            return response.data;
        },
    });

    const { data: unassignedStudents, isLoading: unassignedLoading } = useQuery<Occupant[]>({
        queryKey: ['users', 'unassigned'],
        queryFn: async () => {
             const response = await api.get('/auth/users/?unassigned=true');
             // Handle both paginated and non-paginated responses
             return Array.isArray(response.data) ? response.data : (response.data.results || []);
        },
        enabled: canManage,
    });

    const isLoading = summaryLoading || hostelsLoading;
    const isError = buildingsError || hostelsError || detailError;

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


    const deleteRoomMutation = useMutation({
        mutationFn: async (roomId: number) => {
            return api.delete(`/rooms/${roomId}/`);
        },
        onSuccess: () => {
             toast.success('Room deleted successfully');
             queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
             queryClient.invalidateQueries({ queryKey: ['rooms'] });
        },
        onError: (error: unknown) => {
             toast.error(getApiErrorMessage(error, 'Failed to delete room'));
        }
    });

    const updateRoomMutation = useMutation({
        mutationFn: async ({ roomId, data }: { roomId: number; data: { room_number: string; room_type: string; capacity: number } }) => {
            return api.patch(`/rooms/${roomId}/`, data);
        },
        onSuccess: () => {
            toast.success('Room updated successfully');
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            setEditRoomOpen(false);
            setEditingRoom(null);
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to update room'));
        }
    });

    const addBedMutation = useMutation({
        mutationFn: async (room: RoomData) => {
            const nextCapacity = room.capacity + 1;
            await api.patch(`/rooms/${room.id}/`, { capacity: nextCapacity });
            await api.post(`/rooms/${room.id}/generate_beds/`);
        },
        onSuccess: () => {
            toast.success('Bed added successfully');
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to add bed'));
        }
    });

    const removeBedMutation = useMutation({
        mutationFn: async ({ room, bed }: { room: RoomData; bed: BedData }) => {
            if (bed.is_occupied) {
                throw new Error('Cannot remove an occupied bed. Vacate the student first.');
            }
            const nextCapacity = Math.max(room.occupancy, room.capacity - 1);
            await api.delete(`/rooms/beds/${bed.id}/`);
            if (nextCapacity !== room.capacity) {
                await api.patch(`/rooms/${room.id}/`, { capacity: nextCapacity });
            }
        },
        onSuccess: () => {
            toast.success('Bed removed successfully');
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
        },
        onError: (error: unknown) => {
            if (error instanceof Error) {
                toast.error(error.message);
                return;
            }
            toast.error(getApiErrorMessage(error, 'Failed to remove bed'));
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

    const currentBuilding = buildingDetail;

    const availableBedOptions = useMemo(() => {
        if (!buildingDetail) return [];
        const options: Array<{ id: number; label: string }> = [];
        for (const floor of buildingDetail.floors) {
            for (const room of floor.rooms) {
                for (const bed of room.beds) {
                    if (bed.is_occupied) continue;
                    options.push({
                        id: bed.id,
                        label: `${buildingDetail.name} - ${room.room_number} - Bed ${bed.bed_number}`
                    });
                }
            }
        }
        return options;
    }, [buildingDetail]);

    if (isLoading) {
        return <BrandedLoading fullScreen title="Loading Campus Map" message="Synchronizing physical layout and resident data..." />;
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="p-4 bg-destructive/10 rounded-sm">
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
        if (currentBuilding && (!currentBuilding.is_active || !currentBuilding.hostel_is_active)) {
             toast.error('This block is currently disabled for maintenance.');
             return;
        }
        setSelectedRoom(room);
        setSelectedBed(bed);
    };

    const handleAllocate = () => {
        if (!selectedRoom || !selectedBed || !targetStudentId) return;
        allocateMutation.mutate({
            roomId: selectedRoom.id,
            bedId: selectedBed.id,
            studentId: parseInt(targetStudentId)
        });
    };

    const handleVacate = () => {
        if (!selectedRoom || !selectedBed?.occupant) return;
        deallocateMutation.mutate({
            roomId: selectedRoom.id,
            studentId: selectedBed.occupant.id
        });
    };

    const openRoomEditDialog = (room: RoomData) => {
        setEditingRoom(room);
        setEditingRoomNumber(room.room_number);
        setEditingRoomType(room.type || 'double');
        setEditingRoomCapacity(Math.max(room.capacity, room.occupancy));
        setEditRoomOpen(true);
    };

    const handleRoomUpdate = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingRoom) return;
        const safeCapacity = Math.max(editingRoom.occupancy, editingRoomCapacity);
        updateRoomMutation.mutate({
            roomId: editingRoom.id,
            data: {
                room_number: editingRoomNumber.trim(),
                room_type: editingRoomType,
                capacity: safeCapacity,
            },
        });
    };

    const handleDragStart = (start: DragStart) => {
        if (start.source.droppableId === 'unassigned-list') {
            setIsDraggingStudent(true);
        }
    };

    const handleDragEnd = (result: DropResult) => {
        setIsDraggingStudent(false);
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === 'unassigned-list' && destination.droppableId.startsWith('bed-')) {
            const bedId = parseInt(destination.droppableId.replace('bed-', ''));
            const studentId = parseInt(draggableId);
            let roomId = 0;
            if (buildingDetail) {
                for (const floor of buildingDetail.floors) {
                    for (const room of floor.rooms) {
                        if (room.beds.some(b => b.id === bedId)) {
                             roomId = room.id;
                             break;
                        }
                    }
                    if (roomId) break;
                }
            }
            if (roomId) {
                allocateMutation.mutate({ roomId, bedId, studentId });
            }
        }
    };

    return (
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="container mx-auto px-4 py-6 space-y-6 scroll-smooth animate-in fade-in duration-500 pb-40">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Room Mapping</h1>
                    <div className="flex gap-2">
                        {buildingsSummary?.map(b => (
                            <div key={b.id} className="relative flex items-center">
                                <Button 
                                    variant={(selectedBuilding === b.id || (!selectedBuilding && b.id === buildingsSummary[0].id)) ? 'default' : 'outline'}
                                    onClick={() => setSelectedBuilding(b.id)}
                                >
                                    <Home className="mr-2 h-4 w-4"/> {b.name}
                                    {!b.is_active && (
                                        <span className="ml-2 w-2 h-2 rounded-sm bg-red-500 animate-pulse ring-2 ring-red-200" title="Block Offline" />
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

                {currentBuilding && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-sm bg-gradient-to-br from-card to-muted/30 border shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-sm ${currentBuilding.is_active ? 'bg-primary/10' : 'bg-red-50 ring-1 ring-red-100'}`}>
                                <Home className={`h-6 w-6 ${currentBuilding.is_active ? 'text-primary' : 'text-red-500'}`} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold">{currentBuilding.name}</h2>
                                    <span className="text-[10px] text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded uppercase font-bold tracking-tight">
                                        {currentBuilding.hostel_name || 'No Hostel'}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-wider ${
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
                                    <div className="flex items-center gap-1 bg-white/50 p-1 rounded-sm border border-white/50">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="rounded-sm text-[9px] font-black uppercase px-3 h-7"
                                            onClick={() => bulkFloorActionMutation.mutate({ blockId: currentBuilding.id, action: 'disable_all' })}
                                            disabled={bulkFloorActionMutation.isPending}
                                        >
                                            Disable All Floors
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="rounded-sm text-[9px] font-black uppercase px-3 h-7 bg-white shadow-sm"
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
                                    className="rounded-sm px-4"
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

                {detailLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <BrandedLoading title="Loading Building Layout..." message="Crunching room data" />
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in">
                        {currentBuilding?.floors.map(floor => {
                        const isFloorDisabled = !currentBuilding.hostel_is_active || !currentBuilding.is_active || currentBuilding.disabled_floors?.includes(floor.floor_number);
                        const buildingDisabled = !currentBuilding.hostel_is_active || !currentBuilding.is_active;
                        return (
                            <div key={floor.floor_number} className={`border rounded-sm p-4 transition-all duration-300 ${
                                isFloorDisabled 
                                    ? 'bg-red-50/40 border-red-200 shadow-inner' 
                                    : 'bg-muted/20 border-border'
                            } ${buildingDisabled ? 'grayscale-[50%] opacity-80' : ''}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-semibold flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-sm text-sm font-bold shadow-sm ${
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
                                            className={`h-8 rounded-sm shadow-sm hover:scale-105 active:scale-95 transition-all text-[11px] font-bold ${
                                                isFloorDisabled 
                                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' 
                                                    : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                                            }`}
                                            onClick={() => toggleFloorMutation.mutate({ blockId: currentBuilding.id, floorNum: floor.floor_number })}
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
                                        <div key={room.id} className={`border p-3 rounded bg-card shadow-sm transition-opacity ${isFloorDisabled ? 'opacity-50 pointer-events-none grayscale-[50%]' : ''}`}>
                                            <div className="flex justify-between items-center mb-3 pb-2 border-b">
                                                <div>
                                                    <span className="font-bold text-lg mr-2">{room.room_number}</span>
                                                    <span className="text-xs text-muted-foreground capitalize bg-secondary px-2 py-0.5 rounded-sm">
                                                        {room.type} ({room.occupancy}/{room.capacity})
                                                    </span>
                                                </div>
                                                {canManage && (
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary" onClick={() => openRoomEditDialog(room)} title="Edit Room">
                                                            <Edit className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive" onClick={() => confirmDeleteRoom(room)} title="Delete Room">
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            {canManage && (
                                                <div className="mb-3 flex justify-end">
                                                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => addBedMutation.mutate(room)} disabled={addBedMutation.isPending}>
                                                        <Plus className="h-3 w-3 mr-1" /> Add Bed
                                                    </Button>
                                                </div>
                                            )}
                                            <div className="flex flex-wrap items-center justify-center gap-2">
                                                {room.beds.map(bed => (
                                                    <Droppable key={bed.id} droppableId={`bed-${bed.id}`} isDropDisabled={bed.is_occupied}>
                                                        {(provided, snapshot) => (
                                                            <div 
                                                                ref={provided.innerRef}
                                                                {...provided.droppableProps}
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
                                                                    group relative cursor-pointer p-2 rounded border text-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-ring w-[calc(50%-0.25rem)] sm:w-24
                                                                    ${bed.is_occupied 
                                                                        ? 'bg-primary/10 border-primary/20 text-primary' 
                                                                        : 'bg-accent/10 border-accent/20 text-accent-foreground hover:bg-accent/30'}
                                                                    ${snapshot.isDraggingOver 
                                                                        ? 'ring-4 ring-primary ring-offset-0 scale-110 z-50 bg-white border-primary border-2 shadow-2xl shadow-primary/20 animate-in fade-in zoom-in duration-200' 
                                                                        : !bed.is_occupied && isDraggingStudent 
                                                                            ? 'border-2 border-primary/40 bg-primary/10 animate-pulse scale-105 shadow-md shadow-primary/5 z-30' 
                                                                            : ''}
                                                                `}
                                                            >
                                                                {provided.placeholder}
                                                                {canManage && !bed.is_occupied && (
                                                                    <button
                                                                        type="button"
                                                                        className="absolute right-1 top-1 z-30 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (confirm(`Remove Bed ${bed.bed_number} from Room ${room.room_number}?`)) {
                                                                                removeBedMutation.mutate({ room, bed });
                                                                            }
                                                                        }}
                                                                        title="Remove Bed"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </button>
                                                                )}
                                                                {bed.occupant ? (
                                                                    <div className="pointer-events-none absolute left-1/2 top-0 z-20 w-64 -translate-x-1/2 -translate-y-3 rounded-sm border bg-popover p-3 text-left text-popover-foreground opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus:opacity-100">
                                                                        <div className="text-sm font-bold leading-tight">{bed.occupant.name}</div>
                                                                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                                                            <div>ID / Roll: <span className="font-semibold text-foreground">{(bed.occupant.hall_ticket || bed.occupant.registration_number || bed.occupant.reg_no || '').toUpperCase()}</span></div>
                                                                            <div>College: <span className="font-semibold text-foreground">{bed.occupant.college_name || bed.occupant.college_code || '—'}</span></div>
                                                                            <div>Student Mobile: <span className="font-semibold text-foreground">{bed.occupant.phone || bed.occupant.phone_number || '—'}</span></div>
                                                                            <div>Parents: <span className="font-semibold text-foreground">{bed.occupant.father_phone || '—'}{bed.occupant.mother_phone ? ` / ${bed.occupant.mother_phone}` : ''}</span></div>
                                                                        </div>
                                                                    </div>
                                                                ) : null}
                                                                <Bed className="h-5 w-5 mx-auto mb-1" />
                                                                <div className="text-xs font-medium">Bed {bed.bed_number}</div>
                                                                {bed.occupant && <div className="text-[10px] truncate w-full mt-1 font-semibold">{bed.occupant.name.split(' ')[0]}</div>}
                                                            </div>
                                                        )}
                                                    </Droppable>
                                                ))}
                                                {room.beds.length === 0 && Array.from({ length: room.capacity }).map((_, i) => (
                                                    <div key={i} className="p-2 rounded border text-center bg-muted/40 text-muted-foreground">
                                                        <Plus className="h-4 w-4 mx-auto opacity-20" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )})}
                    </div>
                )}
            </div>

            {/* Allocate / Move Modals */}
            <Dialog open={!!selectedBed} onOpenChange={(open) => !open && setSelectedBed(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedBed?.is_occupied ? (
                                <><UserIcon className="h-5 w-5 text-primary" /> Allocation Details</>
                            ) : (
                                <><Bed className="h-5 w-5 text-primary" /> Bed Allocation</>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedBed && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 rounded-sm bg-muted/50 border">
                                <div className="h-12 w-12 rounded bg-background flex items-center justify-center text-primary border shadow-sm">
                                    <Home className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="text-xl font-bold">Room {selectedRoom?.room_number}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {currentBuilding?.name} • Bed {selectedBed.bed_number}
                                    </div>
                                </div>
                            </div>

                            {selectedBed.is_occupied ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button variant="outline" className="w-full h-12" onClick={() => setMoveStudentOpen(true)}>
                                            <Move className="mr-2 h-4 w-4" /> Move Student
                                        </Button>
                                        <Button variant="destructive" className="w-full h-12" onClick={() => setConfirmVacate(true)}>
                                            <XCircle className="mr-2 h-4 w-4" /> Vacate Bed
                                        </Button>
                                    </div>
                                    <Button variant="secondary" className="w-full" onClick={() => syncInventoryMutation.mutate(selectedRoom!.id)}>
                                        <Move className="mr-2 h-4 w-4" /> Sync Inventory
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Select Student to Allocate</Label>
                                        <StudentSearch 
                                            onSelect={(userId) => setTargetStudentId(userId)}
                                            placeholder="Search by Name or Registration Number..."
                                        />
                                    </div>
                                    <Button 
                                        className="w-full h-12 font-bold" 
                                        onClick={handleAllocate}
                                        disabled={!targetStudentId || allocateMutation.isPending}
                                    >
                                        {allocateMutation.isPending ? 'Allocating...' : 'Complete Allocation'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Move Student Dialog */}
            <Dialog open={moveStudentOpen} onOpenChange={setMoveStudentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move {selectedBed?.occupant?.name}</DialogTitle>
                        <DialogDescription>Select a target bed from the available options in this block.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Target Bed</Label>
                            <Select value={targetBedId} onValueChange={setTargetBedId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Search for available beds..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableBedOptions.map(opt => (
                                        <SelectItem key={opt.id} value={opt.id.toString()}>{opt.label}</SelectItem>
                                    ))}
                                    {availableBedOptions.length === 0 && <div className="p-2 text-center text-xs text-muted-foreground">No available beds found.</div>}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMoveStudentOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={() => {
                                if (selectedBed?.occupant?.id && targetBedId) {
                                    moveMutation.mutate({ studentId: selectedBed.occupant.id, targetBedId: parseInt(targetBedId) });
                                }
                            }}
                            disabled={!targetBedId || moveMutation.isPending}
                        >
                            Confirm Move
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Vacate Confirmation */}
            <Dialog open={confirmVacate} onOpenChange={setConfirmVacate}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Vacation</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to vacate <strong>{selectedBed?.occupant?.name}</strong> from <strong>Room {selectedRoom?.room_number}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setConfirmVacate(false)}>No, Keep</Button>
                        <Button variant="destructive" onClick={handleVacate} disabled={deallocateMutation.isPending}>Yes, Vacate Bed</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Hostel Dialog */}
            <Dialog open={createHostelOpen} onOpenChange={setCreateHostelOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Hostel</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        createHostelMutation.mutate({
                            name: formData.get('name') as string,
                            college: parseInt(formData.get('college') as string),
                        });
                    }} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Hostel Name</Label>
                            <Input id="name" name="name" placeholder="e.g. Boys Hostel Main" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="college">Institutional College</Label>
                            <Select name="college" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select institution" />
                                </SelectTrigger>
                                <SelectContent>
                                    {user?.role === 'super_admin' ? (
                                        hostels?.map(h => <SelectItem key={h.id} value={h.college.toString()}>{h.college_name}</SelectItem>)
                                    ) : (
                                        <SelectItem value={(user as User & { college_id?: number })?.college_id?.toString() || '1'}>Current Institution</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateHostelOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createHostelMutation.isPending}>Create Hostel</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Create Building Dialog */}
            <Dialog open={createBuildingOpen} onOpenChange={setCreateBuildingOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Block/Building</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        createBuildingMutation.mutate({
                            name: fd.get('name') as string,
                            code: fd.get('code') as string,
                            total_floors: parseInt(fd.get('floors') as string),
                            hostel: parseInt(fd.get('hostel') as string),
                        });
                    }} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Parent Hostel</Label>
                            <Select name="hostel" required>
                                <SelectTrigger><SelectValue placeholder="Select Hostel" /></SelectTrigger>
                                <SelectContent>
                                    {hostels?.map(h => <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Block Name</Label>
                                <Input name="name" placeholder="Block A" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Short Code</Label>
                                <Input name="code" placeholder="BA" required />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Total Floors</Label>
                            <Input name="floors" type="number" min="1" max="10" defaultValue="4" required />
                        </div>
                        <DialogFooter>
                             <Button type="submit" disabled={createBuildingMutation.isPending}>Save Block</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Create Room Dialog */}
            <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add Room to Floor {selectedFloorForRoom}</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!currentBuilding || selectedFloorForRoom === null) return;
                        const fd = new FormData(e.currentTarget);
                        createRoomMutation.mutate({
                            building: currentBuilding.id,
                            floor_number: selectedFloorForRoom,
                            room_number: fd.get('room_number'),
                            room_type: fd.get('type'),
                            capacity: parseInt(fd.get('capacity') as string),
                        });
                    }} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Room Number</Label>
                            <Input name="room_number" placeholder="101" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select name="type" defaultValue="double">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                                <Label>Bed Capacity</Label>
                                <Input name="capacity" type="number" min="1" defaultValue="2" required />
                            </div>
                        </div>
                        <DialogFooter>
                             <Button type="submit" disabled={createRoomMutation.isPending}>Create Room</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Room Dialog */}
            <Dialog open={editRoomOpen} onOpenChange={setEditRoomOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Room {editingRoom?.room_number}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleRoomUpdate} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Room Number</Label>
                            <Input value={editingRoomNumber} onChange={(e) => setEditingRoomNumber(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Room Type</Label>
                            <Select value={editingRoomType} onValueChange={setEditingRoomType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
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
                            <Label>Bed Capacity (Allocated: {editingRoom?.occupancy})</Label>
                            <Input type="number" value={editingRoomCapacity} onChange={(e) => setEditingRoomCapacity(parseInt(e.target.value))} min={editingRoom?.occupancy || 1} required />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditRoomOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={updateRoomMutation.isPending}>Update Room</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Toggle Building/Block Dialog */}
            <Dialog open={!!toggleBuildingTarget} onOpenChange={(open) => !open && setToggleBuildingTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{toggleBuildingTarget?.is_active ? 'Disable Block' : 'Enable Block'}</DialogTitle>
                        <DialogDescription>
                            This will prevent students from being allocated to any room in this block. Existing students will remain.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Reason for status change</Label>
                            <Input placeholder="e.g. Annual Maintenance, Painting..." value={hostelToggleReason} onChange={(e) => setHostelToggleReason(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setToggleBuildingTarget(null)}>Cancel</Button>
                        <Button 
                            variant={toggleBuildingTarget?.is_active ? "destructive" : "default"}
                            onClick={() => toggleBuildingMutation.mutate({ id: toggleBuildingTarget!.id, reason: hostelToggleReason })}
                            disabled={toggleBuildingMutation.isPending}
                        >
                            Confirm Update
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Floating Unassigned Students Sidebar */}
            {canManage && (
                <div className="fixed bottom-0 left-0 right-0 min-h-24 py-3 bg-white/95 backdrop-blur-xl border-t shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[100] animate-in slide-in-from-bottom duration-500 overflow-visible">
                    <div className="container mx-auto px-4 h-full flex flex-col justify-center">
                        <div className="flex items-center gap-4">
                            <div className="whitespace-nowrap px-4 border-r flex flex-col items-center justify-center">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Unassigned</h4>
                                <p className="text-2xl font-black text-primary leading-tight">{unassignedStudents?.length || 0}</p>
                            </div>
                            <Droppable droppableId="unassigned-list" direction="horizontal">
                                {(provided, snapshot) => (
                                    <div 
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex-1 flex gap-3 overflow-x-auto pb-2 scrollbar-none px-2 rounded-sm transition-all ${
                                            snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/20 ring-inset' : ''
                                        }`}
                                    >
                                        {unassignedLoading ? (
                                            <div className="flex items-center gap-2 animate-pulse py-4">
                                                {[1,2,3].map(i => <div key={i} className="h-10 w-32 bg-muted rounded-sm" />)}
                                            </div>
                                        ) : unassignedStudents?.length === 0 ? (
                                            <div className="flex items-center justify-center gap-3 text-muted-foreground py-4 italic text-xs w-full bg-emerald-50/50 rounded border border-emerald-100/50">
                                                <CheckCircle className="h-5 w-5 text-emerald-500" /> 
                                                <span className="font-bold uppercase tracking-widest text-emerald-700/80">All students allocated</span>
                                            </div>
                                        ) : (
                                            unassignedStudents?.map((student, index) => (
                                                <Draggable key={student.id} draggableId={student.id.toString()} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`
                                                                flex-shrink-0 flex items-center gap-3 p-3 bg-white border rounded-sm shadow-sm hover:shadow-md transition-all h-16 w-56
                                                                ${snapshot.isDragging ? 'rotate-3 scale-110 z-[60] shadow-2xl border-primary ring-2 ring-primary/20' : ''}
                                                            `}
                                                        >
                                                            <div className="h-10 w-10 rounded-sm bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                                {student.name.charAt(0)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-bold truncate leading-tight">{student.name}</div>
                                                                <div className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">{student.registration_number || student.reg_no}</div>
                                                            </div>
                                                            <Move className="h-4 w-4 text-muted-foreground/30" />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    </div>
                </div>
            )}
        </DragDropContext>
    );
}
