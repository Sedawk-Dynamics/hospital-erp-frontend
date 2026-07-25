'use client';

// ============================================================
// Surgical preference-card templates — full CRUD (create / edit / retire).
// Shared master data maintained by BOTH the pharmacy (Pharmacy → OT Kits) and
// the OT nurse (OT → Surgical Kits). Used by both pages so the editor stays
// identical in each place.
// ============================================================

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, ClipboardList, Boxes, Pencil, Trash2, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  useSurgicalTemplates,
  useCreateSurgicalTemplate,
  useUpdateSurgicalTemplate,
  useDeleteSurgicalTemplate,
  type SurgicalTemplate,
} from '@/hooks/use-ot-kit';
import { useFormulary } from '@/hooks/use-pharmacy';
import { DrugStockLabel } from '@/components/shared/drug-stock-label';
import { useDoctorsList } from '@/hooks/use-hospital';

const TEXTAREA_CLS =
  'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

let _uidCounter = 0;
function uid() {
  _uidCounter += 1;
  return `row-${Date.now()}-${_uidCounter}`;
}

export function SurgicalTemplatesTab() {
  const [editing, setEditing] = useState<SurgicalTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SurgicalTemplate | null>(null);

  const { data, isLoading, isError } = useSurgicalTemplates({ includeInactive: true });
  const templates = data?.items ?? [];

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Preference cards — the default drug/consumable pack a surgeon needs for a procedure.
        </p>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New Template
        </Button>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load templates. Please try again.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 px-1 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading templates...
        </div>
      ) : !isError && templates.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            No preference-card templates yet. Create one to speed up kit requests.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
              <div className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate font-headline text-sm font-bold text-on-surface">{t.name}</h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 text-[10px]',
                      t.isActive ? 'bg-teal-100 text-teal-700 border-teal-300' : 'bg-gray-100 text-gray-600 border-gray-300',
                    )}
                  >
                    {t.isActive ? 'Active' : 'Retired'}
                  </Badge>
                </div>
                {t.procedureName && <p className="mt-0.5 text-xs text-muted-foreground">{t.procedureName}</p>}
              </div>
              <div className="flex-1 space-y-1.5 px-4 py-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Boxes className="h-3.5 w-3.5" />
                  {t.items?.length ?? 0} item{(t.items?.length ?? 0) === 1 ? '' : 's'}
                </div>
                {(t.items?.length ?? 0) > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {t.items!.slice(0, 5).map((i) => (
                      <li key={i.id} className="flex justify-between gap-2">
                        <span className="truncate">{i.drugName ?? i.drugFormularyId}</span>
                        <span className="font-mono shrink-0">× {i.defaultQuantity}</span>
                      </li>
                    ))}
                    {(t.items?.length ?? 0) > 5 && <li className="italic">+ {t.items!.length - 5} more…</li>}
                  </ul>
                )}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 border-t bg-surface-container-low p-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDeleteTarget(t)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Retire
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <TemplateDialog
          template={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {deleteTarget && <DeleteTemplateDialog template={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}

interface TplItemState {
  key: string;
  drugFormularyId: string;
  drugName: string;
  defaultQuantity: number;
}

function TemplateDialog({ template, onClose }: { template: SurgicalTemplate | null; onClose: () => void }) {
  const isEdit = !!template;
  const create = useCreateSurgicalTemplate();
  const update = useUpdateSurgicalTemplate();
  const { data: doctors } = useDoctorsList();

  const [name, setName] = useState(template?.name ?? '');
  const [procedureName, setProcedureName] = useState(template?.procedureName ?? '');
  const [doctorId, setDoctorId] = useState(template?.doctorId ?? '');
  const [notes, setNotes] = useState(template?.notes ?? '');
  const [items, setItems] = useState<TplItemState[]>(() =>
    (template?.items ?? []).map((i) => ({
      key: uid(),
      drugFormularyId: i.drugFormularyId,
      drugName: i.drugName ?? '',
      defaultQuantity: i.defaultQuantity,
    })),
  );

  const doctorOptions = useMemo(
    () =>
      (doctors ?? []).map((d) => ({
        id: d.id || d.userId,
        name: `Dr. ${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.trim(),
      })),
    [doctors],
  );

  const addItem = () => setItems((prev) => [...prev, { key: uid(), drugFormularyId: '', drugName: '', defaultQuantity: 1 }]);
  const updateItem = (key: string, patch: Partial<TplItemState>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const pending = create.isPending || update.isPending;

  const submit = () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    const filled = items.filter((i) => i.drugFormularyId);
    if (filled.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    if (filled.some((i) => !i.defaultQuantity || i.defaultQuantity <= 0)) {
      toast.error('Every item needs a quantity of at least 1');
      return;
    }

    const input = {
      name: name.trim(),
      procedureName: procedureName.trim() || undefined,
      doctorId: doctorId || undefined,
      notes: notes.trim() || undefined,
      items: filled.map((i) => ({ drugFormularyId: i.drugFormularyId, defaultQuantity: i.defaultQuantity })),
    };

    const onSuccess = () => {
      toast.success(isEdit ? 'Template updated' : 'Template created');
      onClose();
    };
    const onError = (err: any) => toast.error(err?.message ?? 'Failed to save template');

    if (isEdit && template) {
      update.mutate({ id: template.id, ...input }, { onSuccess, onError });
    } else {
      create.mutate(input, { onSuccess, onError });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Template' : 'New Preference-Card Template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Rao — Lap Chole Kit" />
            </div>
            <div className="space-y-1.5">
              <Label>Procedure</Label>
              <Input value={procedureName} onChange={(e) => setProcedureName(e.target.value)} placeholder="e.g. Laparoscopic Cholecystectomy" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Surgeon</Label>
              <Select value={doctorId || 'none'} onValueChange={(v: string | null) => setDoctorId(v === 'none' ? '' : (v ?? ''))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select surgeon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {doctorOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Kit items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No items yet. Add the drugs/consumables that make up this kit.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <TemplateItemRow key={item.key} item={item} onChange={(patch) => updateItem(item.key, patch)} onRemove={() => removeItem(item.key)} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for this template..." className={TEXTAREA_CLS} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: TplItemState;
  onChange: (patch: Partial<TplItemState>) => void;
  onRemove: () => void;
}) {
  const [search, setSearch] = useState('');
  const fq = useFormulary({ search: search.trim() || undefined });
  const drugs = fq.data?.data ?? [];

  return (
    <div className="rounded-md border p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1.5">
          {item.drugFormularyId ? (
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5">
              <span className="text-sm font-medium">{item.drugName || item.drugFormularyId}</span>
              <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => onChange({ drugFormularyId: '', drugName: '' })}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search drug / consumable..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              {search.trim().length >= 2 && (
                <div className="max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                  {fq.isLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                    </div>
                  ) : drugs.length > 0 ? (
                    drugs.slice(0, 8).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          onChange({ drugFormularyId: d.id, drugName: d.drugName });
                          setSearch('');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                      >
                        <span className="font-medium">{d.drugName}</span>
                        {d.strength && <span className="ml-2 text-xs text-muted-foreground">{d.strength}</span>}
                        {d.genericName && <span className="ml-2 text-xs text-muted-foreground">{d.genericName}</span>}
                        <DrugStockLabel stock={d.totalStock} className="ml-2 align-middle" />
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No drugs found</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="w-24">
          <NumberInput
            min={1}
            value={item.defaultQuantity}
            onValueChange={(v) => onChange({ defaultQuantity: v })}
            className="text-right"
            aria-label="Quantity"
          />
        </div>

        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-600" onClick={onRemove} title="Remove item">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function DeleteTemplateDialog({ template, onClose }: { template: SurgicalTemplate; onClose: () => void }) {
  const del = useDeleteSurgicalTemplate();

  const submit = () => {
    del.mutate(template.id, {
      onSuccess: () => {
        toast.success('Template retired');
        onClose();
      },
      onError: (err: any) => toast.error(err?.message ?? 'Failed to retire template'),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retire Template</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Retire <b>{template.name}</b>? It will no longer be selectable for new kit requests. Existing kit issues are unaffected.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep
          </Button>
          <Button variant="destructive" onClick={submit} disabled={del.isPending}>
            {del.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Retire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
