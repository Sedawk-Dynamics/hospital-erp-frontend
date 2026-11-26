'use client';

import { useState } from 'react';
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDateTime } from '@/lib/date-utils';
import {
  roleLabel,
  useEscalationSettings,
  useIsHospitalAdmin,
  useUpdateEscalationSettings,
  type EscalationRequestType,
} from '@/hooks/use-insurance-admin';

type Draft = Record<EscalationRequestType, { hours: string; role: string }>;

/**
 * Gap 294: per-hospital escalation rules — how many hours past its deadline a
 * breached request waits, and which role it is escalated to. Editable by the
 * Hospital Admin; everyone else sees the rules read-only.
 */
export function SlaEscalationSettings() {
  const isAdmin = useIsHospitalAdmin();
  const { data, isLoading } = useEscalationSettings();
  const save = useUpdateEscalationSettings();
  const [draft, setDraft] = useState<Draft | null>(null);

  const editing = draft !== null;
  const maxHours = data?.maxHours ?? 720;

  function startEdit() {
    if (!data) return;
    setDraft(
      Object.fromEntries(
        data.settings.map((s) => [s.requestType, { hours: String(s.escalateAfterHours), role: s.targetRole }]),
      ) as Draft,
    );
  }

  function errorFor(hours: string) {
    const n = Number(hours);
    if (!hours.trim() || !Number.isInteger(n) || n <= 0) return 'Whole hours, more than 0';
    if (n > maxHours) return `At most ${maxHours} hours`;
    return null;
  }

  async function submit() {
    if (!draft || !data) return;
    const rows = data.settings.map((s) => ({ requestType: s.requestType, ...draft[s.requestType] }));
    const invalid = rows.find((r) => errorFor(r.hours) || !r.role);
    if (invalid) {
      toast.error('Fix the highlighted rows before saving');
      return;
    }
    try {
      await save.mutateAsync(rows.map((r) => ({ requestType: r.requestType, escalateAfterHours: Number(r.hours), targetRole: r.role })));
      toast.success('Escalation rules saved');
      setDraft(null);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not save escalation rules');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Settings2 className="size-4" /> Escalation rules</CardTitle>
          <CardDescription>
            A breached request is escalated to the chosen role once it has been overdue for the set number of hours.
            {!isAdmin && ' Only a Hospital Admin can change these.'}
          </CardDescription>
        </div>
        {isAdmin && !editing && (
          <Button size="sm" variant="outline" onClick={startEdit} disabled={!data}>Edit</Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="flex items-center gap-2 text-sm text-on-surface-variant"><Loader2 className="size-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="space-y-3">
            {data.settings.map((s) => {
              const row = draft?.[s.requestType];
              const error = row ? errorFor(row.hours) : null;
              return (
                <div key={s.requestType} className="grid items-center gap-2 sm:grid-cols-[1fr_9rem_12rem]">
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-on-surface-variant">
                      {s.isDefault ? 'Default' : s.updatedAt ? `Updated ${formatDateTime(s.updatedAt)}` : 'Configured'}
                    </div>
                  </div>
                  {row ? (
                    <>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={maxHours}
                            step={1}
                            aria-label={`${s.label}: escalate after hours`}
                            aria-invalid={Boolean(error)}
                            value={row.hours}
                            onChange={(e) => setDraft({ ...draft!, [s.requestType]: { ...row, hours: e.target.value } })}
                          />
                          <span className="text-xs text-on-surface-variant">h</span>
                        </div>
                        {error && <p className="mt-0.5 text-[11px] text-destructive">{error}</p>}
                      </div>
                      <select
                        aria-label={`${s.label}: escalate to role`}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                        value={row.role}
                        onChange={(e) => setDraft({ ...draft!, [s.requestType]: { ...row, role: e.target.value } })}
                      >
                        {!data.roles.some((r) => r.name === row.role) && <option value={row.role}>{roleLabel(row.role)}</option>}
                        {data.roles.map((r) => <option key={r.name} value={r.name}>{roleLabel(r.name)}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <div className="text-sm">after <span className="font-semibold">{s.escalateAfterHours}h</span> overdue</div>
                      <div className="text-sm">to <span className="font-semibold">{roleLabel(s.targetRole)}</span></div>
                    </>
                  )}
                </div>
              );
            })}
            {editing && (
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setDraft(null)} disabled={save.isPending}>Cancel</Button>
                <Button size="sm" onClick={submit} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Save rules
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
