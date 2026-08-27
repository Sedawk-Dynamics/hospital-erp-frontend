'use client';

import { useMemo, useState } from 'react';
import {
  Search, Printer, Download, SlidersHorizontal, ShieldCheck,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Boxes, Layers, FileCheck2, X,
  PackagePlus, Syringe, Trash2,
} from 'lucide-react';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { ScheduleBadge } from '@/components/pharmacy/schedule-badge';
import {
  useControlledRegister, useControlledDrugOptions,
  type ControlledRegisterParams, type RegisterRow,
} from '@/hooks/use-pharmacy';
import { useNdpsLocations } from '@/hooks/use-ndps';
import {
  LocationDialog, ReceiveDialog, ConsumptionDialog, DisposalDialog, StockTab, DailyTab,
} from '@/components/pharmacy/ndps-statutory';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toInputDateStr, formatDate, formatDateTime } from '@/lib/date-utils';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

/**
 * The Controlled-Drug Register — the audit view a drug inspector reads.
 *
 * Every movement of a scheduled or narcotic medicine, in one chronological
 * ledger. Two things drive the layout:
 *
 * It is fifteen columns wide, so density matters more than breathing room — the
 * cells are tightened from the table default, the five quantity columns are
 * grouped and set in tabular figures so they scan as a column of arithmetic,
 * and the header sticks while a long period scrolls.
 *
 * It is checked rather than browsed. An auditor verifies one sum — opening plus
 * inward minus outward equals closing — so the summary states that sum as an
 * equation instead of five unrelated tiles, and every row shows the running
 * balance it produced.
 */

/** A register is pulled per period, so the common ones are one click. */
const PRESETS: Array<{ label: string; range: () => { from: string; to: string } }> = [
  {
    label: 'This month',
    range: () => {
      const now = new Date();
      return {
        from: toInputDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toInputDateStr(now),
      };
    },
  },
  {
    label: 'Last month',
    range: () => {
      const now = new Date();
      return {
        from: toInputDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toInputDateStr(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    },
  },
  {
    label: 'Last 90 days',
    range: () => ({
      from: toInputDateStr(new Date(Date.now() - 90 * 864e5)),
      to: toInputDateStr(),
    }),
  },
];

const SCHEDULE_LABEL: Record<string, string> = {
  NDPS: 'NDPS / Narcotics',
  X: 'Schedule X', H1: 'Schedule H1', H: 'Schedule H', H2: 'Schedule H2', G: 'Schedule G',
};

const TYPE_LABEL: Record<string, string> = {
  all: 'All movement',
  inward: 'Inward — receipts & returns',
  outward: 'Outward — dispensing, disposal',
  transfer: 'Internal transfers',
};

/** Compact cell — the table default is built for six columns, not fifteen. */
const CELL = 'px-3 py-2 text-xs';
/** Quantity columns: tabular figures so the digits line up down the column. */
const NUM = `${CELL} text-right tabular-nums`;

export default function ControlledRegisterPage() {
  const initial = PRESETS[0].range();

  // Held as a draft until Go. An inspection search is deliberate, and
  // re-querying a wide date range on every keystroke would make this unusable.
  const [draft, setDraft] = useState<ControlledRegisterParams>({
    fromDate: initial.from, toDate: initial.to, reportType: 'all',
  });
  const [applied, setApplied] = useState<ControlledRegisterParams>(draft);
  const [moreOpen, setMoreOpen] = useState(false);

  const { data, isLoading, isFetching } = useControlledRegister(applied);
  const { data: drugOptions = [] } = useControlledDrugOptions();
  const { data: locations = [] } = useNdpsLocations();
  const selectedDrugIds = (draft.drugIds ?? '').split(',').filter(Boolean);
  // The statutory actions that used to sit on their own NDPS page.
  const [dialog, setDialog] = useState<null | 'receive' | 'consume' | 'dispose' | 'location'>(null);
  const rows = data?.rows ?? [];
  const s = data?.summary;

  const set = <K extends keyof ControlledRegisterParams>(k: K, v: ControlledRegisterParams[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    const r = p.range();
    const next = { ...draft, fromDate: r.from, toDate: r.to };
    setDraft(next);
    setApplied(next);
  };

  /** What the reader is currently looking at, spelled out rather than implied. */
  const activeFilters = useMemo(() => {
    const out: string[] = [];
    if (applied.scheduleType) out.push(SCHEDULE_LABEL[applied.scheduleType] ?? applied.scheduleType);
    if (applied.reportType && applied.reportType !== 'all') out.push(TYPE_LABEL[applied.reportType]);
    if (applied.search) out.push(`matching “${applied.search}”`);
    if (applied.doctorRegNo) out.push(`prescriber ${applied.doctorRegNo}`);
    // Name the items and the safe: "3 items" on a statutory report tells the
    // reader nothing about what they are looking at.
    const ids = (applied.drugIds ?? '').split(',').filter(Boolean);
    if (ids.length) {
      const names = ids.map((id) => drugOptions.find((d) => d.id === id)?.drugName ?? 'item');
      out.push(names.length <= 3 ? names.join(', ') : `${names.length} items`);
    }
    if (applied.locationId) {
      out.push(locations.find((l) => l.id === applied.locationId)?.name ?? 'one sub-store');
    }
    return out;
  }, [applied, drugOptions, locations]);

  const csvRows = useMemo(
    () =>
      rows.map((r) => ({
        'Date/Time': formatDateTime(r.occurredAt),
        'Txn ID': r.txnId,
        'Txn Type': r.txnType,
        'Item Name': r.itemName,
        'API & Strength': r.apiStrength ?? '',
        Batch: r.batchNumber ?? '',
        Expiry: r.expiryDate ? formatDate(r.expiryDate) : '',
        Opening: r.opening,
        'Qty IN': r.qtyIn || '',
        'Qty OUT': r.qtyOut || '',
        'Transfer QTY': r.transferQty || '',
        'Closing Balance': r.closing,
        'Patient / Dept': r.patientOrDept ?? '',
        'Pres. Doctor & Reg. No': r.prescriber ?? '',
        Verification: r.verification ?? '',
      })),
    [rows],
  );

  // Two documents from the same report: the house register, and the Form 35
  // Inspection Book sheet an inspector signs.
  const openPdf = (format?: 'form35') => {
    const qs = new URLSearchParams(
      Object.entries(applied).filter(([, v]) => v != null && v !== '') as [string, string][],
    );
    if (format) qs.set('format', format);
    window.open(`/api/v1/pharmacy/controlled-register/pdf?${qs}`, '_blank');
  };

  const period =
    data?.window
      ? `${formatDate(data.window.from)} – ${formatDate(data.window.to)}`
      : `${draft.fromDate} – ${draft.toDate}`;

  return (
    <PharmacyAdminGuard>
      <div className="space-y-4 animate-fade-in-up print:space-y-2">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-headline flex items-center gap-2 text-xl font-bold">
              <ShieldCheck className="h-5 w-5 text-primary" /> Controlled-Drug Register
            </h1>
            <p className="text-xs text-muted-foreground">
              Every movement of a scheduled or narcotic medicine — receipts, dispensing, transfers
              and disposals — with the running balance an inspection is checked against.
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" disabled={!rows.length}
              onClick={() => downloadCsv('controlled-drug-register', csvRows)}>
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => openPdf()}>
              <Printer className="mr-1.5 h-4 w-4" /> Register (PDF)
            </Button>
            <Button size="sm" disabled={!rows.length} onClick={() => openPdf('form35')}>
              <FileCheck2 className="mr-1.5 h-4 w-4" /> Print Form 35
            </Button>
          </div>
        </div>

        {/* ── The statutory actions that used to live on /inventory/ndps ──
            Receiving, administering and destroying a narcotic are records, not
            stock movements, so they belong with the register an inspector
            reads. Moving stock is the transfer board's job, for every medicine
            alike. */}
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button size="sm" variant="outline" onClick={() => setDialog('receive')}>
            <PackagePlus className="mr-1.5 h-4 w-4" /> Receive (Form 3C)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('consume')}>
            <Syringe className="mr-1.5 h-4 w-4" /> Administer (Form 3E)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog('dispose')}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Disposal
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog('location')}>
            <Boxes className="mr-1.5 h-4 w-4" /> New sub-store
          </Button>
        </div>

        <Tabs defaultValue="ledger">
          <TabsList variant="line">
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="stock">Stock by location</TabsTrigger>
            <TabsTrigger value="daily">Daily account (3H)</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-4">

        {/* ── Filters ── */}
        <div className="space-y-3 rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary print:hidden">
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p.label} variant="ghost" size="sm" className="h-7 text-xs"
                onClick={() => applyPreset(p)}>
                {p.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="reg-from" className="text-xs">From</Label>
              <Input id="reg-from" type="date" value={draft.fromDate ?? ''}
                onChange={(e) => set('fromDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-to" className="text-xs">To</Label>
              <Input id="reg-to" type="date" value={draft.toDate ?? ''}
                onChange={(e) => set('toDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-type" className="text-xs">Report type</Label>
              <Select value={draft.reportType ?? 'all'}
                onValueChange={(v: string | null) => set('reportType', (v as never) ?? 'all')}>
                {/* w-full: the trigger defaults to w-fit, which leaves the two
                    selects narrower than the inputs beside them in the grid. */}
                <SelectTrigger id="reg-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-sched" className="text-xs">Schedule</Label>
              {/* 'all' rather than '' — an empty string leaves the trigger
                  blank instead of showing the placeholder. */}
              <Select value={draft.scheduleType ?? 'all'}
                onValueChange={(v: string | null) =>
                  set('scheduleType', (v === 'all' ? undefined : v) as never)}>
                <SelectTrigger id="reg-sched" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All controlled</SelectItem>
                  {Object.entries(SCHEDULE_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* The spec's item drill-down: an entire class, one molecule, or
                several named items at once. Empty means every controlled drug,
                which is what a register is for. */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-item" className="text-xs">Item</Label>
              <Select
                value={null}
                onValueChange={(v: string | null) => {
                  if (!v) return;
                  const next = selectedDrugIds.includes(v)
                    ? selectedDrugIds
                    : [...selectedDrugIds, v];
                  set('drugIds', next.join(',') as never);
                }}
              >
                <SelectTrigger id="reg-item" className="w-full">
                  <SelectValue
                    placeholder={
                      selectedDrugIds.length
                        ? `${selectedDrugIds.length} item${selectedDrugIds.length === 1 ? '' : 's'}`
                        : 'All items'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {drugOptions
                    .filter((d) => !selectedDrugIds.includes(d.id))
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.drugName}
                        {d.schedule ? ` · ${d.schedule}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-search" className="text-xs">Batch / MRN / invoice</Label>
              <Input id="reg-search" placeholder="Find one entry"
                value={draft.search ?? ''}
                onChange={(e) => set('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setApplied(draft)} />
            </div>
          </div>

          {selectedDrugIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedDrugIds.map((id) => {
                const d = drugOptions.find((o) => o.id === id);
                return (
                  <Badge key={id} variant="outline" className="gap-1 pr-1 text-xs">
                    {d?.drugName ?? id.slice(0, 8)}
                    <button
                      type="button"
                      aria-label={`Remove ${d?.drugName ?? 'item'}`}
                      className="rounded-sm p-0.5 hover:bg-muted"
                      onClick={() =>
                        set(
                          'drugIds',
                          (selectedDrugIds.filter((x) => x !== id).join(',') || undefined) as never,
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              <Button variant="ghost" size="sm" className="h-6 text-xs"
                onClick={() => set('drugIds', undefined as never)}>
                Clear items
              </Button>
            </div>
          )}

          {moreOpen && (
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="reg-doc" className="text-xs">Prescribing doctor / reg. no.</Label>
                <Input id="reg-doc" value={draft.doctorRegNo ?? ''}
                  onChange={(e) => set('doctorRegNo', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-loc" className="text-xs">Sub-store / safe</Label>
                <Select
                  value={draft.locationId ?? 'all'}
                  onValueChange={(v: string | null) =>
                    set('locationId', (v === 'all' ? undefined : v) as never)}
                >
                  <SelectTrigger id="reg-loc" className="w-full">
                    <SelectValue placeholder="Everywhere" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everywhere</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Narrowing to one safe also re-bases the running balance to that location.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setApplied(draft)}>
              <Search className="mr-1.5 h-4 w-4" /> Go
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMoreOpen((o) => !o)}>
              <SlidersHorizontal className="mr-1.5 h-4 w-4" /> More options
            </Button>
          </div>
        </div>

        {/* ── What is on screen ── */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1 font-semibold">{period}</Badge>
          {activeFilters.map((f) => (
            <Badge key={f} variant="outline" className="text-muted-foreground">{f}</Badge>
          ))}
          <span className="text-muted-foreground">
            {isFetching ? 'Loading…' : `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`}
          </span>
        </div>

        {/* ── Summary, stated as the sum an auditor checks ── */}
        {s && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Opening stock" value={s.openingStock} icon={Boxes} tone="slate" />
            <Tile label="Inward" value={s.inward} icon={ArrowDownToLine} tone="emerald" sign="+" />
            <Tile label="Outward" value={s.outward} icon={ArrowUpFromLine} tone="rose" sign="−" />
            <Tile label="Internal transfer" value={s.internalTransfer} icon={ArrowLeftRight} tone="amber" note="not counted" />
            <Tile label="Closing balance" value={s.closingBalance} icon={Layers} tone="teal" strong />
          </div>
        )}
        {s && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {s.openingStock} + {s.inward} − {s.outward} = {s.closingBalance}
            </span>
            {s.internalTransfer > 0 && (
              <>
                {' '}· internal transfers ({s.internalTransfer}) move stock between the vault and its
                sub-stores, so they are shown for custody but not counted — hospital-wide they net
                to zero.
              </>
            )}
          </p>
        )}

        {/* ── Ledger ── */}
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sanctuary">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No controlled-drug movement"
              description={
                activeFilters.length
                  ? `Nothing matched ${activeFilters.join(' · ')} in ${period}.`
                  : `Nothing was received, dispensed, transferred or disposed of in ${period}.`
              }
            />
          ) : (
            <div className="max-h-[65vh] overflow-auto print:max-h-none print:overflow-visible">
              <Table>
                {/* Sticky: a month of movement scrolls well past the header. */}
                <TableHeader className="sticky top-0 z-10 bg-surface-container-lowest shadow-[0_1px_0_var(--color-surface-container)] print:static">
                  <TableRow>
                    <TableHead className={CELL}>Date / time</TableHead>
                    <TableHead className={CELL}>Transaction</TableHead>
                    <TableHead className={CELL}>Item</TableHead>
                    <TableHead className={CELL}>API &amp; strength</TableHead>
                    <TableHead className={CELL}>Batch</TableHead>
                    <TableHead className={CELL}>Expiry</TableHead>
                    <TableHead className={cn(NUM, 'border-l border-surface-container')}>Open</TableHead>
                    <TableHead className={NUM}>In</TableHead>
                    <TableHead className={NUM}>Out</TableHead>
                    <TableHead className={NUM}>Tfr</TableHead>
                    <TableHead className={cn(NUM, 'border-r border-surface-container')}>Close</TableHead>
                    <TableHead className={CELL}>Patient / dept</TableHead>
                    <TableHead className={CELL}>Prescriber &amp; reg. no.</TableHead>
                    <TableHead className={CELL}>Verified by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => <Row key={`${r.txnId}-${i}`} r={r} />)}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
          </TabsContent>

          <TabsContent value="stock"><StockTab /></TabsContent>
          <TabsContent value="daily"><DailyTab /></TabsContent>
        </Tabs>

        <ReceiveDialog open={dialog === 'receive'} onOpenChange={(o) => setDialog(o ? 'receive' : null)} />
        <ConsumptionDialog open={dialog === 'consume'} onOpenChange={(o) => setDialog(o ? 'consume' : null)} />
        <DisposalDialog open={dialog === 'dispose'} onOpenChange={(o) => setDialog(o ? 'dispose' : null)} />
        <LocationDialog open={dialog === 'location'} onOpenChange={(o) => setDialog(o ? 'location' : null)} />
      </div>
    </PharmacyAdminGuard>
  );
}

function Row({ r }: { r: RegisterRow }) {
  const isTransfer = r.transferQty > 0;
  return (
    <TableRow className={cn(isTransfer && 'bg-surface-container-low/40')}>
      <TableCell className={cn(CELL, 'whitespace-nowrap text-muted-foreground')}>
        {formatDateTime(r.occurredAt)}
      </TableCell>
      <TableCell className={CELL}>
        <span className="font-medium">{r.txnType}</span>
        <span className="block font-mono text-[10px] text-muted-foreground">{r.txnId}</span>
      </TableCell>
      <TableCell className={CELL}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{r.itemName}</span>
          <ScheduleBadge schedule={r.schedule} reason={r.scheduleReason} />
        </div>
      </TableCell>
      <TableCell className={cn(CELL, 'text-muted-foreground')}>{r.apiStrength ?? '—'}</TableCell>
      <TableCell className={cn(CELL, 'font-mono text-[11px]')}>{r.batchNumber ?? '—'}</TableCell>
      <TableCell className={cn(CELL, 'whitespace-nowrap text-muted-foreground')}>
        {r.expiryDate ? formatDate(r.expiryDate) : '—'}
      </TableCell>

      {/* The five quantity columns, boxed so they read as one calculation. */}
      <TableCell className={cn(NUM, 'border-l border-surface-container text-muted-foreground')}>
        {r.opening}
      </TableCell>
      <TableCell className={cn(NUM, r.qtyIn ? 'font-medium text-success' : 'text-muted-foreground/40')}>
        {r.qtyIn || '—'}
      </TableCell>
      <TableCell className={cn(NUM, r.qtyOut ? 'font-medium text-error' : 'text-muted-foreground/40')}>
        {r.qtyOut || '—'}
      </TableCell>
      <TableCell className={cn(NUM, r.transferQty ? 'font-medium text-warning' : 'text-muted-foreground/40')}>
        {r.transferQty || '—'}
      </TableCell>
      <TableCell className={cn(NUM, 'border-r border-surface-container font-semibold')}>
        {r.closing}
      </TableCell>

      <TableCell className={CELL}>{r.patientOrDept ?? '—'}</TableCell>
      <TableCell className={CELL}>{r.prescriber ?? '—'}</TableCell>
      <TableCell className={CELL}>
        {r.verification
          ? <span className="text-success">{r.verification}</span>
          : <span className="text-muted-foreground">—</span>}
      </TableCell>
    </TableRow>
  );
}

function Tile({
  label, value, icon: Icon, tone, sign, note, strong,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'slate' | 'emerald' | 'rose' | 'amber' | 'teal';
  sign?: string;
  note?: string;
  strong?: boolean;
}) {
  const toneCls = {
    slate: 'bg-slate-50 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    teal: 'bg-teal-50 text-teal-700',
  }[tone];
  return (
    <div className={cn('rounded-xl p-3 shadow-sanctuary', toneCls, strong && 'ring-1 ring-teal-600/20')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide">{label}</p>
          <p className="font-headline mt-0.5 text-2xl font-bold tabular-nums">
            {sign && value > 0 ? sign : ''}{value}
          </p>
          {note && <p className="text-[10px] opacity-70">{note}</p>}
        </div>
        <Icon className="size-5 shrink-0 opacity-70" />
      </div>
    </div>
  );
}
