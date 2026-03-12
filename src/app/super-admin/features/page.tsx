'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenants, useTenant, useUpdateFeatureToggle } from '@/hooks/use-super-admin';

const FEATURE_KEYS = [
  { key: 'appointments', label: 'Appointments' },
  { key: 'lab', label: 'Laboratory' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'billing', label: 'Billing' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'blood_bank', label: 'Blood Bank' },
  { key: 'imaging', label: 'Imaging / Radiology' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'hr', label: 'HR Management' },
  { key: 'compliance', label: 'Compliance' },
];

export default function FeaturesPage() {
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const { data: tenantsData } = useTenants({ limit: 100 });
  const { data: tenantDetail, isLoading: detailLoading } = useTenant(selectedTenantId);
  const updateFeature = useUpdateFeatureToggle();

  const tenants = tenantsData?.data ?? [];
  const featureToggles = tenantDetail?.featureToggles ?? [];

  const handleToggle = async (featureKey: string, currentEnabled: boolean) => {
    if (!selectedTenantId) return;
    try {
      await updateFeature.mutateAsync({
        tenantId: selectedTenantId,
        featureKey,
        enabled: !currentEnabled,
      });
      toast.success(`${featureKey} ${!currentEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update feature');
    }
  };

  const isFeatureEnabled = (key: string) => {
    const toggle = featureToggles.find((f) => f.featureKey === key);
    return toggle?.isEnabled ?? false;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Feature Management</h1>
        <p className="text-sm text-muted-foreground">Enable or disable features per hospital</p>
      </div>

      <div className="max-w-sm">
        <Select value={selectedTenantId} onValueChange={(v) => setSelectedTenantId(v ?? '')}>
          <SelectTrigger>
            <SelectValue placeholder="Select a hospital" />
          </SelectTrigger>
          <SelectContent>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTenantId && (
        <div className="rounded-lg border bg-card divide-y">
          {detailLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading features...</div>
          ) : (
            FEATURE_KEYS.map((feature) => {
              const enabled = isFeatureEnabled(feature.key);
              return (
                <div key={feature.key} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{feature.label}</p>
                    <p className="text-xs text-muted-foreground">{feature.key}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={enabled ? 'default' : 'outline'}>
                      {enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <button
                      onClick={() => handleToggle(feature.key, enabled)}
                      disabled={updateFeature.isPending}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enabled ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {!selectedTenantId && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Select a hospital to manage its features
        </div>
      )}
    </div>
  );
}
