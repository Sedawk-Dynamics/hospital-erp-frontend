'use client';

import { useState, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useAvailableFormsForMe,
  useFormSubmissions,
  useCreateFormSubmission,
} from '@/hooks/use-forms';
import { FormRenderer } from '@/components/forms/form-renderer';
import {
  TRIGGER_LABELS,
  CATEGORY_LABELS,
  type FormTrigger,
  type FormCategory,
  type FormSchema,
} from '@/types/forms';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDateTimeAmPm } from '@/lib/date-utils';

// ─────────────────────────────────────────────────────────
// Staff Forms Inbox
// ─────────────────────────────────────────────────────────
// Lists all system forms available to the current user.
// Click a form to fill and submit it via FormRenderer.
// Below: recent submissions with status badges.
// ─────────────────────────────────────────────────────────

interface AvailableForm {
  form: {
    id: string;
    name: string;
    description?: string | null;
    category: string;
    trigger: FormTrigger;
    sortOrder: number;
  };
  isRequired: boolean;
  effectiveSchema: FormSchema;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  verified: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-700',
};

// Build unique trigger values from TRIGGER_LABELS
const TRIGGER_OPTIONS = Object.entries(TRIGGER_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function StaffFormsInboxPage() {
  const [search, setSearch] = useState('');
  const [triggerFilter, setTriggerFilter] = useState<string | undefined>();
  const [selectedForm, setSelectedForm] = useState<AvailableForm | null>(null);

  const { data: forms, isLoading } = useAvailableFormsForMe();
  const { data: submissionsData } = useFormSubmissions({ limit: 20 });
  const createMutation = useCreateFormSubmission();

  const submissions = submissionsData?.data ?? [];

  // Collect only triggers present in the fetched forms for the filter dropdown
  const activeTriggers = useMemo(() => {
    const set = new Set<string>();
    for (const f of (forms ?? []) as AvailableForm[]) set.add(f.form.trigger);
    return TRIGGER_OPTIONS.filter((t) => set.has(t.value));
  }, [forms]);

  const filtered = useMemo(() => {
    let list = (forms ?? []) as AvailableForm[];
    if (triggerFilter) list = list.filter((f) => f.form.trigger === triggerFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.form.name.toLowerCase().includes(q) ||
          f.form.description?.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.form.sortOrder - b.form.sortOrder);
  }, [forms, triggerFilter, search]);

  const handleSubmit = async (responses: Record<string, unknown>) => {
    if (!selectedForm) return;
    try {
      await createMutation.mutateAsync({
        formId: selectedForm.form.id,
        trigger: selectedForm.form.trigger,
        responses,
      });
      toast.success(`"${selectedForm.form.name}" submitted`);
      setSelectedForm(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Failed to submit form');
    }
  };

  const requiredCount = ((forms ?? []) as AvailableForm[]).filter((f) => f.isRequired).length;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Staff Forms Inbox
          </h1>
          <p className="font-label text-xs text-muted-foreground max-w-2xl mt-1">
            All forms available to you. Click any form to fill and submit it.
          </p>
        </div>
        {requiredCount > 0 && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-center shrink-0">
            <p className="font-headline text-lg font-bold text-amber-900">{requiredCount}</p>
            <p className="text-[10px] text-amber-800 font-semibold uppercase tracking-wider">
              Required
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search forms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={triggerFilter ?? 'all'}
          onValueChange={(v: string | null) =>
            setTriggerFilter(!v || v === 'all' ? undefined : v)
          }
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All triggers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All triggers</SelectItem>
            {activeTriggers.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Forms grid */}
      {isLoading ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm font-medium">No forms available</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {search || triggerFilter
              ? 'Try adjusting your filters.'
              : 'Forms will appear here once your admin assigns them.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((f) => (
            <button
              key={f.form.id}
              type="button"
              onClick={() => setSelectedForm(f)}
              className={cn(
                'rounded-xl border-2 bg-card p-4 flex flex-col gap-3 text-left transition-colors cursor-pointer',
                f.isRequired
                  ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400'
                  : 'border-border hover:border-primary/50',
              )}
            >
              <div className="flex items-start gap-2">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                    f.isRequired ? 'bg-amber-100' : 'bg-primary/10',
                  )}
                >
                  {f.isRequired ? (
                    <AlertCircle className="h-4 w-4 text-amber-700" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{f.form.name}</h4>
                  <p className="text-[10px] text-muted-foreground">
                    {TRIGGER_LABELS[f.form.trigger]} ·{' '}
                    {CATEGORY_LABELS[f.form.category as FormCategory]}
                  </p>
                </div>
                {f.isRequired && (
                  <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                    REQUIRED
                  </span>
                )}
              </div>
              {f.form.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {f.form.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Recent Submissions */}
      {submissions.length > 0 && (
        <div className="space-y-2 pt-4">
          <h3 className="font-headline text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Recent Submissions
          </h3>
          <div className="rounded-xl border bg-card divide-y">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {s.systemForm?.name ?? 'Form'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDateTimeAmPm(s.submittedAt)}
                  </p>
                </div>
                {s.trigger && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {TRIGGER_LABELS[s.trigger] ?? s.trigger}
                  </Badge>
                )}
                <Badge
                  className={cn(
                    'text-[10px] capitalize shrink-0',
                    STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-700',
                  )}
                >
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fill-form dialog */}
      <Dialog
        open={!!selectedForm}
        onOpenChange={(o) => {
          if (!o) setSelectedForm(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {selectedForm && (
            <>
              <DialogTitle className="font-headline text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {selectedForm.form.name}
              </DialogTitle>
              {selectedForm.form.description && (
                <DialogDescription>{selectedForm.form.description}</DialogDescription>
              )}
              <div className="mt-3 rounded-lg border bg-muted/20 p-4">
                <FormRenderer
                  schema={selectedForm.effectiveSchema as never}
                  onSubmit={handleSubmit}
                  isSubmitting={createMutation.isPending}
                  submitLabel="Submit Form"
                  onCancel={() => setSelectedForm(null)}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
