'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Percent, Save, Loader2, Building2, CheckCircle2, XCircle,
  Pencil, Trash2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  useDefaultCommission,
  useUpdateDefaultCommission,
  useAllCommissions,
  useSetHospitalCommission,
  useDeleteHospitalCommission,
} from '@/hooks/use-commission';
import type { HospitalCommissionItem } from '@/hooks/use-commission';

// ============================================================
// Default Commission Card
// ============================================================

function DefaultCommissionCard() {
  const { data, isLoading } = useDefaultCommission();
  const updateMutation = useUpdateDefaultCommission();
  const [editing, setEditing] = useState(false);
  const [percent, setPercent] = useState('');

  const handleEdit = () => {
    setPercent(String(data?.defaultPercent ?? 5));
    setEditing(true);
  };

  const handleSave = async () => {
    const value = parseFloat(percent);
    if (isNaN(value) || value < 0 || value > 50) {
      toast.error('Commission must be between 0% and 50%');
      return;
    }
    try {
      await updateMutation.mutateAsync({ defaultPercent: value });
      toast.success('Default commission updated');
      setEditing(false);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update';
      toast.error(msg);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Percent className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-headline text-lg font-bold">Platform Commission</h2>
          <p className="font-label text-sm text-on-surface-variant">
            Default commission applied to all hospitals
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : editing ? (
        <div className="flex items-end gap-3 pt-2">
          <div className="flex-1 space-y-2">
            <Label>Commission Percentage</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="50"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">%</span>
            </div>
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending} size="sm">
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
          <Button variant="outline" onClick={() => setEditing(false)} size="sm">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2">
          <div>
            <span className="text-3xl font-bold tabular-nums">{data?.defaultPercent ?? 0}</span>
            <span className="text-lg text-on-surface-variant ml-1">%</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Hospital Commission Row
// ============================================================

function HospitalRow({
  hospital,
  defaultPercent,
}: {
  hospital: HospitalCommissionItem;
  defaultPercent: number;
}) {
  const setMutation = useSetHospitalCommission();
  const deleteMutation = useDeleteHospitalCommission();
  const [editing, setEditing] = useState(false);
  const [percent, setPercent] = useState('');

  const hasOverride = hospital.hospitalCommission !== null;
  const effectivePercent = hasOverride
    ? hospital.hospitalCommission!.commissionPercent
    : defaultPercent;

  const handleEdit = () => {
    setPercent(String(effectivePercent));
    setEditing(true);
  };

  const handleSave = async () => {
    const value = parseFloat(percent);
    if (isNaN(value) || value < 0 || value > 50) {
      toast.error('Commission must be between 0% and 50%');
      return;
    }
    try {
      await setMutation.mutateAsync({ tenantId: hospital.id, commissionPercent: value });
      toast.success(`Commission set for ${hospital.name}`);
      setEditing(false);
    } catch {
      toast.error('Failed to set commission');
    }
  };

  const handleRemoveOverride = async () => {
    try {
      await deleteMutation.mutateAsync(hospital.id);
      toast.success(`Override removed for ${hospital.name}`);
    } catch {
      toast.error('Failed to remove override');
    }
  };

  return (
    <tr className="border-b border-surface-container last:border-0 hover:bg-surface-container-low/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-on-surface-variant shrink-0" />
          <div>
            <p className="font-label text-sm font-medium">{hospital.name}</p>
            <p className="font-label text-[10px] text-on-surface-variant font-mono">{hospital.slug}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        {hospital.bankVerified ? (
          <CheckCircle2 className="h-4 w-4 text-primary inline-block" />
        ) : (
          <XCircle className="h-4 w-4 text-on-surface-variant/40 inline-block" />
        )}
      </td>
      <td className="px-4 py-3 text-center font-label text-sm tabular-nums">
        {editing ? (
          <div className="flex items-center gap-1 justify-center">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="50"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="w-20 h-8 text-center text-sm"
            />
            <span className="text-xs text-on-surface-variant">%</span>
          </div>
        ) : (
          <span>
            {effectivePercent}%
            {hasOverride && (
              <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">custom</Badge>
            )}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <Button size="sm" variant="default" onClick={handleSave} disabled={setMutation.isPending} className="h-7 px-2 text-xs">
              {setMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="h-7 px-2 text-xs">
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 justify-end">
            <Button size="sm" variant="outline" onClick={handleEdit} className="h-7 px-2 text-xs">
              <Pencil className="h-3 w-3 mr-1" /> Set
            </Button>
            {hasOverride && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRemoveOverride}
                disabled={deleteMutation.isPending}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ============================================================
// Page Component
// ============================================================

export default function CommissionPage() {
  const { data: allCommissions, isLoading } = useAllCommissions();

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold">Commission Settings</h1>
        <p className="font-label text-sm text-on-surface-variant mt-1">
          Control the platform commission on patient online payments
        </p>
      </div>

      {/* Default Commission */}
      <DefaultCommissionCard />

      {/* Hospital-specific Overrides */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-between border-b border-surface-container px-6 py-4">
          <div>
            <h2 className="font-headline text-lg font-bold">Hospital Commissions</h2>
            <p className="font-label text-xs text-on-surface-variant mt-0.5">
              Set per-hospital overrides or use the platform default
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !allCommissions?.hospitals?.length ? (
          <div className="text-center py-12">
            <Building2 className="h-8 w-8 text-on-surface-variant/30 mx-auto mb-2" />
            <p className="font-label text-sm text-on-surface-variant">No hospitals found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-container text-on-surface-variant">
                  <th className="px-4 py-3 text-left font-label text-xs font-semibold uppercase tracking-wider">Hospital</th>
                  <th className="px-4 py-3 text-center font-label text-xs font-semibold uppercase tracking-wider">Bank</th>
                  <th className="px-4 py-3 text-center font-label text-xs font-semibold uppercase tracking-wider">Commission</th>
                  <th className="px-4 py-3 text-right font-label text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allCommissions.hospitals.map((hospital) => (
                  <HospitalRow
                    key={hospital.id}
                    hospital={hospital}
                    defaultPercent={allCommissions.defaultPercent}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
