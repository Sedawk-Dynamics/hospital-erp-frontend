'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toInputDateStr } from '@/lib/date-utils';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

interface Reservation {
  id: string;
  patientId: string;
  patient?: { id: string; mrn?: string; firstName: string; lastName: string; phone?: string };
  doctorId: string;
  doctor?: { id: string; user?: { firstName: string; lastName: string }; specialization?: string };
  wardId: string;
  ward?: { id: string; name: string };
  bedId?: string;
  bed?: { id: string; bedNumber: string };
  reservedDate: string;
  expectedAdmission?: string;
  diagnosis?: string;
  speciality?: string;
  advanceAmount: number;
  notes?: string;
  status: string;
  createdAt: string;
}

interface Ward {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  user?: { firstName: string; lastName: string };
  specialization?: string;
}

const statusFilters = [
  { key: 'all', label: 'All' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusStyles: Record<string, { bg: string; text: string }> = {
  reserved: { bg: 'bg-blue-100', text: 'text-blue-700' },
  confirmed: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  admitted: { bg: 'bg-purple-100', text: 'text-purple-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
};

export function ReservationTab() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'reservations', { status: statusFilter, search, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;
      const response = await apiGet<Reservation[]>('/clinical/reservations', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const reservations = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setStatusFilter(f.key); setPage(1); }}
              className={cn(
                'rounded-full px-3 py-1 text-[10px] font-bold transition-colors',
                statusFilter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-high/80'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Create Reservation
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
        <Input
          placeholder="Search reservation..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Reserved Date</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Diagnosis</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Consultant</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Ward / Bed</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Advance</th>
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
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No reservations found.
                  </td>
                </tr>
              ) : (
                reservations.map((res) => {
                  const st = statusStyles[res.status] ?? statusStyles.reserved;
                  return (
                    <tr key={res.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-label text-sm font-bold">{res.patient?.firstName} {res.patient?.lastName}</p>
                        <p className="text-xs text-muted-foreground">{res.patient?.mrn || '-'} | {res.patient?.phone || '-'}</p>
                      </td>
                      <td className="px-4 py-3 font-label text-xs text-on-surface-variant">{formatDate(res.reservedDate)}</td>
                      <td className="px-4 py-3 font-label text-sm">{res.diagnosis || '-'}</td>
                      <td className="px-4 py-3 font-label text-sm">
                        {res.doctor ? `Dr. ${res.doctor.user?.firstName} ${res.doctor.user?.lastName}` : '-'}
                      </td>
                      <td className="px-4 py-3 font-label text-sm">
                        {res.ward?.name || '-'}{res.bed ? ` / ${res.bed.bedNumber}` : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-label text-sm font-bold">
                        ₹{Number(res.advanceAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', st.bg, st.text)}>
                          {res.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {reservations.length > 0
                ? `${(page - 1) * 20 + 1}-${(page - 1) * 20 + reservations.length} of ${meta.total}`
                : '0 results'}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>›</Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Reservation Dialog */}
      <CreateReservationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

// ── Create Reservation Dialog ───────────────────────────────

function CreateReservationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    wardId: '',
    bedId: '',
    reservedDate: toInputDateStr(),
    expectedAdmission: '',
    diagnosis: '',
    speciality: '',
    advanceAmount: 0,
    notes: '',
  });

  // Fetch wards for dropdown
  const { data: wardsData } = useQuery({
    queryKey: ['infrastructure', 'wards'],
    queryFn: async () => {
      const res = await apiGet<Ward[]>('/infrastructure/wards', { params: { limit: 100 } });
      return res.data;
    },
    enabled: open,
  });

  // Fetch available beds for the selected ward
  const { data: bedsData, isFetching: bedsLoading } = useQuery({
    queryKey: ['infrastructure', 'beds', { wardId: form.wardId, status: 'available' }],
    queryFn: async () => {
      const res = await apiGet<Array<{ id: string; bedNumber: string; bedType?: string }>>(
        '/infrastructure/beds',
        { params: { wardId: form.wardId, status: 'available', limit: 200 } },
      );
      return res.data;
    },
    enabled: open && Boolean(form.wardId),
  });

  // Fetch patients for search
  const [patientSearch, setPatientSearch] = useState('');
  const { data: patientsData } = useQuery({
    queryKey: ['patients', 'search', patientSearch],
    queryFn: async () => {
      const res = await apiGet<any[]>('/patients', { params: { search: patientSearch, limit: 10 } });
      return res.data;
    },
    enabled: open && patientSearch.length >= 2,
  });

  // Fetch doctors
  const { data: doctorsData } = useQuery({
    queryKey: ['doctors', 'list'],
    queryFn: async () => {
      const res = await apiGet<Doctor[]>('/appointments/doctors', { params: { limit: 100 } });
      return res.data;
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const body: any = {
        patientId: data.patientId,
        doctorId: data.doctorId,
        wardId: data.wardId,
        reservedDate: new Date(data.reservedDate).toISOString(),
        diagnosis: data.diagnosis || undefined,
        speciality: data.speciality || undefined,
        advanceAmount: data.advanceAmount || 0,
        notes: data.notes || undefined,
      };
      if (data.bedId) body.bedId = data.bedId;
      if (data.expectedAdmission) body.expectedAdmission = new Date(data.expectedAdmission).toISOString();
      return apiPost('/clinical/reservations', body);
    },
    onSuccess: () => {
      toast.success('Reservation created successfully');
      qc.invalidateQueries({ queryKey: ['hospital', 'reservations'] });
      qc.invalidateQueries({ queryKey: ['hospital', 'beds'] });
      qc.invalidateQueries({ queryKey: ['hospital', 'occupancy'] });
      qc.invalidateQueries({ queryKey: ['infrastructure', 'beds'] });
      onOpenChange(false);
      setForm({
        patientId: '', doctorId: '', wardId: '', bedId: '',
        reservedDate: toInputDateStr(),
        expectedAdmission: '', diagnosis: '', speciality: '', advanceAmount: 0, notes: '',
      });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create reservation');
    },
  });

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.patientId || !form.doctorId || !form.wardId) {
      toast.error('Patient, Doctor, and Ward are required');
      return;
    }
    createMutation.mutate(form);
  };

  const patients = patientsData ?? [];
  const wards = wardsData ?? [];
  const doctors = doctorsData ?? [];
  const beds = bedsData ?? [];

  const selectedDoctor = doctors.find((d: any) => d.id === form.doctorId);
  const selectedWard = wards.find((w: any) => w.id === form.wardId);
  const selectedBed = beds.find((b) => b.id === form.bedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Reservation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
          {/* Patient search */}
          <div>
            <label className="text-xs font-medium text-foreground">Patient *</label>
            <Input
              placeholder="Search patient by name or MRN..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="mt-1"
            />
            {patients.length > 0 && patientSearch.length >= 2 && !form.patientId && (
              <div className="mt-1 rounded-lg border bg-card shadow-sm max-h-32 overflow-y-auto">
                {patients.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, patientId: p.id }));
                      setPatientSearch(`${p.firstName} ${p.lastName} (${p.mrn || ''})`);
                    }}
                  >
                    {p.firstName} {p.lastName} — {p.mrn || 'No MRN'} | {p.phone || '-'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Doctor */}
            <div>
              <label className="text-xs font-medium text-foreground">Doctor *</label>
              <Select value={form.doctorId} onValueChange={(v) => handleChange('doctorId', v ?? '')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select doctor">
                    {() =>
                      selectedDoctor
                        ? `Dr. ${selectedDoctor.user?.firstName ?? (selectedDoctor as any).firstName ?? ''} ${selectedDoctor.user?.lastName ?? (selectedDoctor as any).lastName ?? ''}`.trim()
                        : 'Select doctor'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      Dr. {d.user?.firstName || d.firstName} {d.user?.lastName || d.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ward */}
            <div>
              <label className="text-xs font-medium text-foreground">Ward *</label>
              <Select
                value={form.wardId}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, wardId: v ?? '', bedId: '' }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select ward">
                    {() => (selectedWard ? selectedWard.name : 'Select ward')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {wards.map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bed (optional — blocks the bed when set) */}
            <div>
              <label className="text-xs font-medium text-foreground">
                Bed {form.wardId ? '(optional)' : ''}
              </label>
              <Select
                value={form.bedId || null}
                onValueChange={(v) => handleChange('bedId', v ?? '')}
                disabled={!form.wardId || bedsLoading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue
                    placeholder={
                      !form.wardId
                        ? 'Select a ward first'
                        : bedsLoading
                          ? 'Loading...'
                          : beds.length === 0
                            ? 'No beds available'
                            : 'Select bed'
                    }
                  >
                    {() =>
                      selectedBed
                        ? `${selectedBed.bedNumber}${selectedBed.bedType ? ` — ${selectedBed.bedType}` : ''}`
                        : !form.wardId
                          ? 'Select a ward first'
                          : bedsLoading
                            ? 'Loading...'
                            : beds.length === 0
                              ? 'No beds available'
                              : 'Select bed'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {beds.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bedNumber}{b.bedType ? ` — ${b.bedType}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reserved Date */}
            <div>
              <label className="text-xs font-medium text-foreground">Reserved Date *</label>
              <Input type="date" value={form.reservedDate} onChange={(e) => handleChange('reservedDate', e.target.value)} className="mt-1" />
            </div>

            {/* Expected Admission */}
            <div>
              <label className="text-xs font-medium text-foreground">Expected Admission</label>
              <Input type="date" value={form.expectedAdmission} onChange={(e) => handleChange('expectedAdmission', e.target.value)} className="mt-1" />
            </div>

            {/* Speciality */}
            <div>
              <label className="text-xs font-medium text-foreground">Speciality</label>
              <Input value={form.speciality} onChange={(e) => handleChange('speciality', e.target.value)} placeholder="e.g. Cardiology" className="mt-1" />
            </div>

            {/* Advance Amount */}
            <div>
              <label className="text-xs font-medium text-foreground">Advance Amount (₹)</label>
              <Input type="number" min={0} value={form.advanceAmount} onChange={(e) => handleChange('advanceAmount', Number(e.target.value))} className="mt-1" />
            </div>
          </div>

          {/* Diagnosis */}
          <div>
            <label className="text-xs font-medium text-foreground">Diagnosis</label>
            <Textarea value={form.diagnosis} onChange={(e) => handleChange('diagnosis', e.target.value)} placeholder="Provisional diagnosis..." rows={2} className="mt-1" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-foreground">Notes</label>
            <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Additional notes..." rows={2} className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Reservation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
