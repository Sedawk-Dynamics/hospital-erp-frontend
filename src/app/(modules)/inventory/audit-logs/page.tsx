'use client';

import { useState } from 'react';
import { formatDate, formatTime, toInputDateStr } from '@/lib/date-utils';
import { FileCheck, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { useInventoryAuditLogs } from '@/hooks/use-inventory';

const ENTITY_TYPES = [
  { value: 'inventory_item', label: 'Inventory Item' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'stock_transaction', label: 'Stock Transaction' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'supply_request', label: 'Supply Request' },
  { value: 'stock_transfer', label: 'Stock Transfer' },
];

const ACTION_COLOR: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  update: 'bg-blue-100 text-blue-700 border-blue-300',
  delete: 'bg-red-100 text-red-700 border-red-300',
};

export default function InventoryAuditLogsPage() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [fromDate, setFromDate] = useState(toInputDateStr(monthAgo));
  const [toDate, setToDate] = useState(toInputDateStr(today));
  const [action, setAction] = useState<'create' | 'update' | 'delete' | ''>('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useInventoryAuditLogs({
    fromDate,
    toDate,
    action: (action || undefined) as 'create' | 'update' | 'delete' | undefined,
    entityType: entityType || undefined,
    search: search.trim() || undefined,
    page,
    limit: 50,
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="Inventory Audit Logs"
        description="Every stock action (additions, deductions, returns, adjustments, transfers) with user, timestamp and before/after values"
      />

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
        </div>
        <div>
          <Label>Entity</Label>
          <Select value={entityType || 'all'} onValueChange={(v) => { setEntityType(v === 'all' ? '' : (v ?? '')); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="All entities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {ENTITY_TYPES.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Action</Label>
          <Select value={action || 'all'} onValueChange={(v) => { setAction((v === 'all' ? '' : v) as 'create' | 'update' | 'delete' | ''); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search description..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-primary" />
          <h2 className="font-headline text-base font-bold">Audit Trail</h2>
          {meta && (
            <span className="text-xs text-muted-foreground ml-2">{meta.total} entries</span>
          )}
        </div>

        {isLoading ? (
          <div className="p-4"><Skeleton className="h-32 w-full" /></div>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={FileCheck} title="No audit entries" description="No actions recorded for the chosen filters." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-b-0 hover:bg-muted/30 align-top">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.createdAt)} · {formatTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {log.user
                        ? `${log.user.firstName} ${log.user.lastName}`
                        : <span className="text-muted-foreground">system</span>}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={`text-xs ${ACTION_COLOR[log.action] ?? ''}`}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {log.entityType}
                      <div className="font-mono text-[10px]">{log.entityId.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-2">{log.description ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Page {meta.page} of {meta.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
