'use client';

import { useMemo, useState } from 'react';
import { Search, Printer, Download, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { ScheduleBadge } from '@/components/pharmacy/schedule-badge';
import { useControlledRegister, type ControlledRegisterParams } from '@/hooks/use-pharmacy';
import { toInputDateStr, formatDate, formatDateTime } from '@/lib/date-utils';
import { downloadCsv } from '@/lib/csv';

/**
 * The Controlled-Drug Register — the audit view a drug inspector reads.
 *
 * Every movement of a scheduled or narcotic medicine, from every path it can
 * take, in one chronological ledger with a running balance. The columns follow
 * the statutory register layout rather than our own conventions, because this
 * page is printed and signed during an inspection.
 */
export default function ControlledRegisterPage() {
  const today = toInputDateStr();
  const monthAgo = toInputDateStr(new Date(Date.now() - 30 * 864e5));

  // Held as draft until GO — an inspection search is deliberate, and re-querying
  // a wide date range on every keystroke would make the page unusable.
  const [draft, setDraft] = useState<ControlledRegisterParams>({
    fromDate: monthAgo,
    toDate: today,
    reportType: 'all',
  });
  const [applied, setApplied] = useState<ControlledRegisterParams>(draft);
  const [moreOpen, setMoreOpen] = useState(false);

  const { data, isLoading } = useControlledRegister(applied);
  const rows = data?.rows ?? [];
  const s = data?.summary;

  const set = <K extends keyof ControlledRegisterParams>(k: K, v: ControlledRegisterParams[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

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

  return (
    <PharmacyAdminGuard>
      <div className="space-y-4 p-4 print:p-0">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <h1 className="font-headline flex flex-1 items-center gap-2 text-xl font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Controlled-Drug Register
          </h1>
          <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCsv('controlled-drug-register', csvRows)}>
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print Register Format
          </Button>
        </div>

        {/* ── Filters ── */}
        <div className="space-y-3 rounded-xl border bg-card p-4 print:hidden">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="reg-from" className="text-xs">From</Label>
              <Input id="reg-from" type="date" value={draft.fromDate ?? ''} onChange={(e) => set('fromDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-to" className="text-xs">To</Label>
              <Input id="reg-to" type="date" value={draft.toDate ?? ''} onChange={(e) => set('toDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-type" className="text-xs">Report type</Label>
              <Select value={draft.reportType ?? 'all'} onValueChange={(v: string | null) => set('reportType', (v as never) ?? 'all')}>
                <SelectTrigger id="reg-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All movement</SelectItem>
                  <SelectItem value="inward">Inward — receipts &amp; returns</SelectItem>
                  <SelectItem value="outward">Outward — dispensing, disposal</SelectItem>
                  <SelectItem value="transfer">Internal transfers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-sched" className="text-xs">Schedule</Label>
              <Select value={draft.scheduleType ?? ''} onValueChange={(v: string | null) => set('scheduleType', (v as never) || undefined)}>
                <SelectTrigger id="reg-sched"><SelectValue placeholder="All controlled" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NDPS">NDPS / Narcotics</SelectItem>
                  <SelectItem value="X">Schedule X</SelectItem>
                  <SelectItem value="H1">Schedule H1</SelectItem>
                  <SelectItem value="H">Schedule H</SelectItem>
                  <SelectItem value="H2">Schedule H2</SelectItem>
                  <SelectItem value="G">Schedule G</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-search" className="text-xs">Batch / MRN / invoice</Label>
              <Input
                id="reg-search"
                placeholder="Find a needle in the haystack"
                value={draft.search ?? ''}
                onChange={(e) => set('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setApplied(draft)}
              />
            </div>
          </div>

          {moreOpen && (
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="reg-doc" className="text-xs">Prescribing doctor / reg. no.</Label>
                <Input id="reg-doc" value={draft.doctorRegNo ?? ''} onChange={(e) => set('doctorRegNo', e.target.value)} />
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

        {/* ── Summary ── */}
        {s && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <Stat label="Opening stock" value={s.openingStock} />
            <Stat label="Inward" value={s.inward} tone="in" />
            <Stat label="Outward" value={s.outward} tone="out" />
            <Stat label="Internal transfer" value={s.internalTransfer} />
            <Stat label="Closing balance" value={s.closingBalance} strong />
          </div>
        )}
        {s && s.internalTransfer > 0 && (
          <p className="text-xs text-muted-foreground print:hidden">
            Internal transfers move stock between the vault and its sub-stores, so they are shown
            for custody but not counted in the balance — hospital-wide they net to zero.
          </p>
        )}

        {/* ── Ledger ── */}
        <div className="overflow-x-auto rounded-xl border bg-card">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No controlled-drug movement"
              description="Nothing was received, dispensed, transferred or disposed of in this window."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Txn ID</TableHead>
                  <TableHead>Txn type</TableHead>
                  <TableHead>Item name</TableHead>
                  <TableHead>API &amp; Strength</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Qty IN</TableHead>
                  <TableHead className="text-right">Qty OUT</TableHead>
                  <TableHead className="text-right">Transfer</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead>Patient / Dept</TableHead>
                  <TableHead>Pres. Doctor &amp; Reg. No</TableHead>
                  <TableHead>Verification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.txnId}-${i}`} className="text-xs">
                    <TableCell className="whitespace-nowrap">{formatDateTime(r.occurredAt)}</TableCell>
                    <TableCell className="font-mono text-[11px]">{r.txnId}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.txnType}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{r.itemName}</span>
                        <ScheduleBadge schedule={r.schedule} />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.apiStrength ?? '—'}</TableCell>
                    <TableCell className="font-mono text-[11px]">{r.batchNumber ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.expiryDate ? formatDate(r.expiryDate) : '—'}</TableCell>
                    <TableCell className="text-right">{r.opening}</TableCell>
                    <TableCell className="text-right text-success">{r.qtyIn || ''}</TableCell>
                    <TableCell className="text-right text-error">{r.qtyOut || ''}</TableCell>
                    <TableCell className="text-right">{r.transferQty || ''}</TableCell>
                    <TableCell className="text-right font-semibold">{r.closing}</TableCell>
                    <TableCell>{r.patientOrDept ?? '—'}</TableCell>
                    <TableCell>{r.prescriber ?? '—'}</TableCell>
                    <TableCell>{r.verification ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </PharmacyAdminGuard>
  );
}

function Stat({
  label, value, tone, strong,
}: { label: string; value: number; tone?: 'in' | 'out'; strong?: boolean }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold ${
          tone === 'in' ? 'text-success' : tone === 'out' ? 'text-error' : strong ? 'text-primary' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
