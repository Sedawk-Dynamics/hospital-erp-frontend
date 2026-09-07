'use client';

// Super-admin SAC → GST master. The twin of the HSN master: an HSN decides the
// rate on GOODS, a SAC decides it on SERVICES. A consultation, a surgery, a
// room, a cosmetic procedure — the determination engine resolves each of them
// through this table by longest prefix, exactly as it resolves a medicine
// through HSN. Platform-wide, because 999311 is inpatient care in every
// hospital in the country.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BriefcaseMedical, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useCreateSacCode, useDeactivateSacCode, useSacCodes, useUpdateSacCode,
  type GstTreatment, type SacCode,
} from '@/hooks/use-sac-codes';

const TREATMENTS: Array<{ value: GstTreatment; label: string; hint: string }> = [
  { value: 'exempt', label: 'Exempt', hint: 'The law exempts it — healthcare under Notification 12/2017' },
  { value: 'taxable', label: 'Taxable', hint: 'Tax is charged at the stated rate' },
  { value: 'nil_rated', label: 'Nil rated', hint: 'The rate itself is nil' },
  { value: 'non_gst', label: 'Non-GST', hint: 'Outside GST altogether' },
  { value: 'zero_rated', label: 'Zero rated', hint: 'Export or SEZ supply' },
];

const EMPTY = {
  sacCode: '',
  description: '',
  gstRate: 0,
  treatment: 'exempt' as GstTreatment,
  category: '',
};

export default function SacCodesPage() {
  const { data: rows = [], isLoading } = useSacCodes();
  const create = useCreateSacCode();
  const update = useUpdateSacCode();
  const deactivate = useDeactivateSacCode();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<SacCode | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.sacCode.includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (row: SacCode) => {
    setEditing(row);
    setForm({
      sacCode: row.sacCode,
      description: row.description ?? '',
      gstRate: row.gstRate,
      treatment: row.treatment,
      category: row.category ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    const body = {
      sacCode: form.sacCode.trim(),
      description: form.description.trim() || null,
      // A rate only means anything on a taxable row. The server reconciles the
      // two as well — a row that says "exempt at 18%" is a typo, not a
      // position — but sending a clean value keeps the form honest too.
      gstRate: form.treatment === 'taxable' ? Number(form.gstRate) : 0,
      treatment: form.treatment,
      category: form.category.trim() || null,
    };
    if (!body.sacCode) {
      toast.error('A SAC code is required');
      return;
    }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...body });
      else await create.mutateAsync(body);
      toast.success(editing ? 'SAC code updated' : 'SAC code added');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the SAC code');
    }
  };

  const remove = async (row: SacCode) => {
    try {
      await deactivate.mutateAsync(row.id);
      toast.success(`${row.sacCode} deactivated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not deactivate the code');
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <BriefcaseMedical className="mt-1 h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">SAC → GST Master</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              What a hospital SERVICE is taxed at. Resolved by longest prefix, so a six-digit code
              beats the four-digit heading above it — 999311 (inpatient care) wins over 9993
              (human health services). Every hospital shares this table.
            </p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Add code
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search code, description or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? 'No SAC codes yet. Add the ones this platform bills against.' : 'Nothing matches that search.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                {['SAC code', 'Description', 'Category', 'Treatment', 'Rate', ''].map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
                      h === 'Rate' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={`border-t ${r.isActive ? '' : 'opacity-50'}`}>
                  <td className="px-3 py-1.5 font-mono">{r.sacCode}</td>
                  <td className="px-3 py-1.5">{r.description ?? '—'}</td>
                  <td className="px-3 py-1.5">{r.category ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant={r.treatment === 'taxable' ? 'default' : 'secondary'}>
                      {TREATMENTS.find((t) => t.value === r.treatment)?.label ?? r.treatment}
                    </Badge>
                    {!r.isActive ? <span className="ml-2 text-xs">inactive</span> : null}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.treatment === 'taxable' ? `${r.gstRate}%` : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)} aria-label={`Edit ${r.sacCode}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {r.isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(r)}
                        aria-label={`Deactivate ${r.sacCode}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.sacCode}` : 'Add a SAC code'}</DialogTitle>
            <DialogDescription>
              The rate applies only to a taxable service. Anything else is a zero rate by
              definition, so the field is put away.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sac">SAC code</Label>
              <Input
                id="sac"
                value={form.sacCode}
                onChange={(e) => setForm((f) => ({ ...f, sacCode: e.target.value }))}
                placeholder="999311"
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="desc">Description</Label>
              <Input
                id="desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Inpatient services"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat">Category</Label>
              <Input
                id="cat"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Healthcare"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="treatment">Treatment</Label>
              <Select
                value={form.treatment}
                onValueChange={(v) => setForm((f) => ({ ...f, treatment: (v ?? 'exempt') as GstTreatment }))}
              >
                <SelectTrigger id="treatment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TREATMENTS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} — {t.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.treatment === 'taxable' ? (
              <div className="space-y-1">
                <Label htmlFor="rate">GST rate %</Label>
                <Input
                  id="rate"
                  type="number"
                  min={0}
                  max={100}
                  value={form.gstRate}
                  onChange={(e) => setForm((f) => ({ ...f, gstRate: Number(e.target.value) }))}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
