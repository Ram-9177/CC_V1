import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { listRooms, upsertRoom, assignUserToRoom, unassignUserFromRoom, bulkAssignRoomsFromCsvText, exportRoomOccupantsCsv, RoomWithOccupants } from '../../../lib/rooms';
import { toast } from 'sonner';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { useSocketEvent } from '../../../lib/socket';
import { exportAllRoomsCsv, exportAllOccupantsCsv } from '../../../lib/rooms';
import { Checkbox } from '../../ui/checkbox';

export function RoomsManagement() {
  const [rooms, setRooms] = useState<RoomWithOccupants[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [blockFilter, setBlockFilter] = useState<string | undefined>();
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Upsert form
  const [block, setBlock] = useState('');
  const [number, setNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [capacity, setCapacity] = useState<number>(4);

  // Assign form
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedRoomOccupants, setSelectedRoomOccupants] = useState<Array<{ id: string; hallticket: string; firstName?: string; lastName?: string; bedLabel?: string }>>([]);
  const [hallticket, setHallticket] = useState('');
  const [bedLabel, setBedLabel] = useState<string>('');
  // Move dialog state
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetRoomId, setMoveTargetRoomId] = useState('');
  const [moveTargetBed, setMoveTargetBed] = useState('');
  const [movingHallticket, setMovingHallticket] = useState('');

  const blocks = useMemo(() => Array.from(new Set(rooms.map(r => r.block))).sort(), [rooms]);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listRooms({ search, block: blockFilter });
      setRooms(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh on room events
  useSocketEvent('room:upserted', () => refresh(), !!selectedRoomId || true);
  useSocketEvent('room:assigned', () => refresh(), !!selectedRoomId || true);
  useSocketEvent('room:unassigned', () => refresh(), !!selectedRoomId || true);
  useSocketEvent('room:bulkAssigned', () => refresh(), !!selectedRoomId || true);

  // Load occupants for selected room (simple fetch via list + filter: in real API, call GET /rooms/:id)
  useEffect(() => {
    const room = rooms.find(r => r.id === selectedRoomId);
    if (!room) {
      setSelectedRoomOccupants([]);
      return;
    }
    // Best-effort: fetch room details from API directly for occupants
    (async () => {
      try {
        const res = await fetch(new URL(`/rooms/${selectedRoomId}`, (import.meta as any)?.env?.VITE_API_URL || '').toString(), {
          headers: { ...(localStorage.getItem('authToken') ? { Authorization: `Bearer ${localStorage.getItem('authToken')}` } : {}) },
        });
        if (res.ok) {
          const data = await res.json();
          setSelectedRoomOccupants((data?.occupants || []).map((u: any) => ({ id: u.id, hallticket: u.hallticket, firstName: u.firstName, lastName: u.lastName, bedLabel: u.bedLabel })));
        } else {
          setSelectedRoomOccupants([]);
        }
      } catch {
        setSelectedRoomOccupants([]);
      }
    })();
  }, [selectedRoomId, rooms]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Rooms Management</h1>
        <p className="text-muted-foreground">Create rooms, view occupancy, and assign students to beds.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
              <CardTitle>Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input placeholder="Search block or number" value={search} onChange={e => setSearch(e.target.value)} />
              <Select value={blockFilter || ''} onValueChange={(v: string) => setBlockFilter(v || undefined)}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Blocks" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Blocks</SelectItem>
                  {blocks.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={refresh} disabled={loading}>Filter</Button>
              <div className="flex items-center gap-2 pl-2">
                <Checkbox id="only-available" checked={onlyAvailable} onCheckedChange={(v: any) => setOnlyAvailable(!!v)} />
                <label htmlFor="only-available" className="text-sm">Only Available</label>
              </div>
              <Button variant="outline" onClick={async () => {
                try {
                  const blob = await exportAllRoomsCsv();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'rooms-occupancy.csv'; a.click();
                  URL.revokeObjectURL(url);
                } catch (err: any) {
                  toast.error(err.message || 'Export failed');
                }
              }}>Export All Rooms</Button>
              <Button variant="outline" onClick={async () => {
                try {
                  const blob = await exportAllOccupantsCsv();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'rooms-occupants.csv'; a.click();
                  URL.revokeObjectURL(url);
                } catch (err: any) {
                  toast.error(err.message || 'Export failed');
                }
              }}>Export All Occupants</Button>
              {selectedRoomId && (
                <Button variant="outline" onClick={async () => {
                  try {
                    const blob = await exportRoomOccupantsCsv(selectedRoomId);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'room-occupants.csv'; a.click();
                    URL.revokeObjectURL(url);
                  } catch (err: any) {
                    toast.error(err.message || 'Export failed');
                  }
                }}>Export Occupants</Button>
              )}
            </div>

            <div className="grid gap-2">
              {rooms
                .filter(r => !onlyAvailable || ((r.capacity || 4) - (r.occupants ?? 0) > 0))
                .sort((a, b) => {
                  if (!onlyAvailable) return 0;
                  const avA = (a.capacity || 4) - (a.occupants ?? 0);
                  const avB = (b.capacity || 4) - (b.occupants ?? 0);
                  return avB - avA;
                })
                .map(r => {
                const occ = r.occupants ?? 0;
                const cap = r.capacity || 4;
                const pct = cap ? (occ / cap) : 0;
                const color = pct >= 0.95 ? 'bg-red-600 text-white' : pct >= 0.75 ? 'bg-yellow-500 text-black' : 'bg-green-600 text-white';
                return (
                  <div key={r.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Badge>{r.block}</Badge>
                      <div>
                        <div className="font-medium flex items-center gap-2">Room {r.number}
                          <span className={`text-xs px-2 py-0.5 rounded ${color}`}>{occ}/{cap}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground">Avail {(cap - occ)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Floor {r.floor || '-'} • Capacity {cap}</div>
                      </div>
                    </div>
                    <Button variant={selectedRoomId === r.id ? 'default' : 'outline'} onClick={() => setSelectedRoomId(r.id)}>Select</Button>
                  </div>
                );
              })}
              {rooms.length === 0 && (
                <p className="text-sm text-muted-foreground">No rooms found.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create / Update Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Block (e.g., A)" value={block} onChange={e => setBlock(e.target.value)} />
                <Input placeholder="Number (e.g., 101)" value={number} onChange={e => setNumber(e.target.value)} />
                <Input placeholder="Floor (optional)" value={floor} onChange={e => setFloor(e.target.value)} />
                <Input placeholder="Capacity (default 4)" value={String(capacity)} onChange={e => setCapacity(parseInt(e.target.value || '4', 10))} />
              </div>
              <Button onClick={async () => {
                try {
                  await upsertRoom({ block, number, floor: floor || undefined, capacity });
                  toast.success('Room saved');
                  setBlock(''); setNumber(''); setFloor(''); setCapacity(4);
                  refresh();
                } catch (err: any) {
                  toast.error(err.message || 'Failed to save room');
                }
              }}>Save Room</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assign Student to Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select room" /></SelectTrigger>
                  <SelectContent>
                    {rooms.map(r => {
                      const occ = r.occupants ?? 0; const cap = r.capacity || 4; const av = cap - occ;
                      return <SelectItem key={r.id} value={r.id}>{r.block}-{r.number} (occ {occ}/{cap} • Avail {av})</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                <Input placeholder="Hallticket" value={hallticket} onChange={e => setHallticket(e.target.value)} />
                <Input placeholder="Bed Label (A/B/C/D)" value={bedLabel} onChange={e => setBedLabel(e.target.value.toUpperCase())} />
              </div>
              <Button onClick={async () => {
                if (!selectedRoomId) return toast.error('Select a room');
                if (!hallticket) return toast.error('Enter hallticket');
                try {
                  await assignUserToRoom(selectedRoomId, hallticket.trim().toUpperCase(), bedLabel || undefined);
                  toast.success('Assigned successfully');
                  setHallticket(''); setBedLabel('');
                  refresh();
                } catch (err: any) {
                  toast.error(err.message || 'Failed to assign');
                }
              }}>Assign</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Occupants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedRoomId && selectedRoomOccupants.length === 0 && (
                <p className="text-sm text-muted-foreground">No occupants in this room.</p>
              )}
              {!selectedRoomId && (
                <p className="text-sm text-muted-foreground">Select a room to view occupants.</p>
              )}
              {selectedRoomOccupants.map((u) => (
                <div key={u.id} className="flex items-center justify-between border rounded-lg p-2">
                  <div>
                    <div className="font-medium">{u.hallticket}</div>
                    <div className="text-xs text-muted-foreground">{[u.firstName, u.lastName].filter(Boolean).join(' ')} {u.bedLabel ? `• Bed ${u.bedLabel}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input placeholder="New Bed" className="w-24" value={u.bedLabel || ''} onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      setSelectedRoomOccupants(prev => prev.map(x => x.id === u.id ? { ...x, bedLabel: v } : x));
                    }} />
                    <Button size="sm" onClick={async () => {
                      try {
                        await assignUserToRoom(selectedRoomId, u.hallticket, u.bedLabel || undefined);
                        toast.success('Bed updated');
                        refresh();
                      } catch (err: any) {
                        toast.error(err.message || 'Failed to change bed');
                      }
                    }}>Change Bed</Button>
                    <Button size="sm" variant="outline" onClick={() => { setMoveOpen(true); setMovingHallticket(u.hallticket); }}>Move</Button>
                    <Button variant="destructive" size="sm" onClick={async () => {
                      try {
                        await unassignUserFromRoom(selectedRoomId, u.hallticket);
                        toast.success('Unassigned');
                        refresh();
                        setSelectedRoomOccupants(prev => prev.filter(x => x.id !== u.id));
                      } catch (err: any) {
                        toast.error(err.message || 'Failed to unassign');
                      }
                    }}>Unassign</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bulk Assign (CSV)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Upload a CSV with columns: hallticket, block, number, bedLabel</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  const header = 'hallticket,block,number,bedLabel,floor\n';
                  const sample = [
                    'HT001,A,101,A,1',
                    'HT002,A,101,B,1',
                    'HT003,B,201,,2'
                  ].join('\n');
                  const csv = header + sample + '\n';
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'room-assignments-template.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}>Download Template</Button>
              </div>
              <input type="file" accept=".csv,text/csv" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                try {
                  const res = await bulkAssignRoomsFromCsvText(text);
                  if (res.failed > 0) toast.warning(`Assigned ${res.assigned}, failed ${res.failed}`);
                  else toast.success(`Assigned ${res.assigned}`);
                  refresh();
                } catch (err: any) {
                  toast.error(err.message || 'Bulk assign failed');
                } finally {
                  e.currentTarget.value = '';
                }
              }} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Move Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Student to Another Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Hallticket: {movingHallticket}</div>
            <Select value={moveTargetRoomId} onValueChange={setMoveTargetRoomId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select target room" /></SelectTrigger>
              <SelectContent>
                {rooms.filter(r => r.id !== selectedRoomId).map(r => {
                  const occ = r.occupants ?? 0; const cap = r.capacity || 4; const av = cap - occ;
                  return <SelectItem key={r.id} value={r.id}>{r.block}-{r.number} (occ {occ}/{cap} • Avail {av})</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Input placeholder="Target Bed (optional)" value={moveTargetBed} onChange={e => setMoveTargetBed(e.target.value.toUpperCase())} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!moveTargetRoomId || !movingHallticket) return;
              try {
                await assignUserToRoom(moveTargetRoomId, movingHallticket, moveTargetBed || undefined);
                toast.success('Student moved');
                setMoveOpen(false);
                setMoveTargetRoomId(''); setMoveTargetBed(''); setMovingHallticket('');
                refresh();
              } catch (err: any) {
                toast.error(err.message || 'Failed to move');
              }
            }}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
