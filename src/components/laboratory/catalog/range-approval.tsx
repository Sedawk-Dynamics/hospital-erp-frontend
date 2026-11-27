'use client';

// Gap 369: reference-range proposals and pathologist sign-off. Anything pending
// here is not in use: entry flags, reports and the portal read the live range.

import { useMemo, useState } from 'react';
import { Bot, Check, ChevronDown, ChevronRight, History, Loader2, PencilLine, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useApproveRanges,
  useConfirmRanges,
  usePendingRanges,
  useProposeRange,
  useRangeStatus,
  useRejectRange,
  useSuggestRange,
  useTestRanges,
  type PendingProposal,
  type RangeEdits,
  type RangeFilter,
  type RangeSlot,
  type RangeStatusRow,
} from '@/hooks/use-lab-catalog';
import { useLabRole } from '@/hooks/use-lab-role';
import { useAuthStore } from '@/stores/auth-store';
import { formatDateTime } from '@/lib/date-utils';
import { cn, getApiErrorMessage } from '@/lib/utils';

const FILTERS: { value: RangeFilter; label: string }[] = [
  { value: 'not_signed_off', label: 'Not signed off' },
  { value: 'pending', label: 'Awaiting approval' },
  { value: 'no_range', label: 'No range' },
  { value: 'all', label: 'All' },
];

export function rangeLabel(r: { refLow: number | null; refHigh: number | null; refText: string | null } | null): string {
  if (!r) return 'none';
  if (r.refLow != null && r.refHigh != null) return `${r.refLow}–${r.refHigh}`;
  if (r.refLow != null) return `≥ ${r.refLow}`;
  if (r.refHigh != null) return `≤ ${r.refHigh}`;
  return r.refText ?? 'none';
}

export function RangeStatusBadge({ status }: { status: RangeSlot['status'] }) {
  if (status === 'signed_off') return <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Signed off</Badge>;
  if (status === 'no_range') return <Badge className="bg-gray-100 text-gray-700 text-[10px]">No range</Badge>;
  return <Badge className="bg-amber-100 text-amber-900 text-[10px]">Not signed off</Badge>;
}

export function RangeApprovalSection() {
  const { canSignRanges } = useLabRole();
  const status = useRangeStatus();
  const pending = usePendingRanges();
  const [filter, setFilter] = useState<RangeFilter>('not_signed_off');
  const [search, setSearch] = useState('');
  const [openTest, setOpenTest] = useState<string | null>(null);
  const [historyOf, setHistoryOf] = useState<RangeStatusRow | null>(null);

  const totals = status.data?.totals;
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (status.data?.tests ?? []).filter((t) => {
      if (filter === 'not_signed_off' && t.notSignedOff === 0) return false;
      if (filter === 'pending' && t.pending === 0) return false;
      if (filter === 'no_range' && t.noRange === 0) return false;
      if (!q) return true;
      return [t.testName, t.testCode ?? '', ...t.ranges.map((r) => r.name)].join(' ').toLowerCase().includes(q);
    });
  }, [status.data, filter, search]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-surface-container-lowest p-4 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span><strong>{totals?.notSignedOff ?? 0}</strong> range(s) not signed off</span>
          <span><strong>{totals?.pending ?? 0}</strong> awaiting approval</span>
          <span><strong>{totals?.signedOff ?? 0}</strong> signed off</span>
          <span><strong>{totals?.noRange ?? 0}</strong> without a range</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Ranges already in use stay on reports and are shown as not signed off until a pathologist confirms them.
          Proposed ranges are not used anywhere until approved.
          {!canSignRanges && ' Only a pathologist (Lab Supervisor) can approve, reject or confirm.'}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Awaiting a pathologist</h2>
        {pending.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : pending.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(pending.error, 'Could not load proposals')}</p>
        ) : (pending.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting.</p>
        ) : (
          <div className="space-y-2">
            {(pending.data ?? []).map((p) => (
              <ProposalCard key={p.id} proposal={p} canSign={canSignRanges} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold mr-2">Ranges in use</h2>
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
          <Input
            className="h-8 max-w-xs text-xs"
            placeholder="Search test or parameter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {status.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(status.error, 'Could not load ranges')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tests match.</p>
        ) : (
          <div className="divide-y rounded-xl border bg-surface-container-lowest">
            {rows.map((t) => (
              <div key={t.testId}>
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                    onClick={() => setOpenTest(openTest === t.testId ? null : t.testId)}
                  >
                    {openTest === t.testId ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="truncate font-medium">{t.testName}</span>
                    {t.testCode && <span className="font-mono text-[10px] text-muted-foreground">{t.testCode}</span>}
                  </button>
                  {t.notSignedOff > 0 && <Badge className="bg-amber-100 text-amber-900 text-[10px]">{t.notSignedOff} not signed off</Badge>}
                  {t.pending > 0 && <Badge className="bg-sky-100 text-sky-900 text-[10px]">{t.pending} pending</Badge>}
                  <Button size="sm" variant="ghost" className="h-7" title="History" onClick={() => setHistoryOf(t)}>
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {openTest === t.testId && <TestRanges row={t} canSign={canSignRanges} />}
              </div>
            ))}
          </div>
        )}
      </section>

      <RangeHistoryDialog row={historyOf} onClose={() => setHistoryOf(null)} />
    </div>
  );
}

function TestRanges({ row, canSign }: { row: RangeStatusRow; canSign: boolean }) {
  const confirmRanges = useConfirmRanges();
  const suggest = useSuggestRange();
  const [proposeFor, setProposeFor] = useState<RangeSlot | null>(null);

  const confirmSlots = async (slots: RangeSlot[]) => {
    if (!window.confirm(`Sign off ${slots.length} range(s) of ${row.testName} exactly as shown?`)) return;
    try {
      await confirmRanges.mutateAsync({
        testId: row.testId,
        items: slots.map((s) => ({ parameterKey: s.key, expectedLiveHash: s.liveHash })),
      });
      toast.success('Signed off');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not sign off'));
    }
  };

  const onSuggest = async (slot: RangeSlot) => {
    try {
      await suggest.mutateAsync({ testId: row.testId, parameterKey: slot.key });
      toast.success('AI suggestion saved for the pathologist to review');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'No suggestion available'));
    }
  };

  const unsigned = row.ranges.filter((r) => r.status === 'not_signed_off');

  return (
    <div className="bg-surface-container-low px-4 py-2">
      <table className="w-full text-xs">
        <tbody>
          {row.ranges.map((r) => (
            <tr key={r.key} className="border-b last:border-b-0">
              <td className="py-1.5 pr-2 font-medium">{r.name}</td>
              <td className="py-1.5 pr-2">{r.rangeText || 'none'} <span className="text-muted-foreground">{r.unit ?? ''}</span></td>
              <td className="py-1.5 pr-2">
                <RangeStatusBadge status={r.status} />
                {r.signedOffBy && (
                  <span className="ml-1 text-[10px] text-muted-foreground">{r.signedOffBy}, {formatDateTime(r.signedOffAt)}</span>
                )}
              </td>
              <td className="py-1.5 text-right">
                <div className="inline-flex flex-wrap justify-end gap-1">
                  {r.inputType === 'number' && (
                    <Button size="sm" variant="ghost" className="h-6 gap-1 text-[11px]" disabled={suggest.isPending} onClick={() => onSuggest(r)}>
                      <Bot className="h-3 w-3" /> Suggest with AI
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 gap-1 text-[11px]" onClick={() => setProposeFor(r)}>
                    <PencilLine className="h-3 w-3" /> Propose
                  </Button>
                  {canSign && r.status === 'not_signed_off' && (
                    <Button size="sm" variant="outline" className="h-6 gap-1 text-[11px]" disabled={confirmRanges.isPending} onClick={() => confirmSlots([r])}>
                      <ShieldCheck className="h-3 w-3" /> Confirm current range
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canSign && unsigned.length > 1 && (
        <div className="pt-2 text-right">
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={confirmRanges.isPending} onClick={() => confirmSlots(unsigned)}>
            <ShieldCheck className="h-3.5 w-3.5" /> Confirm all {unsigned.length} shown
          </Button>
        </div>
      )}
      {proposeFor && <ProposeDialog testId={row.testId} testName={row.testName} slot={proposeFor} onClose={() => setProposeFor(null)} />}
    </div>
  );
}

type RangeFormState = { unit: string; low: string; high: string; text: string };

export function readRangeForm(f: RangeFormState): { edits: RangeEdits; error: string | null } {
  const n = (v: string) => (v.trim() === '' ? null : Number(v));
  const low = n(f.low);
  const high = n(f.high);
  if ((low !== null && !Number.isFinite(low)) || (high !== null && !Number.isFinite(high))) {
    return { edits: {}, error: 'Limits must be numbers' };
  }
  if (low !== null && high !== null && low >= high) return { edits: {}, error: 'The low limit must be below the high limit' };
  return {
    edits: { unit: f.unit.trim() || null, refLow: low, refHigh: high, refText: f.text.trim() || null },
    error: null,
  };
}

function RangeFields({ value, onChange }: { value: RangeFormState; onChange: (v: RangeFormState) => void }) {
  const set = (k: keyof RangeFormState) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid grid-cols-3 gap-2">
      <div><Label className="text-xs">Low</Label><Input inputMode="decimal" value={value.low} onChange={set('low')} /></div>
      <div><Label className="text-xs">High</Label><Input inputMode="decimal" value={value.high} onChange={set('high')} /></div>
      <div><Label className="text-xs">Unit</Label><Input value={value.unit} onChange={set('unit')} /></div>
      <div className="col-span-3">
        <Label className="text-xs">Text range (used only when there are no limits; does not flag high or low)</Label>
        <Input maxLength={100} value={value.text} onChange={set('text')} placeholder="e.g. Male 13-17; Female 12-15" />
      </div>
    </div>
  );
}

const formFrom = (r: { unit: string | null; refLow: number | null; refHigh: number | null; refText: string | null }): RangeFormState => ({
  unit: r.unit ?? '',
  low: r.refLow?.toString() ?? '',
  high: r.refHigh?.toString() ?? '',
  text: r.refText ?? '',
});

function ProposeDialog({ testId, testName, slot, onClose }: { testId: string; testName: string; slot: RangeSlot; onClose: () => void }) {
  const propose = useProposeRange();
  const [form, setForm] = useState(formFrom(slot));
  const [rationale, setRationale] = useState('');
  const submit = async () => {
    const { edits, error } = readRangeForm(form);
    if (error) return void toast.error(error);
    try {
      await propose.mutateAsync({ testId, parameterKey: slot.key, ...edits, rationale: rationale || undefined });
      toast.success('Sent for pathologist approval');
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not propose this range'));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propose a range: {slot.name}</DialogTitle>
          <DialogDescription>{testName}. In use now: {slot.rangeText || 'none'} {slot.unit ?? ''}. Your proposal is not used until another person, a pathologist, approves it.</DialogDescription>
        </DialogHeader>
        <RangeFields value={form} onChange={setForm} />
        <div><Label className="text-xs">Source or reason</Label><Textarea rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={propose.isPending}>Send for approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProposalCard({ proposal: p, canSign }: { proposal: PendingProposal; canSign: boolean }) {
  const approve = useApproveRanges();
  const reject = useRejectRange();
  const userId = useAuthStore((s) => s.user?.id);
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState(formFrom(p));
  const own = p.source !== 'ai' && !!p.proposedById && p.proposedById === userId;
  const busy = approve.isPending || reject.isPending;
  const removes = p.proposedText === '';

  const onApprove = async () => {
    if (!p.liveHash) return;
    let edits: RangeEdits | undefined;
    if (editing) {
      const r = readRangeForm(form);
      if (r.error) return void toast.error(r.error);
      edits = r.edits;
    }
    if (removes && !editing && !window.confirm(`This removes the range for ${p.parameterName}. Results will no longer be flagged. Continue?`)) return;
    try {
      await approve.mutateAsync([{ id: p.id, expectedLiveHash: p.liveHash, edits }]);
      toast.success('Approved. New results use this range; issued reports keep theirs.');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not approve'));
    }
  };

  const onReject = async () => {
    if (reason.trim().length < 3) return void toast.error('Give a reason');
    try {
      await reject.mutateAsync({ id: p.id, reason: reason.trim() });
      toast.success('Rejected');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not reject'));
    }
  };

  return (
    <div className="space-y-2 rounded-xl border bg-surface-container-lowest px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{p.test.testName} / {p.parameterName}</span>
        {p.source === 'ai' ? (
          <Badge className="gap-1 bg-violet-100 text-violet-900 text-[10px]"><Bot className="h-3 w-3" /> AI-suggested, not reviewed</Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-800 text-[10px]">Proposed by {p.proposedByName ?? 'staff'}</Badge>
        )}
        {p.stale && <Badge className="bg-amber-100 text-amber-900 text-[10px]">Range in use has changed since</Badge>}
        <span className="ml-auto text-[11px] text-muted-foreground">{formatDateTime(p.proposedAt)}</span>
      </div>
      <div className="flex flex-wrap gap-x-6 text-xs">
        <span>In use: <strong>{p.live?.rangeText || 'none'}</strong> {p.live?.unit ?? ''}</span>
        <span>Proposed: <strong>{removes ? 'remove the range' : p.proposedText}</strong> {p.unit ?? ''}</span>
      </div>
      {p.rationale && <p className="text-xs text-muted-foreground">{p.rationale}{p.aiModel ? ` (${p.aiModel})` : ''}</p>}
      {(p.warnings ?? []).map((w) => <p key={w} className="text-xs text-amber-800">{w}</p>)}
      {p.orphaned && <p className="text-xs text-destructive">This parameter was removed or renamed, so the proposal can only be rejected.</p>}
      {canSign && editing && <RangeFields value={form} onChange={setForm} />}
      {canSign && rejecting && (
        <Textarea rows={2} placeholder="Why is this being rejected?" value={reason} onChange={(e) => setReason(e.target.value)} />
      )}
      {canSign && (
        <div className="flex flex-wrap gap-2">
          {!rejecting && (
            <>
              <Button size="sm" className="h-7 gap-1 text-xs" disabled={busy || own || p.orphaned || !p.liveHash} onClick={onApprove}
                title={own ? 'You proposed this range, so another pathologist has to approve it' : undefined}>
                <Check className="h-3.5 w-3.5" /> {editing ? 'Approve with edits' : 'Approve'}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || own || p.orphaned} onClick={() => setEditing((v) => !v)}>
                {editing ? 'Undo edits' : 'Edit'}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className={cn('h-7 gap-1 text-xs', rejecting && 'text-destructive')} disabled={busy}
            onClick={rejecting ? onReject : () => setRejecting(true)}>
            <X className="h-3.5 w-3.5" /> {rejecting ? 'Confirm rejection' : 'Reject'}
          </Button>
          {rejecting && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRejecting(false)}>Cancel</Button>}
          {own && <span className="self-center text-[11px] text-muted-foreground">You proposed this; another pathologist has to approve it.</span>}
        </div>
      )}
    </div>
  );
}

function RangeHistoryDialog({ row, onClose }: { row: RangeStatusRow | null; onClose: () => void }) {
  const { data, isLoading } = useTestRanges(row?.testId ?? null);
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Range history: {row?.testName}</DialogTitle>
          <DialogDescription>Every proposal, approval, rejection and confirmation.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (data?.history ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet. The ranges in use have never been signed off here.</p>
        ) : (
          <ul className="divide-y text-xs">
            {(data?.history ?? []).map((h) => (
              <li key={h.id} className="space-y-0.5 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{h.parameterName}</span>
                  <Badge className="text-[10px] capitalize">{h.origin === 'confirm_current' ? 'confirmed' : h.status}</Badge>
                  {h.source === 'ai' && <Badge className="bg-violet-100 text-violet-900 text-[10px]">AI-suggested</Badge>}
                </div>
                <div>
                  Proposed {h.proposedText || 'no range'} {h.unit ?? ''} by {h.proposedByName ?? 'staff'}, {formatDateTime(h.proposedAt)}
                </div>
                {h.reviewedAt && (
                  <div>
                    {h.status === 'rejected' ? 'Rejected' : 'Signed'} by {h.reviewedByName}, {formatDateTime(h.reviewedAt)}
                    {h.status === 'approved' && h.origin !== 'confirm_current' && `: ${rangeLabel(h.previousLive)} to ${rangeLabel(h.appliedLive)}`}
                    {h.editedValues && ' (edited)'}
                    {h.reviewNote && `. ${h.reviewNote}`}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
