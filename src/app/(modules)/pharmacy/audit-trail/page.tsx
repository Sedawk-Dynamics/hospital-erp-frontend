'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  History, Search, ChevronDown, ChevronRight, Monitor, User as UserIcon, Loader2, RotateCcw,
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email?: string } | null;
}

// Friendly labels for the pharmacy/inventory entity types the trail covers.
const ENTITY_LABELS: Record<string, string> = {
  drug_formulary: 'Master Drug (mapping)',
  drug_batch: 'Batch',
  inward_invoice: 'Invoice / Inward',
  dispensing_record: 'Dispense',
  pharmacy_sale: 'Counter Sale',
  drug_return: 'Return',
  stock_transaction: 'Stock Movement',
  stock_transfer: 'Stock Transfer',
  inventory_item: 'Inventory Item',
  inventory_setting: 'Inventory Setting',
  purchase_order: 'Purchase Order',
  gst_exception: 'GST Exception',
};
const ENTITY_OPTIONS = Object.keys(ENTITY_LABELS);

const ACTION_STYLE: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-800',
  update: 'bg-amber-100 text-amber-800',
  delete: 'bg-red-100 text-red-800',
  read: 'bg-slate-100 text-slate-700',
};

const entityLabel = (t: string) => ENTITY_LABELS[t] ?? t.replace(/_/g, ' ');

function JsonBlock({ title, value, tone }: { title: string; value: unknown; tone: 'old' | 'new' }) {
  const entries = value && typeof value === 'object' ? Object.entries(value as Record<string, unknown>) : [];
  return (
    <div className="min-w-0 flex-1">
      <p className={cn('mb-1 text-[10px] font-bold uppercase tracking-wide', tone === 'old' ? 'text-red-600' : 'text-emerald-700')}>
        {title}
      </p>
      {entries.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground">—</p>
      ) : (
        <div className="space-y-0.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[11px]">
              <span className="shrink-0 font-medium text-muted-foreground">{k}:</span>
              <span className="break-all text-foreground">{v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PharmacyAuditTrailPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [action, setAction] = useState<string>('all');
  const [entityType, setEntityType] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: 25 };
    if (debounced) p.search = debounced;
    if (action !== 'all') p.action = action;
    if (entityType !== 'all') p.entityType = entityType;
    if (fromDate) p.fromDate = new Date(fromDate).toISOString();
    if (toDate) { const d = new Date(toDate); d.setHours(23, 59, 59, 999); p.toDate = d.toISOString(); }
    return p;
  }, [page, debounced, action, entityType, fromDate, toDate]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['pharmacy-audit-trail', params],
    queryFn: async () => apiGet<AuditRow[]>('/pharmacy/audit-trail', { params }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta as { total: number; page: number; totalPages: number } | undefined;

  const hasFilter = !!debounced || action !== 'all' || entityType !== 'all' || !!fromDate || !!toDate;
  const clearFilters = () => {
    setSearch(''); setDebounced(''); setAction('all'); setEntityType('all'); setFromDate(''); setToDate(''); setPage(1);
  };
  const toggle = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="flex items-center gap-2 font-headline text-xl font-bold">
          <History className="h-5 w-5 text-primary" /> Pharmacy Audit Trail
        </h1>
        <p className="text-xs text-muted-foreground">
          Every pharmacy &amp; inventory action — invoice import, product mapping, inventory creation, batch modification,
          stock adjustment/transfer, dispense, sale, return — with who, when, from where (machine), and the exact before → after.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-surface-container-lowest p-3 shadow-sanctuary">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Label className="mb-1 block text-[11px] text-muted-foreground">Search</Label>
            <Search className="pointer-events-none absolute left-2.5 top-[30px] h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Description, entity, ID…" className="h-9 pl-8 text-sm" />
          </div>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">Action</Label>
            <Select value={action} onValueChange={(v) => { setAction(v ?? 'all'); setPage(1); }}>
              <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="create">Created</SelectItem>
                <SelectItem value="update">Updated</SelectItem>
                <SelectItem value="delete">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">Type</Label>
            <Select value={entityType} onValueChange={(v) => { setEntityType(v ?? 'all'); setPage(1); }}>
              <SelectTrigger className="h-9 w-[180px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ENTITY_OPTIONS.map((t) => (<SelectItem key={t} value={t}>{entityLabel(t)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="h-9 w-[150px] text-sm" />
          </div>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">To</Label>
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="h-9 w-[150px] text-sm" />
          </div>
          {hasFilter && (
            <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
              <RotateCcw className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Register */}
      <div className="overflow-hidden rounded-xl border bg-surface-container-lowest shadow-sanctuary">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            {meta ? `${meta.total.toLocaleString('en-IN')} entries` : 'Loading…'}
          </span>
          {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No audit entries match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b bg-surface-container-low/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="w-8 px-2 py-2.5"></th>
                  <th className="px-3 py-2.5 text-left font-label">Date / Time</th>
                  <th className="px-3 py-2.5 text-left font-label">User</th>
                  <th className="px-3 py-2.5 text-left font-label">Action</th>
                  <th className="px-3 py-2.5 text-left font-label">Entity</th>
                  <th className="px-3 py-2.5 text-left font-label">Details / Reason</th>
                  <th className="px-3 py-2.5 text-left font-label">Machine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {rows.map((r) => {
                  const open = expanded.has(r.id);
                  const hasDiff = !!(r.oldValues || r.newValues);
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={cn('align-top hover:bg-surface-container-low/40', hasDiff && 'cursor-pointer')}
                        onClick={() => hasDiff && toggle(r.id)}
                      >
                        <td className="px-2 py-2.5 text-muted-foreground">
                          {hasDiff && (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-foreground">{formatDateTime(r.createdAt)}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                            <UserIcon className="h-3 w-3 text-muted-foreground" />{r.user?.name || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className={cn('h-5 px-2 text-[10px] font-semibold capitalize', ACTION_STYLE[r.action] ?? 'bg-slate-100 text-slate-700')}>
                            {r.action}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-xs font-medium text-foreground">{entityLabel(r.entityType)}</div>
                          <div className="max-w-[160px] truncate text-[10px] text-muted-foreground" title={r.entityId}>{r.entityId}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="max-w-[320px] text-xs text-muted-foreground">{r.description || '—'}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title={r.userAgent || undefined}>
                            <Monitor className="h-3 w-3" />{r.ipAddress || '—'}
                          </span>
                        </td>
                      </tr>
                      {open && hasDiff && (
                        <tr className="bg-surface-container-low/30">
                          <td></td>
                          <td colSpan={6} className="px-3 py-3">
                            <div className="flex flex-col gap-4 rounded-lg border bg-card p-3 sm:flex-row">
                              <JsonBlock title="Previous value" value={r.oldValues} tone="old" />
                              <div className="hidden w-px bg-outline-variant/40 sm:block" />
                              <JsonBlock title="New value" value={r.newValues} tone="new" />
                            </div>
                            {r.userAgent && (
                              <p className="mt-2 text-[10px] text-muted-foreground">Machine (user-agent): {r.userAgent}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-2.5">
            <span className="text-xs text-muted-foreground">Page {meta.page} of {meta.totalPages}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
