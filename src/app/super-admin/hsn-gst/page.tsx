'use client';

// Super-admin HSN → GST Tax Master. In India the GST rate on an item is decided
// by its HSN code; this platform-wide reference is the single source of truth
// that turns an HSN into a rate. At stock inward the entered/scanned HSN is
// matched here by LONGEST PREFIX (an 8-digit tariff item wins over its 4-digit
// chapter heading) and its GST auto-fills the batch — so operators never have to
// remember the rate per medicine. Editable here; every hospital shares it.

import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  Receipt,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Pencil,
  Trash2,
  Info,
  Layers,
  FileUp,
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
  useHsnGstRatesAdmin,
  useCreateHsnGstRate,
  useUpdateHsnGstRate,
  useDeleteHsnGstRate,
  useBulkHsnGstRates,
  type HsnGstRate,
  type HsnGstRateInput,
} from '@/hooks/use-drug-master';

const CATEGORIES = ['medicine', 'consumable', 'device', 'supplement', 'other'] as const;

// GST 2.0 slabs (effective 22-Sep-2025). Pharma/healthcare falls in these:
//   0%  — Nil-rated: 33 notified life-saving drugs, and all individual health &
//         life insurance. Also NIL medicines like ORS.
//   5%  — Standard rate for the vast majority of medicines (formulations,
//         AYUSH, most APIs) and medical devices/consumables (reduced from 12%).
//   18% — A handful of items still taxed higher (e.g. nicotine gums, certain
//         non-medicinal wellness products).
//   40% — Special de-merit slab (tobacco, pan masala, aerated/sugary drinks) —
//         rarely a pharmacy line, kept for completeness.
const GST_SLABS = [
  { value: 0, label: '0% — Nil (life-saving / exempt)' },
  { value: 5, label: '5% — Most medicines & devices' },
  { value: 18, label: '18% — Higher-rated items' },
  { value: 40, label: '40% — Special de-merit' },
] as const;

const EMPTY: HsnGstRateInput = {
  hsnCode: '',
  description: '',
  gstRate: 5,
  category: 'medicine',
  isActive: true,
};

const CATEGORY_STYLES: Record<string, string> = {
  medicine: 'bg-primary/10 text-primary',
  consumable: 'bg-blue-100 text-blue-700',
  device: 'bg-purple-100 text-purple-700',
  supplement: 'bg-amber-100 text-amber-700',
  other: 'bg-muted text-muted-foreground',
};

export default function SuperAdminHsnGstPage() {
  const [search, setSearch] = useState('');
  const { data: rows = [], isLoading } = useHsnGstRatesAdmin();
  const createRate = useCreateHsnGstRate();
  const updateRate = useUpdateHsnGstRate();
  const deleteRate = useDeleteHsnGstRate();
  const bulkRates = useBulkHsnGstRates();

  const [editing, setEditing] = useState<HsnGstRate | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<HsnGstRateInput>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<HsnGstRate | null>(null);

  // Bulk import
  const [openBulk, setOpenBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkGst, setBulkGst] = useState(5);
  const [bulkCategory, setBulkCategory] = useState<string>('medicine');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.hsnCode.includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpenForm(true);
  }

  function openEdit(r: HsnGstRate) {
    setEditing(r);
    setForm({
      hsnCode: r.hsnCode,
      description: r.description ?? '',
      gstRate: r.gstRate,
      category: r.category ?? 'other',
      isActive: r.isActive ?? true,
    });
    setOpenForm(true);
  }

  async function handleSave() {
    const hsnCode = form.hsnCode.replace(/\D/g, '');
    if (!hsnCode) {
      toast.error('HSN code (digits only) is required');
      return;
    }
    if (form.gstRate == null || Number.isNaN(Number(form.gstRate))) {
      toast.error('GST rate is required');
      return;
    }
    const payload: HsnGstRateInput = {
      hsnCode,
      description: form.description?.toString().trim() || null,
      gstRate: Number(form.gstRate),
      category: form.category || null,
      isActive: form.isActive ?? true,
    };
    try {
      if (editing) {
        await updateRate.mutateAsync({ id: editing.id, ...payload });
        toast.success('HSN → GST rate updated');
      } else {
        await createRate.mutateAsync(payload);
        toast.success('HSN → GST rate added');
      }
      setOpenForm(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to save';
      toast.error(msg);
    }
  }

  async function handleDelete(r: HsnGstRate) {
    try {
      await deleteRate.mutateAsync(r.id);
      toast.success('HSN → GST rate removed');
      setConfirmDelete(null);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete';
      toast.error(msg);
    }
  }

  // Parse the bulk textarea. Each non-empty line is:
  //   HSN [, GST%] [, description] [, category]
  // A line that omits GST / category inherits the defaults chosen above.
  function parseBulk(): HsnGstRateInput[] {
    const out: HsnGstRateInput[] = [];
    for (const raw of bulkText.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      const hsnCode = (parts[0] ?? '').replace(/\D/g, '');
      if (!hsnCode) continue;
      const gstPart = parts[1] ? Number(parts[1].replace(/[^\d.]/g, '')) : NaN;
      const catPart = parts[3]?.toLowerCase();
      out.push({
        hsnCode,
        gstRate: Number.isNaN(gstPart) ? bulkGst : gstPart,
        description: parts[2] || null,
        category: (CATEGORIES as readonly string[]).includes(catPart ?? '')
          ? catPart!
          : bulkCategory || null,
        isActive: true,
      });
    }
    return out;
  }

  // Read an Excel/CSV file and append its rows to the bulk textarea as
  //   HSN, GST%, description, category
  // lines, so they flow through the same parse/preview/import path. Columns are
  // taken positionally (HSN, GST, description, category); a header row whose
  // first cell isn't a number is skipped.
  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        toast.error('The file has no sheets');
        return;
      }
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: '',
      });
      const lines: string[] = [];
      for (const row of grid) {
        const cells = (row as unknown[]).map((c) => String(c ?? '').trim());
        const hsn = (cells[0] ?? '').replace(/\D/g, '');
        if (!hsn) continue; // skip blank / header rows (non-numeric first cell)
        const parts = [hsn, cells[1] ?? '', cells[2] ?? '', cells[3] ?? ''];
        // Trim trailing empties so a bare HSN stays a single token.
        while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
        lines.push(parts.join(', '));
      }
      if (!lines.length) {
        toast.error('No HSN codes found in the file');
        return;
      }
      setBulkText((prev) => (prev.trim() ? `${prev.trim()}\n${lines.join('\n')}` : lines.join('\n')));
      toast.success(`Loaded ${lines.length} row(s) from ${file.name}`);
    } catch {
      toast.error('Could not read the file — is it a valid .xlsx / .csv?');
    }
  }

  const bulkPreview = parseBulk();

  async function handleBulkSave() {
    const rows = parseBulk();
    if (!rows.length) {
      toast.error('Add at least one HSN code (one per line)');
      return;
    }
    try {
      const res = await bulkRates.mutateAsync(rows);
      const skipped = res?.skipped?.length ?? 0;
      toast.success(
        `Imported ${res?.created ?? 0} new, updated ${res?.updated ?? 0}` +
          (skipped ? `, skipped ${skipped}` : ''),
      );
      setBulkText('');
      setOpenBulk(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Bulk import failed';
      toast.error(msg);
    }
  }

  const saving = createRate.isPending || updateRate.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            HSN → GST Tax Master
          </h1>
          <p className="font-label text-sm text-on-surface-variant">
            Platform-wide HSN → GST reference. Adding stock auto-fills GST from the item&apos;s HSN.
            {rows.length ? ` ${rows.length} code(s).` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setOpenBulk(true)} className="gap-1.5">
            <Layers className="h-4 w-4" />
            Bulk add
          </Button>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add HSN code
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-xs text-on-surface-variant">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Matching is <strong>longest-prefix</strong>: a specific 8-digit tariff item (e.g. ORS
          <span className="font-mono"> 30049010</span> → 0%) wins over its 4-digit chapter heading
          (<span className="font-mono">3004</span> → 5%). Rates reflect the GST 2.0 slabs effective
          22-Sep-2025 (most medicines &amp; medical devices at 5%). Edit any row to match your own
          classification — hospitals bill at their own price regardless.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <div className="relative mb-3 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search HSN, description or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? 'No HSN codes match your search.' : 'No HSN → GST rates yet. Add one to begin.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2 px-2">HSN Code</th>
                  <th className="text-left py-2 px-2">Description</th>
                  <th className="text-left py-2 px-2">Category</th>
                  <th className="text-right py-2 px-2">GST %</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-surface-container-low transition-colors">
                    <td className="py-2 px-2 font-mono font-semibold text-foreground">{r.hsnCode}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground max-w-[360px]">
                      <span className="line-clamp-1">{r.description ?? '—'}</span>
                    </td>
                    <td className="py-2 px-2">
                      {r.category ? (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            CATEGORY_STYLES[r.category] ?? CATEGORY_STYLES.other
                          }`}
                        >
                          {r.category}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-semibold tabular-nums">{r.gstRate}%</td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {r.isActive ? 'Active' : 'Inactive'}
                      </span>
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
                          <DropdownMenuItem onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmDelete(r)}
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
          </div>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit HSN → GST rate' : 'Add HSN → GST rate'}</DialogTitle>
            <DialogDescription>
              A 4-digit HSN is a chapter-wide default; add a 6/8-digit code to override the rate for
              a specific item.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">HSN code *</label>
              <Input
                className="font-mono"
                value={form.hsnCode}
                inputMode="numeric"
                onChange={(e) => setForm((p) => ({ ...p, hsnCode: e.target.value.replace(/\D/g, '') }))}
                placeholder="e.g. 3004"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium">GST rate *</label>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={String(form.gstRate)}
                onChange={(e) => setForm((p) => ({ ...p, gstRate: Number(e.target.value) }))}
              >
                {GST_SLABS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
                {/* Preserve a legacy rate (e.g. 12% / 28%) when editing an older
                    row so the dropdown still shows its real value. */}
                {!GST_SLABS.some((s) => s.value === Number(form.gstRate)) && (
                  <option value={String(form.gstRate)}>{form.gstRate}% (legacy)</option>
                )}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium">Description</label>
              <Input
                value={form.description ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Medicaments in measured doses or retail packing"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Category</label>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm capitalize"
                value={form.category ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value || null }))}
              >
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4"
                />
                Active (used at stock inward)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Add code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk add dialog */}
      <Dialog open={openBulk} onOpenChange={setOpenBulk}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk add HSN → GST rates</DialogTitle>
            <DialogDescription>
              Paste one HSN per line — <span className="font-mono">HSN, GST%, description, category</span> —
              or upload an Excel / CSV with those columns in that order. Lines that omit the
              rate/category use the defaults below. Re-importing an existing HSN updates its rate.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Default GST rate</label>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={String(bulkGst)}
                onChange={(e) => setBulkGst(Number(e.target.value))}
              >
                {GST_SLABS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Default category</label>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm capitalize"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
              >
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">HSN codes</label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp className="h-3.5 w-3.5" />
                Upload Excel / CSV
              </Button>
            </div>
            <textarea
              className="w-full min-h-40 rounded-md border bg-background px-2.5 py-2 text-sm font-mono"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`3004\n30049010, 0, ORS sachets\n9018, 5, Medical devices, device\n300450, 18`}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {bulkPreview.length} valid row{bulkPreview.length === 1 ? '' : 's'} detected.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBulk(false)} disabled={bulkRates.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkSave}
              disabled={bulkRates.isPending || bulkPreview.length === 0}
              className="gap-1.5"
            >
              {bulkRates.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {bulkPreview.length || ''} code{bulkPreview.length === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove HSN → GST rate?</DialogTitle>
            <DialogDescription>
              <span className="font-mono font-semibold">{confirmDelete?.hsnCode}</span> ·{' '}
              {confirmDelete?.gstRate}% will no longer auto-fill GST at stock inward. This can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              disabled={deleteRate.isPending}
              className="gap-1.5"
            >
              {deleteRate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
