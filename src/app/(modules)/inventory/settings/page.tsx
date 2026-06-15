'use client';

import { useState } from 'react';
import { Settings, Bell, ShieldAlert, PackageCheck, Loader2, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/date-utils';
import {
  useInventorySettings,
  useUpdateInventorySettings,
  useRunInventoryAlerts,
  type UpdateInventorySettingsInput,
} from '@/hooks/use-inventory';

// Roles that can meaningfully act on inventory alerts. Empty selection on the
// backend falls back to this same set, so these are the sensible choices.
const RECIPIENT_ROLES: Array<{ slug: string; label: string }> = [
  { slug: 'inventory_manager', label: 'Inventory Manager' },
  { slug: 'pharmacy_admin', label: 'Pharmacy Admin' },
  { slug: 'admin', label: 'Hospital Admin' },
];

type FormState = Required<UpdateInventorySettingsInput>;

const EMPTY_FORM: FormState = {
  defaultLowStockThreshold: 10,
  expiryAlertMonths: 3,
  lowStockAlertEnabled: true,
  expiryAlertEnabled: true,
  autoFlagExpired: false,
  preventExpiredUse: true,
  reorderNotifyEnabled: true,
  alertRecipientRoles: [],
};

export default function InventorySettingsPage() {
  const { data: settings, isLoading } = useInventorySettings();
  const update = useUpdateInventorySettings();
  const runAlerts = useRunInventoryAlerts();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // Seed the editable form from the fetched settings once, re-seeding only when
  // a different settings row arrives. Adjusting state during render (guarded) is
  // React's recommended alternative to a setState-in-effect.
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  if (settings && settings.id !== seededFrom) {
    setSeededFrom(settings.id);
    setForm({
      defaultLowStockThreshold: settings.defaultLowStockThreshold,
      expiryAlertMonths: settings.expiryAlertMonths,
      lowStockAlertEnabled: settings.lowStockAlertEnabled,
      expiryAlertEnabled: settings.expiryAlertEnabled,
      autoFlagExpired: settings.autoFlagExpired,
      preventExpiredUse: settings.preventExpiredUse,
      reorderNotifyEnabled: settings.reorderNotifyEnabled,
      alertRecipientRoles: settings.alertRecipientRoles ?? [],
    });
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleRole = (slug: string) =>
    setForm((f) => ({
      ...f,
      alertRecipientRoles: f.alertRecipientRoles.includes(slug)
        ? f.alertRecipientRoles.filter((r) => r !== slug)
        : [...f.alertRecipientRoles, slug],
    }));

  const handleSave = async () => {
    if (form.defaultLowStockThreshold < 0) return toast.error('Default threshold must be ≥ 0');
    if (form.expiryAlertMonths < 1) return toast.error('Expiry window must be at least 1 month');
    try {
      await update.mutateAsync(form);
      toast.success('Inventory settings saved');
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to save settings');
    }
  };

  const handleRunAlerts = async () => {
    try {
      const res = await runAlerts.mutateAsync({});
      toast.success(
        `Alerts processed — ${res.lowStockAlerts} low-stock, ${res.expiryAlerts} expiry${
          res.expiredFlagged ? `, ${res.expiredFlagged} expired flagged` : ''
        }`,
      );
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to run alerts');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Settings className="h-5 w-5" /> Inventory Settings
          </h1>
          <p className="text-xs text-muted-foreground">
            Module-level configuration — reorder thresholds, expiry tracking, and who gets alerted.
          </p>
        </div>
        <Button variant="outline" onClick={handleRunAlerts} disabled={runAlerts.isPending}>
          {runAlerts.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="mr-2 h-4 w-4" />
          )}
          Run alerts now
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Thresholds */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-primary" /> Stock thresholds
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="threshold">Default reorder threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  value={form.defaultLowStockThreshold}
                  onChange={(e) => set('defaultLowStockThreshold', Number(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Applied to new items when no per-item threshold is given.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiry-months">Expiry look-ahead (months)</Label>
                <Input
                  id="expiry-months"
                  type="number"
                  min={1}
                  max={36}
                  value={form.expiryAlertMonths}
                  onChange={(e) => set('expiryAlertMonths', Number(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">
                  Batches expiring within this window are flagged and alerted.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Automation guards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" /> Expiry guards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <ToggleRow
                label="Prevent use of expired stock"
                description="Block a stock-out that names a batch past its expiry date."
                checked={form.preventExpiredUse}
                onChange={(v) => set('preventExpiredUse', v)}
              />
              <Separator />
              <ToggleRow
                label="Auto-flag expired batches"
                description="During each alert run, remove fully-expired batches automatically."
                checked={form.autoFlagExpired}
                onChange={(v) => set('autoFlagExpired', v)}
              />
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Alerts &amp; notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <ToggleRow
                label="Low-stock alerts"
                description="Notify recipients when items fall to or below their threshold."
                checked={form.lowStockAlertEnabled}
                onChange={(v) => set('lowStockAlertEnabled', v)}
              />
              <Separator />
              <ToggleRow
                label="Reorder notification on crossing"
                description="Fire an alert the moment a stock movement crosses the threshold."
                checked={form.reorderNotifyEnabled}
                onChange={(v) => set('reorderNotifyEnabled', v)}
              />
              <Separator />
              <ToggleRow
                label="Expiry alerts"
                description="Notify recipients about batches expiring within the look-ahead window."
                checked={form.expiryAlertEnabled}
                onChange={(v) => set('expiryAlertEnabled', v)}
              />
              <Separator />
              <div className="py-3">
                <p className="text-sm font-medium">Alert recipients</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Roles that receive inventory notifications. Leave all unchecked to use the
                  defaults (Inventory Manager, Pharmacy Admin, Admin).
                </p>
                <div className="flex flex-wrap gap-2">
                  {RECIPIENT_ROLES.map((role) => {
                    const active = form.alertRecipientRoles.includes(role.slug);
                    return (
                      <Button
                        key={role.slug}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => toggleRole(role.slug)}
                      >
                        {role.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {settings?.lastAlertRunAt
                ? `Last alert run: ${formatDateTime(settings.lastAlertRunAt)}`
                : 'Alerts have not run yet.'}
            </p>
            <Button onClick={handleSave} disabled={update.isPending}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save settings
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
