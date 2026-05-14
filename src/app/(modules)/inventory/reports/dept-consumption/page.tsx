'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toInputDateStr } from '@/lib/date-utils';
import { Building2, ChevronDown, ChevronRight, IndianRupee, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { apiGet } from '@/lib/api';
import { useDeptConsumptionReport } from '@/hooks/use-inventory';

function fmt(n: number) {
  return n.toLocaleString('en-IN');
}

function rupees(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface Dept { id: string; name: string }

export default function DeptConsumptionReportPage() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [fromDate, setFromDate] = useState(toInputDateStr(monthAgo));
  const [toDate, setToDate] = useState(toInputDateStr(today));
  const [departmentId, setDepartmentId] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: deptsResp } = useQuery({
    queryKey: ['infrastructure', 'departments'],
    queryFn: async () => {
      const r = await apiGet<Dept[]>('/infrastructure/departments', { params: { limit: 100 } });
      return r.data;
    },
  });
  const departments = deptsResp ?? [];

  const { data, isLoading } = useDeptConsumptionReport({
    fromDate,
    toDate,
    departmentId: departmentId || undefined,
  });

  const rows = data?.departments ?? [];

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="Department Consumption Report"
        description="What each department used in the window, with cost analysis and per-item breakdown"
      />

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Department</Label>
          <Select value={departmentId || 'all'} onValueChange={(v) => setDepartmentId(v === 'all' ? '' : (v ?? ''))}>
            <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl shadow-sanctuary p-4 bg-blue-50">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-muted-foreground">Total Items Consumed</p>
          </div>
          <p className="font-headline text-2xl font-extrabold mt-1">{fmt(data?.totals.quantity ?? 0)}</p>
        </div>
        <div className="rounded-xl shadow-sanctuary p-4 bg-emerald-50">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-emerald-600" />
            <p className="text-xs text-muted-foreground">Total Cost</p>
          </div>
          <p className="font-headline text-2xl font-extrabold mt-1">{rupees(data?.totals.cost ?? 0)}</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-32 w-full" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={Building2} title="No consumption data" description="No stock-out tagged to any department in this window." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = expanded.has(row.departmentId);
                return (
                  <>
                    <tr
                      key={row.departmentId}
                      className="border-b cursor-pointer hover:bg-muted/30"
                      onClick={() => toggle(row.departmentId)}
                    >
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.departmentName}
                      </td>
                      <td className="px-4 py-3 text-right">{row.items.length}</td>
                      <td className="px-4 py-3 text-right">{fmt(row.totalQuantity)}</td>
                      <td className="px-4 py-3 text-right">{rupees(row.totalCost)}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={4} className="bg-muted/30 px-0 py-0">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                                <th className="px-8 py-2">Item</th>
                                <th className="px-4 py-2">Category</th>
                                <th className="px-4 py-2 text-right">Quantity</th>
                                <th className="px-4 py-2 text-right">Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.items.map((it) => (
                                <tr key={it.itemId} className="border-b last:border-b-0">
                                  <td className="px-8 py-1.5">{it.itemName}</td>
                                  <td className="px-4 py-1.5 capitalize text-muted-foreground">{it.category.replace('_', ' ')}</td>
                                  <td className="px-4 py-1.5 text-right">{fmt(it.quantity)} {it.unit || ''}</td>
                                  <td className="px-4 py-1.5 text-right">{rupees(it.totalCost)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
