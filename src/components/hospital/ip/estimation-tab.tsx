'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Search, Plus, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';

interface Estimation {
  id: string;
  patientId: string;
  patient?: { id: string; mrn?: string; firstName: string; lastName: string; phone?: string };
  doctorId: string;
  doctor?: { id: string; user?: { firstName: string; lastName: string } };
  complaints?: string;
  estimationPeriodDays: number;
  totalEstimateAmount: number;
  items?: { description: string; amount: number }[];
  notes?: string;
  status: string;
  createdAt: string;
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  finalized: { bg: 'bg-blue-100', text: 'text-blue-700' },
  approved: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
};

export function EstimationTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'estimations', { search, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      const response = await apiGet<Estimation[]>('/clinical/estimations', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const estimations = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search estimation..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
        <Button
          size="sm"
          className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Create Estimation
        </Button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Date</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Doctor</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Complaints</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Period</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Estimate Amount</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : estimations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No estimations found.
                  </td>
                </tr>
              ) : (
                estimations.map((est) => {
                  const st = statusStyles[est.status] ?? statusStyles.draft;
                  return (
                    <tr key={est.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-label text-sm font-bold">{est.patient?.firstName} {est.patient?.lastName}</p>
                        <p className="text-xs text-muted-foreground">{est.patient?.mrn || '-'}</p>
                      </td>
                      <td className="px-4 py-3 font-label text-xs text-on-surface-variant">
                        {formatDate(est.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-label text-sm">
                        {est.doctor ? `Dr. ${est.doctor.user?.firstName} ${est.doctor.user?.lastName}` : '-'}
                      </td>
                      <td className="px-4 py-3 font-label text-sm truncate max-w-[200px]">{est.complaints || '-'}</td>
                      <td className="px-4 py-3 font-label text-sm">{est.estimationPeriodDays} days</td>
                      <td className="px-4 py-3 text-right font-label text-sm font-bold">
                        ₹{Number(est.totalEstimateAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', st.bg, st.text)}>
                          {est.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {estimations.length > 0
                ? `${(page - 1) * 20 + 1}-${(page - 1) * 20 + estimations.length} of ${meta.total}`
                : '0 results'}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>›</Button>
            </div>
          </div>
        )}
      </div>

      <CreateEstimationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

// ── Create Estimation Dialog ────────────────────────────────

interface EstimationItem {
  description: string;
  amount: number;
}

function CreateEstimationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [patientSearch, setPatientSearch] = useState('');
  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    complaints: '',
    estimationPeriodDays: 1,
    notes: '',
  });
  const [items, setItems] = useState<EstimationItem[]>([{ description: '', amount: 0 }]);

  const { data: patientsData } = useQuery({
    queryKey: ['patients', 'search', patientSearch],
    queryFn: async () => {
      const res = await apiGet<any[]>('/patients', { params: { search: patientSearch, limit: 10 } });
      return res.data;
    },
    enabled: open && patientSearch.length >= 2,
  });

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors', 'list'],
    queryFn: async () => {
      const res = await apiGet<any[]>('/appointments/doctors', { params: { limit: 100 } });
      return res.data;
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((i) => i.description.trim() && i.amount > 0);
      const totalEstimateAmount = validItems.reduce((sum, i) => sum + i.amount, 0);
      return apiPost('/clinical/estimations', {
        patientId: form.patientId,
        doctorId: form.doctorId,
        complaints: form.complaints || undefined,
        estimationPeriodDays: form.estimationPeriodDays,
        totalEstimateAmount,
        items: validItems.length > 0 ? validItems : undefined,
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Estimation created successfully');
      qc.invalidateQueries({ queryKey: ['hospital', 'estimations'] });
      onOpenChange(false);
      setForm({ patientId: '', doctorId: '', complaints: '', estimationPeriodDays: 1, notes: '' });
      setItems([{ description: '', amount: 0 }]);
      setPatientSearch('');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create estimation');
    },
  });

  const patients = patientsData ?? [];
  const doctors = doctorsData ?? [];
  const totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Estimation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
          {/* Patient search */}
          <div>
            <label className="text-xs font-medium">Patient *</label>
            <Input placeholder="Search patient..." value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} className="mt-1" />
            {patients.length > 0 && patientSearch.length >= 2 && !form.patientId && (
              <div className="mt-1 rounded-lg border bg-card shadow-sm max-h-32 overflow-y-auto">
                {patients.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, patientId: p.id }));
                      setPatientSearch(`${[p.firstName, p.lastName].filter(Boolean).join(" ")} (${p.mrn || ""})`);
                    }}
                  >
                    {p.firstName} {p.lastName} — {p.mrn || 'No MRN'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium">Doctor *</label>
              <Select value={form.doctorId} onValueChange={(v) => setForm((p) => ({ ...p, doctorId: v ?? '' }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>Dr. {d.user?.firstName || d.firstName} {d.user?.lastName || d.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Period (days) *</label>
              <NumberInput min={1} value={form.estimationPeriodDays} onValueChange={(v) => setForm((p) => ({ ...p, estimationPeriodDays: v }))} className="mt-1" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Complaints</label>
            <Textarea value={form.complaints} onChange={(e) => setForm((p) => ({ ...p, complaints: e.target.value }))} placeholder="Chief complaints..." rows={2} className="mt-1" />
          </div>

          {/* Estimation Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium">Estimation Items</label>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setItems((prev) => [...prev, { description: '', amount: 0 }])}>
                <Plus className="mr-1 h-3 w-3" /> Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Description (e.g. Room charges)"
                    value={item.description}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...next[i], description: e.target.value };
                      setItems(next);
                    }}
                    className="flex-1 text-sm"
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Amount"
                    value={item.amount || ''}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...next[i], amount: Number(e.target.value) || 0 };
                      setItems(next);
                    }}
                    className="w-32 text-sm"
                  />
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>×</Button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm font-bold">
              Total: ₹{totalAmount.toLocaleString('en-IN')}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Notes</label>
            <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." rows={2} className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.patientId || !form.doctorId}>
              {createMutation.isPending ? 'Creating...' : 'Create Estimation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
