'use client';

// Super-admin GST slab master.
//
// The rates the law recognises, and the window each was legal in. This is the
// list nothing may be billed outside of: the finalisation gate, the counter
// sale and every endpoint that writes a rate onto a master all check against
// it, and each of them names these rates in its refusal.
//
// Date-ranged, which is what resolves the contradiction the review document
// raised — the report lists 0/5/12/18/28/40 while also saying 12% and 28% were
// removed. Both are true on different dates: the 56th GST Council retired them
// with effect from 22 September 2025. A bill raised in June 2025 at 12% was
// correct and stays correct, because every check is made as at the document's
// own date.
//
// So a slab is CLOSED with an end date, never deleted. Deleting one would make
// every bill issued under it unexplainable.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';
import {
  useCreateGstSlab, useGstSlabs, useUpdateGstSlab, type GstSlab,
} from '@/hooks/use-gst-slabs';

const EMPTY = {
  ratePercent: 0,
  label: '',
  effectiveFrom: '',
  effectiveTo: '',
  note: '',
};

export default function GstSlabsPage() {
  const { data, isLoading } = useGstSlabs();
  const create = useCreateGstSlab();
  const update = useUpdateGstSlab();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GstSlab | null>(null);
  const [form, setForm] = useState(EMPTY);

  const slabs = useMemo(() => data?.slabs ?? [], [data]);
  const current = slabs.filter((s) => s.current);
  const closed = slabs.filter((s) => !s.current);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (s: GstSlab) => {
    setEditing(s);
    setForm({
      ratePercent: s.ratePercent,
      label: s.label,
      effectiveFrom: s.effectiveFrom.slice(0, 10),
      effectiveTo: s.effectiveTo ? s.effectiveTo.slice(0, 10) : '',
      note: s.note ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          label: form.label.trim(),
          effectiveTo: form.effectiveTo ? form.effectiveTo : null,
          note: form.note.trim() || null,
        });
        toast.success('Slab updated');
      } else {
        if (!form.effectiveFrom) {
          toast.error('A slab needs the date it became legal.');
          return;
        }
        await create.mutateAsync({
          ratePercent: form.ratePercent,
          label: form.label.trim() || `${form.ratePercent}%`,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || null,
          note: form.note.trim() || null,
        });
        toast.success('Slab added');
      }
      setOpen(false);
    } catch (e) {
      toast.error((e as Error)?.message || 'Could not save the slab');
    }
  };

  const Row = ({ s }: { s: GstSlab }) => (
    <tr className="border-t">
      <td className="px-3 py-2 font-label">{s.label}</td>
      <td className="px-3 py-2 text-right tabular-nums">{s.ratePercent}%</td>
      <td className="px-3 py-2">{formatDate(s.effectiveFrom)}</td>
      <td className="px-3 py-2">
        {s.effectiveTo ? formatDate(s.effectiveTo) : <span className="text-muted-foreground">still in force</span>}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{s.note ?? '—'}</td>
      <td className="px-3 py-2 text-right">
        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
          <Pencil className="size-3.5" />
        </Button>
      </td>
    </tr>
  );

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Scale className="size-5" /> GST Slabs
          </h1>
          <p className="max-w-3xl text-xs text-muted-foreground">
            The rates the law recognises. Nothing on the platform can be billed outside this
            list — the finalisation gate, the pharmacy counter and every master that stores a
            rate all check against it.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 size-4" /> Add a slab
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">
              In force today <Badge variant="outline">{current.length}</Badge>
            </h2>
            <div className="overflow-x-auto rounded-xl border bg-surface-container-lowest">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2">Legal from</th>
                    <th className="px-3 py-2">Until</th>
                    <th className="px-3 py-2">Why</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {current.map((s) => (
                    <Row key={s.id} s={s} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {closed.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">
                Closed <Badge variant="outline">{closed.length}</Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Kept, not deleted. A bill raised while one of these was legal has to stay
                explainable, and the rate check is made as at the bill&apos;s own date.
              </p>
              <div className="overflow-x-auto rounded-xl border bg-surface-container-lowest opacity-80">
                <table className="w-full text-sm">
                  <tbody>
                    {closed.map((s) => (
                      <Row key={s.id} s={s} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground">{data?.note}</p>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit slab' : 'Add a slab'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'The rate and the date it became legal cannot change — those are what bills already issued were judged against. Close it with an end date instead.'
                : 'A rate the law recognises, and the date it became legal.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Rate %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  disabled={!!editing}
                  value={form.ratePercent}
                  onChange={(e) => setForm({ ...form, ratePercent: Number(e.target.value) })}
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder={`${form.ratePercent}%`}
                  className="mt-1 h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Legal from</Label>
                <Input
                  type="date"
                  disabled={!!editing}
                  value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Until (blank = still in force)</Label>
                <Input
                  type="date"
                  value={form.effectiveTo}
                  onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                  className="mt-1 h-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Why — the notification or Council meeting</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="e.g. Retired by the 56th GST Council, effective 22 Sep 2025"
                className="mt-1 h-8"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
