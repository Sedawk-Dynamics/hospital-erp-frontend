'use client';

// Super-admin Drug Master — platform-wide Indian drug catalog (~254K brands)
// seeded from the open Indian medicine dataset. Hospitals search this and
// import drugs into their own formulary (one-click "add to formulary").
//
// Mirrors the Lab Test Templates page (see /super-admin/lab-templates).

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Pill,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useDrugMasterList,
  useCreateDrugMaster,
  useUpdateDrugMaster,
  useDeleteDrugMaster,
  type DrugMaster,
  type DrugMasterInput,
} from '@/hooks/use-drug-master';
import { RefreshCatalogDialog } from '@/components/pharmacy/refresh-catalog-dialog';

const DOSAGE_FORMS = [
  'tablet',
  'capsule',
  'syrup',
  'injection',
  'cream',
  'drops',
  'inhaler',
  'other',
] as const;

const EMPTY: DrugMasterInput = {
  name: '',
  genericName: '',
  saltComposition: '',
  manufacturer: '',
  type: 'allopathy',
  dosageForm: null,
  strength: '',
  packSizeLabel: '',
  mrp: null,
  schedule: '',
  gtin: '',
  casePackGtin: '',
  unitsPerCase: null,
  manufacturerCode: '',
  hsnCode: '',
  gstRate: null,
  isDiscontinued: false,
  isPublished: true,
};

export default function SuperAdminDrugMasterPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  // Debounce the search box → server query.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useDrugMasterList({
    page,
    limit,
    search: search || undefined,
    includeDiscontinued: true,
  });
  const createDrug = useCreateDrugMaster();
  const updateDrug = useUpdateDrugMaster();
  const deleteDrug = useDeleteDrugMaster();

  const drugs = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const [editing, setEditing] = useState<DrugMaster | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<DrugMasterInput>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<DrugMaster | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpenForm(true);
  }

  function openEdit(d: DrugMaster) {
    setEditing(d);
    setForm({
      name: d.name,
      genericName: d.genericName ?? '',
      saltComposition: d.saltComposition ?? '',
      manufacturer: d.manufacturer ?? '',
      type: d.type ?? '',
      dosageForm: d.dosageForm,
      strength: d.strength ?? '',
      packSizeLabel: d.packSizeLabel ?? '',
      mrp: d.mrp != null ? Number(d.mrp) : null,
      schedule: d.schedule ?? '',
      gtin: d.gtin ?? '',
      casePackGtin: d.casePackGtin ?? '',
      unitsPerCase: d.unitsPerCase ?? null,
      manufacturerCode: d.manufacturerCode ?? '',
      hsnCode: d.hsnCode ?? '',
      gstRate: d.gstRate != null ? Number(d.gstRate) : null,
      isDiscontinued: d.isDiscontinued,
      isPublished: d.isPublished,
    });
    setOpenForm(true);
  }

  async function handleSave() {
    if (!form.name?.trim()) {
      toast.error('Drug name is required');
      return;
    }
    const payload: DrugMasterInput = {
      ...form,
      name: form.name.trim(),
      genericName: form.genericName?.toString().trim() || null,
      saltComposition: form.saltComposition?.toString().trim() || null,
      manufacturer: form.manufacturer?.toString().trim() || null,
      type: form.type?.toString().trim() || null,
      strength: form.strength?.toString().trim() || null,
      packSizeLabel: form.packSizeLabel?.toString().trim() || null,
      schedule: form.schedule?.toString().trim() || null,
      mrp: form.mrp != null && !Number.isNaN(Number(form.mrp)) ? Number(form.mrp) : null,
      gtin: form.gtin?.toString().trim() || null,
      casePackGtin: form.casePackGtin?.toString().trim() || null,
      unitsPerCase: form.unitsPerCase != null && !Number.isNaN(Number(form.unitsPerCase)) ? Number(form.unitsPerCase) : null,
      manufacturerCode: form.manufacturerCode?.toString().trim() || null,
      hsnCode: form.hsnCode?.toString().trim() || null,
      gstRate: form.gstRate != null && !Number.isNaN(Number(form.gstRate)) ? Number(form.gstRate) : null,
    };
    try {
      if (editing) {
        await updateDrug.mutateAsync({ id: editing.id, ...payload });
        toast.success('Drug updated');
      } else {
        await createDrug.mutateAsync(payload);
        toast.success('Drug added to catalog');
      }
      setOpenForm(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to save';
      toast.error(msg);
    }
  }

  async function handleDelete(d: DrugMaster) {
    try {
      await deleteDrug.mutateAsync(d.id);
      toast.success('Drug removed from catalog');
      setConfirmDelete(null);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete';
      toast.error(msg);
    }
  }

  const saving = createDrug.isPending || updateDrug.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            Drug Master Catalog
          </h1>
          <p className="font-label text-sm text-on-surface-variant">
            Platform-wide Indian drug catalog. Hospitals search this and import drugs into their own
            formulary. {meta ? `${meta.total.toLocaleString('en-IN')} drugs` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCatalogDialog />
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add drug
          </Button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder='Search brand, composition or manufacturer ("Augmentin", "Amoxycillin"…)'
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        ) : drugs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search
              ? 'No drugs match your search.'
              : 'Catalog is empty. Run "npm run db:seed:drug-master" to import the Indian medicine dataset, or add drugs manually.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Brand</th>
                  <th className="text-left py-2 px-2">Generic / Composition</th>
                  <th className="text-left py-2 px-2">Manufacturer</th>
                  <th className="text-left py-2 px-2">Form</th>
                  <th className="text-right py-2 px-2">MRP ₹</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {drugs.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-surface-container-low transition-colors">
                    <td className="py-2 px-2">
                      <span className="font-semibold text-foreground">{d.name}</span>
                      {d.packSizeLabel && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{d.packSizeLabel}</p>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground max-w-[260px]">
                      <span className="line-clamp-1 text-foreground">{d.genericName ?? '—'}</span>
                      {d.saltComposition && (
                        <span className="line-clamp-1 text-[10px] text-muted-foreground">{d.saltComposition}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{d.manufacturer ?? '—'}</td>
                    <td className="py-2 px-2 text-xs capitalize">{d.dosageForm ?? '—'}</td>
                    <td className="py-2 px-2 text-right text-xs">
                      {d.mrp != null ? `₹ ${Number(d.mrp).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex flex-col items-start gap-0.5">
                        {d.isDiscontinued ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            Discontinued
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              d.isPublished
                                ? 'bg-primary/10 text-primary'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {d.isPublished ? 'Published' : 'Draft'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button className="p-1 rounded hover:bg-surface-container-high">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(d)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmDelete(d)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>
                Page {meta?.page ?? page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit drug' : 'Add drug to catalog'}</DialogTitle>
            <DialogDescription>
              Platform-wide entry. Hospitals import this into their own formulary and set local
              pricing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium">Brand name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium">Generic Name(s)</label>
              <Input
                value={form.genericName ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, genericName: e.target.value }))}
                placeholder="e.g. Paracetamol, Caffeine (comma-separate multiple)"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium">Composition</label>
              <Input
                value={form.saltComposition ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, saltComposition: e.target.value }))}
                placeholder="e.g. Paracetamol (500mg) + Caffeine (65mg)"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Manufacturer</label>
              <Input
                value={form.manufacturer ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Dosage form</label>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={form.dosageForm ?? ''}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dosageForm: (e.target.value || null) as any }))
                }
              >
                <option value="">—</option>
                {DOSAGE_FORMS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Strength</label>
              <Input
                value={form.strength ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, strength: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Pack size</label>
              <Input
                value={form.packSizeLabel ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, packSizeLabel: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium">MRP ₹</label>
              <Input
                type="number"
                value={form.mrp ?? ''}
                onChange={(e) =>
                  setForm((p) => ({ ...p, mrp: e.target.value === '' ? null : Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium">Schedule (H/H1/X)</label>
              <Input
                value={form.schedule ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Type</label>
              <Input
                value={form.type ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                placeholder="allopathy / ayurvedic / …"
              />
            </div>
            <div>
              <label className="text-xs font-medium">HSN code</label>
              <Input
                className="font-mono"
                value={form.hsnCode ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, hsnCode: e.target.value }))}
                placeholder="e.g. 30049099"
              />
            </div>
            <div>
              <label className="text-xs font-medium">GST %</label>
              <Input
                type="number"
                step="0.01"
                value={form.gstRate ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, gstRate: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="e.g. 12"
              />
            </div>
            <div className="col-span-2 border-t pt-2 mt-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Barcodes / Product Resolution</p>
            </div>
            <div>
              <label className="text-xs font-medium">GTIN (consumer unit)</label>
              <Input
                className="font-mono"
                value={form.gtin ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, gtin: e.target.value }))}
                placeholder="e.g. 8901234567890"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Case-pack GTIN (outer)</label>
              <Input
                className="font-mono"
                value={form.casePackGtin ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, casePackGtin: e.target.value }))}
                placeholder="GTIN-14"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Units / case</label>
              <Input
                type="number"
                min={1}
                value={form.unitsPerCase ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, unitsPerCase: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="e.g. 24"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Manufacturer code</label>
              <Input
                value={form.manufacturerCode ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, manufacturerCode: e.target.value }))}
              />
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-4 border-t pt-3 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.isPublished ?? true}
                  onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))}
                />
                Published (visible to hospitals)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.isDiscontinued ?? false}
                  onChange={(e) => setForm((p) => ({ ...p, isDiscontinued: e.target.checked }))}
                />
                Discontinued
              </label>
            </div>
          </div>

          {/* Read-only clinical detail (from the dataset / provider feed) */}
          {editing && (editing.description || editing.sideEffects) && (
            <div className="space-y-2 rounded-lg border bg-surface-container-low p-3 text-xs max-h-56 overflow-y-auto">
              <p className="font-semibold text-on-surface-variant">Clinical detail (reference)</p>
              {editing.description && (
                <p><span className="text-muted-foreground">Uses: </span>{editing.description}</p>
              )}
              {editing.sideEffects && (
                <p><span className="text-muted-foreground">Side effects: </span>{editing.sideEffects}</p>
              )}
              {editing.drugInteractions?.drug && editing.drugInteractions.drug.length > 0 && (
                <p>
                  <span className="text-muted-foreground">Interactions: </span>
                  {editing.drugInteractions.drug.slice(0, 8).join(', ')}
                  {editing.drugInteractions.drug.length > 8 ? ` +${editing.drugInteractions.drug.length - 8}` : ''}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete drug?</DialogTitle>
            <DialogDescription>
              &quot;{confirmDelete?.name}&quot; will be removed from the catalog. Hospital formulary
              rows already imported from it keep working but lose the catalog link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteDrug.isPending}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
