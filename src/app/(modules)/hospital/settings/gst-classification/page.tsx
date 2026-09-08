'use client';

// Item mapping and the auditor's sign-off — section 7.2 of the GST report.
//
// Every sellable service has to point at a SAC code, because that is what the
// resolution chain resolves a service's rate through. Until this screen existed
// there was no way to set one: `createServiceTariff` and `updateServiceTariff`
// never wrote `sacCode`, `gstTreatment` or `isCosmetic`, and `gstApproved` was
// read in two places and written nowhere.
//
// The approval is not decoration. The IP charge path reads
//
//     itemRatePercent: tariff.gstApproved ? tariff.gstRatePercent : (data.taxRate ?? null)
//
// so while approval was impossible the tariff's own configured rate was
// DISCARDED on every charge and a rate off the request stood in for it. An
// unapproved classification was worse than none.
//
// The report is explicit about whose job this is: "It should be the hospital's
// own CA or auditor. We build the screens; we should not be choosing tax
// classifications."

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, BadgeCheck, Loader2, Search, ShieldAlert } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  useServiceTariffs, useUpdateServiceTariff, useSetTariffGstApproval,
  type ServiceTariff,
} from '@/hooks/use-service-tariffs';
import { useSacCodes } from '@/hooks/use-sac-codes';
import { useGstSlabs } from '@/hooks/use-gst-slabs';

const TREATMENTS = [
  { value: 'exempt', label: 'Exempt', hint: 'Healthcare under Notification 12/2017' },
  { value: 'taxable', label: 'Taxable', hint: 'Tax is charged at the stated rate' },
  { value: 'nil_rated', label: 'Nil rated', hint: 'The rate itself is nil' },
  { value: 'non_gst', label: 'Non-GST', hint: 'Outside GST altogether' },
  { value: 'zero_rated', label: 'Zero rated', hint: 'Export or SEZ supply' },
] as const;

type Treatment = (typeof TREATMENTS)[number]['value'];

export default function GstClassificationPage() {
  const { data, isLoading } = useServiceTariffs({ limit: 200 });
  const { data: sacCodes = [] } = useSacCodes();
  const { data: slabData } = useGstSlabs();
  const update = useUpdateServiceTariff();
  const approve = useSetTariffGstApproval();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ServiceTariff | null>(null);
  const [form, setForm] = useState({
    sacCode: '',
    gstTreatment: 'exempt' as Treatment,
    taxRate: 0,
    isCosmetic: false,
  });

  const tariffs = useMemo(() => {
    const rows = data?.data ?? [];
    const q = search.trim().toLowerCase();
    return q
      ? rows.filter(
          (t) =>
            t.serviceName.toLowerCase().includes(q) ||
            (t.serviceCode ?? '').toLowerCase().includes(q) ||
            (t.sacCode ?? '').includes(q),
        )
      : rows;
  }, [data, search]);

  const unapproved = tariffs.filter((t) => !t.gstApproved);
  const legalRates = (slabData?.slabs ?? []).filter((s) => s.current).map((s) => s.ratePercent);

  const open = (t: ServiceTariff) => {
    setEditing(t);
    setForm({
      sacCode: t.sacCode ?? '',
      gstTreatment: (t.gstTreatment as Treatment) ?? 'exempt',
      taxRate: Number(t.gstRatePercent ?? 0),
      isCosmetic: Boolean(t.isCosmetic),
    });
  };

  /** Picking a SAC fills the rate and treatment from the master. */
  const pickSac = (code: string) => {
    const sac = sacCodes.find((c) => c.sacCode === code);
    setForm((f) => ({
      ...f,
      sacCode: code,
      ...(sac ? { gstTreatment: sac.treatment as Treatment, taxRate: Number(sac.gstRate) } : {}),
    }));
  };

  const save = async () => {
    if (!editing) return;
    try {
      await update.mutateAsync({
        id: editing.id,
        sacCode: form.sacCode.trim() || null,
        gstTreatment: form.gstTreatment,
        taxRate: form.gstTreatment === 'taxable' ? form.taxRate : 0,
        isCosmetic: form.isCosmetic,
      });
      toast.success('Classification saved — it still needs approving');
      setEditing(null);
    } catch (e) {
      toast.error((e as Error)?.message || 'Could not save the classification');
    }
  };

  const setApproval = async (t: ServiceTariff, approved: boolean) => {
    try {
      await approve.mutateAsync({ id: t.id, approved });
      toast.success(
        approved
          ? `${t.serviceName} approved — its own rate will now be used`
          : `Approval withdrawn from ${t.serviceName}`,
      );
    } catch (e) {
      toast.error((e as Error)?.message || 'Could not change the approval');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/hospital/settings" aria-label="Back to settings" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="font-headline text-xl font-bold">GST classification</h1>
          <p className="max-w-3xl text-xs text-muted-foreground">
            What each service is, for tax. The SAC code decides the rate; the cosmetic flag is
            how an exempt procedure is told from an 18% one. Your auditor approves the mapping —
            until they do, the tariff&apos;s own rate is not used.
          </p>
        </div>
      </div>

      {unapproved.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            <b>{unapproved.length}</b> of {tariffs.length} tariffs have not been approved. Until a
            tariff is approved its configured rate is discarded when a charge is raised against it.
          </p>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a service, code or SAC"
          className="h-9 pl-8"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-surface-container-lowest">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Service</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">SAC</th>
                <th className="px-3 py-2">Treatment</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2">Cosmetic</th>
                <th className="px-3 py-2">Approved</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {tariffs.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{t.serviceName}</td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">{t.category}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {t.sacCode ?? <span className="text-red-600">not set</span>}
                  </td>
                  <td className="px-3 py-2 capitalize">
                    {t.gstTreatment ? t.gstTreatment.replace(/_/g, ' ') : <span className="text-red-600">not set</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {t.gstTreatment === 'taxable' ? `${Number(t.gstRatePercent)}%` : '—'}
                  </td>
                  <td className="px-3 py-2">{t.isCosmetic ? <Badge variant="outline">Cosmetic</Badge> : '—'}</td>
                  <td className="px-3 py-2">
                    {t.gstApproved ? (
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                        <BadgeCheck className="mr-1 size-3" /> Approved
                      </Badge>
                    ) : (
                      <span className="text-xs text-amber-700">Awaiting the auditor</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => open(t)}>
                        Classify
                      </Button>
                      <Button
                        variant={t.gstApproved ? 'ghost' : 'outline'}
                        size="sm"
                        disabled={approve.isPending}
                        onClick={() => setApproval(t, !t.gstApproved)}
                      >
                        {t.gstApproved ? 'Withdraw' : 'Approve'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.serviceName}</DialogTitle>
            <DialogDescription>
              Picking a SAC fills the treatment and rate from the platform master. Saving a change
              withdraws any approval — your auditor signed off what was there, not what it becomes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">SAC code</Label>
              <Select value={form.sacCode || null} onValueChange={(v) => v && pickSac(v)}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Pick a service accounting code" />
                </SelectTrigger>
                <SelectContent>
                  {sacCodes
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.sacCode}>
                        {c.sacCode} — {c.description ?? ''} ({c.treatment === 'taxable' ? `${c.gstRate}%` : c.treatment})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Treatment</Label>
                <Select
                  value={form.gstTreatment}
                  onValueChange={(v) => v && setForm({ ...form, gstTreatment: v as Treatment })}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TREATMENTS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Rate</Label>
                {/* Only a legal slab, and only where the treatment is taxable.
                    A rate that is not a slab cannot be approved anyway — the
                    server refuses it — so it is not offered. */}
                <Select
                  value={String(form.taxRate)}
                  onValueChange={(v) => v && setForm({ ...form, taxRate: Number(v) })}
                >
                  <SelectTrigger className="mt-1 h-9" disabled={form.gstTreatment !== 'taxable'}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {legalRates.map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.isCosmetic}
                onChange={(e) => setForm({ ...form, isCosmetic: e.target.checked })}
              />
              <span>
                Cosmetic or non-therapeutic
                <span className="block text-[11px] text-muted-foreground">
                  Taxable however the rest of the surgery list is classified — and the OT kit
                  consumables used in it follow at the same rate.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
