'use client';

// Radiology Settings — radiology_admin only.
//
// A single "Imaging Modalities" catalog. Each row is a modality the department
// offers (X-Ray, CT, MRI, USG, or any custom one the admin types) with a price.
// Doctors pick a modality from this list when ordering imaging and write the
// body part themselves. Backed by ServiceTariff rows in the imaging category;
// the underlying ImagingType enum is auto-derived from the name on the backend
// (so the admin never has to pick a modality "type").

import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Search, Activity, RefreshCw, Save, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useServiceTariffs, useCreateServiceTariff, useUpdateServiceTariff, useDeleteServiceTariff,
  type ServiceTariff,
} from '@/hooks/use-service-tariffs';
import { RadiologyAdminGuard } from '@/components/radiology/radiology-admin-guard';

export default function RadiologySettingsPage() {
  return (
    <RadiologyAdminGuard>
      <RadiologySettingsInner />
    </RadiologyAdminGuard>
  );
}

function RadiologySettingsInner() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="Imaging Modalities"
        description="The imaging studies your department offers and their prices. Doctors pick a modality from this list and write the body part when ordering."
      />
      <ModalitiesSection />
    </div>
  );
}

// ── Modalities catalog ───────────────────────────────────────────────────────

function ModalitiesSection() {
  const [search, setSearch] = useState('');
  const tariffsQ = useServiceTariffs({ category: 'imaging', limit: 200 });
  const all = tariffsQ.data?.data ?? [];
  const modalities = all.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.serviceName.toLowerCase().includes(q) ||
      (t.serviceCode ?? '').toLowerCase().includes(q)
    );
  });

  const [editing, setEditing] = useState<ServiceTariff | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ServiceTariff | null>(null);
  const del = useDeleteServiceTariff();

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      toast.success(`${deleting.serviceName} deleted`);
      setDeleting(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to delete modality');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search modality name…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => tariffsQ.refetch()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Modality
          </Button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        {tariffsQ.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : modalities.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No modalities yet"
            description="Add the imaging studies your department offers (X-Ray, CT, MRI, USG…) so doctors can order them."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  <Th>Modality</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">GST %</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {modalities.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-medium">{t.serviceName}</td>
                    <td className="px-4 py-3 text-right">
                      {Number(t.basePrice).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                    </td>
                    <td className="px-4 py-3 text-right">{Number(t.gstRatePercent ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn(
                        t.isActive ? 'bg-green-50 text-green-700 border-green-300' : 'bg-zinc-100 text-zinc-600',
                      )}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-error hover:text-error"
                          onClick={() => setDeleting(t)}
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalityEditorDialog
        mode="create"
        open={creating}
        onOpenChange={(o) => !o && setCreating(false)}
      />
      <ModalityEditorDialog
        mode="edit"
        tariff={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete modality?</DialogTitle>
            <DialogDescription>
              "{deleting?.serviceName}" will be removed from the imaging catalog and
              doctors will no longer be able to order it. Existing bills are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={del.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={del.isPending}
              className="bg-error text-white hover:bg-error/90"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function slugifyCode(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || 'mod'}-${suffix}`;
}

function ModalityEditorDialog({
  mode, tariff, open, onOpenChange,
}: {
  mode: 'create' | 'edit';
  tariff?: ServiceTariff | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const create = useCreateServiceTariff();
  const update = useUpdateServiceTariff();

  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState<number | ''>('');
  const [taxRate, setTaxRate] = useState<number | ''>(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (tariff) {
      setName(tariff.serviceName);
      setBasePrice(Number(tariff.basePrice));
      setTaxRate(Number(tariff.gstRatePercent ?? 0));
      setIsActive(tariff.isActive);
    } else {
      setName(''); setBasePrice(''); setTaxRate(0); setIsActive(true);
    }
  }, [open, tariff?.id]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Modality name is required'); return; }
    if (basePrice === '' || Number(basePrice) <= 0) { toast.error('Price must be positive'); return; }

    try {
      if (mode === 'create') {
        await create.mutateAsync({
          name: name.trim(),
          code: slugifyCode(name),
          category: 'imaging',
          basePrice: Number(basePrice),
          taxRate: Number(taxRate || 0),
          isActive,
        });
        toast.success('Modality added');
      } else if (tariff) {
        await update.mutateAsync({
          id: tariff.id,
          name: name.trim(),
          category: 'imaging',
          basePrice: Number(basePrice),
          taxRate: Number(taxRate || 0),
          isActive,
        });
        toast.success('Modality updated');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save modality');
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Modality' : 'Edit Modality'}</DialogTitle>
          <DialogDescription>
            Doctors will be able to search and pick this modality when ordering imaging, and it auto-bills at the price set here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Modality Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MRI, CT Scan, Ultrasound, Mammography" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Price (₹) *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <Label>GST %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rad-modality-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <Label htmlFor="rad-modality-active" className="cursor-pointer">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={handleSave} disabled={pending}>
            <Save className="mr-1.5 h-4 w-4" />
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th className={cn(
      'px-4 pb-4 pt-5 font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest',
      align === 'right' ? 'text-right' : 'text-left',
    )}>
      {children}
    </th>
  );
}
