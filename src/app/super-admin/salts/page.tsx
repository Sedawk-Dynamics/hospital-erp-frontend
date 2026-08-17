'use client';

/**
 * The salt review queue.
 *
 * A drug's schedule is decided from its molecules, and a molecule no published
 * list names is stored UNDECIDED rather than over-the-counter. That distinction
 * only pays off if someone can see the undecided ones and clear them — which is
 * this page.
 *
 * They are ranked by how many catalog products contain the molecule, because
 * that is the order in which the decisions matter: rosuvastatin sits in nearly
 * two thousand products, warfarin in eighteen. Deciding one re-classifies every
 * product containing it, immediately.
 */

import { useState } from 'react';
import { AlertTriangle, Check, Search, FlaskConical, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScheduleBadge, ControlledBadge } from '@/components/pharmacy/schedule-badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useSalts, useSaltReviewSummary, useDecideSalt,
  type Salt, type SaltListParams,
} from '@/hooks/use-drug-master';
import type { DrugSchedule } from '@/hooks/use-pharmacy';

const SCHEDULES: { code: DrugSchedule; label: string; hint: string }[] = [
  { code: 'X', label: 'Schedule X', hint: 'Prescription in duplicate; copy kept 2 years; stock locked' },
  { code: 'H1', label: 'Schedule H1', hint: 'Prescription + an entry in the H1 register' },
  { code: 'H', label: 'Schedule H', hint: 'Prescription from a registered practitioner' },
  { code: 'G', label: 'Schedule G', hint: 'No prescription — caution label only' },
  { code: 'OTC', label: 'Over the counter', hint: 'Not in any schedule' },
];

const STATUSES = [
  { key: 'undecided' as const, label: 'Needs a decision' },
  { key: 'decided' as const, label: 'Decided' },
  { key: 'all' as const, label: 'All' },
];

const CELL = 'py-2 px-3 text-sm';

function Tile({
  value, label, tone = 'plain',
}: { value: string | number; label: string; tone?: 'plain' | 'warn' }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3',
        tone === 'warn' ? 'border-warning/30 bg-warning/10' : 'border-border bg-card',
      )}
    >
      <div className={cn('text-2xl font-semibold tabular-nums', tone === 'warn' && 'text-warning')}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default function SaltReviewPage() {
  const [status, setStatus] = useState<'undecided' | 'decided' | 'all'>('undecided');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Salt | null>(null);

  const params: SaltListParams = {
    page, limit: 50, status,
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const { data, isLoading } = useSalts(params);
  const { data: summary } = useSaltReviewSummary();
  const decide = useDecideSalt();

  const salts = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FlaskConical className="h-6 w-6 text-primary" />
          Molecules
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every drug&rsquo;s schedule comes from its molecules. A molecule no published list names
          is held here as <strong>undecided</strong> rather than treated as over-the-counter, so it
          shows up as work instead of quietly reading as safe. Deciding one re-classifies every
          product that contains it.
        </p>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile value={summary.undecided} label="Need a decision" tone="warn" />
          <Tile value={summary.productsAffected} label="Products affected by them" tone="warn" />
          <Tile value={summary.decided} label="Decided" />
          <Tile value={summary.manual} label="Set by hand" />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => { setStatus(s.key); setPage(1); }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                status === s.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-56 flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Find a molecule…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px]">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur">
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 px-3 font-semibold">Molecule</th>
              <th className="py-2 px-3 text-right font-semibold">Products</th>
              <th className="py-2 px-3 font-semibold">Schedule</th>
              <th className="py-2 px-3 font-semibold">Why</th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className={cn(CELL, 'text-center text-muted-foreground')}>Loading…</td></tr>
            ) : !salts.length ? (
              <tr>
                <td colSpan={5} className={cn(CELL, 'text-center text-muted-foreground')}>
                  {status === 'undecided'
                    ? 'Nothing left to decide.'
                    : 'No molecules match.'}
                </td>
              </tr>
            ) : (
              salts.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/40">
                  <td className={CELL}>
                    <div className="font-medium">{s.name}</div>
                    {s.synonyms.length ? (
                      <div className="text-[11px] text-muted-foreground">
                        also written {s.synonyms.slice(0, 3).join(', ')}
                      </div>
                    ) : null}
                  </td>
                  <td className={cn(CELL, 'text-right tabular-nums')}>
                    {s.productCount.toLocaleString('en-IN')}
                  </td>
                  <td className={CELL}>
                    {s.scheduleCode ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <ScheduleBadge schedule={s.scheduleCode} showOtc />
                        <ControlledBadge
                          controlledClass={s.controlledClass}
                          vaultControlled={s.vaultControlled}
                        />
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Undecided
                      </span>
                    )}
                  </td>
                  <td className={cn(CELL, 'max-w-sm text-xs text-muted-foreground')}>
                    {s.scheduleNote}
                    {s.source === 'manual' ? (
                      <span className="ml-1 font-medium text-foreground">(set by hand)</span>
                    ) : null}
                  </td>
                  <td className={cn(CELL, 'text-right')}>
                    <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                      {s.scheduleCode ? 'Change' : 'Decide'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {meta.page} of {meta.totalPages} · {meta.total.toLocaleString('en-IN')} molecules
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <DecideDialog
        salt={editing}
        onClose={() => setEditing(null)}
        onSave={async (data) => {
          if (!editing) return;
          try {
            await decide.mutateAsync({ id: editing.id, data });
            toast.success(
              `${editing.name} saved — ${editing.productCount.toLocaleString('en-IN')} product(s) re-classified.`,
            );
            setEditing(null);
          } catch {
            toast.error('Could not save the schedule.');
          }
        }}
        saving={decide.isPending}
      />
    </div>
  );
}

function DecideDialog({
  salt, onClose, onSave, saving,
}: {
  salt: Salt | null;
  onClose: () => void;
  onSave: (data: {
    scheduleCode: DrugSchedule | null;
    controlledClass?: 'narcotic' | 'psychotropic' | null;
    vaultControlled?: boolean;
    note?: string | null;
  }) => void;
  saving: boolean;
}) {
  const [choice, setChoice] = useState<DrugSchedule | null>(null);
  const [note, setNote] = useState('');

  // Seed the form when a different molecule is opened. Keyed on the salt id so
  // it does not fight the user's typing on every render.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (salt && seededFor !== salt.id) {
    setSeededFor(salt.id);
    setChoice(salt.scheduleCode);
    setNote('');
  }

  if (!salt) return null;

  return (
    <Dialog open={Boolean(salt)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{salt.name}</DialogTitle>
          <DialogDescription>
            In {salt.productCount.toLocaleString('en-IN')} catalog product
            {salt.productCount === 1 ? '' : 's'}. Saving re-classifies every one of them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {salt.classes.length ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Covered by the <strong>{salt.classes.join(', ')}</strong> class entry.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label>What does the counter need for this molecule?</Label>
            <div className="space-y-1.5">
              {SCHEDULES.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => setChoice(s.code)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                    choice === s.code ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      choice === s.code ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                    )}
                  >
                    {choice === s.code ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="salt-note">Why (optional)</Label>
            <Textarea
              id="salt-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Recorded against the molecule, and shown to anyone who asks why."
            />
          </div>

          <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              This is a decision, not a guess — it is marked as set by hand and no re-seed will
              overwrite it.
            </span>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave({ scheduleCode: choice, note: note.trim() || null })} disabled={saving}>
            {saving ? 'Saving…' : 'Save and re-classify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
