import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBuildings, useCreateBuilding, useUpdateBuilding, useDeleteBuilding, useToggleFloor } from '@/hooks/features/useRooms';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';
import { Building } from '@/types';
import {
  Pencil, Trash2, Plus, Building2, ChevronDown, ChevronRight,
  Layers, CheckCircle2, XCircle
} from 'lucide-react';
import { ListSkeleton } from '@/components/common/PageSkeleton';
import { cn } from '@/lib/utils';


interface ManageBuildingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type BuildingExtended = Building & { total_floors?: number; disabled_floors?: number[]; is_active?: boolean };

interface BuildingFormData {
  name: string;
  code: string;
  total_floors: number;
  gender_type: string;
}

const emptyForm: BuildingFormData = { name: '', code: '', total_floors: 1, gender_type: 'co-ed' };

export function ManageBuildingsDialog({ open, onOpenChange }: ManageBuildingsDialogProps) {
  const { data: buildings, isLoading } = useBuildings<BuildingExtended>(open);

  const createMutation = useCreateBuilding();
  const updateMutation = useUpdateBuilding();
  const deleteMutation = useDeleteBuilding();
  const toggleFloorMutation = useToggleFloor();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<BuildingFormData>(emptyForm);
  const [isAdding, setIsAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error('Name and Code are required.');
      return;
    }
    createMutation.mutate(
      { name: formData.name, code: formData.code, total_floors: formData.total_floors, gender_type: formData.gender_type },
      {
        onSuccess: () => {
          toast.success('Building created successfully');
          setIsAdding(false);
          setFormData(emptyForm);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create building')),
      }
    );
  };

  const handleUpdate = (id: number) => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error('Name and Code are required.');
      return;
    }
    updateMutation.mutate(
      { id, data: { name: formData.name, code: formData.code, total_floors: formData.total_floors, gender_type: formData.gender_type } },
      {
        onSuccess: () => {
          toast.success('Building updated');
          cancelEdit();
        },
        onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update building')),
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Delete "${name}"? This will affect all associated rooms and allocations.`)) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Building deleted'),
        onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to delete building')),
      });
    }
  };

  const handleToggleFloor = (buildingId: number, floor: number) => {
    toggleFloorMutation.mutate(
      { buildingId, floor },
      {
        onSuccess: (data) => toast.success(data?.detail || `Floor ${floor} toggled`),
        onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to toggle floor')),
      }
    );
  };

  const startEdit = (b: BuildingExtended) => {
    setEditingId(b.id);
    setIsAdding(false);
    setExpandedId(null);
    setFormData({
      name: b.name,
      code: b.code,
      total_floors: b.total_floors || (b as any).floors || 1,
      gender_type: (b as any).gender_type || 'co-ed',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData(emptyForm);
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) cancelEdit(); }}>
      <DialogContent className="max-w-lg w-[95vw] rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Manage Buildings & Floors
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[65vh] overflow-y-auto px-1 py-1 pr-2">
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : (
            <div className="space-y-2">
              {(!buildings || buildings.length === 0) && !isAdding && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  No buildings yet. Add your first building block below.
                </p>
              )}

              {buildings?.map((b: BuildingExtended) => {
                const totalFloors = b.total_floors || (b as any).floors || 0;
                const disabledFloors: number[] = (b as any).disabled_floors || [];
                const isExpanded = expandedId === b.id;
                const isEditing = editingId === b.id;

                return (
                  <div key={b.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    {/* Building Row */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
                      {/* Expand toggle */}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        onClick={() => toggleExpand(b.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      {isEditing ? (
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Building Name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className="h-7 text-sm flex-1"
                            />
                            <Input
                              placeholder="Code"
                              value={formData.code}
                              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                              className="h-7 text-sm w-24"
                            />
                          </div>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              min="1"
                              max="20"
                              placeholder="Floors"
                              value={formData.total_floors}
                              onChange={(e) => setFormData({ ...formData, total_floors: parseInt(e.target.value) || 1 })}
                              className="h-7 text-sm w-24"
                            />
                            <select
                              value={formData.gender_type}
                              onChange={(e) => setFormData({ ...formData, gender_type: e.target.value })}
                              className="h-7 text-xs border rounded px-2 flex-1"
                            >
                              <option value="boys">Boys</option>
                              <option value="girls">Girls</option>
                              <option value="co-ed">Co-Ed</option>
                            </select>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs px-2">Cancel</Button>
                            <Button size="sm" onClick={() => handleUpdate(b.id)} disabled={updateMutation.isPending} className="h-7 text-xs px-2">
                              {updateMutation.isPending ? 'Saving…' : 'Save'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900 truncate">{b.name}</span>
                              <span className="font-mono text-xs text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">{b.code}</span>
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-blue-200 text-blue-600">
                                {(b as any).gender_type || 'co-ed'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              <Layers className="inline h-3 w-3 mr-1" />
                              {totalFloors} floor{totalFloors !== 1 ? 's' : ''}
                              {disabledFloors.length > 0 && (
                                <span className="text-orange-600 ml-2">• {disabledFloors.length} floor{disabledFloors.length > 1 ? 's' : ''} disabled</span>
                              )}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => startEdit(b)}
                              title="Edit building"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(b.id, b.name)}
                              disabled={deleteMutation.isPending}
                              title="Delete building"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Floor Management Panel */}
                    {isExpanded && !isEditing && (
                      <div className="px-4 py-3 border-t bg-white">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          Floor Access Control
                        </p>
                        {totalFloors === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No floors configured.</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Array.from({ length: totalFloors }, (_, i) => i + 1).map((floor) => {
                              const isDisabled = disabledFloors.includes(floor);
                              return (
                                <div
                                  key={floor}
                                  className={cn(
                                    'flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all',
                                    isDisabled
                                      ? 'bg-red-50 border-red-200 text-red-700'
                                      : 'bg-green-50 border-green-200 text-green-700'
                                  )}
                                >
                                  <div className="flex items-center gap-1.5">
                                    {isDisabled
                                      ? <XCircle className="h-3.5 w-3.5" />
                                      : <CheckCircle2 className="h-3.5 w-3.5" />
                                    }
                                    <span className="font-bold text-xs">Floor {floor}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFloor(b.id, floor)}
                                    disabled={toggleFloorMutation.isPending}
                                    className={cn(
                                      'text-[10px] font-bold px-2 py-0.5 rounded border transition-all',
                                      isDisabled
                                        ? 'border-red-300 bg-red-100 text-red-700 hover:bg-red-200'
                                        : 'border-green-300 bg-green-100 text-green-700 hover:bg-green-200'
                                    )}
                                  >
                                    {isDisabled ? 'Enable' : 'Disable'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add New Building Form */}
              {isAdding && (
                <div className="p-3 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">New Building Block</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Building Name (e.g. Block A)"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-8 flex-1"
                      autoFocus
                    />
                    <Input
                      placeholder="Code (e.g. BLK-A)"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="h-8 w-28"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      placeholder="Total Floors"
                      value={formData.total_floors}
                      onChange={(e) => setFormData({ ...formData, total_floors: parseInt(e.target.value) || 1 })}
                      className="h-8 w-28"
                    />
                    <select
                      value={formData.gender_type}
                      onChange={(e) => setFormData({ ...formData, gender_type: e.target.value })}
                      className="h-8 text-xs border rounded px-2 flex-1"
                    >
                      <option value="boys">Boys Block</option>
                      <option value="girls">Girls Block</option>
                      <option value="co-ed">Co-Ed Block</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 text-xs">Cancel</Button>
                    <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending} className="h-7 text-xs">
                      {createMutation.isPending ? 'Creating…' : 'Create Building'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isAdding && editingId === null && (
            <Button
              variant="outline"
              className="w-full border-dashed h-10 text-sm"
              onClick={() => { setIsAdding(true); setExpandedId(null); setFormData(emptyForm); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Building Block
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
