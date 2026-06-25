'use client';

import { useState } from 'react';
import {
  useIcdList,
  useCreateIcd,
  useUpdateIcd,
  useDeleteIcd,
  type IcdCode,
  type IcdCodeInput,
} from '@/hooks/use-icd';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Stethoscope, Plus, Pencil, Trash2 } from 'lucide-react';

const EMPTY: IcdCodeInput = { code: '', title: '', category: '', chapter: '', isBillable: true, keywords: [] };

export default function SuperAdminIcdCodesPage() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useIcdList({ page, limit, q: search || undefined, includeInactive: true });
  const createIcd = useCreateIcd();
  const updateIcd = useUpdateIcd();
  const deleteIcd = useDeleteIcd();

  const codes = data?.data ?? [];
  const meta = data?.meta;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IcdCode | null>(null);
  const [form, setForm] = useState<IcdCodeInput>(EMPTY);
  const [keywordsText, setKeywordsText] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setKeywordsText('');
    setOpen(true);
  };

  const openEdit = (icd: IcdCode) => {
    setEditing(icd);
    setForm({
      code: icd.code,
      title: icd.title,
      category: icd.category ?? '',
      chapter: icd.chapter ?? '',
      isBillable: icd.isBillable,
    });
    setKeywordsText('');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.title.trim()) {
      toast.error('Code and title are required');
      return;
    }
    const payload: IcdCodeInput = {
      ...form,
      keywords: keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    };
    try {
      if (editing) {
        await updateIcd.mutateAsync({ id: editing.id, ...payload });
        toast.success('ICD code updated');
      } else {
        await createIcd.mutateAsync(payload);
        toast.success('ICD code created');
      }
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save');
    }
  };

  const handleDelete = async (icd: IcdCode) => {
    if (!confirm(`Delete ICD code ${icd.code}?`)) return;
    try {
      await deleteIcd.mutateAsync(icd.id);
      toast.success('ICD code deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to delete');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            ICD-10 Codes
          </h1>
          <p className="font-label text-sm text-on-surface-variant">
            Platform-wide diagnosis catalog. Hospitals search these for diagnosis autocomplete and
            can also add their own custom codes.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add code
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by code, title or keyword…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          className="pl-8"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sm ring-1 ring-foreground/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container text-left">
              <th className="px-4 py-3 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Code</th>
              <th className="px-4 py-3 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Title</th>
              <th className="px-4 py-3 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Category</th>
              <th className="px-4 py-3 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Flags</th>
              <th className="px-4 py-3 text-right font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : codes.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No ICD codes found.</td></tr>
            ) : (
              codes.map((icd) => (
                <tr key={icd.id} className="border-b border-surface-container/50 hover:bg-surface-container-low">
                  <td className="px-4 py-2.5 font-semibold text-primary">{icd.code}</td>
                  <td className="px-4 py-2.5">{icd.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{icd.category ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {!icd.isActive && <span className="rounded bg-error/10 px-1.5 py-0.5 text-[10px] text-error">inactive</span>}
                      {icd.isCustom && <span className="rounded bg-secondary/10 px-1.5 py-0.5 text-[10px] text-secondary">custom</span>}
                      {icd.isBillable && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">billable</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(icd)} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(icd)} aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-error" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>{meta?.total ?? codes.length} codes</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
            <span>Page {page} of {meta?.totalPages ?? 1}</span>
            <Button variant="ghost" size="icon-sm" disabled={page >= (meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>›</Button>
          </div>
        </div>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit ICD code' : 'Add ICD code'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label className="text-xs mb-1">Code *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="E11.9" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-1">Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Type 2 diabetes…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1">Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Endocrine" />
              </div>
              <div>
                <Label className="text-xs mb-1">Chapter</Label>
                <Input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1">Search keywords (comma-separated)</Label>
              <Input value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder="diabetes, sugar, dm" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isBillable}
                onChange={(e) => setForm({ ...form, isBillable: e.target.checked })}
              />
              Billable
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createIcd.isPending || updateIcd.isPending}>
              {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
