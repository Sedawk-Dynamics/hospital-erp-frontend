import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiPut } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export type StaffStatus = 'active' | 'on_leave' | 'resigned' | 'terminated';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type LeaveType =
  | 'vacation' | 'sick' | 'casual' | 'maternity' | 'paternity' | 'unpaid' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'on_leave' | 'holiday';
export type AttendanceSource = 'manual' | 'biometric' | 'system';
export type PayrollStatus = 'draft' | 'processed' | 'paid';
export type LicenseStatus = 'active' | 'expired' | 'renewal_pending';
export type ShiftType = 'morning' | 'afternoon' | 'night' | 'general';

export interface StaffProfile {
  id: string;
  userId: string;
  departmentId: string;
  employeeId?: string | null;
  position?: string | null;
  dateOfJoining?: string | null;
  dateOfBirth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  salary?: number | string | null;
  employmentType?: EmploymentType | null;
  status: StaffStatus;
  createdAt: string;
  user?: { firstName: string; lastName?: string | null; email?: string | null };
  department?: { id: string; name: string };
}

export interface StaffLicense {
  id: string;
  staffId: string;
  licenseType: string;
  licenseNumber: string;
  issuingAuthority?: string | null;
  issuedDate?: string | null;
  expiryDate?: string | null;
  documentUrl?: string | null;
  status: LicenseStatus;
  staff?: { id: string; employeeId?: string | null; user?: { firstName: string; lastName?: string | null } };
}

export interface DutyRoster {
  id: string;
  staffId: string;
  departmentId: string;
  wardId?: string | null;
  role?: string | null;
  shiftDate: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'published' | 'completed' | 'swapped' | 'cancelled';
  staff?: { user?: { firstName: string; lastName?: string | null } };
  ward?: { id: string; name: string } | null;
  department?: { id: string; name: string };
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: AttendanceStatus;
  source: AttendanceSource;
  overtimeHours: number | string;
  notes?: string | null;
  staff?: { user?: { firstName: string; lastName?: string | null }; employeeId?: string | null };
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: LeaveStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  staff?: { user?: { firstName: string; lastName?: string | null }; employeeId?: string | null };
}

export interface PayrollRecord {
  id: string;
  staffId: string;
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
  createdAt: string;
  staff?: { user?: { firstName: string; lastName?: string | null }; employeeId?: string | null };
}

export interface HrDashboardData {
  staff: {
    total: number;
    active: number;
    byDepartment: Array<{ departmentId: string; departmentName: string; count: number }>;
  };
  attendance: {
    today: { present: number; absent: number; halfDay: number; onLeave: number; holiday: number; total: number };
    thisWeek: { present: number; absent: number; halfDay: number; onLeave: number; holiday: number };
  };
  leaves: { pending: number; onLeaveToday: number };
  payroll: {
    month: string;
    draft: { count: number; total: number };
    processed: { count: number; total: number };
    paid: { count: number; total: number };
  };
  licenses: { expiringSoon: number };
}

// ============================================================
// Query keys
// ============================================================

export const hrKeys = {
  dashboard: ['hr', 'dashboard'] as const,
  staff: (params?: unknown) => ['hr', 'staff', params] as const,
  staffOne: (id: string) => ['hr', 'staff', id] as const,
  licenses: (params?: unknown) => ['hr', 'licenses', params] as const,
  expiringLicenses: (daysAhead?: number) => ['hr', 'licenses', 'expiring', daysAhead] as const,
  rosters: (params?: unknown) => ['hr', 'rosters', params] as const,
  attendance: (params?: unknown) => ['hr', 'attendance', params] as const,
  attendanceSummary: (params: { staffId?: string; month: number; year: number }) =>
    ['hr', 'attendance', 'summary', params] as const,
  leaves: (params?: unknown) => ['hr', 'leaves', params] as const,
  leaveBalance: (userId: string) => ['hr', 'leaves', 'balance', userId] as const,
  payroll: (params?: unknown) => ['hr', 'payroll', params] as const,
  payrollOne: (id: string) => ['hr', 'payroll', id] as const,
  reports: (kind: string, params?: unknown) => ['hr', 'reports', kind, params] as const,
};

// ============================================================
// Dashboard
// ============================================================

export function useHrDashboard() {
  return useQuery({
    queryKey: hrKeys.dashboard,
    queryFn: async () => {
      const res = await apiGet<HrDashboardData>('/hr/dashboard');
      return res.data!;
    },
  });
}

// ============================================================
// Staff
// ============================================================

export function useStaffProfiles(params?: {
  departmentId?: string;
  status?: StaffStatus;
  employmentType?: EmploymentType;
  page?: number;
  limit?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: hrKeys.staff(params),
    queryFn: async () => {
      const res = await apiGet<StaffProfile[]>('/hr/staff', { params });
      return res;
    },
  });
}

export function useStaffProfile(id: string | undefined) {
  return useQuery({
    queryKey: hrKeys.staffOne(id!),
    queryFn: async () => {
      const res = await apiGet<StaffProfile>(`/hr/staff/${id}`);
      return res.data!;
    },
    enabled: !!id,
  });
}

export function useCreateStaffProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiPost<StaffProfile>('/hr/staff', body);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'staff'] }),
  });
}

export function useUpdateStaffProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await apiPut<StaffProfile>(`/hr/staff/${id}`, body);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'staff'] }),
  });
}

export function useDeactivateStaffProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<StaffProfile>(`/hr/staff/${id}/deactivate`);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'staff'] }),
  });
}

// ============================================================
// Licenses
// ============================================================

export function useLicenses(params?: { staffId?: string; status?: LicenseStatus; page?: number; limit?: number }) {
  return useQuery({
    queryKey: hrKeys.licenses(params),
    queryFn: async () => apiGet<StaffLicense[]>('/hr/licenses', { params }),
  });
}

export function useExpiringLicenses(daysAhead = 30) {
  return useQuery({
    queryKey: hrKeys.expiringLicenses(daysAhead),
    queryFn: async () => {
      const res = await apiGet<StaffLicense[]>(`/hr/licenses/expiring`, { params: { daysAhead } });
      return res.data ?? [];
    },
  });
}

export function useAddLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiPost<StaffLicense>('/hr/licenses', body);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'licenses'] }),
  });
}

export function useUpdateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await apiPut<StaffLicense>(`/hr/licenses/${id}`, body);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'licenses'] }),
  });
}

// ============================================================
// Duty Rosters
// ============================================================

export function useRosters(params?: {
  staffId?: string;
  departmentId?: string;
  wardId?: string;
  shiftType?: ShiftType;
  status?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: hrKeys.rosters(params),
    queryFn: async () => apiGet<DutyRoster[]>('/hr/rosters', { params }),
  });
}

export function useCreateRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiPost<DutyRoster>('/hr/rosters', body);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'rosters'] }),
  });
}

export function useCreateRosterBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: Array<Record<string, unknown>>) => {
      const res = await apiPost<DutyRoster[]>('/hr/rosters/bulk', { entries });
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'rosters'] }),
  });
}

export function usePublishRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<DutyRoster>(`/hr/rosters/${id}/publish`);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'rosters'] }),
  });
}

// ============================================================
// Attendance
// ============================================================

export function useAttendance(params?: {
  staffId?: string;
  status?: AttendanceStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: hrKeys.attendance(params),
    queryFn: async () => apiGet<AttendanceRecord[]>('/hr/attendance', { params }),
  });
}

export function useAttendanceSummary(params: { staffId?: string; month: number; year: number }) {
  return useQuery({
    queryKey: hrKeys.attendanceSummary(params),
    queryFn: async () => {
      const res = await apiGet<unknown>('/hr/attendance/summary', { params });
      return res.data;
    },
  });
}

export function useRecordAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiPost<AttendanceRecord>('/hr/attendance', body);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'attendance'] }),
  });
}

// ============================================================
// Leaves
// ============================================================

export function useLeaves(params?: {
  staffId?: string;
  status?: LeaveStatus;
  leaveType?: LeaveType;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: hrKeys.leaves(params),
    queryFn: async () => apiGet<LeaveRequest[]>('/hr/leaves', { params }),
  });
}

export function useLeaveBalance(userId: string | undefined) {
  return useQuery({
    queryKey: hrKeys.leaveBalance(userId!),
    queryFn: async () => {
      const res = await apiGet<unknown>(`/hr/leaves/balance/${userId}`);
      return res.data;
    },
    enabled: !!userId,
  });
}

export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiPost<LeaveRequest>('/hr/leaves', body);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'leaves'] }),
  });
}

export function useApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<LeaveRequest>(`/hr/leaves/${id}/approve`);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'leaves'] }),
  });
}

export function useRejectLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<LeaveRequest>(`/hr/leaves/${id}/reject`);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'leaves'] }),
  });
}

// ============================================================
// Payroll
// ============================================================

export function usePayrollList(params?: {
  staffId?: string;
  status?: PayrollStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: hrKeys.payroll(params),
    queryFn: async () => apiGet<PayrollRecord[]>('/hr/payroll', { params }),
  });
}

export function usePayroll(id: string | undefined) {
  return useQuery({
    queryKey: hrKeys.payrollOne(id!),
    queryFn: async () => {
      const res = await apiGet<PayrollRecord>(`/hr/payroll/${id}`);
      return res.data!;
    },
    enabled: !!id,
  });
}

export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiPost<PayrollRecord>('/hr/payroll/generate', body);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'payroll'] }),
  });
}

export function useApprovePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<PayrollRecord>(`/hr/payroll/${id}/approve`);
      return res.data!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'payroll'] }),
  });
}

// ============================================================
// Reports
// ============================================================

export function useAbsenteeismReport(params?: { fromDate?: string; toDate?: string; departmentId?: string }) {
  return useQuery({
    queryKey: hrKeys.reports('absenteeism', params),
    queryFn: async () => {
      const res = await apiGet<{
        from: string;
        to: string;
        overallRate: number;
        rows: Array<{ staffId: string; employeeId?: string | null; name: string; department?: string | null; workingDays: number; absentDays: number; halfDays: number; absenteeismRate: number }>;
      }>('/hr/reports/absenteeism', { params });
      return res.data!;
    },
  });
}

export function useAttritionReport(params?: { fromDate?: string; toDate?: string; departmentId?: string }) {
  return useQuery({
    queryKey: hrKeys.reports('attrition', params),
    queryFn: async () => {
      const res = await apiGet<{
        from: string;
        to: string;
        headcount: number;
        totalLeavers: number;
        attritionRate: number;
        byReason: Record<string, number>;
        byDepartment: Record<string, number>;
        leavers: Array<{ staffId: string; name: string; department?: string | null; status: string; exitedAt: string }>;
      }>('/hr/reports/attrition', { params });
      return res.data!;
    },
  });
}

export function useOvertimeReport(params?: { fromDate?: string; toDate?: string; departmentId?: string }) {
  return useQuery({
    queryKey: hrKeys.reports('overtime', params),
    queryFn: async () => {
      const res = await apiGet<{
        from: string;
        to: string;
        totalOvertimeHours: number;
        staffWithOvertime: number;
        rows: Array<{ staffId: string; name: string; department?: string | null; overtimeHours: number }>;
      }>('/hr/reports/overtime', { params });
      return res.data!;
    },
  });
}

export function useLeaveUtilizationReport(params?: { fromDate?: string; toDate?: string; departmentId?: string }) {
  return useQuery({
    queryKey: hrKeys.reports('leave-utilization', params),
    queryFn: async () => {
      const res = await apiGet<{
        from: string;
        to: string;
        byType: Record<string, number>;
        totalDays: number;
        rows: Array<{ staffId: string; name: string; department?: string | null; vacation: number; sick: number; casual: number; maternity: number; paternity: number; unpaid: number; other: number; totalDays: number }>;
      }>('/hr/reports/leave-utilization', { params });
      return res.data!;
    },
  });
}

// ============================================================
// Salary slip PDF — auth-gated blob download
// ============================================================

export async function downloadSalarySlipPdf(payrollId: string): Promise<void> {
  const apiClientMod = await import('@/lib/api-client');
  const res = await apiClientMod.default.get(`/hr/salary-slips/${payrollId}/pdf`, {
    responseType: 'blob',
  });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
