'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { Search, CalendarIcon, Eye, FileText, FlaskConical, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useDoctorAdmissions, useDischargePatient, useCreateProgressNote } from '@/hooks/use-doctor';
import { apiPost } from '@/lib/api';

const ipStatItems = [
  { key: 'all', label: 'All', color: 'text-on-surface' },
  { key: 'admitted', label: 'In IP', color: 'text-primary-container' },
  { key: 'discharged', label: 'Discharge', color: 'text-secondary' },
  { key: 'transferred', label: 'Transferred', color: 'text-primary' },
  { key: 'absconded', label: 'Absconded', color: 'text-error' },
];

export default function DoctorIPHomePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('admitted');
  const [selectedWard, setSelectedWard] = useState('all');
  const [fromDate, setFromDate] = useState(toInputDateStr());
  const [toDate, setToDate] = useState(toInputDateStr());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedAdmissionId, setSelectedAdmissionId] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const statusFilter = activeFilter === 'all' ? undefined : activeFilter;

  const { data: admissionsData, isLoading } = useDoctorAdmissions({
    page,
    limit: 10,
    // user.id is the User ID; the backend resolves the matching DoctorProfile
    // before filtering Admission.doctorId. Passing user.id as doctorId here
    // would compare against DoctorProfile.id and silently return nothing.
    doctorUserId: user?.id,
    status: statusFilter,
    search: search || undefined,
    date: fromDate,
    wardId: selectedWard !== 'all' ? selectedWard : undefined,
  });

  const dischargeMutation = useDischargePatient();
  const createNoteMutation = useCreateProgressNote();

  const admissions = admissionsData?.data ?? [];
  const meta = admissionsData?.meta;

  // Compute stats from current data
  const stats = {
    all: meta?.total ?? admissions.length,
    admitted: admissions.filter((a) => a.status === 'admitted').length,
    discharged: admissions.filter((a) => a.status === 'discharged').length,
    transferred: admissions.filter((a) => a.status === 'transferred').length,
    absconded: admissions.filter((a) => a.status === 'absconded').length,
  };

  const handleDischarge = useCallback(async (id: string) => {
    try {
      await dischargeMutation.mutateAsync({ id });
      toast.success('Patient discharged successfully');
    } catch {
      toast.error('Failed to discharge patient');
    }
  }, [dischargeMutation]);

  const handleAddNote = useCallback((patientId: string, admissionId: string) => {
    setSelectedPatientId(patientId);
    setSelectedAdmissionId(admissionId);
    setNoteContent('');
    setNoteDialogOpen(true);
  }, []);

  const handleSubmitNote = useCallback(async () => {
    if (!noteContent.trim()) {
      toast.error('Please enter note content');
      return;
    }
    try {
      // Create or reuse a visit for this IP patient
      let visitId: string | undefined;
      try {
        const visitResp = await apiPost<{ id: string }>('/clinical/visits', {
          patientId: selectedPatientId,
          doctorId: user?.id,
          visitType: 'ip',
          visitDate: new Date().toISOString(),
        });
        visitId = visitResp.data?.id;
      } catch {
        // Visit may already exist — try to find it
      }
      if (!visitId) {
        toast.error('Could not create visit for this patient');
        return;
      }
      await createNoteMutation.mutateAsync({
        patientId: selectedPatientId,
        visitId,
        content: noteContent,
        noteType: 'general',
      });
      toast.success('Progress note added successfully');
      setNoteDialogOpen(false);
    } catch {
      toast.error('Failed to add progress note');
    }
  }, [noteContent, selectedPatientId, user?.id, createNoteMutation]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">IP Home</h1>
        <div className="flex items-center gap-2">
          <Select value="today" onValueChange={() => {}}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Select Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <div className="flex items-center gap-3">
          <Select value={selectedWard} onValueChange={(v) => { setSelectedWard(v ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select Ward" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wards</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">From:</span>
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="pl-8 h-8 text-xs w-full sm:w-[140px]"
              />
            </div>
            <span className="text-xs text-muted-foreground">To:</span>
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="pl-8 h-8 text-xs w-full sm:w-[140px]"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2">
          {ipStatItems.map((item) => (
            <button
              key={item.key}
              onClick={() => { setActiveFilter(item.key); setPage(1); }}
              className={cn(
                'flex flex-col items-center rounded-lg border-2 px-3 py-2 min-w-[80px] shadow-sm hover:shadow-md transition-all duration-200',
                activeFilter === item.key
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-card hover:border-border'
              )}
            >
              <span className={cn('text-lg font-bold', item.color)}>
                {stats[item.key as keyof typeof stats] ?? 0}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>From Date:</span>
          <span className="font-semibold text-foreground">{formatDate(fromDate)}</span>
          <span className="ml-2">To Date:</span>
          <span className="font-semibold text-foreground">{formatDate(toDate)}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-8 text-xs w-[200px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden shadow-sm ring-1 ring-foreground/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient Details</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">IP Records</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Diagnosis</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Bed/Ward</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading admissions...</p>
                  </td>
                </tr>
              ) : admissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center font-label text-on-surface-variant">
                    No admitted patients found.
                  </td>
                </tr>
              ) : (
                admissions.map((admission) => {
                  const patient = admission.patient;
                  const patientName = patient
                    ? `${patient.firstName} ${patient.lastName}`.toUpperCase()
                    : 'Unknown';
                  const initials = patient
                    ? `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase()
                    : '?';

                  return (
                    <tr key={admission.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <button
                              type="button"
                              onClick={() => router.push(`/doctor/ip/${admission.id}`)}
                              className="font-semibold text-foreground hover:text-primary text-left"
                            >
                              {patientName}
                              {patient?.gender && (
                                <span className="font-normal text-muted-foreground ml-1">
                                  {patient.gender === 'female' ? 'F' : patient.gender === 'male' ? 'M' : ''}
                                </span>
                              )}
                            </button>
                            <div className="text-xs text-muted-foreground">
                              {patient?.mrn || patient?.uhid || '-'} | {patient?.phone || '-'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Admitted: {formatDate(admission.admissionDate)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-primary text-xs">
                            IP: {admission.ipNumber || admission.id?.slice(-8)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Complaints: {admission.complaints || admission.notes || '-'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Medico-Legal: {admission.medicoLegal || 'No'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground">{admission.diagnosis || '-'}</p>
                        {admission.procedure && (
                          <p className="text-xs text-muted-foreground">Proc: {admission.procedure}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {admission.bed?.bedNumber || '-'} / {admission.ward?.name || '-'}
                          </p>
                          {admission.doctor?.user && (
                            <p className="text-xs text-muted-foreground">
                              Dr {admission.doctor.user.firstName} {admission.doctor.user.lastName}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'font-label text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
                          admission.status === 'admitted' && 'bg-primary-container/10 text-primary-container',
                          admission.status === 'discharged' && 'bg-primary/10 text-primary',
                          admission.status === 'transferred' && 'bg-secondary/10 text-secondary',
                          admission.status === 'absconded' && 'bg-error/10 text-error',
                        )}>
                          {admission.status.charAt(0).toUpperCase() + admission.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="View Details"
                            onClick={() => router.push(`/doctor/ip/${admission.id}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Add Notes"
                            onClick={() => handleAddNote(admission.patientId, admission.id)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Order Tests"
                            onClick={() =>
                              router.push(
                                `/doctor/ip/${admission.id}?tab=orders`,
                              )
                            }
                          >
                            <FlaskConical className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" className="h-7 w-7" />}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/doctor/ip/${admission.id}`)}>
                                View Full Record
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/doctor/prescriptions?patientId=${admission.patientId}&admissionId=${admission.id}`,
                                  )
                                }
                              >
                                Add Prescription
                              </DropdownMenuItem>
                              {/* Vitals are nurse-recorded; the doctor sees them
                                   read-only on the consultation/IP record. */}
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/doctor/discharge-summary?admissionId=${admission.id}`)
                                }
                              >
                                Prepare Discharge Summary
                              </DropdownMenuItem>
                              {admission.status === 'admitted' && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDischarge(admission.id)}
                                >
                                  Discharge Patient
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <span className="font-medium">10</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {admissions.length > 0
                ? `${(page - 1) * 10 + 1}-${(page - 1) * 10 + admissions.length} of ${meta?.total ?? admissions.length}`
                : '0-0 of 0'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              &#8249;
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= (meta?.totalPages ?? 1)}
              onClick={() => setPage(page + 1)}
            >
              &#8250;
            </Button>
          </div>
        </div>
      </div>

      {/* Add Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Progress Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-foreground">Note</label>
              <Textarea
                placeholder="Enter progress note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={6}
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitNote}
                disabled={createNoteMutation.isPending}
              >
                {createNoteMutation.isPending ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
