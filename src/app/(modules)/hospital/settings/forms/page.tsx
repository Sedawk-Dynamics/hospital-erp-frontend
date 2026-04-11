'use client';

import { useMemo, useState } from 'react';
import {
  FileText,
  Inbox,
  Search,
  Loader2,
  Eye,
  Settings2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useHospitalFormConfigs,
  useUpsertHospitalFormConfig,
  useFormSubmissions,
} from '@/hooks/use-forms';
import {
  CATEGORY_LABELS,
  TRIGGER_LABELS,
  ROLE_OPTIONS,
  ROLE_SETTING_LABELS,
  MODULE_LABELS,
  type SystemForm,
  type RoleSetting,
  type FormSchema,
  type FormSubmission,
  type FormTrigger,
  type FormCategory,
} from '@/types/forms';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { FormPreviewDialog } from '@/components/forms/form-preview-dialog';

// ─── Trigger grouping for the System Forms tab ──────────────

const TRIGGER_GROUP_ORDER: { group: string; triggers: FormTrigger[] }[] = [
  {
    group: 'Patient Lifecycle',
    triggers: [
      'appointment_booking', 'patient_registration', 'visit_check_in',
      'pre_consultation', 'admission', 'pre_op', 'post_op', 'discharge', 'feedback',
    ],
  },
  {
    group: 'Clinical Workflow',
    triggers: [
      'vital_signs_entry', 'prescription_created', 'prescription_dispensed',
      'lab_order_created', 'lab_sample_collected', 'lab_report_finalized',
      'imaging_request_created', 'imaging_result_finalized',
      'progress_note_added', 'nursing_note_added', 'medication_administered', 'patient_transfer',
    ],
  },
  {
    group: 'Staff & HR',
    triggers: [
      'staff_check_in', 'staff_check_out', 'shift_handover', 'leave_request',
      'performance_review', 'employee_onboarding', 'exit_interview', 'training_completion',
    ],
  },
  {
    group: 'Pharmacy',
    triggers: ['drug_stock_received', 'drug_returned', 'pharmacy_expiry_audit'],
  },
  {
    group: 'Laboratory',
    triggers: ['specimen_received', 'lab_qc_check'],
  },
  {
    group: 'Blood Bank',
    triggers: ['blood_donation_collected', 'transfusion_initiated', 'transfusion_reaction_reported'],
  },
  {
    group: 'Insurance & Billing',
    triggers: ['insurance_claim_submitted', 'pre_authorization_request', 'payment_received', 'refund_requested'],
  },
  {
    group: 'Operations & Compliance',
    triggers: ['daily_safety_check', 'incident_reported', 'equipment_check', 'inventory_audit', 'maintenance_request', 'compliance_audit'],
  },
  {
    group: 'Periodic Reviews',
    triggers: ['daily_review', 'weekly_review', 'monthly_review'],
  },
  {
    group: 'Manual',
    triggers: ['manual'],
  },
];

type FormWithConfig = SystemForm & {
  config: { id: string; isEnabled: boolean; schemaOverride?: FormSchema | null; roleSettings: Record<string, RoleSetting> } | null;
};

// ─── Main Page ──────────────────────────────────────────────

export default function HospitalFormsPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold">Forms</h1>
        <p className="font-label text-xs text-muted-foreground">
          Enable or disable system forms for your hospital and configure per-role visibility.
        </p>
      </div>

      <Tabs defaultValue="system-forms">
        <TabsList variant="line">
          <TabsTrigger value="system-forms">
            <FileText className="h-4 w-4" />
            System Forms
          </TabsTrigger>
          <TabsTrigger value="submissions">
            <Inbox className="h-4 w-4" />
            Submissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system-forms">
          <SystemFormsTab />
        </TabsContent>
        <TabsContent value="submissions">
          <SubmissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1: System Forms ────────────────────────────────────

function SystemFormsTab() {
  const [search, setSearch] = useState('');
  const [configForm, setConfigForm] = useState<FormWithConfig | null>(null);
  const [previewForm, setPreviewForm] = useState<FormWithConfig | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { data: forms, isLoading } = useHospitalFormConfigs();
  const upsertMutation = useUpsertHospitalFormConfig();

  const filtered = useMemo(() => {
    if (!forms) return [];
    if (!search.trim()) return forms as FormWithConfig[];
    const q = search.toLowerCase();
    return (forms as FormWithConfig[]).filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q) ||
        TRIGGER_LABELS[f.trigger]?.toLowerCase().includes(q),
    );
  }, [forms, search]);

  const grouped = useMemo(() => {
    const formsByTrigger = new Map<string, FormWithConfig[]>();
    for (const f of filtered) {
      const list = formsByTrigger.get(f.trigger) ?? [];
      list.push(f);
      formsByTrigger.set(f.trigger, list);
    }

    return TRIGGER_GROUP_ORDER
      .map((g) => {
        const groupForms = g.triggers.flatMap((t) => formsByTrigger.get(t) ?? []);
        return { group: g.group, forms: groupForms };
      })
      .filter((g) => g.forms.length > 0);
  }, [filtered]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleToggle = async (form: FormWithConfig) => {
    const newEnabled = form.config ? !form.config.isEnabled : true;
    try {
      await upsertMutation.mutateAsync({
        formId: form.id,
        isEnabled: newEnabled,
      });
      toast.success(`${form.name} ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update form');
    }
  };

  const isEnabled = (form: FormWithConfig) => form.config?.isEnabled ?? form.isActive;

  return (
    <div className="space-y-3 mt-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search forms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm font-medium">No forms found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? 'Try a different search term.' : 'No system forms are available.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ group, forms: groupForms }) => {
            const collapsed = collapsedGroups.has(group);
            const enabledCount = groupForms.filter((f) => isEnabled(f)).length;
            return (
              <div key={group} className="rounded-xl border bg-card overflow-hidden">
                <button
                  onClick={() => toggleGroup(group)}
                  className="flex items-center gap-2 w-full px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="h-4 w-1 bg-primary rounded-full" />
                  <h3 className="font-headline text-sm font-bold uppercase tracking-wider flex-1">
                    {group}
                  </h3>
                  <span className="text-[10px] font-label text-muted-foreground">
                    {enabledCount}/{groupForms.length} enabled
                  </span>
                </button>

                {!collapsed && (
                  <div className="divide-y">
                    {groupForms.map((form) => (
                      <div
                        key={form.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors"
                      >
                        {/* Toggle */}
                        <button
                          onClick={() => handleToggle(form)}
                          disabled={upsertMutation.isPending}
                          className={cn(
                            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isEnabled(form) ? 'bg-primary' : 'bg-muted-foreground/30',
                          )}
                          role="switch"
                          aria-checked={isEnabled(form)}
                          aria-label={`Toggle ${form.name}`}
                        >
                          <span
                            className={cn(
                              'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5',
                              isEnabled(form) ? 'translate-x-4 ml-0.5' : 'translate-x-0.5',
                            )}
                          />
                        </button>

                        {/* Form info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{form.name}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              {CATEGORY_LABELS[form.category]}
                            </Badge>
                            <Badge
                              className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-0"
                            >
                              {TRIGGER_LABELS[form.trigger]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200"
                            >
                              {MODULE_LABELS[form.module] || form.module}
                            </Badge>
                          </div>
                          {form.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {form.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-1 text-[10px] text-muted-foreground">
                            {form.appearsAt && (
                              <span>
                                <span className="font-semibold text-on-surface-variant">Appears:</span>{' '}
                                {form.appearsAt}
                              </span>
                            )}
                            {form.resultsVisibleAt?.length > 0 && (
                              <span>
                                <span className="font-semibold text-on-surface-variant">Results in:</span>{' '}
                                {form.resultsVisibleAt.join(' · ')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewForm(form)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfigForm(form)}
                          >
                            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                            Configure
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Role settings config dialog */}
      {configForm && (
        <RoleConfigDialog
          form={configForm}
          open={!!configForm}
          onClose={() => setConfigForm(null)}
        />
      )}

      {/* Form preview dialog */}
      {previewForm && (
        <FormPreviewDialog
          open={!!previewForm}
          onClose={() => setPreviewForm(null)}
          schema={previewForm.config?.schemaOverride ?? previewForm.schema}
          title={previewForm.name}
          description={previewForm.description}
          meta={[
            { label: 'Trigger', value: TRIGGER_LABELS[previewForm.trigger] || previewForm.trigger },
            { label: 'Category', value: CATEGORY_LABELS[previewForm.category] || previewForm.category },
            { label: 'Module', value: MODULE_LABELS[previewForm.module] || previewForm.module },
            ...(previewForm.appearsAt ? [{ label: 'Appears at', value: previewForm.appearsAt }] : []),
            ...(previewForm.resultsVisibleAt?.length ? [{ label: 'Results visible in', value: previewForm.resultsVisibleAt.join(', ') }] : []),
          ]}
        />
      )}
    </div>
  );
}

// ─── Role Settings Config Dialog ────────────────────────────

function RoleConfigDialog({
  form,
  open,
  onClose,
}: {
  form: FormWithConfig;
  open: boolean;
  onClose: () => void;
}) {
  const effectiveSettings = form.config?.roleSettings ?? form.defaultRoleSettings ?? {};
  // Only show roles that are applicable for this form
  const applicableSet = new Set(form.applicableRoles ?? []);
  const applicableRoleOptions = ROLE_OPTIONS.filter((r) => applicableSet.has(r.slug));

  const [roleSettings, setRoleSettings] = useState<Record<string, RoleSetting>>(() => {
    const initial: Record<string, RoleSetting> = {};
    for (const role of applicableRoleOptions) {
      initial[role.slug] = effectiveSettings[role.slug] ?? 'hidden';
    }
    return initial;
  });

  const upsertMutation = useUpsertHospitalFormConfig();

  const handleSave = async () => {
    try {
      await upsertMutation.mutateAsync({
        formId: form.id,
        roleSettings,
      });
      toast.success(`Role settings saved for "${form.name}"`);
      onClose();
    } catch {
      toast.error('Failed to save role settings');
    }
  };

  const handleRoleChange = (roleSlug: string, value: string | null) => {
    if (!value) return;
    setRoleSettings((prev) => ({ ...prev, [roleSlug]: value as RoleSetting }));
  };

  // Group applicable roles by category
  const rolesByCategory = useMemo(() => {
    const map = new Map<string, typeof ROLE_OPTIONS>();
    for (const role of applicableRoleOptions) {
      const list = map.get(role.category) ?? [];
      list.push(role);
      map.set(role.category, list);
    }
    return Array.from(map.entries());
  }, [applicableRoleOptions]);

  const settingColor: Record<RoleSetting, string> = {
    required: 'text-red-600',
    optional: 'text-blue-600',
    view_only: 'text-amber-600',
    hidden: 'text-muted-foreground',
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline">Configure: {form.name}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Set how each role interacts with this form when it triggers at{' '}
            <span className="font-medium text-primary">{TRIGGER_LABELS[form.trigger]}</span>.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {rolesByCategory.map(([category, roles]) => (
            <div key={category}>
              <h4 className="font-label text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                {category}
              </h4>
              <div className="space-y-2">
                {roles.map((role) => (
                  <div
                    key={role.slug}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{role.label}</p>
                      <p className="text-[10px] text-muted-foreground">{role.description}</p>
                    </div>
                    <Select
                      value={roleSettings[role.slug]}
                      onValueChange={(value) => handleRoleChange(role.slug, value)}
                    >
                      <SelectTrigger className={cn('w-[130px] h-8 text-xs', settingColor[roleSettings[role.slug]])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(ROLE_SETTING_LABELS) as [RoleSetting, string][]).map(
                          ([val, label]) => (
                            <SelectItem key={val} value={val}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={upsertMutation.isPending}>
            {upsertMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab 2: Submissions ─────────────────────────────────────

function SubmissionsTab() {
  const [selected, setSelected] = useState<FormSubmission | null>(null);
  const { data, isLoading } = useFormSubmissions({ limit: 100 });

  const submissions = data?.data ?? [];

  return (
    <div className="space-y-3 mt-3">
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium">No submissions yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              When users fill out forms, their submissions will appear here.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-label text-[10px] uppercase tracking-wider text-muted-foreground">
                  Form
                </th>
                <th className="px-4 py-3 text-left font-label text-[10px] uppercase tracking-wider text-muted-foreground">
                  Patient
                </th>
                <th className="px-4 py-3 text-left font-label text-[10px] uppercase tracking-wider text-muted-foreground">
                  Trigger
                </th>
                <th className="px-4 py-3 text-left font-label text-[10px] uppercase tracking-wider text-muted-foreground">
                  Filled by
                </th>
                <th className="px-4 py-3 text-left font-label text-[10px] uppercase tracking-wider text-muted-foreground">
                  When
                </th>
                <th className="px-4 py-3 text-left font-label text-[10px] uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-label text-[10px] uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-xs font-medium">
                    {s.systemForm?.name ?? s.instance?.name ?? '--'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.patient
                      ? `${s.patient.firstName} ${s.patient.lastName ?? ''} (${s.patient.mrn})`
                      : '--'}
                  </td>
                  <td className="px-4 py-3">
                    {s.trigger ? (
                      <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                        {TRIGGER_LABELS[s.trigger]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.submitter
                      ? `${s.submitter.firstName} ${s.submitter.lastName ?? ''}`
                      : '--'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTimeAmPm(s.submittedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] capitalize',
                        s.status === 'submitted' && 'bg-blue-100 text-blue-800 border-blue-200',
                        s.status === 'verified' && 'bg-emerald-100 text-emerald-800 border-emerald-200',
                        s.status === 'rejected' && 'bg-red-100 text-red-800 border-red-200',
                        s.status === 'draft' && 'bg-amber-100 text-amber-800 border-amber-200',
                      )}
                    >
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="View"
                      onClick={() => setSelected(s)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Submission detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && <SubmissionDetail submission={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Submission Detail ──────────────────────────────────────

function SubmissionDetail({ submission }: { submission: FormSubmission }) {
  const formName = submission.systemForm?.name ?? submission.instance?.name ?? 'Submission';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-headline">{formName}</DialogTitle>
        <p className="text-xs text-muted-foreground">
          Submitted {formatDateTimeAmPm(submission.submittedAt)}
          {submission.submitter && (
            <> by {submission.submitter.firstName} {submission.submitter.lastName}</>
          )}
        </p>
      </DialogHeader>

      {/* Context info */}
      <div className="space-y-3 mt-3">
        {submission.patient && (
          <div className="flex gap-2 text-xs">
            <span className="font-label text-muted-foreground">Patient:</span>
            <span className="font-medium">
              {submission.patient.firstName} {submission.patient.lastName} ({submission.patient.mrn})
            </span>
          </div>
        )}
        {submission.trigger && (
          <div className="flex gap-2 text-xs">
            <span className="font-label text-muted-foreground">Trigger:</span>
            <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-0">
              {TRIGGER_LABELS[submission.trigger]}
            </Badge>
          </div>
        )}

        {/* Responses */}
        <div className="rounded-lg border p-4 space-y-2">
          <h4 className="font-label text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Responses
          </h4>
          {Object.entries(submission.responses).length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No responses recorded.</p>
          ) : (
            Object.entries(submission.responses).map(([key, value]) => (
              <div key={key} className="flex gap-3 py-1 border-b last:border-0">
                <span className="font-label text-xs text-muted-foreground min-w-[120px]">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-xs font-medium break-words">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '--')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
