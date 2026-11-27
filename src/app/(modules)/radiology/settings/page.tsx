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
  BadgeCheck, Plus, Pencil, Search, Activity, RefreshCw, Save, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useGstSlabs } from '@/hooks/use-gst-slabs';
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
  useApproveRadiologyDiagnostic, useSetTariffGstApproval, radiologyGstSet,
  type ServiceTariff,
} from '@/hooks/use-service-tariffs';
import { useCanManageGst } from '@/hooks/use-gst-portal';
import { getApiErrorMessage } from '@/lib/utils';
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

  // #358: the finance / GST admin approves each study's GST. Nothing is approved
  // until they do, and only what they select.
  const canApprove = useCanManageGst();
  const approveDiagnostic = useApproveRadiologyDiagnostic();
  const setApproval = useSetTariffGstApproval();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const approvable = modalities.filter((t) => !t.isCosmetic && !radiologyGstSet(t));
  const chosen = approvable.filter((t) => selected.has(t.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const approveAsDiagnostic = async (rows: ServiceTariff[]) => {
    try {
      const res = await approveDiagnostic.mutateAsync(rows.map((t) => t.id));
      if (res.approved.length) toast.success(`${res.approved.length} approved as diagnostic — exempt, 0%`);
      for (const s of res.skipped) toast.warning(`${s.serviceName ?? 'Study'} not approved: ${s.reason}`, { duration: 8000 });
      setSelected(new Set());
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not approve'));
    }
  };
  const changeApproval = async (t: ServiceTariff, approved: boolean) => {
    try {
      await setApproval.mutateAsync({ id: t.id, approved });
      toast.success(approved ? `${t.serviceName} approved at ${Number(t.gstRatePercent)}%` : `Approval withdrawn from ${t.serviceName}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not change the approval'));
    }
  };
  const notSet = all.filter((t) => t.isActive && !radiologyGstSet(t));
  const cosmeticNotSet = notSet.filter((t) => t.isCosmetic);

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
          {canApprove ? (
            <Button
              variant="outline"
              size="sm"
              disabled={!chosen.length || approveDiagnostic.isPending}
              onClick={() => approveAsDiagnostic(chosen)}
            >
              <BadgeCheck className="mr-1.5 h-4 w-4" /> Approve selected as diagnostic 0%{chosen.length ? ` (${chosen.length})` : ''}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => tariffsQ.refetch()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Modality
          </Button>
        </div>
      </div>

      {!tariffsQ.isLoading && notSet.length > 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          GST is not set for {notSet.length} of {all.filter((t) => t.isActive).length} active studies. Diagnostic scans are
          billed as exempt until the finance / GST admin approves them.
          {cosmeticNotSet.length
            ? ` ${cosmeticNotSet.length} cosmetic / non-medical study(ies) cannot be billed until their rate and SAC are approved.`
            : ''}
        </p>
      ) : null}

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
                  {canApprove ? (
                    <Th>
                      <input
                        type="checkbox"
                        aria-label="Select every diagnostic study not yet approved"
                        checked={approvable.length > 0 && chosen.length === approvable.length}
                        disabled={!approvable.length}
                        onChange={(e) => setSelected(e.target.checked ? new Set(approvable.map((t) => t.id)) : new Set())}
                      />
                    </Th>
                  ) : null}
                  <Th>Modality</Th>
                  <Th>Purpose</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">GST</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {modalities.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low">
                    {canApprove ? (
                      <td className="px-4 py-3">
                        {!t.isCosmetic && !radiologyGstSet(t) ? (
                          <input
                            type="checkbox"
                            aria-label={`Select ${t.serviceName}`}
                            checked={selected.has(t.id)}
                            onChange={() => toggle(t.id)}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="px-4 py-3 font-medium">{t.serviceName}</td>
                    <td className="px-4 py-3 text-xs">{t.isCosmetic ? 'Cosmetic / non-medical' : 'Diagnostic'}</td>
                    <td className="px-4 py-3 text-right">
                      {Number(t.basePrice).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                    </td>
                    {/* #358: a rate counts only once the finance / GST admin has
                        approved it. Until then it is "GST not set", never 0%. */}
                    <td className="px-4 py-3 text-right">
                      <GstCell t={t} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn(
                        t.isActive ? 'bg-green-50 text-green-700 border-green-300' : 'bg-zinc-100 text-zinc-600',
                      )}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canApprove && !radiologyGstSet(t) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={approveDiagnostic.isPending || setApproval.isPending}
                            onClick={() => (t.isCosmetic ? changeApproval(t, true) : approveAsDiagnostic([t]))}
                          >
                            <BadgeCheck className="size-3.5" />{' '}
                            {t.isCosmetic ? `Approve${Number(t.gstRatePercent) > 0 ? ` ${Number(t.gstRatePercent)}%` : ''}` : 'Approve 0%'}
                          </Button>
                        ) : null}
                        {canApprove && t.gstApproved ? (
                          <Button size="sm" variant="ghost" disabled={setApproval.isPending} onClick={() => changeApproval(t, false)}>
                            Withdraw
                          </Button>
                        ) : null}
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
              &quot;{deleting?.serviceName}&quot; will be removed from the imaging catalog and
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

function GstCell({ t }: { t: ServiceTariff }) {
  if (radiologyGstSet(t)) {
    return (
      <span className="text-xs">
        {t.gstTreatment === 'taxable' ? `${Number(t.gstRatePercent)}%` : `0% (${String(t.gstTreatment).replace(/_/g, ' ')})`}
        {t.sacCode ? <span className="block font-mono text-[10px] text-muted-foreground">SAC {t.sacCode}</span> : null}
      </span>
    );
  }
  const proposed = t.isCosmetic && Number(t.gstRatePercent ?? 0) > 0;
  return (
    <span className="text-xs text-amber-700" title="The finance / GST admin has not approved this study's GST">
      GST not set
      {proposed ? <span className="block text-[10px]">{Number(t.gstRatePercent)}% entered, awaiting approval</span> : null}
      {t.isCosmetic ? <span className="block text-[10px] text-red-700">Cannot be billed yet</span> : null}
    </span>
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
  // #358: no default. A cosmetic / non-medical scan's rate is the admin's to enter.
  const [taxRate, setTaxRate] = useState<number | ''>('');
  const [cosmetic, setCosmetic] = useState(false);
  const [sacCode, setSacCode] = useState('');
  // The rates in force today — the same list the finalisation gate checks
  // against, so this form cannot offer one the bill will refuse.
  const { data: radSlabs } = useGstSlabs();
  const radLegalRates = (radSlabs?.slabs ?? [])
    .filter((x) => x.current)
    .map((x) => x.ratePercent)
    .sort((a, b) => a - b);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (tariff) {
      setName(tariff.serviceName);
      setBasePrice(Number(tariff.basePrice));
      setCosmetic(!!tariff.isCosmetic);
      setTaxRate(tariff.isCosmetic && Number(tariff.gstRatePercent ?? 0) > 0 ? Number(tariff.gstRatePercent) : '');
      setSacCode(tariff.sacCode ?? '');
      setIsActive(tariff.isActive);
    } else {
      setName(''); setBasePrice(''); setTaxRate(''); setCosmetic(false); setSacCode(''); setIsActive(true);
    }
  }, [open, tariff?.id]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Modality name is required'); return; }
    if (basePrice === '' || Number(basePrice) <= 0) { toast.error('Price must be positive'); return; }
    if (cosmetic && !(Number(taxRate) > 0)) { toast.error('Choose the GST rate for a cosmetic / non-medical scan'); return; }
    if (cosmetic && !/^\d{6}$/.test(sacCode)) { toast.error('Enter the 6-digit SAC for a cosmetic / non-medical scan'); return; }
    if (!cosmetic && sacCode && !/^\d{6}$/.test(sacCode)) { toast.error('A SAC code is 6 digits'); return; }

    // The purpose decides the treatment. An unchanged classification is not sent,
    // so editing a name or a price never withdraws an approval.
    const gst = cosmetic
      ? { isCosmetic: true, gstTreatment: 'taxable' as const, taxRate: Number(taxRate), sacCode }
      : {
          isCosmetic: false,
          gstTreatment: tariff?.gstTreatment && tariff.gstTreatment !== 'taxable' ? tariff.gstTreatment : ('exempt' as const),
          taxRate: 0,
          sacCode: sacCode || null,
        };
    const gstChanged =
      !tariff ||
      !!tariff.isCosmetic !== gst.isCosmetic ||
      Number(tariff.gstRatePercent ?? 0) !== gst.taxRate ||
      (tariff.sacCode ?? null) !== (gst.sacCode || null);

    try {
      if (mode === 'create') {
        await create.mutateAsync({
          name: name.trim(),
          code: slugifyCode(name),
          category: 'imaging',
          basePrice: Number(basePrice),
          ...gst,
          isActive,
        });
        toast.success('Modality added — its GST still needs the finance / GST admin’s approval');
      } else if (tariff) {
        await update.mutateAsync({
          id: tariff.id,
          name: name.trim(),
          category: 'imaging',
          basePrice: Number(basePrice),
          ...(gstChanged ? gst : {}),
          isActive,
        });
        toast.success(gstChanged ? 'Modality updated — its GST needs approving' : 'Modality updated');
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
              <Label>Scan purpose *</Label>
              <Select value={cosmetic ? 'cosmetic' : 'diagnostic'} onValueChange={(v: string | null) => v && setCosmetic(v === 'cosmetic')}>
                <SelectTrigger>
                  <SelectValue>{cosmetic ? 'Cosmetic / non-medical' : 'Diagnostic'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diagnostic">Diagnostic</SelectItem>
                  <SelectItem value="cosmetic">Cosmetic / non-medical</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {cosmetic ? 'Taxable. Enter the rate and SAC.' : 'Exempt (0%).'} The finance / GST admin approves it.
              </p>
            </div>
            {cosmetic ? (
              <div>
                <Label>GST % *</Label>
                {/* A rate the law recognises, and no default: the client gave none. */}
                <Select value={taxRate === '' ? null : String(taxRate)} onValueChange={(v: string | null) => v != null && setTaxRate(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {radLegalRates
                      .filter((r) => r > 0)
                      .map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r}%
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div>
              <Label htmlFor="rad-sac">SAC {cosmetic ? '*' : '(optional)'}</Label>
              <Input
                id="rad-sac"
                inputMode="numeric"
                maxLength={6}
                value={sacCode}
                onChange={(e) => setSacCode(e.target.value.replace(/\D/g, ''))}
                placeholder={cosmetic ? '6 digits' : '999316 if left blank'}
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
