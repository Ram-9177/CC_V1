import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bed, User, Move, XCircle, Home, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

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
    const queryClient = useQueryClient();

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
        onError: (error: any) => {
            toast.error(error.response?.data?.detail || 'Failed to allocate');
        }
    });

    const deallocateMutation = useMutation({
        mutationFn: async ({ roomId, studentId }: { roomId: number, studentId: number }) => {
            return api.post(`/rooms/${roomId}/deallocate/`, { user_id: studentId });
        },
        onSuccess: () => {
            toast.success('Bed vacated successfully');
            queryClient.invalidateQueries({ queryKey: ['room-mapping'] });
            setSelectedBed(null);
        },
        onError: (error: any) => {
             toast.error(error.response?.data?.detail || 'Failed to vacate');
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
        onError: (error: any) => {
            toast.error(error.response?.data?.detail || 'Failed to move student');
        }
    });

    if (isLoading) return <div>Loading map...</div>;

    const currentBuilding = selectedBuilding 
        ? buildings?.find(b => b.id === selectedBuilding) 
        : buildings?.[0];

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
        if (!selectedRoom || !selectedBed?.occupant) return;
        if (confirm(`Vacate ${selectedBed.occupant.name}?`)) {
            deallocateMutation.mutate({
                roomId: selectedRoom.id,
                studentId: selectedBed.occupant.id
            });
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {floor.rooms.map(room => (
                                <div key={room.id} className="border p-3 rounded-lg bg-card shadow-sm">
                                    <div className="flex justify-between items-center mb-3 pb-2 border-b">
                                        <span className="font-bold text-lg">{room.room_number}</span>
                                        <div className="text-xs text-muted-foreground capitalize">
                                            {room.type} ({room.occupancy}/{room.capacity})
                                        </div>
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
                                        {/* Fallback for rooms without explicit beds (legacy compatibility) */}
                                        {room.beds.length === 0 && Array.from({ length: room.capacity }).map((_, i) => (
                                            <div key={i} className="p-2 rounded border text-center bg-muted/40 text-muted-foreground">
                                                 <Bed className="h-5 w-5 mx-auto mb-1" />
                                                 <span className="text-xs">No Bed Data</span>
                                            </div>
                                        ))}
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
                         {selectedBed?.is_occupied && selectedBed.occupant ? (
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
                                     <Button variant="destructive" onClick={handleVacate}>
                                         <XCircle className="w-4 h-4 mr-2" /> Vacate Bed
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
                             <Label>Student User ID</Label>
                             <Input 
                                placeholder="Enter User ID (e.g. 15)" 
                                value={targetStudentId}
                                onChange={e => setTargetStudentId(e.target.value)}
                             />
                             <p className="text-xs text-muted-foreground">Enter the database ID of the student user.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAllocate} disabled={allocateMutation.isPending}>
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
        </div>
    );
}
