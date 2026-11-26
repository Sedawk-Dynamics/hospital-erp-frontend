'use client';

// Gap 300: HR Staff / Duty Rosters / Licenses / Leaves had no way to create
// records, so attendance and payroll had no staff to pick. These dialogs reuse
// the existing POST /hr/* endpoints (plus /hr/staff/import-from-users).

import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useUsersList } from '@/hooks/use-users';
import {
  useStaffProfiles, useCreateStaffProfile, useCreateRoster, useAddLicense, useApplyLeave,
  type ShiftType, type LeaveType, type EmploymentType,
} from '@/hooks/use-hr';

/** Create buttons are for HR Staff and Hospital Admin only (gap 300). */
export function useCanManageHr(): boolean {
  const { user } = useAuthStore();
  const roles = user?.roles ?? (user?.role?.name ? [user.role.name] : []);
  return roles.some((r) => r === 'hr_staff' || r === 'admin' || r === 'super_admin');
}

const selectCls = 'w-full rounded-md border bg-background px-3 py-2 text-sm';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function useDepartmentOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['hr', 'departments'],
    queryFn: async () => {
      const r = await apiGet<Array<{ id: string; name: string }>>('/infrastructure/departments', { params: { limit: 100 } });
      return r.data ?? [];
    },
    enabled,
  });
}

type StaffRow = { id: string; employeeId?: string | null; user?: { firstName: string; lastName?: string | null } };

function StaffSelect({ value, onChange, enabled }: { value: string; onChange: (v: string) => void; enabled: boolean }) {
  const { data } = useStaffProfiles(enabled ? { status: 'active', limit: 200 } : undefined);
  const rows = (data?.data ?? []) as StaffRow[];
  return (
    <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select staff…</option>
      {rows.map((s) => (
        <option key={s.id} value={s.id}>
          {s.user?.firstName} {s.user?.lastName ?? ''}{s.employeeId ? ` · ${s.employeeId}` : ''}
        </option>
      ))}
    </select>
  );
}

// ─── Staff ──────────────────────────────────────────────────

export function ImportStaffButton() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async () => (await apiPost<{ created: number; skipped: number }>('/hr/staff/import-from-users', {})).data!,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['hr', 'staff'] });
      toast.success(r.created ? `${r.created} draft staff profile(s) created — complete their details` : 'Every staff user already has a profile');
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not import staff')),
  });
  return (
    <Button variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
      <Users className="h-4 w-4 mr-1" /> {m.isPending ? 'Importing…' : 'Import from users'}
    </Button>
  );
}

export function AddStaffDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ userId: '', departmentId: '', employeeId: '', position: '', dateOfJoining: '', employmentType: '' });
  const users = useUsersList(open ? { limit: 200, isActive: 'true' } : undefined);
  const depts = useDepartmentOptions(open);
  const staff = useStaffProfiles(open ? { limit: 200 } : undefined);
  const create = useCreateStaffProfile();

  // One profile per user: hide users that already have one, and patient accounts.
  const taken = new Set(((staff.data?.data ?? []) as Array<{ userId: string }>).map((s) => s.userId));
  const candidates = (open ? users.data?.data ?? [] : []).filter(
    (u) => !taken.has(u.id) && u.userRoles.some((ur) => ur.role.name !== 'patient'),
  );

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.userId) { toast.error('Select a user'); return; }
    const body: Record<string, unknown> = { userId: form.userId };
    if (form.departmentId) body.departmentId = form.departmentId;
    if (form.employeeId.trim()) body.employeeId = form.employeeId.trim();
    if (form.position.trim()) body.position = form.position.trim();
    if (form.dateOfJoining) body.dateOfJoining = form.dateOfJoining;
    if (form.employmentType) body.employmentType = form.employmentType as EmploymentType;
    create.mutate(body, {
      onSuccess: () => {
        toast.success('Staff profile created');
        setOpen(false);
        setForm({ userId: '', departmentId: '', employeeId: '', position: '', dateOfJoining: '', employmentType: '' });
      },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Could not create staff profile')),
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4 mr-1" /> Add staff</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add staff profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="User account *">
              <select className={selectCls} value={form.userId} onChange={(e) => set('userId')(e.target.value)}>
                <option value="">Select user…</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName ?? ''} · {u.email}</option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select className={selectCls} value={form.departmentId} onChange={(e) => set('departmentId')(e.target.value)}>
                <option value="">Default department</option>
                {(depts.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Employee ID"><Input value={form.employeeId} onChange={(e) => set('employeeId')(e.target.value)} /></Field>
              <Field label="Position"><Input value={form.position} onChange={(e) => set('position')(e.target.value)} /></Field>
              <Field label="Date of joining"><Input type="date" value={form.dateOfJoining} onChange={(e) => set('dateOfJoining')(e.target.value)} /></Field>
              <Field label="Employment type">
                <select className={selectCls} value={form.employmentType} onChange={(e) => set('employmentType')(e.target.value)}>
                  <option value="">—</option>
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Shift ──────────────────────────────────────────────────

const SHIFT_DEFAULTS: Record<ShiftType, [string, string]> = {
  morning: ['08:00', '14:00'],
  afternoon: ['14:00', '20:00'],
  night: ['20:00', '08:00'],
  general: ['09:00', '17:00'],
};

export function AddShiftDialog({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [shiftDate, setShiftDate] = useState(defaultDate);
  const [shiftType, setShiftType] = useState<ShiftType>('morning');
  const [times, setTimes] = useState<[string, string]>(SHIFT_DEFAULTS.morning);
  const create = useCreateRoster();

  const submit = () => {
    if (!staffId || !shiftDate) { toast.error('Select staff and date'); return; }
    create.mutate(
      { staffId, shiftDate, shiftType, startTime: times[0], endTime: times[1] },
      {
        onSuccess: () => { toast.success('Shift added'); setOpen(false); setStaffId(''); },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not add shift')),
      },
    );
  };

  return (
    <>
      <Button onClick={() => { setShiftDate(defaultDate); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add shift</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Staff *"><StaffSelect value={staffId} onChange={setStaffId} enabled={open} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date *"><Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} /></Field>
              <Field label="Shift">
                <select
                  className={selectCls}
                  value={shiftType}
                  onChange={(e) => { const t = e.target.value as ShiftType; setShiftType(t); setTimes(SHIFT_DEFAULTS[t]); }}
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="night">Night</option>
                  <option value="general">General</option>
                </select>
              </Field>
              <Field label="Start"><Input type="time" value={times[0]} onChange={(e) => setTimes([e.target.value, times[1]])} /></Field>
              <Field label="End"><Input type="time" value={times[1]} onChange={(e) => setTimes([times[0], e.target.value])} /></Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Licence ────────────────────────────────────────────────

export function AddLicenseDialog() {
  const empty = { staffId: '', licenseType: '', licenseNumber: '', issuingAuthority: '', issuedDate: '', expiryDate: '' };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const add = useAddLicense();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.staffId || !form.licenseType.trim() || !form.licenseNumber.trim() || !form.expiryDate) {
      toast.error('Staff, type, number and expiry date are required');
      return;
    }
    const body: Record<string, unknown> = {
      staffId: form.staffId,
      licenseType: form.licenseType.trim(),
      licenseNumber: form.licenseNumber.trim(),
      expiryDate: form.expiryDate,
    };
    if (form.issuingAuthority.trim()) body.issuingAuthority = form.issuingAuthority.trim();
    if (form.issuedDate) body.issuedDate = form.issuedDate;
    add.mutate(body, {
      onSuccess: () => { toast.success('Licence added'); setOpen(false); setForm(empty); },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Could not add licence')),
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add licence</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add licence</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Staff *"><StaffSelect value={form.staffId} onChange={set('staffId')} enabled={open} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type *"><Input placeholder="e.g. Nursing Council" value={form.licenseType} onChange={(e) => set('licenseType')(e.target.value)} /></Field>
              <Field label="Number *"><Input value={form.licenseNumber} onChange={(e) => set('licenseNumber')(e.target.value)} /></Field>
            </div>
            <Field label="Issuing authority"><Input value={form.issuingAuthority} onChange={(e) => set('issuingAuthority')(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issued"><Input type="date" value={form.issuedDate} onChange={(e) => set('issuedDate')(e.target.value)} /></Field>
              <Field label="Expiry *"><Input type="date" value={form.expiryDate} onChange={(e) => set('expiryDate')(e.target.value)} /></Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={add.isPending}>{add.isPending ? 'Saving…' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Leave ──────────────────────────────────────────────────

export function NewLeaveDialog() {
  const empty = { staffId: '', leaveType: 'casual' as LeaveType, startDate: '', endDate: '', reason: '' };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const apply = useApplyLeave();

  const submit = () => {
    if (!form.staffId || !form.startDate || !form.endDate) { toast.error('Staff and dates are required'); return; }
    const body: Record<string, unknown> = {
      staffId: form.staffId, leaveType: form.leaveType, startDate: form.startDate, endDate: form.endDate,
    };
    if (form.reason.trim()) body.reason = form.reason.trim();
    apply.mutate(body, {
      onSuccess: () => { toast.success('Leave request created'); setOpen(false); setForm(empty); },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Could not create leave request')),
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New leave</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New leave request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Staff *">
              <StaffSelect value={form.staffId} onChange={(v) => setForm((f) => ({ ...f, staffId: v }))} enabled={open} />
            </Field>
            <Field label="Leave type">
              <select className={selectCls} value={form.leaveType} onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value as LeaveType }))}>
                <option value="casual">Casual</option>
                <option value="sick">Sick</option>
                <option value="vacation">Vacation</option>
                <option value="maternity">Maternity</option>
                <option value="paternity">Paternity</option>
                <option value="unpaid">Unpaid</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From *"><Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></Field>
              <Field label="To *"><Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} /></Field>
            </div>
            <Field label="Reason"><Textarea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={apply.isPending}>{apply.isPending ? 'Saving…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
