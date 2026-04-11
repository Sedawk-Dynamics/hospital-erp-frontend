'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenants, useTenant, useUpdateFeatureToggle } from '@/hooks/use-super-admin';

/** All feature keys with their labels and the number of system forms tied to each */
const FEATURE_KEYS = [
  { key: 'appointments', label: 'Appointments', description: 'OP scheduling, booking, check-in' },
  { key: 'ip_management', label: 'In-Patient (IP)', description: 'Admissions, discharge, nursing, ward management' },
  { key: 'ot_management', label: 'Operation Theatre (OT)', description: 'Pre-op, post-op, surgical workflows' },
  { key: 'lab', label: 'Laboratory', description: 'Lab orders, specimen collection, QC checks' },
  { key: 'pharmacy', label: 'Pharmacy', description: 'Prescription dispensing, stock management' },
  { key: 'billing', label: 'Billing', description: 'Billing, payments, transactions' },
  { key: 'inventory', label: 'Inventory', description: 'Cross-module stock management' },
  { key: 'blood_bank', label: 'Blood Bank', description: 'Blood donation, transfusion management' },
  { key: 'imaging', label: 'Imaging / Radiology', description: 'X-ray, CT, MRI, ultrasound' },
  { key: 'insurance', label: 'Insurance & TPA', description: 'Insurance claims, pre-authorization' },
  { key: 'hr', label: 'HR Management', description: 'Staff records, attendance, payroll' },
  { key: 'compliance', label: 'Compliance & Audit', description: 'Safety checks, incident reports, audits' },
];

/** Number of system forms tied to each feature */
const FORM_COUNTS: Record<string, number> = {
  appointments: 16,
  ip_management: 12,
  ot_management: 6,
  lab: 3,
  compliance: 2,
  blood_bank: 1,
};

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
        <h1 className="font-headline text-xl font-bold">Feature Management</h1>
        <p className="font-label text-sm text-on-surface-variant">
          Enable or disable features per hospital. Each feature includes its related system forms.
        </p>
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
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary divide-y divide-surface-container/50">
          {detailLoading ? (
            <div className="p-8 text-center font-label text-sm text-on-surface-variant">Loading features...</div>
          ) : (
            FEATURE_KEYS.map((feature) => {
              const enabled = isFeatureEnabled(feature.key);
              const formCount = FORM_COUNTS[feature.key];
              return (
                <div key={feature.key} className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-label text-sm font-bold text-on-surface">{feature.label}</p>
                      {formCount && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1">
                          <FileText className="h-2.5 w-2.5" />
                          {formCount} form{formCount > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="font-label text-[10px] text-on-surface-variant mt-0.5">
                      {feature.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${enabled ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => handleToggle(feature.key, enabled)}
                      disabled={updateFeature.isPending}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enabled ? 'bg-primary' : 'bg-surface-container'
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
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 text-center font-label text-sm text-on-surface-variant">
          Select a hospital to manage its features
        </div>
      )}
    </div>
  );
}
