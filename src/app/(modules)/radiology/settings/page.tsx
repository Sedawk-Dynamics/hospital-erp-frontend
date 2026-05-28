'use client';

// Radiology Settings — radiology_admin only.
//
// Two tabs:
//   • Tariffs       — manage imaging service tariffs (X-Ray, CT, MRI, USG,
//                      ECG, ECHO and custom). Drives the auto-bill linking
//                      done by /imaging/requests when an order is created.
//   • Modalities    — modality + body-part reference list. Read-only view of
//                      the imaging types the system currently accepts; the
//                      list is enum-bound at the schema level so we cannot
//                      add new ones from the UI yet.

import { useState, useEffect } from 'react';
import {
  Settings, Plus, Pencil, Search, Activity, RefreshCw, Save, Tag, IndianRupee,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useServiceTariffs, useCreateServiceTariff, useUpdateServiceTariff,
  type ServiceTariff,
} from '@/hooks/use-service-tariffs';
import { RadiologyAdminGuard } from '@/components/radiology/radiology-admin-guard';

const MODALITY_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: 'xray', label: 'X-Ray', description: 'Plain radiography' },
  { value: 'ct_scan', label: 'CT Scan', description: 'Computed tomography' },
  { value: 'mri', label: 'MRI', description: 'Magnetic resonance imaging' },
  { value: 'ultrasound', label: 'Ultrasound', description: 'Sonography / USG' },
  { value: 'ecg', label: 'ECG', description: 'Electrocardiogram' },
  { value: 'echo', label: 'Echo', description: 'Echocardiography' },
  { value: 'other', label: 'Other', description: 'Mammography, fluoroscopy, etc.' },
];

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
        title="Radiology Settings"
        description="Service tariffs and modality catalog for the imaging department."
      />

      <Tabs defaultValue="tariffs">
        <TabsList variant="line">
          <TabsTrigger value="tariffs">
            <Settings className="mr-1.5 h-4 w-4" />
            Tariffs
          </TabsTrigger>
          <TabsTrigger value="modalities">
            <Activity className="mr-1.5 h-4 w-4" />
            Modalities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tariffs" className="pt-4">
          <TariffsSection />
        </TabsContent>
        <TabsContent value="modalities" className="pt-4">
          <ModalitiesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Tariffs ─────────────────────────────────────────────────────────────────

// Modality value set — used to keep per-modality base-price rows out of the
// freeform "specific studies" table below.
const MODALITY_CODES = new Set(MODALITY_OPTIONS.map((m) => m.value));

function TariffsSection() {
  const [search, setSearch] = useState('');
  const tariffsQ = useServiceTariffs({
    category: 'imaging',
    limit: 200,
  });
  const allTariffs = tariffsQ.data?.data ?? [];
  // The freeform table lists named studies (e.g. "MRI Brain with contrast"),
  // not the per-modality base prices which live in the grid above.
  const tariffs = allTariffs
    .filter((t) => !MODALITY_CODES.has((t.serviceCode ?? '').toLowerCase()))
    .filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.serviceName.toLowerCase().includes(q) ||
        (t.serviceCode ?? '').toLowerCase().includes(q)
      );
    });

  const [editing, setEditing] = useState<ServiceTariff | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <ModalityPricingSection
        tariffs={allTariffs}
        loading={tariffsQ.isLoading}
        onChanged={() => tariffsQ.refetch()}
      />

      <div className="flex items-center gap-2 pt-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Named Studies</h3>
        <span className="text-xs text-muted-foreground">
          Specific protocols priced separately from the modality base price (e.g. "MRI Brain with contrast").
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search service name, code…"
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
            <Plus className="mr-1.5 h-4 w-4" /> New Tariff
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
        ) : tariffs.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No imaging tariffs yet"
            description="Add tariffs for X-Ray, CT, MRI, USG, ECG and other studies."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  <Th>Service Name</Th>
                  <Th>Code</Th>
                  <Th align="right">Base Price</Th>
                  <Th align="right">GST %</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {tariffs.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-medium">{t.serviceName}</td>
                    <td className="px-4 py-3 font-mono text-xs">{t.serviceCode ?? '-'}</td>
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
                      <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TariffEditorDialog
        mode="create"
        open={creating}
        onOpenChange={(o) => !o && setCreating(false)}
      />
      <TariffEditorDialog
        mode="edit"
        tariff={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}

// ── Modality base prices ──────────────────────────────────────────────────────
// A quick grid for setting the base price of every imaging modality in one
// place. Each row is backed by a ServiceTariff whose serviceCode equals the
// imaging type (e.g. 'ct_scan'), which the auto-bill linker and the charges
// pull both resolve by. Available to radiology_admin and hospital admin.

function ModalityPricingSection({
  tariffs, loading, onChanged,
}: {
  tariffs: ServiceTariff[];
  loading: boolean;
  onChanged: () => void;
}) {
  const create = useCreateServiceTariff();
  const update = useUpdateServiceTariff();

  // serviceCode (lowercased) → existing tariff
  const byCode = new Map<string, ServiceTariff>();
  for (const t of tariffs) {
    const code = (t.serviceCode ?? '').toLowerCase();
    if (code) byCode.set(code, t);
  }

  // Local draft per modality: { price, gst }. Seeded from existing tariffs.
  const [drafts, setDrafts] = useState<Record<string, { price: string; gst: string }>>({});
  const [savingCode, setSavingCode] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, { price: string; gst: string }> = {};
    for (const m of MODALITY_OPTIONS) {
      const existing = byCode.get(m.value);
      next[m.value] = {
        price: existing ? String(Number(existing.basePrice)) : '',
        gst: existing ? String(Number(existing.gstRatePercent ?? 0)) : '0',
      };
    }
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tariffs]);

  const handleSave = async (m: typeof MODALITY_OPTIONS[number]) => {
    const draft = drafts[m.value];
    if (!draft || draft.price === '' || Number(draft.price) <= 0) {
      toast.error('Enter a base price greater than 0');
      return;
    }
    const existing = byCode.get(m.value);
    setSavingCode(m.value);
    try {
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          name: existing.serviceName,
          code: m.value,
          category: 'imaging',
          basePrice: Number(draft.price),
          taxRate: Number(draft.gst || 0),
          isActive: true,
        });
      } else {
        await create.mutateAsync({
          name: m.label,
          code: m.value,
          category: 'imaging',
          basePrice: Number(draft.price),
          taxRate: Number(draft.gst || 0),
          isActive: true,
        });
      }
      toast.success(`${m.label} base price saved`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save price');
    } finally {
      setSavingCode(null);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-3">
      <div className="flex items-center gap-2">
        <IndianRupee className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Modality Base Prices</h3>
        <span className="text-xs text-muted-foreground">
          Set the default charge for each imaging type. Used to auto-bill new requests.
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {MODALITY_OPTIONS.map((m) => {
            const draft = drafts[m.value] ?? { price: '', gst: '0' };
            const existing = byCode.get(m.value);
            return (
              <div
                key={m.value}
                className="flex items-end gap-2 rounded-lg border border-surface-container p-3"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{m.label}</p>
                  <p className="text-[11px] text-muted-foreground">{m.description}</p>
                </div>
                <div className="w-28">
                  <Label className="text-[10px]">Base Price (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={existing ? undefined : 'Not set'}
                    value={draft.price}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [m.value]: { ...prev[m.value], price: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="w-20">
                  <Label className="text-[10px]">GST %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={draft.gst}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [m.value]: { ...prev[m.value], gst: e.target.value },
                      }))
                    }
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSave(m)}
                  disabled={savingCode === m.value}
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingCode === m.value ? 'Saving…' : 'Save'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TariffEditorDialog({
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
  const [code, setCode] = useState('');
  const [basePrice, setBasePrice] = useState<number | ''>('');
  const [taxRate, setTaxRate] = useState<number | ''>(0);
  const [isActive, setIsActive] = useState(true);

  // Re-seed the form whenever the dialog is opened with a different tariff,
  // and clear it when switching back to create mode.
  useEffect(() => {
    if (!open) return;
    if (tariff) {
      setName(tariff.serviceName);
      setCode(tariff.serviceCode ?? '');
      setBasePrice(Number(tariff.basePrice));
      setTaxRate(Number(tariff.gstRatePercent ?? 0));
      setIsActive(tariff.isActive);
    } else {
      setName(''); setCode(''); setBasePrice(''); setTaxRate(0); setIsActive(true);
    }
  }, [open, tariff?.id]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!code.trim()) { toast.error('Code is required'); return; }
    if (basePrice === '' || Number(basePrice) <= 0) { toast.error('Base price must be positive'); return; }

    try {
      if (mode === 'create') {
        await create.mutateAsync({
          name: name.trim(),
          code: code.trim(),
          category: 'imaging',
          basePrice: Number(basePrice),
          taxRate: Number(taxRate || 0),
          isActive,
        });
        toast.success('Tariff created');
      } else if (tariff) {
        await update.mutateAsync({
          id: tariff.id,
          name: name.trim(),
          code: code.trim(),
          category: 'imaging',
          basePrice: Number(basePrice),
          taxRate: Number(taxRate || 0),
          isActive,
        });
        toast.success('Tariff updated');
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save tariff');
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Imaging Tariff' : 'Edit Imaging Tariff'}</DialogTitle>
          <DialogDescription>
            Tariffs in the <code>imaging</code> category are auto-linked to imaging requests at creation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Service Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MRI Brain with contrast" />
          </div>
          <div>
            <Label>Code *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. MRI-BRN-C" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Base Price (₹) *</Label>
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
              id="rad-tariff-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <Label htmlFor="rad-tariff-active" className="cursor-pointer">Active</Label>
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

// ── Modalities ──────────────────────────────────────────────────────────────

function ModalitiesSection() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Modality codes the system recognizes for imaging requests. The list is
        enum-bound at the schema level — add new ones in the radiology backend
        if you need to onboard a new modality.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODALITY_OPTIONS.map((m) => (
          <div key={m.value} className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{m.label}</p>
              <Badge variant="outline" className="font-mono text-[10px]">{m.value}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
          </div>
        ))}
      </div>
    </div>
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
