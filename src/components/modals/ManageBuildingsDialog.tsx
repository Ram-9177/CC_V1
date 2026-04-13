import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBuildings, useCreateBuilding, useUpdateBuilding, useDeleteBuilding } from '@/hooks/features/useRooms';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';
import { Building } from '@/types';
import { Pencil, Trash2, Plus, Building2 } from 'lucide-react';
import { ListSkeleton } from '@/components/common/PageSkeleton';

interface ManageBuildingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageBuildingsDialog({ open, onOpenChange }: ManageBuildingsDialogProps) {
  const { data: buildings, isLoading } = useBuildings(open);
  
  const createMutation = useCreateBuilding();
  const updateMutation = useUpdateBuilding();
  const deleteMutation = useDeleteBuilding();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', total_floors: 1 });
  const [isAdding, setIsAdding] = useState(false);

  const handleCreate = () => {
    if (!formData.name || !formData.code || !formData.total_floors) {
      toast.error('Name, Code, and Total Floors are required.');
      return;
    }
    createMutation.mutate(
      { name: formData.name, code: formData.code, total_floors: formData.total_floors },
      {
        onSuccess: () => {
          toast.success('Building created successfully');
          setIsAdding(false);
          setFormData({ name: '', code: '', total_floors: 1 });
        },
        onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create building')),
      }
    );
  };

  const handleUpdate = (id: number) => {
    if (!formData.name || !formData.code || !formData.total_floors) {
      toast.error('Name, Code, and Total Floors are required.');
      return;
    }
    updateMutation.mutate(
      { id, data: { name: formData.name, code: formData.code, total_floors: formData.total_floors } },
      {
        onSuccess: () => {
          toast.success('Building updated successfully');
          setEditingId(null);
          setFormData({ name: '', code: '', total_floors: 1 });
        },
        onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update building')),
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this building? It may affect associated rooms and allocations.')) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Building deleted successfully'),
        onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to delete building')),
      });
    }
  };

  const startEdit = (b: Building & { total_floors?: number }) => {
    setEditingId(b.id);
    setIsAdding(false);
    setFormData({ name: b.name, code: b.code, total_floors: b.total_floors || b.floors || 1 });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ name: '', code: '', total_floors: 1 });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) { cancelEdit(); }
    }}>
      <DialogContent className="max-w-md w-[95vw] rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Manage Buildings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 py-1">
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : (
            <div className="space-y-2">
              {buildings?.map((b: Building & { total_floors?: number }) => (
                <div key={b.id} className="p-3 border rounded-lg bg-gray-50 flex items-center justify-between gap-2">
                  {editingId === b.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Building Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-8"
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Code"
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          className="h-8 w-1/2"
                        />
                        <Input
                          type="number"
                          min="1"
                          placeholder="Floors"
                          value={formData.total_floors}
                          onChange={(e) => setFormData({ ...formData, total_floors: parseInt(e.target.value) || 1 })}
                          className="h-8 w-1/2"
                        />
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                        <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 text-xs">Cancel</Button>
                        <Button size="sm" onClick={() => handleUpdate(b.id)} disabled={updateMutation.isPending} className="h-7 text-xs">
                          {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-bold text-sm text-gray-900">{b.name} <span className="text-muted-foreground font-mono text-xs ml-1">({b.code})</span></p>
                        <p className="text-xs text-muted-foreground">Floors: {b.total_floors || b.floors || 0} • Block ID: {b.id}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => startEdit(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(b.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {buildings?.length === 0 && !isAdding && (
                <p className="text-center text-sm text-muted-foreground py-4">No buildings found.</p>
              )}
            </div>
          )}

          {isAdding && (
            <div className="p-3 border rounded-lg bg-gray-50 border-primary/20 flex-1 space-y-2">
              <Input
                placeholder="Building Name (e.g. Block A)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-8"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Code (e.g. BLK-A)"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="h-8 w-1/2"
                />
                <Input
                  type="number"
                  min="1"
                  placeholder="Total Floors"
                  value={formData.total_floors}
                  onChange={(e) => setFormData({ ...formData, total_floors: parseInt(e.target.value) || 1 })}
                  className="h-8 w-1/2"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 text-xs">Cancel</Button>
                <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending} className="h-7 text-xs">
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          )}

          {!isAdding && editingId === null && (
            <Button variant="outline" className="w-full mt-2 border-dashed h-9" onClick={() => { setIsAdding(true); setFormData({ name: '', code: '', total_floors: 1 }); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Building Block
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
