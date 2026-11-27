'use client';

// The follow-up fee settings (gap items #331 and #019): the hospital default,
// and the same fields as an override for a department or a doctor, where every
// field may be left to the default. Read-only for anyone but the Hospital Admin.

import { useId, useState } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  draftError,
  fromDraft,
  MAX_FREE_DAYS,
  SCOPE_LABELS,
  toDraft,
  type AfterWindowMode,
  type FollowUpRuleDraft,
  type FollowUpRuleLayer,
  type FollowUpScope,
} from '@/lib/follow-up-fee';
import {
  useDoctorFollowUpRule,
  useSaveFollowUpRule,
  type FollowUpRules,
  type RuleTarget,
} from '@/hooks/use-follow-up-rules';
import { formatDateTime } from '@/lib/date-utils';
import { getApiErrorMessage } from '@/lib/utils';

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function RuleFields({
  draft,
  onChange,
  inheritLabel,
}: {
  draft: FollowUpRuleDraft;
  onChange: (patch: Partial<FollowUpRuleDraft>) => void;
  /** Set for an override: what "use the default" reads as. */
  inheritLabel?: string;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${id}-days`} className="mb-1 block text-xs text-muted-foreground">
          Free follow-up days (0–{MAX_FREE_DAYS})
        </Label>
        <Input
          id={`${id}-days`}
          inputMode="numeric"
          value={draft.freeDays}
          placeholder={inheritLabel ?? ''}
          onChange={(e) => onChange({ freeDays: e.target.value })}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          The visit itself is day 0. {inheritLabel ? 'Blank uses the default; 0 means none.' : '0 means none.'}
        </p>
      </div>

      <div>
        <Label htmlFor={`${id}-after`} className="mb-1 block text-xs text-muted-foreground">
          After the free days, a follow-up costs
        </Label>
        <select
          id={`${id}-after`}
          className={SELECT_CLASS}
          value={draft.afterWindow}
          onChange={(e) => onChange({ afterWindow: e.target.value as AfterWindowMode | '' })}
        >
          <option value="">{inheritLabel ?? 'Choose…'}</option>
          <option value="full">The full consultation fee</option>
          <option value="fixed">A fixed follow-up fee</option>
        </select>
        {draft.afterWindow === 'fixed' && (
          <div className="mt-2">
            <Label htmlFor={`${id}-fee`} className="mb-1 block text-xs text-muted-foreground">
              Follow-up fee (₹)
            </Label>
            <Input
              id={`${id}-fee`}
              inputMode="decimal"
              value={draft.fixedFee}
              onChange={(e) => onChange({ fixedFee: e.target.value })}
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor={`${id}-scope`} className="mb-1 block text-xs text-muted-foreground">
          Which return visits count
        </Label>
        <select
          id={`${id}-scope`}
          className={SELECT_CLASS}
          value={draft.scope}
          onChange={(e) => onChange({ scope: e.target.value as FollowUpScope | '' })}
        >
          <option value="">{inheritLabel ?? 'Choose…'}</option>
          {(Object.keys(SCOPE_LABELS) as FollowUpScope[]).map((s) => (
            <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor={`${id}-discharge`} className="mb-1 block text-xs text-muted-foreground">
          Does an inpatient discharge start the free days?
        </Label>
        <select
          id={`${id}-discharge`}
          className={SELECT_CLASS}
          value={draft.dischargeStartsWindow}
          onChange={(e) =>
            onChange({ dischargeStartsWindow: e.target.value as FollowUpRuleDraft['dischargeStartsWindow'] })
          }
        >
          <option value="">{inheritLabel ?? 'Choose…'}</option>
          <option value="yes">Yes, from the day of discharge</option>
          <option value="no">No, only a paid consultation does</option>
        </select>
      </div>
    </div>
  );
}

/** One level's rule with Save and Remove. Remount (`key`) it on new data. */
function RuleEditor({
  layer,
  target,
  complete = false,
  inheritLabel,
  removeLabel,
  canRemove,
}: {
  layer: FollowUpRuleLayer | null;
  target: RuleTarget;
  complete?: boolean;
  inheritLabel?: string;
  removeLabel: string;
  canRemove: boolean;
}) {
  const [draft, setDraft] = useState<FollowUpRuleDraft>(() => toDraft(layer));
  const save = useSaveFollowUpRule(target);
  const error = draftError(draft, complete);
  const [showError, setShowError] = useState(false);

  const submit = async (value: FollowUpRuleLayer | null) => {
    try {
      await save.mutateAsync(value);
      toast.success(value ? 'Follow-up rule saved.' : 'Follow-up rule removed.');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save the follow-up rule.'));
    }
  };

  return (
    <div className="space-y-3">
      <RuleFields
        draft={draft}
        inheritLabel={inheritLabel}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      />
      {showError && error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {canRemove && (
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={save.isPending}
            onClick={() => void submit(null)}
          >
            <RotateCcw className="h-4 w-4" /> {removeLabel}
          </Button>
        )}
        <Button
          type="button"
          className="gap-1.5"
          disabled={save.isPending}
          onClick={() => {
            setShowError(true);
            if (!error) void submit(fromDraft(draft));
          }}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save follow-up rule
        </Button>
      </div>
    </div>
  );
}

const layerKey = (l: FollowUpRuleLayer | null) => JSON.stringify(l);

/** The hospital default. */
export function HospitalFollowUpRuleCard({ rules }: { rules: FollowUpRules }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          Hospital default
          {rules.hospitalSummary && <Badge variant="secondary">{rules.hospitalSummary}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!rules.hospital && (
          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            No rule is set. Until one is, a visit booked as a follow-up at the desk is free, and each
            doctor keeps any free days they already have.
          </p>
        )}
        {rules.canEdit ? (
          <RuleEditor
            key={layerKey(rules.hospital)}
            layer={rules.hospital}
            target={{ level: 'hospital' }}
            complete
            removeLabel="Remove rule"
            canRemove={!!rules.hospital}
          />
        ) : (
          <>
            {rules.hospital && <LayerDetails layer={rules.hospital} />}
            <p className="text-xs text-muted-foreground">Only the Hospital Admin can change this.</p>
          </>
        )}
        {rules.hospitalUpdatedAt && (
          <p className="text-[11px] text-muted-foreground">
            Last changed {formatDateTime(rules.hospitalUpdatedAt)}. A change applies to appointments booked
            after it; bills and bookings already made keep their price.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LayerDetails({ layer }: { layer: FollowUpRuleLayer }) {
  const rows: Array<[string, string]> = [];
  if (layer.scope) rows.push(['Return visits that count', SCOPE_LABELS[layer.scope]]);
  if (layer.dischargeStartsWindow !== null) {
    rows.push(['Discharge starts the free days', layer.dischargeStartsWindow ? 'Yes' : 'No']);
  }
  return (
    <dl className="space-y-1 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Department defaults: one line each, opened to edit. */
export function DepartmentFollowUpRules({ rules }: { rules: FollowUpRules }) {
  const [open, setOpen] = useState<string | null>(null);
  if (rules.departments.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Department defaults (optional)</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {rules.departments.map((d) => (
          <div key={d.departmentId} className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                {d.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {d.summary ?? 'No rule'}
                  {!d.override && d.summary ? ' (hospital default)' : ''}
                </span>
              </span>
              {rules.canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setOpen((o) => (o === d.departmentId ? null : d.departmentId))}
                >
                  {open === d.departmentId ? 'Close' : d.override ? 'Edit' : 'Set'}
                </Button>
              )}
            </div>
            {open === d.departmentId && rules.canEdit && (
              <div className="mt-3">
                <RuleEditor
                  key={layerKey(d.override)}
                  layer={d.override}
                  target={{ level: 'departments', id: d.departmentId }}
                  inheritLabel="Use hospital default"
                  removeLabel="Use hospital default"
                  canRemove={!!d.override}
                />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const hasOverride = (l: FollowUpRuleLayer) => Object.values(l).some((v) => v !== null);

/** One doctor's rule, on the doctor's own schedule and fee screen. */
export function DoctorFollowUpRuleCard({ doctorId, readOnly = false }: { doctorId: string; readOnly?: boolean }) {
  const { data, isLoading } = useDoctorFollowUpRule(doctorId);
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the follow-up rule…
      </div>
    );
  }
  if (!data) return null;

  const own = hasOverride(data.override);
  // Days left from before there were rules: they still apply, on their own.
  const summary =
    data.summary ??
    (data.override.freeDays ? `Free for ${data.override.freeDays} days after a paid consultation` : 'No rule set');
  const editable = data.canEdit && !readOnly;

  return (
    <div className="space-y-3 rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-sm font-semibold text-foreground">Follow-up rule</span>
          <p className="text-[11px] text-muted-foreground">
            {own ? 'Set for this doctor' : data.summary ? 'Using the default' : 'Nothing set for this doctor'}
            {own && data.inheritedSummary ? ` · default: ${data.inheritedSummary}` : ''}
          </p>
        </div>
        <Badge variant="secondary">{summary}</Badge>
      </div>
      {editable ? (
        <RuleEditor
          key={`${doctorId}:${layerKey(data.override)}`}
          layer={data.override}
          target={{ level: 'doctors', id: doctorId }}
          inheritLabel="Use default"
          removeLabel="Use default for all"
          canRemove={own}
        />
      ) : (
        !readOnly && (
          <p className="text-xs text-muted-foreground">Only the Hospital Admin can change follow-up rules.</p>
        )
      )}
    </div>
  );
}
