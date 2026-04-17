'use client';

import { useState, useCallback } from 'react';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Search, Printer, Plus, Eye, CalendarIcon, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useDoctorOTRequests, useCreateOTRequest, usePatientSearch } from '@/hooks/use-doctor';

const otStatItems = [
  { key: 'all', label: 'All', color: 'text-on-surface', statusFilter: undefined },
  { key: 'upcoming', label: 'Upcoming', color: 'text-primary-container', statusFilter: 'scheduled' },
  { key: 'approved', label: 'Approved', color: 'text-primary', statusFilter: 'approved' },
  { key: 'in_progress', label: 'In Progress', color: 'text-secondary', statusFilter: 'in_progress' },
  { key: 'completed', label: 'Completed', color: 'text-tertiary', statusFilter: 'completed' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-error', statusFilter: 'cancelled' },
];

export default function DoctorOTListPage() {
  const { user } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(toInputDateStr());
  const [page, setPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Form state
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [surgeryName, setSurgeryName] = useState('');
  const [surgeryType, setSurgeryType] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [priority, setPriority] = useState('routine');
  const [preOpDiagnosis, setPreOpDiagnosis] = useState('');
  const [otNotes, setOtNotes] = useState('');

  const statusFilter = otStatItems.find((i) => i.key === activeFilter)?.statusFilter;

  const { data: otData, isLoading } = useDoctorOTRequests({
    page,
    limit: 10,
    surgeonId: user?.id,
    status: statusFilter,
    search: search || undefined,
    date: fromDate,
  });

  const { data: patientResults } = usePatientSearch(patientSearch);
  const createOTMutation = useCreateOTRequest();

  const otRequests = otData?.data ?? [];
  const meta = otData?.meta;

  // Compute stats
  const stats = otRequests.reduce(
    (acc, req) => {
      acc.all++;
      if (req.status === 'scheduled') acc.upcoming++;
      else if (req.status === 'approved') acc.approved++;
      else if (req.status === 'in_progress') acc.in_progress++;
      else if (req.status === 'completed') acc.completed++;
      else if (req.status === 'cancelled') acc.cancelled++;
      return acc;
    },
    { all: 0, upcoming: 0, approved: 0, in_progress: 0, completed: 0, cancelled: 0 } as Record<string, number>
  );
  // Use meta total for 'all' if available
  if (meta?.total) stats.all = meta.total;

  const handleCreateOTRequest = useCallback(async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!surgeryName.trim()) {
      toast.error('Please enter surgery name');
      return;
    }
    try {
      await createOTMutation.mutateAsync({
        patientId: selectedPatient.id,
        surgeryName,
        surgeryType: surgeryType || undefined,
        speciality: speciality || undefined,
        surgeonId: user?.id,
        scheduledDate: scheduledDate || undefined,
        scheduledStartTime: scheduledTime || undefined,
        priority,
        preOpDiagnosis: preOpDiagnosis || undefined,
        notes: otNotes || undefined,
      });
      toast.success('OT request created successfully');
      setCreateDialogOpen(false);
      resetForm();
    } catch {
      toast.error('Failed to create OT request');
    }
  }, [selectedPatient, surgeryName, surgeryType, speciality, scheduledDate, scheduledTime, priority, preOpDiagnosis, otNotes, user, createOTMutation]);

  const resetForm = () => {
    setSelectedPatient(null);
    setPatientSearch('');
    setSurgeryName('');
    setSurgeryType('');
    setSpeciality('');
    setScheduledDate('');
    setScheduledTime('');
    setPriority('routine');
    setPreOpDiagnosis('');
    setOtNotes('');
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">OT Schedule</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Printer className="h-4 w-4" />
          </Button>
          <Button className="gap-1.5 h-8" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New OT Request
          </Button>
        </div>
      </div>

      {/* Date + Stats */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="pl-8 h-8 text-xs w-full sm:w-[140px]"
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {otStatItems.map((item) => (
          <button
            key={item.key}
            onClick={() => { setActiveFilter(item.key); setPage(1); }}
            className={cn(
              'flex flex-col items-center rounded-lg border-2 px-3 py-2 min-w-[90px] shadow-sm hover:shadow-md transition-all duration-200',
              activeFilter === item.key
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-card hover:border-border'
            )}
          >
            <span className={cn('text-lg font-bold', item.color)}>
              {stats[item.key] ?? 0}
            </span>
            <span className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex justify-end">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient or surgery..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-8 text-xs w-[220px]"
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
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">OT Name</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Surgery/Speciality</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Schedule</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Surgeon</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Anaesthetist</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading OT requests...</p>
                  </td>
                </tr>
              ) : otRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center font-label text-on-surface-variant">
                    No OT requests found for the selected criteria.
                  </td>
                </tr>
              ) : (
                otRequests.map((req) => {
                  const patient = req.patient;
                  const patientName = patient
                    ? `${patient.firstName} ${patient.lastName}`.toUpperCase()
                    : 'Unknown';

                  return (
                    <tr key={req.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {patient?.firstName?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground text-xs">{patientName}</p>
                            <p className="text-xs text-muted-foreground">{patient?.mrn || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{req.otName || '-'}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground text-xs">{req.surgeryName}</p>
                          {req.speciality && (
                            <p className="text-xs text-muted-foreground">{req.speciality}</p>
                          )}
                          {req.surgeryType && (
                            <p className="text-xs text-muted-foreground">{req.surgeryType}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          {req.scheduledDate ? (
                            <>
                              <p className="text-foreground">{formatDate(req.scheduledDate)}</p>
                              {req.scheduledStartTime && (
                                <p className="text-muted-foreground">{req.scheduledStartTime} - {req.scheduledEndTime || '...'}</p>
                              )}
                            </>
                          ) : (
                            <p className="text-muted-foreground">Not scheduled</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {req.surgeon?.user
                          ? `Dr ${req.surgeon.user.firstName} ${req.surgeon.user.lastName}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {req.anaesthetist?.user
                          ? `Dr ${req.anaesthetist.user.firstName}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'font-label text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
                          req.status === 'scheduled' && 'bg-primary-container/10 text-primary-container',
                          req.status === 'approved' && 'bg-primary/10 text-primary',
                          req.status === 'in_progress' && 'bg-secondary/10 text-secondary',
                          req.status === 'completed' && 'bg-tertiary/10 text-tertiary',
                          req.status === 'cancelled' && 'bg-error/10 text-error',
                          req.status === 'pending' && 'bg-surface-container-high text-on-surface-variant',
                        )}>
                          {req.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" className="h-7 w-7" />}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Print</DropdownMenuItem>
                              {req.status === 'pending' && (
                                <DropdownMenuItem>Edit Request</DropdownMenuItem>
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
              {otRequests.length > 0
                ? `${(page - 1) * 10 + 1}-${(page - 1) * 10 + otRequests.length} of ${meta?.total ?? otRequests.length}`
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

      {/* Create OT Request Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New OT Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Patient Search */}
            <div>
              <label className="text-sm font-medium">Patient *</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between rounded-lg border p-2 mt-1">
                  <span className="text-sm font-medium">{selectedPatient.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedPatient(null)}>
                    <span className="text-xs">x</span>
                  </Button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patient..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-8"
                  />
                  {patientResults && patientResults.length > 0 && patientSearch.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border bg-background max-h-40 overflow-y-auto shadow-lg">
                      {patientResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedPatient({ id: p.id, name: `${p.firstName} ${p.lastName}` });
                            setPatientSearch('');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b last:border-0"
                        >
                          {p.firstName} {p.lastName} - {p.mrn}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Surgery Name *</label>
              <Input
                value={surgeryName}
                onChange={(e) => setSurgeryName(e.target.value)}
                placeholder="Enter surgery name"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Surgery Type</label>
                <Input
                  value={surgeryType}
                  onChange={(e) => setSurgeryType(e.target.value)}
                  placeholder="e.g., Elective"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Speciality</label>
                <Input
                  value={speciality}
                  onChange={(e) => setSpeciality(e.target.value)}
                  placeholder="e.g., Orthopedics"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Scheduled Date</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Scheduled Time</label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? 'routine')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Pre-Op Diagnosis</label>
              <Input
                value={preOpDiagnosis}
                onChange={(e) => setPreOpDiagnosis(e.target.value)}
                placeholder="Enter pre-operative diagnosis"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={otNotes}
                onChange={(e) => setOtNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleCreateOTRequest} disabled={createOTMutation.isPending}>
                {createOTMutation.isPending ? 'Creating...' : 'Create Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
