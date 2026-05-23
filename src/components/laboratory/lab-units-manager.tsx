'use client';

// Lab unit-groups manager. Used inside the hospital admin Lab Settings
// (Units tab) and also surfaceable on the super-admin side. Behaviour:
//   • lists every unit group merged (global + tenant-local), with units
//     nested as collapsible rows
//   • shows a "system" badge on platform-seeded rows (delete is blocked
//     server-side; UI hides the bin)
//   • inline create for a hospital-local group or a unit inside any group
//     the caller has rights on
//   • edit-in-place for symbol/name/conversion factor/base
//
// Backed by /lab/unit-groups + /lab/units. Reads work for any auth user
// (the parameter builder uses the same list); writes route to local or
// global automatically per the service-layer guard (see lab-units.service).

import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useLabUnitGroups,
  useCreateLabUnitGroup,
  useUpdateLabUnitGroup,
  useDeleteLabUnitGroup,
  useCreateLabUnit,
  useUpdateLabUnit,
  useDeleteLabUnit,
  type LabUnitGroup,
  type LabUnit,
} from '@/hooks/use-lab-units';
import { cn } from '@/lib/utils';

interface LabUnitsManagerProps {
  // When true the "Create global group" toggle appears (super_admin
  // surface). Hospital admins always create local groups.
  allowGlobal?: boolean;
}

function errMsg(e: unknown, fallback: string) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export function LabUnitsManager({ allowGlobal = false }: LabUnitsManagerProps) {
  const { data: groups, isLoading } = useLabUnitGroups();
  const createGroup = useCreateLabUnitGroup();
  const updateGroup = useUpdateLabUnitGroup();
  const deleteGroup = useDeleteLabUnitGroup();
  const createUnit = useCreateLabUnit();
  const updateUnit = useUpdateLabUnit();
  const deleteUnit = useDeleteLabUnit();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({
    code: '',
    name: '',
    description: '',
    isGlobal: false,
  });
  const [editingGroup, setEditingGroup] = useState<LabUnitGroup | null>(null);
  const [newUnitForGroup, setNewUnitForGroup] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState<{
    symbol: string;
    name: string;
    conversionFactor: string;
    isBase: boolean;
  }>({ symbol: '', name: '', conversionFactor: '', isBase: false });
  const [editingUnit, setEditingUnit] = useState<LabUnit | null>(null);

  const sortedGroups = (groups ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateGroup = async () => {
    if (!newGroupForm.code.trim() || !newGroupForm.name.trim()) {
      toast.error('Code and name are required');
      return;
    }
    try {
      await createGroup.mutateAsync({
        code: newGroupForm.code.trim(),
        name: newGroupForm.name.trim(),
        description: newGroupForm.description.trim() || null,
        isGlobal: allowGlobal ? newGroupForm.isGlobal : false,
      });
      toast.success('Unit group created');
      setNewGroupOpen(false);
      setNewGroupForm({ code: '', name: '', description: '', isGlobal: false });
    } catch (e: unknown) {
      toast.error(errMsg(e, 'Failed to create group'));
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup) return;
    try {
      await updateGroup.mutateAsync({
        id: editingGroup.id,
        name: editingGroup.name,
        description: editingGroup.description ?? null,
        sortOrder: editingGroup.sortOrder,
      });
      toast.success('Unit group updated');
      setEditingGroup(null);
    } catch (e: unknown) {
      toast.error(errMsg(e, 'Failed to update group'));
    }
  };

  const handleDeleteGroup = async (g: LabUnitGroup) => {
    if (!confirm(`Delete "${g.name}" and its ${g.units.length} unit(s)?`)) return;
    try {
      await deleteGroup.mutateAsync(g.id);
      toast.success('Unit group deleted');
    } catch (e: unknown) {
      toast.error(errMsg(e, 'Failed to delete group'));
    }
  };

  const startAddUnit = (groupId: string) => {
    setNewUnitForGroup(groupId);
    setUnitForm({ symbol: '', name: '', conversionFactor: '', isBase: false });
  };

  const handleCreateUnit = async () => {
    if (!newUnitForGroup || !unitForm.symbol.trim()) {
      toast.error('Symbol is required');
      return;
    }
    try {
      await createUnit.mutateAsync({
        unitGroupId: newUnitForGroup,
        symbol: unitForm.symbol.trim(),
        name: unitForm.name.trim() || null,
        conversionFactor: unitForm.conversionFactor.trim() === ''
          ? null
          : Number(unitForm.conversionFactor),
        isBase: unitForm.isBase,
      });
      toast.success('Unit added');
      setNewUnitForGroup(null);
    } catch (e: unknown) {
      toast.error(errMsg(e, 'Failed to add unit'));
    }
  };

  const handleUpdateUnit = async () => {
    if (!editingUnit) return;
    try {
      await updateUnit.mutateAsync({
        id: editingUnit.id,
        symbol: editingUnit.symbol,
        name: editingUnit.name ?? null,
        conversionFactor:
          editingUnit.conversionFactor === '' || editingUnit.conversionFactor == null
            ? null
            : Number(editingUnit.conversionFactor),
        isBase: editingUnit.isBase,
      });
      toast.success('Unit updated');
      setEditingUnit(null);
    } catch (e: unknown) {
      toast.error(errMsg(e, 'Failed to update unit'));
    }
  };

  const handleDeleteUnit = async (u: LabUnit) => {
    if (!confirm(`Delete unit "${u.symbol}"?`)) return;
    try {
      await deleteUnit.mutateAsync(u.id);
      toast.success('Unit deleted');
    } catch (e: unknown) {
      toast.error(errMsg(e, 'Failed to delete unit'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold">Unit groups</h2>
          <p className="text-[11px] text-muted-foreground">
            Hierarchy: parameters → unit group → unit. Hospital-local groups stay on this tenant; deleting the
            global ones is blocked. {allowGlobal ? 'Toggle "Global" on create to author at the platform level.' : ''}
          </p>
        </div>
        <Button size="sm" onClick={() => setNewGroupOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New unit group
        </Button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        {isLoading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No unit groups yet. Seed them with{' '}
            <code className="font-mono text-[11px]">npm run db:seed:lab-units</code>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left w-8" />
                <th className="px-3 py-2 text-left">Group</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Scope</th>
                <th className="px-3 py-2 text-right">Units</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map((g) => {
                const isExpanded = expanded.has(g.id);
                return (
                  <Fragment key={g.id}>
                    <tr className="border-b hover:bg-surface-container-low">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggle(g.id)}
                          className="p-0.5 rounded hover:bg-surface-container-high"
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-2">
                          {g.name}
                          {g.isSystem && (
                            <Badge className="bg-muted text-muted-foreground text-[9px] gap-1">
                              <Lock className="h-2.5 w-2.5" />
                              system
                            </Badge>
                          )}
                          {g.tenantId && (
                            <Badge className="bg-primary/10 text-primary text-[9px]">local</Badge>
                          )}
                        </div>
                        {g.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{g.description}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{g.code}</td>
                      <td className="px-3 py-2 text-xs">
                        {g.tenantId ? <span>Hospital local</span> : <span>Platform global</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold">{g.units.length}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => startAddUnit(g.id)}
                          >
                            <Plus className="h-3 w-3" />
                            Unit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setEditingGroup(g)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {!g.isSystem && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleDeleteGroup(g)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-surface-container-lowest/60">
                        <td />
                        <td colSpan={5} className="px-3 py-2">
                          {g.units.length === 0 && newUnitForGroup !== g.id ? (
                            <p className="text-xs text-muted-foreground italic py-2">
                              No units in this group yet. Click "+ Unit" to add one.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="text-[10px] uppercase text-muted-foreground">
                                  <tr>
                                    <th className="text-left py-1.5 pr-3 font-medium">Symbol</th>
                                    <th className="text-left py-1.5 pr-3 font-medium">Name</th>
                                    <th className="text-right py-1.5 pr-3 font-medium">×Base</th>
                                    <th className="text-left py-1.5 pr-3 font-medium">Base?</th>
                                    <th className="text-right py-1.5 font-medium">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.units.map((u) => (
                                    <tr key={u.id} className="border-t border-surface-container/50">
                                      <td className="py-1.5 pr-3 font-mono">{u.symbol}</td>
                                      <td className="py-1.5 pr-3 text-muted-foreground">{u.name ?? '—'}</td>
                                      <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">
                                        {u.conversionFactor != null ? Number(u.conversionFactor) : '—'}
                                      </td>
                                      <td className="py-1.5 pr-3">
                                        {u.isBase ? (
                                          <Badge className="bg-emerald-100 text-emerald-800 text-[9px]">Base</Badge>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 text-right">
                                        <div className="inline-flex gap-1 justify-end">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                            onClick={() => setEditingUnit(u)}
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          {!u.isSystem && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                              onClick={() => handleDeleteUnit(u)}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {newUnitForGroup === g.id && (
                            <div className="mt-2 grid grid-cols-12 gap-2 items-end p-3 rounded border border-dashed border-primary/40 bg-primary/5">
                              <div className="col-span-2">
                                <Label className="text-[10px]">Symbol *</Label>
                                <Input
                                  className="h-7 text-xs"
                                  value={unitForm.symbol}
                                  onChange={(e) => setUnitForm((p) => ({ ...p, symbol: e.target.value }))}
                                  placeholder="mg/dL"
                                />
                              </div>
                              <div className="col-span-4">
                                <Label className="text-[10px]">Display name</Label>
                                <Input
                                  className="h-7 text-xs"
                                  value={unitForm.name}
                                  onChange={(e) => setUnitForm((p) => ({ ...p, name: e.target.value }))}
                                  placeholder="milligram per decilitre"
                                />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-[10px]">×Base factor</Label>
                                <Input
                                  className="h-7 text-xs"
                                  type="number"
                                  step="any"
                                  value={unitForm.conversionFactor}
                                  onChange={(e) => setUnitForm((p) => ({ ...p, conversionFactor: e.target.value }))}
                                  placeholder="1"
                                />
                              </div>
                              <div className="col-span-2 flex items-center gap-1.5 pb-1">
                                <input
                                  id={`base-${g.id}`}
                                  type="checkbox"
                                  checked={unitForm.isBase}
                                  onChange={(e) => setUnitForm((p) => ({ ...p, isBase: e.target.checked }))}
                                />
                                <Label htmlFor={`base-${g.id}`} className="text-xs">
                                  Base unit
                                </Label>
                              </div>
                              <div className="col-span-2 flex gap-1 justify-end pb-1">
                                <Button size="sm" variant="ghost" className="h-7" onClick={() => setNewUnitForGroup(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                                <Button size="sm" className="h-7" onClick={handleCreateUnit} disabled={createUnit.isPending}>
                                  {createUnit.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* New group dialog */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New unit group</DialogTitle>
            <DialogDescription>
              Groups are how parameters tell the unit picker which units are sensible. Use a stable lowercase code
              (e.g. <code className="font-mono">cardiac_markers</code>) — parameters reference it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Code (snake_case) *</Label>
              <Input
                value={newGroupForm.code}
                onChange={(e) =>
                  setNewGroupForm((p) => ({
                    ...p,
                    code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                  }))
                }
                placeholder="custom_pulmonary"
                className="font-mono"
              />
            </div>
            <div>
              <Label>Display name *</Label>
              <Input
                value={newGroupForm.name}
                onChange={(e) => setNewGroupForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Pulmonary function"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newGroupForm.description}
                onChange={(e) => setNewGroupForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            {allowGlobal && (
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newGroupForm.isGlobal}
                  onChange={(e) => setNewGroupForm((p) => ({ ...p, isGlobal: e.target.checked }))}
                />
                Create as global (platform-wide)
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={createGroup.isPending}>
              {createGroup.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit group dialog */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit unit group</DialogTitle>
            <DialogDescription>
              Code is immutable (parameters reference it). You can rename + reorder.
            </DialogDescription>
          </DialogHeader>
          {editingGroup && (
            <div className="space-y-3">
              <div>
                <Label>Code</Label>
                <Input value={editingGroup.code} readOnly className="font-mono bg-muted/50" />
              </div>
              <div>
                <Label>Display name *</Label>
                <Input
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={editingGroup.description ?? ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={editingGroup.sortOrder}
                  onChange={(e) => setEditingGroup({ ...editingGroup, sortOrder: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateGroup} disabled={updateGroup.isPending}>
              {updateGroup.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit unit dialog */}
      <Dialog open={!!editingUnit} onOpenChange={(open) => !open && setEditingUnit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit unit</DialogTitle>
          </DialogHeader>
          {editingUnit && (
            <div className="space-y-3">
              <div>
                <Label>Symbol *</Label>
                <Input
                  value={editingUnit.symbol}
                  onChange={(e) => setEditingUnit({ ...editingUnit, symbol: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>Display name</Label>
                <Input
                  value={editingUnit.name ?? ''}
                  onChange={(e) => setEditingUnit({ ...editingUnit, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Conversion factor (× base)</Label>
                <Input
                  type="number"
                  step="any"
                  value={editingUnit.conversionFactor == null ? '' : String(editingUnit.conversionFactor)}
                  onChange={(e) =>
                    setEditingUnit({
                      ...editingUnit,
                      conversionFactor: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingUnit.isBase}
                  onChange={(e) => setEditingUnit({ ...editingUnit, isBase: e.target.checked })}
                />
                Base unit (one per group)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUnit(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUnit} disabled={updateUnit.isPending}>
              {updateUnit.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

