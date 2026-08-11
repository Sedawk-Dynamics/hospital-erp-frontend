'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  usePayrollList, useGeneratePayroll, useApprovePayroll, useStaffProfiles,
  downloadSalarySlipPdf, type PayrollStatus,
} from '@/hooks/use-hr';
import { Download, FileText, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_TONE: Record<PayrollStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  processed: 'bg-sky-100 text-sky-700 border-sky-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const inr = (v: number | string | null | undefined) =>
  v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function HrPayrollPage() {
  const [status, setStatus] = useState<PayrollStatus | ''>('');
  const { data, isLoading } = usePayrollList({ status: status || undefined, limit: 100 });
  const approve = useApprovePayroll();

  const rows = (data?.data ?? []) as Array<{
    id: string;
    payPeriodStart: string;
    payPeriodEnd: string;
    basicSalary?: number | string | null;
    allowances: number | string;
    deductions: number | string;
    overtimePay: number | string;
    grossSalary?: number | string | null;
    taxDeduction: number | string;
    netSalary?: number | string | null;
    status: PayrollStatus;
    paidAt?: string | null;
    staff?: { employeeId?: string | null; user?: { firstName: string; lastName?: string | null } };
  }>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Payroll</h1>
          <p className="text-sm text-on-surface-variant">
            Generate, approve, and download salary slip PDFs for each pay period.
          </p>
        </div>
        <GeneratePayrollDialog />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as PayrollStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="processed">Processed</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">No payroll records.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2 text-right">Basic</th>
                    <th className="px-3 py-2 text-right">Allow.</th>
                    <th className="px-3 py-2 text-right">OT</th>
                    <th className="px-3 py-2 text-right">Gross</th>
                    <th className="px-3 py-2 text-right">Deduct.</th>
                    <th className="px-3 py-2 text-right">Tax</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs">
                        {new Date(r.payPeriodStart).toLocaleDateString('en-IN')} – {new Date(r.payPeriodEnd).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-3 py-2">
                        {r.staff?.user?.firstName} {r.staff?.user?.lastName ?? ''}
                      </td>
                      <td className="px-3 py-2 text-right">{inr(r.basicSalary)}</td>
                      <td className="px-3 py-2 text-right">{inr(r.allowances)}</td>
                      <td className="px-3 py-2 text-right">{inr(r.overtimePay)}</td>
                      <td className="px-3 py-2 text-right">{inr(r.grossSalary)}</td>
                      <td className="px-3 py-2 text-right">{inr(r.deductions)}</td>
                      <td className="px-3 py-2 text-right">{inr(r.taxDeduction)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{inr(r.netSalary)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={STATUS_TONE[r.status]}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm" variant="ghost" className="h-7 px-2"
                            onClick={async () => {
                              try { await downloadSalarySlipPdf(r.id); }
                              catch { toast.error('Could not download slip'); }
                            }}
                            title="Download PDF"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {r.status === 'draft' && (
                            <Button
                              size="sm" variant="ghost" className="h-7 px-2"
                              onClick={() => approve.mutate(r.id, {
                                onSuccess: () => toast.success('Payroll approved'),
                                onError: () => toast.error('Could not approve'),
                              })}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />Approve
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GeneratePayrollDialog() {
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState('');
  const today = new Date();
  const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastDayThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [payPeriodStart, setStart] = useState(firstDayThisMonth);
  const [payPeriodEnd, setEnd] = useState(lastDayThisMonth);
  const [allowances, setAllow] = useState('0');
  const [deductions, setDed] = useState('0');
  const [overtimePay, setOt] = useState('0');
  const [taxDeduction, setTax] = useState('0');

  const { data: staffData } = useStaffProfiles({ status: 'active', limit: 200 });
  const staff = (staffData?.data ?? []) as Array<{ id: string; employeeId?: string | null; user?: { firstName: string; lastName?: string | null } }>;
  const generate = useGeneratePayroll();

  const submit = () => {
    if (!staffId) return toast.error('Pick a staff member');
    generate.mutate(
      {
        staffId,
        payPeriodStart,
        payPeriodEnd,
        allowances: Number(allowances) || 0,
        deductions: Number(deductions) || 0,
        overtimePay: Number(overtimePay) || 0,
        taxDeduction: Number(taxDeduction) || 0,
      },
      {
        onSuccess: () => { toast.success('Payroll generated'); setOpen(false); setStaffId(''); },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast.error(msg ?? 'Could not generate payroll');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-3.5 w-3.5 mr-1" /><FileText className="h-3.5 w-3.5 mr-1" />Process Payroll
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Process Payroll</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Staff</Label>
            <select className="block w-full rounded-md border px-3 py-2 text-sm" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Select…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.user?.firstName} {s.user?.lastName ?? ''} {s.employeeId ? `(${s.employeeId})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Pay Period Start</Label>
              <Input type="date" value={payPeriodStart} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Pay Period End</Label>
              <Input type="date" value={payPeriodEnd} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Allowances (₹)</Label>
              <Input type="number" min="0" value={allowances} onChange={(e) => setAllow(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Overtime Pay (₹)</Label>
              <Input type="number" min="0" value={overtimePay} onChange={(e) => setOt(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Deductions (₹)</Label>
              <Input type="number" min="0" value={deductions} onChange={(e) => setDed(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tax / TDS (₹)</Label>
              <Input type="number" min="0" value={taxDeduction} onChange={(e) => setTax(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-on-surface-variant">
            Net pay is computed as Basic + Allowances + Overtime − Deductions − Tax.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={generate.isPending}>Generate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
