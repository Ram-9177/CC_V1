import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bed, User, Move, XCircle, Home, CheckCircle, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { StudentSearch } from '@/components/common/StudentSearch';

interface Occupant {
    id: number;
    name: string;
    reg_no: string;
    hall_ticket?: string;
    phone_number?: string;
    college_code?: string | null;
    college_name?: string | null;
    father_phone?: string;
    mother_phone?: string;
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

interface BuildingData {
    id: number;
    name: string;
    code: string;
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
    const [createRoomOpen, setCreateRoomOpen] = useState(false);
    const [selectedFloorForRoom, setSelectedFloorForRoom] = useState<number | null>(null);
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const canManage = ['admin', 'super_admin', 'warden', 'head_warden'].includes(user?.role || '');

    const { data: buildings, isLoading } = useQuery<BuildingData[]>({
        queryKey: ['room-mapping'],
        queryFn: async () => {
            const response = await api.get('/rooms/mapping/');
            return response.data;
        },
    });

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

    const deallocateMutation = useMutation({
        mutationFn: async ({ roomId, studentId }: { roomId: number, studentId: number }) => {
            console.log(`API Call: POST /rooms/${roomId}/deallocate/ with user_id: ${studentId}`);
            return api.post(`/rooms/${roomId}/deallocate/`, { user_id: Number(studentId) });
        },
        onSuccess: () => {
            toast.success('Bed vacated successfully');
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            setSelectedBed(null);
            console.log('Vacate successful, queries invalidated');
        },
        onError: (error: unknown) => {
             console.error('Vacate Mutation Error:', error);
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
        mutationFn: async (data: { name: string; code: string; total_floors: number }) => {
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

    if (isLoading) return <div>Loading map...</div>;

    const currentBuilding = selectedBuilding 
        ? buildings?.find(b => b.id === selectedBuilding) 
        : buildings?.[0];

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
        console.log('Vacate initiated:', { 
            roomId: selectedRoom?.id, 
            studentId: selectedBed?.occupant?.id,
            roomNumber: selectedRoom?.room_number 
        });
        
        if (!selectedRoom || !selectedBed?.occupant) {
            console.error('Vacate failed: Missing room or occupant data');
            return;
        }

        // Using native confirm for now, but adding explicit logging
        if (window.confirm(`Are you sure you want to vacate ${selectedBed.occupant.name} from Room ${selectedRoom.room_number}?`)) {
            console.log('Vacate confirmed by user. Mutating...');
            deallocateMutation.mutate({
                roomId: selectedRoom.id,
                studentId: selectedBed.occupant.id
            });
        } else {
            console.log('Vacate cancelled by user');
        }
    };

    const availableBedOptions = (() => {
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
    })();

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Room Mapping</h1>
                <div className="flex gap-2">
                    {buildings?.map(b => (
                        <Button 
                            key={b.id} 
                            variant={currentBuilding?.id === b.id ? 'default' : 'outline'}
                            onClick={() => setSelectedBuilding(b.id)}
                        >
                            <Home className="mr-2 h-4 w-4"/> {b.name}
                        </Button>
                    ))}
                    {canManage && (
                        <Button variant="ghost" onClick={() => setCreateBuildingOpen(true)}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Map Area */}
            <div className="space-y-8">
                {currentBuilding?.floors.map(floor => (
                    <div key={floor.floor_number} className="border rounded-xl p-4 bg-muted/20">
                        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                                Floor {floor.floor_number}
                            </span>
                        </h3>
                        {/* Floor Actions */}
                        {canManage && (
                            <div className="flex justify-end mb-2">
                                <Button size="sm" variant="ghost" onClick={() => {
                                    setSelectedFloorForRoom(floor.floor_number);
                                    setCreateRoomOpen(true);
                                }}>
                                    <Plus className="h-3 w-3 mr-1" /> Add Room
                                </Button>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {floor.rooms.map(room => (
                                <div key={room.id} className="border p-3 rounded-lg bg-card shadow-sm">
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
                                                                Hall Ticket:{' '}
                                                                <span className="font-semibold text-foreground">
                                                                    {(bed.occupant.hall_ticket || bed.occupant.reg_no || '').toUpperCase()}
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
                                                                    {bed.occupant.phone_number || '—'}
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
                                                                                    {/* Add Bed Button if under capacity */}
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
                ))}
            </div>

            {/* Bed Details Dialog */}
            <Dialog open={!!selectedBed} onOpenChange={(open) => !open && setSelectedBed(null)}>
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
                                         <p className="text-muted-foreground">
                                            {(selectedBed.occupant.hall_ticket || selectedBed.occupant.reg_no || '').toUpperCase()}
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
                                                {selectedBed.occupant.phone_number || '—'}
                                             </span>
                                         </div>
                                         <div className="flex items-center justify-between gap-4">
                                             <span className="text-muted-foreground">Parent Mobile</span>
                                             <span className="font-semibold text-right">
                                                {selectedBed.occupant.father_phone && <div>F: {selectedBed.occupant.father_phone}</div>}
                                                {selectedBed.occupant.mother_phone && <div>M: {selectedBed.occupant.mother_phone}</div>}
                                                {selectedBed.occupant.guardian_phone && <div>G: {selectedBed.occupant.guardian_phone}</div>}
                                                {!selectedBed.occupant.father_phone && !selectedBed.occupant.mother_phone && !selectedBed.occupant.guardian_phone && '—'}
                                             </span>
                                         </div>
                                     </div>
                                     <div className="flex gap-2 justify-center pt-4">
                                         <Button 
                                             variant="destructive" 
                                             onClick={handleVacate} 
                                             disabled={deallocateMutation.isPending}
                                         >
                                             {deallocateMutation.isPending ? (
                                                 <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Vacating...</>
                                             ) : (
                                                 <><XCircle className="w-4 h-4 mr-2" /> Vacate Bed</>
                                             )}
                                         </Button>
                                         <Button
                                            variant="outline"
                                            onClick={() => setMoveStudentOpen(true)}
                                         >
                                             <Move className="w-4 h-4 mr-2" /> Move Student
                                         </Button>
                                     </div>
                                 </div>
                             ) : (
                                 <div className="text-center space-y-4 py-8">
                                     <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-500">
                                         <XCircle className="h-8 w-8" />
                                     </div>
                                     <p className="text-sm font-medium">Record Locked or Missing</p>
                                     <p className="text-xs text-muted-foreground px-8">The bed is marked as occupied but the student record is unavailable. Please refresh or contact support.</p>
                                     <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['room-mapping'] })}>
                                         Refresh Map
                                     </Button>
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

            {/* Create Building Dialog */}
            <Dialog open={createBuildingOpen} onOpenChange={setCreateBuildingOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Block</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        createBuildingMutation.mutate({
                            name: formData.get('name') as string,
                            code: formData.get('code') as string,
                            total_floors: Number(formData.get('total_floors')),
                        });
                    }} className="space-y-4 py-4">
                        <div className="space-y-2">
                             <Label>Block Name</Label>
                             <Input name="name" placeholder="e.g. Block A" required />
                        </div>
                        <div className="space-y-2">
                             <Label>Block Code</Label>
                             <Input name="code" placeholder="e.g. A" required />
                        </div>
                        <div className="space-y-2">
                             <Label>Total Floors</Label>
                             <Input name="total_floors" type="number" defaultValue="1" min="1" required />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={createBuildingMutation.isPending}>
                                {createBuildingMutation.isPending ? 'Creating...' : 'Create Block'}
                            </Button>
                        </DialogFooter>
                    </form>
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
        </div>
    );
}
