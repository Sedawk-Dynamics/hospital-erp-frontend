'use client';

// Gap 369: price review list, duplicate groups, and retiring a duplicate.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useDuplicateGroups,
  usePriceReview,
  useRetirePreview,
  useRetireTest,
  type CatalogueTestBrief,
} from '@/hooks/use-lab-catalog';
import { useLabTests } from '@/hooks/use-lab';
import { formatINR } from '@/lib/money';
import { formatDateTime } from '@/lib/date-utils';
import { getApiErrorMessage } from '@/lib/utils';

/** Asks for the reason the server requires before it saves the price. */
export function PriceReasonDialog({
  message,
  onCancel,
  onConfirm,
}: {
  message: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check this price</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="price-reason" className="text-xs">Reason for keeping this price (recorded)</Label>
          <Textarea id="price-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Go back</Button>
          <Button disabled={reason.trim().length < 5} onClick={() => onConfirm(reason.trim())}>Save this price</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CatalogReviewSection() {
  const price = usePriceReview();
  const groups = useDuplicateGroups();
  const [pair, setPair] = useState<{ retire: CatalogueTestBrief; keepId: string } | null>(null);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Needs price review</h2>
        <p className="text-xs text-muted-foreground">
          A single test priced above a panel that includes it. Prices are only listed here; change them on the Test Catalog tab.
        </p>
        {price.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : price.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(price.error, 'Could not load the price review')}</p>
        ) : (price.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No prices need review.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-surface-container-lowest text-sm">
            {(price.data ?? []).map((r) => (
              <li key={`${r.testId}-${r.panelId}`} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span>
                  <strong>{r.testName}</strong> {formatINR(r.price)} costs more than <strong>{r.panelName}</strong>{' '}
                  {formatINR(r.panelPrice)}, which includes it
                </span>
                {r.confirmed ? (
                  <Badge className="ml-auto bg-gray-100 text-gray-800 text-[10px]">
                    Kept, {formatDateTime(r.confirmedAt)}: {r.confirmedReason}
                  </Badge>
                ) : (
                  <Badge className="ml-auto bg-amber-100 text-amber-900 text-[10px]">Needs review</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Possible duplicates</h2>
        {groups.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : groups.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(groups.error, 'Could not load duplicates')}</p>
        ) : (groups.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No near-identical names found. You can also retire any test from the Test Catalog tab.</p>
        ) : (
          (groups.data ?? []).map((g) => (
            <div key={g.message} className="divide-y rounded-xl border bg-surface-container-lowest text-sm">
              {g.tests.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <span className="font-medium">{t.testName}</span>
                  <span className="text-xs text-muted-foreground">
                    {[t.testCode, t.sampleType, `${t.ranges.length} parameter(s)`, t.price != null ? formatINR(t.price) : 'no price'].filter(Boolean).join(' · ')}
                  </span>
                  <span className="ml-auto flex gap-1">
                    {g.tests.filter((o) => o.id !== t.id).map((o) => (
                      <Button key={o.id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPair({ retire: t, keepId: o.id })}>
                        Retire this, keep {o.testName}
                      </Button>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </section>

      {pair && (
        <RetireDialog retireId={pair.retire.id} retireName={pair.retire.testName} initialKeepId={pair.keepId} onClose={() => setPair(null)} />
      )}
    </div>
  );
}

export function RetireDialog({
  retireId,
  retireName,
  initialKeepId,
  onClose,
}: {
  retireId: string;
  retireName: string;
  initialKeepId?: string;
  onClose: () => void;
}) {
  const [keepId, setKeepId] = useState<string | null>(initialKeepId ?? null);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [agree, setAgree] = useState(false);
  const { data: found } = useLabTests({ search: search || undefined, limit: 10 });
  const preview = useRetirePreview(retireId, keepId);
  const retire = useRetireTest();
  const p = preview.data;
  const differs = (p?.differences.length ?? 0) > 0;
  const ready = !!p && p.keep.isActive && (!differs || (agree && reason.trim().length >= 5));

  const submit = async () => {
    if (!keepId) return;
    try {
      await retire.mutateAsync({ retireId, keepTestId: keepId, reason: reason.trim(), confirmDifferences: differs ? agree : undefined });
      toast.success(`${retireName} retired. Past orders and reports are unchanged.`);
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not retire this test'));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Retire {retireName}</DialogTitle>
          <DialogDescription>
            It is switched off for new orders, never deleted. Searching its name will find the test you keep.
          </DialogDescription>
        </DialogHeader>

        {!initialKeepId && (
          <div className="space-y-1">
            <Label className="text-xs">Keep this test instead</Label>
            <Input placeholder="Search tests" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-36 overflow-y-auto rounded-lg border">
              {(found?.data ?? []).filter((t) => t.id !== retireId && t.isActive).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-container-low ${keepId === t.id ? 'bg-primary/10 font-medium' : ''}`}
                  onClick={() => setKeepId(t.id)}
                >
                  {t.testName} {t.testCode && <span className="font-mono text-[10px] text-muted-foreground">{t.testCode}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {preview.isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
        {preview.isError && <p className="text-sm text-destructive">{getApiErrorMessage(preview.error, 'Could not check this test')}</p>}
        {p && (
          <div className="space-y-3 text-sm">
            <p>
              Keeping <strong>{p.keep.testName}</strong> {p.keep.price != null && `(${formatINR(p.keep.price)})`}
              {p.retire.price != null && `, retiring at ${formatINR(p.retire.price)}`}.
            </p>
            <ul className="list-disc pl-5 text-xs">
              <li>{p.references.orderItems} past or current order line(s) stay on the retired test</li>
              {p.references.openOrderItems > 0 && <li>{p.references.openOrderItems} of them are still open and will be completed as ordered</li>}
              {p.references.pendingRanges > 0 && <li>{p.references.pendingRanges} range proposal(s) on it are still pending</li>}
            </ul>
            {p.references.needsAttention.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">Change these by hand. They refer to the retired test by name or code:</p>
                <ul className="list-disc pl-5">
                  {p.references.needsAttention.map((n) => <li key={`${n.kind}-${n.label}`}>{n.kind}: {n.label}</li>)}
                </ul>
              </div>
            )}
            {differs && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900">
                <p className="font-semibold">These are not identical tests:</p>
                <ul className="list-disc pl-5">{p.differences.map((d) => <li key={d}>{d}</li>)}</ul>
                <label className="mt-2 flex items-center gap-2">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  The differences are acceptable and the kept test replaces it
                </label>
              </div>
            )}
            <div>
              <Label className="text-xs">Reason{differs ? ' (required)' : ''}</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!ready || retire.isPending} onClick={submit}>Retire {retireName}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
