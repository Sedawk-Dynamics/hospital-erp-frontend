'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/shared/data-table';
import {
  useAllPlans,
  useCreatePlan,
  useUpdatePlan,
  usePlatformUsers,
  useAdminAssignPlan,
  usePlanAssignments,
  useAllSubscriptions,
  type SubscriptionPlanAdmin,
  type PlatformUser,
  type AdminSubscription,
  type PlanAssignment,
} from '@/hooks/use-super-admin';
import { useDebounce } from '@/hooks/use-debounce';

// ============================================================
// All Subscriptions Tab
// ============================================================

function TenantSubscriptionsTab() {
  const { data: subscriptions, isLoading } = useAllSubscriptions();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const allSubs = subscriptions ?? [];
  const filtered = statusFilter === 'all'
    ? allSubs
    : statusFilter === 'demo'
      ? allSubs.filter((s) => s.isDemoTrial)
      : allSubs.filter((s) => s.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-1.5">
        {['all', 'active', 'expired', 'cancelled', 'demo'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full font-label text-xs font-bold transition-colors capitalize ${
              statusFilter === s
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-container text-left">
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold">User</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold">Hospitals</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold">Plan</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold">Billing</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold">Payment</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold">Status</th>
              <th className="px-4 py-3 font-label text-xs text-on-surface-variant font-bold">Period</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-surface-container">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-shimmer" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center font-label text-sm text-on-surface-variant">
                  No subscriptions found.
                </td>
              </tr>
            ) : (
              filtered.map((sub) => (
                <tr key={sub.id} className="border-b border-surface-container hover:bg-surface-container-low/50 transition-colors">
                  {/* User */}
                  <td className="px-4 py-3">
                    {sub.user ? (
                      <div>
                        <p className="font-label text-sm font-bold">{sub.user.firstName} {sub.user.lastName}</p>
                        <p className="font-label text-[10px] text-on-surface-variant">{sub.user.email}</p>
                      </div>
                    ) : (
                      <span className="font-label text-[10px] text-on-surface-variant">—</span>
                    )}
                  </td>
                  {/* Hospitals */}
                  <td className="px-4 py-3">
                    {sub.hospitals.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {sub.hospitals.map((h) => (
                          <Badge key={h.id} variant="secondary" className="text-[10px] font-bold bg-primary/5 text-primary border-0">
                            {h.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="font-label text-[10px] text-on-surface-variant">No hospital</span>
                    )}
                  </td>
                  {/* Plan */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-label text-sm font-bold">{sub.plan.name}</p>
                      {sub.isDemoTrial && (
                        <span className="font-label text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Demo</span>
                      )}
                    </div>
                    {sub.plan.priceMonthly ? (
                      <p className="font-label text-[10px] text-on-surface-variant">
                        Rs {Number(sub.plan.priceMonthly).toLocaleString()}/mo
                      </p>
                    ) : (
                      <p className="font-label text-[10px] text-on-surface-variant">Free</p>
                    )}
                  </td>
                  {/* Billing */}
                  <td className="px-4 py-3">
                    <span className="font-label text-xs capitalize">{sub.billingCycle || '-'}</span>
                  </td>
                  {/* Payment Method */}
                  <td className="px-4 py-3">
                    <span className={`font-label text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      sub.subscriptionPaymentMethod === 'autopay'
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {sub.subscriptionPaymentMethod === 'autopay' ? 'AutoPay' : 'Manual'}
                    </span>
                    {sub.autoRenew && (
                      <span className="font-label text-[9px] text-green-600 ml-1">Auto-renew</span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`font-label text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      sub.status === 'active' ? 'bg-primary/10 text-primary' :
                      sub.status === 'expired' ? 'bg-error/10 text-error' :
                      'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {sub.status}
                    </span>
                  </td>
                  {/* Period */}
                  <td className="px-4 py-3">
                    <p className="font-label text-[10px] text-on-surface-variant">
                      {formatDate(sub.startDate)}
                    </p>
                    <p className="font-label text-[10px] text-on-surface-variant">
                      → {sub.endDate ? formatDate(sub.endDate) : 'No end'}
                    </p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// System Features — canonical list matching backend FeatureToggle keys
// ============================================================

const SYSTEM_FEATURES = [
  { key: 'appointments', label: 'Appointments & Scheduling', description: 'OPD appointments, queue management, doctor scheduling' },
  { key: 'billing', label: 'Billing & Payments', description: 'Bill generation, payment collection, receipts' },
  { key: 'lab', label: 'Laboratory', description: 'Lab orders, sample tracking, test results, reports' },
  { key: 'pharmacy', label: 'Pharmacy', description: 'Drug formulary, dispensing, batch tracking, returns' },
  { key: 'inventory', label: 'Inventory Management', description: 'Stock tracking, purchase orders, suppliers' },
  { key: 'imaging', label: 'Radiology / Imaging', description: 'Imaging requests, results, DICOM integration' },
  { key: 'ip_management', label: 'In-Patient (IP)', description: 'Admissions, bed management, ward transfers, discharge' },
  { key: 'ot_management', label: 'Operation Theatre (OT)', description: 'OT scheduling, surgery records, OT inventory' },
  { key: 'blood_bank', label: 'Blood Bank', description: 'Donors, donations, cross-match, transfusions' },
  { key: 'insurance', label: 'Insurance & TPA', description: 'Policies, claims, pre-authorization, TPA management' },
  { key: 'hr', label: 'HR & Payroll', description: 'Staff profiles, attendance, leaves, duty rosters, payroll' },
  { key: 'compliance', label: 'Compliance & Audit', description: 'Incident reports, audit logs, compliance documents' },
  { key: 'reports', label: 'Advanced Reports', description: 'Custom reports, scheduled reports, data export' },
  { key: 'multi_hospital', label: 'Multi-Hospital', description: 'Manage multiple hospital branches under one account' },
] as const;

// ============================================================
// Plan Form Dialog
// ============================================================

interface PlanFormData {
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  maxUsers: string;
  maxHospitals: string;
  features: Record<string, boolean>;
  isActive: boolean;
}

const defaultFeatures: Record<string, boolean> = Object.fromEntries(
  SYSTEM_FEATURES.map((f) => [f.key, false]),
);

const emptyPlanForm: PlanFormData = {
  name: '',
  description: '',
  priceMonthly: '',
  priceYearly: '',
  maxUsers: '',
  maxHospitals: '',
  features: { ...defaultFeatures },
  isActive: false,
};

function planToFormData(plan: SubscriptionPlanAdmin): PlanFormData {
  const features = { ...defaultFeatures };
  if (plan.features) {
    for (const [key, val] of Object.entries(plan.features)) {
      features[key] = !!val;
    }
  }
  return {
    name: plan.name,
    description: plan.description || '',
    priceMonthly: plan.priceMonthly != null ? String(plan.priceMonthly) : '',
    priceYearly: plan.priceYearly != null ? String(plan.priceYearly) : '',
    maxUsers: plan.maxUsers != null ? String(plan.maxUsers) : '',
    maxHospitals: plan.maxHospitals != null ? String(plan.maxHospitals) : '',
    features,
    isActive: plan.isActive,
  };
}

function PlanFormDialog({
  editingPlan,
  open,
  onOpenChange,
}: {
  editingPlan: SubscriptionPlanAdmin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const [form, setForm] = useState<PlanFormData>(emptyPlanForm);

  useEffect(() => {
    if (open) {
      setForm(editingPlan ? planToFormData(editingPlan) : emptyPlanForm);
    }
  }, [open, editingPlan]);

  const isEditing = !!editingPlan;
  const isPending = createPlan.isPending || updatePlan.isPending;

  const toggleFeature = (key: string) => {
    setForm((p) => ({
      ...p,
      features: { ...p.features, [key]: !p.features[key] },
    }));
  };

  const enabledCount = Object.values(form.features).filter(Boolean).length;

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      priceMonthly: form.priceMonthly ? Number(form.priceMonthly) : undefined,
      priceYearly: form.priceYearly ? Number(form.priceYearly) : undefined,
      maxUsers: form.maxUsers ? Number(form.maxUsers) : undefined,
      maxHospitals: form.maxHospitals ? Number(form.maxHospitals) : undefined,
      features: form.features,
      isActive: form.isActive,
    };

    try {
      if (isEditing) {
        await updatePlan.mutateAsync({ id: editingPlan.id, ...payload });
        toast.success('Plan updated successfully');
      } else {
        await createPlan.mutateAsync(payload);
        toast.success('Plan created successfully');
      }
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        `Failed to ${isEditing ? 'update' : 'create'} plan`;
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-0">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl font-extrabold">
              {isEditing ? 'Edit Plan' : 'Create New Plan'}
            </DialogTitle>
            <DialogDescription className="font-label text-sm">
              {isEditing
                ? 'Update plan details and toggle which features hospitals on this plan can access.'
                : 'Set up pricing, limits, and choose which modules hospitals on this plan will get.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[72vh] overflow-y-auto sanctuary-scrollbar px-8 py-6">
          {/* Plan Details Section */}
          <div className="mb-8">
            <h3 className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">
              Plan Details
            </h3>
            <div className="bg-surface-container-lowest rounded-2xl p-6 space-y-5 shadow-sanctuary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="font-label text-xs font-semibold text-on-surface-variant">Plan Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Basic, Professional, Enterprise"
                    className="h-11 rounded-xl bg-surface-container-low border-none font-label text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="font-label text-xs font-semibold text-on-surface-variant">Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description shown to hospital admins when choosing a plan"
                    className="h-11 rounded-xl bg-surface-container-low border-none font-label text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-label text-xs font-semibold text-on-surface-variant">Monthly (INR)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.priceMonthly}
                    onChange={(e) => setForm((p) => ({ ...p, priceMonthly: e.target.value }))}
                    placeholder="999"
                    className="h-11 rounded-xl bg-surface-container-low border-none font-label text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-label text-xs font-semibold text-on-surface-variant">Yearly (INR)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.priceYearly}
                    onChange={(e) => setForm((p) => ({ ...p, priceYearly: e.target.value }))}
                    placeholder="9990"
                    className="h-11 rounded-xl bg-surface-container-low border-none font-label text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-label text-xs font-semibold text-on-surface-variant">Max Users</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.maxUsers}
                    onChange={(e) => setForm((p) => ({ ...p, maxUsers: e.target.value }))}
                    placeholder="Unlimited"
                    className="h-11 rounded-xl bg-surface-container-low border-none font-label text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-label text-xs font-semibold text-on-surface-variant">Max Hospitals</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.maxHospitals}
                    onChange={(e) => setForm((p) => ({ ...p, maxHospitals: e.target.value }))}
                    placeholder="Unlimited"
                    className="h-11 rounded-xl bg-surface-container-low border-none font-label text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                Module Access
              </h3>
              <div className="flex items-center gap-3">
                <span className="font-label text-xs text-on-surface-variant">
                  <span className="font-bold text-primary">{enabledCount}</span>/{SYSTEM_FEATURES.length} enabled
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const allEnabled = enabledCount === SYSTEM_FEATURES.length;
                    const newFeatures = Object.fromEntries(
                      SYSTEM_FEATURES.map((f) => [f.key, !allEnabled]),
                    );
                    setForm((p) => ({ ...p, features: newFeatures }));
                  }}
                  className="font-label text-[10px] font-bold text-primary hover:underline"
                >
                  {enabledCount === SYSTEM_FEATURES.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SYSTEM_FEATURES.map((feature) => {
                const enabled = form.features[feature.key] ?? false;
                return (
                  <button
                    key={feature.key}
                    type="button"
                    onClick={() => toggleFeature(feature.key)}
                    className={`group relative flex items-start gap-3 rounded-2xl p-4 text-left transition-all duration-200 ${
                      enabled
                        ? 'bg-primary/8 ring-1 ring-primary/25 shadow-sm'
                        : 'bg-surface-container-lowest shadow-sanctuary hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                        enabled
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'bg-surface-container-high text-transparent group-hover:bg-surface-container-highest'
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-label text-sm font-bold leading-tight ${enabled ? 'text-primary' : 'text-on-surface'}`}>
                        {feature.label}
                      </p>
                      <p className="font-label text-[10px] text-on-surface-variant leading-snug mt-0.5">
                        {feature.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto-Offer After Demo Toggle */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sanctuary p-5 flex items-center justify-between">
            <div>
              <p className="font-label text-sm font-bold text-on-surface">Auto-Offer After Demo</p>
              <p className="font-label text-[10px] text-on-surface-variant mt-0.5">
                {form.isActive
                  ? 'This plan will be automatically offered to users when their demo trial ends.'
                  : 'This plan will not be auto-offered. You can still manually assign it to users.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                form.isActive ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg transition-transform ${
                  form.isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-5 bg-surface-container-low/50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-6"
          >
            Cancel
          </Button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-primary text-on-primary font-label font-bold text-sm px-8 py-2.5 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
                ? 'Save Changes'
                : 'Create Plan'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Manage Plans Tab
// ============================================================

function ManagePlansTab() {
  const { data: plans, isLoading } = useAllPlans();
  const updatePlan = useUpdatePlan();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanAdmin | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleToggleAutoOffer = async (plan: SubscriptionPlanAdmin) => {
    try {
      await updatePlan.mutateAsync({ id: plan.id, isActive: !plan.isActive });
      toast.success(`${plan.name} ${plan.isActive ? 'removed from' : 'added to'} auto-offer`);
    } catch {
      toast.error('Failed to update plan');
    }
  };

  const handleEdit = (plan: SubscriptionPlanAdmin) => {
    setEditingPlan(plan);
    setEditDialogOpen(true);
  };

  const columns: Column<SubscriptionPlanAdmin>[] = [
    {
      key: 'name',
      label: 'Plan Name',
      render: (item) => (
        <div>
          <p className="font-label text-sm font-bold">{item.name}</p>
          {item.description && (
            <p className="font-label text-[10px] text-on-surface-variant line-clamp-1">{item.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'priceMonthly',
      label: 'Monthly',
      render: (item) =>
        item.priceMonthly != null ? (
          <span className="font-label text-sm tabular-nums">&#8377;{item.priceMonthly.toLocaleString('en-IN')}</span>
        ) : (
          <span className="font-label text-[10px] text-on-surface-variant">Custom</span>
        ),
    },
    {
      key: 'priceYearly',
      label: 'Yearly',
      render: (item) =>
        item.priceYearly != null ? (
          <span className="font-label text-sm tabular-nums">&#8377;{item.priceYearly.toLocaleString('en-IN')}</span>
        ) : (
          <span className="font-label text-[10px] text-on-surface-variant">Custom</span>
        ),
    },
    {
      key: 'maxUsers',
      label: 'Max Users',
      render: (item) => (item.maxUsers != null ? item.maxUsers : 'Unlimited'),
    },
    {
      key: 'features',
      label: 'Features',
      render: (item) => {
        if (!item.features) return '-';
        const included = Object.values(item.features).filter(Boolean).length;
        const total = Object.keys(item.features).length;
        return (
          <span className="font-label text-[10px] text-on-surface-variant">
            {included}/{total} included
          </span>
        );
      },
    },
    {
      key: 'autoOffer',
      label: 'Auto-Offer',
      render: (item) => (
        <button
          onClick={() => handleToggleAutoOffer(item)}
          disabled={updatePlan.isPending}
          className="inline-flex items-center gap-1"
          title={item.isActive ? 'Click to disable auto-offer' : 'Click to enable auto-offer'}
        >
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center ${item.isActive ? 'bg-green-500/10 text-green-600' : 'bg-surface-container-high text-on-surface-variant'}`}>
            {item.isActive ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Auto-Offer
              </>
            ) : (
              'Manual Only'
            )}
          </span>
        </button>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item) => (
        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={(plans ?? []) as unknown as Record<string, unknown>[]}
        isLoading={isLoading}
        emptyMessage="No plans found. Create your first plan."
      />

      {/* Create Dialog */}
      <PlanFormDialog editingPlan={null} open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit Dialog */}
      <PlanFormDialog
        editingPlan={editingPlan}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingPlan(null);
        }}
      />
    </div>
  );
}

// ============================================================
// Assign Plan to User Tab
// ============================================================

function AssignPlanTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { data: usersData } = usePlatformUsers({
    page: 1,
    limit: 50,
    search: debouncedSearch || undefined,
  });
  const { data: plans = [] } = useAllPlans();
  const assignPlan = useAdminAssignPlan();

  const [userId, setUserId] = useState('');
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);


  const users = usersData?.data ?? [];
  const selectedUser = users.find((u) => u.id === userId);
  const activePlans = plans.filter((p) => p.isActive);

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId],
    );
  };

  const handleAssign = async () => {
    if (!userId || selectedPlanIds.length === 0) {
      toast.error('Select a user and at least one plan');
      return;
    }
    try {
      await assignPlan.mutateAsync({ userId, planIds: selectedPlanIds });
      toast.success('Plans offered to user successfully');
      setDialogOpen(false);
      setUserId('');
      setSelectedPlanIds([]);
      setSearch('');
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to assign plans';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-label text-sm text-on-surface-variant">
          Offer plans to a user — they choose their preferred plan, billing cycle, and complete payment.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow" />}>
            Offer Plans to User
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Offer Plans to User</DialogTitle>
              <DialogDescription>
                Select one or more plans. The user will be notified and can choose their preferred plan, billing cycle (monthly/yearly), and pay.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* User search */}
              <div className="space-y-2">
                <Label className="font-label text-xs font-bold">Search User <span className="text-error">*</span></Label>
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && users.length > 0 && !userId && (
                  <div className="max-h-40 overflow-y-auto border border-outline-variant/20 rounded-lg">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        className="w-full text-left px-3 py-2 hover:bg-surface-container-low transition-colors text-sm"
                        onClick={() => {
                          setUserId(u.id);
                          setSearch(`${u.firstName} ${u.lastName}`);
                        }}
                      >
                        <span className="font-bold">{u.firstName} {u.lastName}</span>
                        <span className="text-on-surface-variant ml-2 text-xs">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <div className="flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-2">
                    <span className="font-label text-sm font-bold">{selectedUser.firstName} {selectedUser.lastName}</span>
                    <span className="font-label text-xs text-on-surface-variant">{selectedUser.email}</span>
                    <button
                      className="ml-auto text-on-surface-variant hover:text-error text-xs"
                      onClick={() => { setUserId(''); setSearch(''); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Plan multi-select */}
              <div className="space-y-2">
                <Label className="font-label text-xs font-bold">
                  Select Plans <span className="text-error">*</span>
                  <span className="text-on-surface-variant font-normal ml-1">(pick 1 or more)</span>
                </Label>
                <div className="rounded-xl border border-outline-variant/20 max-h-52 overflow-y-auto divide-y divide-surface-container">
                  {activePlans.map((plan) => {
                    const isSelected = selectedPlanIds.includes(plan.id);
                    return (
                      <label
                        key={plan.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-surface-container-low'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePlan(plan.id)}
                          className="h-4 w-4 rounded border-input accent-primary shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-label text-sm font-bold">{plan.name}</p>
                          {plan.description && (
                            <p className="font-label text-[10px] text-on-surface-variant truncate">{plan.description}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {plan.priceMonthly ? (
                            <p className="font-label text-xs font-bold">Rs {Number(plan.priceMonthly).toLocaleString()}<span className="text-on-surface-variant font-normal">/mo</span></p>
                          ) : (
                            <p className="font-label text-xs text-on-surface-variant">Custom</p>
                          )}
                          {plan.maxUsers && (
                            <p className="font-label text-[10px] text-on-surface-variant">{plan.maxUsers} users</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {selectedPlanIds.length > 0 && (
                  <p className="font-label text-[10px] text-primary font-bold">
                    {selectedPlanIds.length} plan{selectedPlanIds.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              {/* Info */}
              <div className="bg-surface-container-low rounded-lg p-3">
                <p className="font-label text-[10px] text-on-surface-variant">
                  The user will receive a notification with the offered plans. They choose billing cycle (monthly/yearly) and complete payment themselves. Hospitals will be re-activated so the user can log in.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleAssign}
                disabled={!userId || selectedPlanIds.length === 0 || assignPlan.isPending}
              >
                {assignPlan.isPending ? 'Sending...' : `Offer ${selectedPlanIds.length || ''} Plan${selectedPlanIds.length > 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Assignments table */}
      <AssignmentsTable />
    </div>
  );
}

function AssignmentsTable() {
  const { data: assignments, isLoading } = usePlanAssignments();
  const { data: allPlans = [] } = useAllPlans();
  const assignPlan = useAdminAssignPlan();

  const [editTarget, setEditTarget] = useState<PlanAssignment | null>(null);
  const [editPlanIds, setEditPlanIds] = useState<string[]>([]);


  const activePlans = allPlans.filter((p: SubscriptionPlanAdmin) => p.isActive);

  const openEdit = (a: PlanAssignment) => {
    setEditTarget(a);
    setEditPlanIds(a.plans.map((p) => p.id));
  };

  const toggleEditPlan = (planId: string) => {
    setEditPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId],
    );
  };

  const handleUpdate = async () => {
    if (!editTarget || editPlanIds.length === 0) return;
    try {
      await assignPlan.mutateAsync({ userId: editTarget.userId, planIds: editPlanIds });
      toast.success(`Plans updated for ${editTarget.userName}`);
      setEditTarget(null);
    } catch {
      toast.error('Failed to update plans');
    }
  };

  return (
    <>
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-container">
          <h3 className="font-headline text-base font-bold">Offered Plans</h3>
          <p className="font-label text-xs text-on-surface-variant">Users who have been offered plans by admin</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-container text-left">
              <th className="px-6 py-3 font-label text-xs text-on-surface-variant font-bold">User</th>
              <th className="px-6 py-3 font-label text-xs text-on-surface-variant font-bold">Offered Plans</th>
              <th className="px-6 py-3 font-label text-xs text-on-surface-variant font-bold">Assigned On</th>
              <th className="px-6 py-3 font-label text-xs text-on-surface-variant font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-surface-container">
                  <td className="px-6 py-3"><div className="h-4 w-32 rounded animate-shimmer" /></td>
                  <td className="px-6 py-3"><div className="h-4 w-40 rounded animate-shimmer" /></td>
                  <td className="px-6 py-3"><div className="h-4 w-24 rounded animate-shimmer" /></td>
                  <td className="px-6 py-3"><div className="h-4 w-16 rounded animate-shimmer" /></td>
                </tr>
              ))
            ) : !assignments || assignments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center font-label text-sm text-on-surface-variant">
                  No plan assignments yet. Use the button above to offer plans to users.
                </td>
              </tr>
            ) : (
              assignments.map((a) => (
                <tr key={a.userId} className="border-b border-surface-container hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-label text-sm font-bold">{a.userName}</p>
                    <p className="font-label text-[10px] text-on-surface-variant">{a.email}</p>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {a.plans.map((p) => (
                        <span key={p.id} className="font-label text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="font-label text-xs text-on-surface-variant">
                      {formatDate(a.assignedAt)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => openEdit(a)}>
                      Change Plans
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Change Plans Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Change Offered Plans</DialogTitle>
            <DialogDescription>
              Update the plans available to <strong>{editTarget?.userName}</strong> ({editTarget?.email}).
              The user will be notified of the change.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              {/* Current plans */}
              <div>
                <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mb-1.5">Currently offered</p>
                <div className="flex flex-wrap gap-1">
                  {editTarget.plans.map((p) => (
                    <span key={p.id} className="font-label text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Plan multi-select */}
              <div className="space-y-1.5">
                <Label className="font-label text-xs font-bold">
                  Select New Plans <span className="text-error">*</span>
                </Label>
                <div className="rounded-xl border border-outline-variant/20 max-h-52 overflow-y-auto divide-y divide-surface-container">
                  {activePlans.map((plan: SubscriptionPlanAdmin) => {
                    const isSelected = editPlanIds.includes(plan.id);
                    return (
                      <label
                        key={plan.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-purple-50' : 'hover:bg-surface-container-low'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEditPlan(plan.id)}
                          className="h-4 w-4 rounded border-input accent-purple-600 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-label text-sm font-bold">{plan.name}</p>
                          {plan.description && <p className="font-label text-[10px] text-on-surface-variant truncate">{plan.description}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          {plan.priceMonthly ? (
                            <p className="font-label text-xs font-bold">Rs {Number(plan.priceMonthly).toLocaleString()}<span className="text-on-surface-variant font-normal">/mo</span></p>
                          ) : (
                            <p className="font-label text-xs text-on-surface-variant">Free</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {editPlanIds.length > 0 && (
                  <p className="font-label text-[10px] text-purple-600 font-bold">
                    {editPlanIds.length} plan{editPlanIds.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} className="flex-1">Cancel</Button>
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              disabled={editPlanIds.length === 0 || assignPlan.isPending}
              onClick={handleUpdate}
            >
              {assignPlan.isPending ? 'Updating...' : `Update Plans (${editPlanIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function SubscriptionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-xl font-bold">Subscriptions</h1>
        <p className="font-label text-sm text-on-surface-variant">
          Manage user subscriptions, plans, and assignments
        </p>
      </div>

      <Tabs defaultValue="assign">
        <TabsList>
          <TabsTrigger value="assign">Assign Plan</TabsTrigger>
          <TabsTrigger value="subscriptions">User Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Manage Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="assign">
          <AssignPlanTab />
        </TabsContent>

        <TabsContent value="subscriptions">
          <TenantSubscriptionsTab />
        </TabsContent>

        <TabsContent value="plans">
          <ManagePlansTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
