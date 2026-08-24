'use client';

import { useState, useCallback } from 'react';
import { formatDate, formatDateTime, formatTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { Search, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  useMRDDocuments,
  useCreateMRDRequest,
  usePatientSearch,
  usePatientDetail,
  usePatientVitals,
  usePatientDiagnoses,
  usePrescriptions,
  useProgressNotes,
  useLabOrders,
} from '@/hooks/use-doctor';
import { formatTemperature, temperatureIn, temperatureUnitLabel, temperatureValue } from '@/lib/vitals-temperature';
import { useTemperatureUnit } from '@/stores/temperature-unit-store';

export default function DoctorMRDPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound');
  const [patientSearch, setPatientSearch] = useState('');
  const [locationFrom, setLocationFrom] = useState('');
  const [wardRoom, setWardRoom] = useState('general');
  const [search, setSearch] = useState('');
  const [selectedPatientForRequest, setSelectedPatientForRequest] = useState<{
    id: string;
    name: string;
    mrn: string;
    phone: string;
  } | null>(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [selectedPatientIdForRecord, setSelectedPatientIdForRecord] = useState('');
  const [page, setPage] = useState(1);

  const doctorName = user ? `Dr ${user.firstName}` : 'Doctor';

  const { data: searchResults } = usePatientSearch(patientSearch);
  const { data: mrdData, isLoading: mrdLoading } = useMRDDocuments({
    page,
    limit: 10,
    direction: activeTab,
    search: search || undefined,
  });
  const createMRDRequest = useCreateMRDRequest();

  const mrdDocuments = mrdData?.data ?? [];
  const meta = mrdData?.meta;

  const handleSelectPatient = useCallback((patient: { id: string; firstName: string; lastName: string; mrn: string; phone: string }) => {
    setSelectedPatientForRequest({
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      mrn: patient.mrn,
      phone: patient.phone,
    });
    setPatientSearch('');
  }, []);

  const handleSubmitRequest = useCallback(async () => {
    if (!selectedPatientForRequest) {
      toast.error('Please select a patient');
      return;
    }
    if (!locationFrom.trim()) {
      toast.error('Please enter location');
      return;
    }
    try {
      await createMRDRequest.mutateAsync({
        patientId: selectedPatientForRequest.id,
        locationFrom,
        wardRoom,
        doctorId: user?.id,
      });
      toast.success('MRD request submitted successfully');
      setSelectedPatientForRequest(null);
      setLocationFrom('');
    } catch {
      toast.error('Failed to submit MRD request');
    }
  }, [selectedPatientForRequest, locationFrom, wardRoom, user, createMRDRequest]);

  const handleClear = useCallback(() => {
    setSelectedPatientForRequest(null);
    setPatientSearch('');
    setLocationFrom('');
    setWardRoom('general');
  }, []);

  const handleViewRecord = useCallback((patientId: string) => {
    setSelectedPatientIdForRecord(patientId);
    setRecordDialogOpen(true);
  }, []);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">MRD - Medical Records</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
        {/* Left: Request MRD Document form */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-4 shadow-sm ring-1 ring-foreground/5">
          <h3 className="font-semibold text-foreground">Request MRD Document</h3>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Patient"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-9"
              />
              {searchResults && searchResults.length > 0 && patientSearch.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border bg-background max-h-48 overflow-y-auto shadow-lg">
                  {searchResults.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors text-sm border-b last:border-0"
                    >
                      <span className="font-medium">{patient.firstName} {patient.lastName}</span>
                      <span className="text-muted-foreground ml-2">{patient.mrn}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Input
              placeholder="Location From *"
              value={locationFrom}
              onChange={(e) => setLocationFrom(e.target.value)}
            />

            <div>
              <label className="text-xs text-muted-foreground">Ward / Room No *</label>
              <Select value={wardRoom} onValueChange={(v) => setWardRoom(v ?? 'general')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Ward" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="icu">ICU</SelectItem>
                  <SelectItem value="ot">OT</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Doctor Name</label>
              <Select value="current" onValueChange={() => {}}>
                <SelectTrigger>
                  <SelectValue placeholder={doctorName} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">{doctorName}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Patient Details</h4>
              <div className="rounded-lg border p-4 min-h-[100px] text-xs">
                {selectedPatientForRequest ? (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{selectedPatientForRequest.name}</p>
                    <p className="text-muted-foreground">MRN: {selectedPatientForRequest.mrn}</p>
                    <p className="text-muted-foreground">Phone: {selectedPatientForRequest.phone}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Select a patient to view details</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClear}>
              Clear
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmitRequest}
              disabled={createMRDRequest.isPending}
            >
              {createMRDRequest.isPending ? 'Requesting...' : 'Request'}
            </Button>
          </div>
        </div>

        {/* Right: MRD Documents */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden shadow-sm ring-1 ring-foreground/5">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-foreground">MRD Documents</h3>
            <div className="flex gap-1">
              <button
                onClick={() => { setActiveTab('inbound'); setPage(1); }}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  activeTab === 'inbound'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                Inbound
              </button>
              <button
                onClick={() => { setActiveTab('outbound'); setPage(1); }}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  activeTab === 'outbound'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                Outbound
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex justify-end p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 h-8 text-xs w-[200px]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient Details</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Requested To</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Requested Date & Time</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody>
                {mrdLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
                    </td>
                  </tr>
                ) : mrdDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center font-label text-on-surface-variant">
                      No {activeTab} MRD requests found.
                    </td>
                  </tr>
                ) : (
                  mrdDocuments.map((doc) => (
                    <tr key={doc.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {doc.patient?.firstName?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground">
                              {doc.patient ? `${doc.patient.firstName} ${doc.patient.lastName}` : 'Unknown'}
                            </p>
                            <div className="text-xs text-muted-foreground">
                              {doc.patient?.mrn || '-'} | {doc.patient?.phone || '-'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{doc.requestedTo}</td>
                      <td className="px-4 py-3 text-foreground">
                        {formatDate(doc.createdAt)} | {formatTime(doc.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'font-label text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
                          doc.status === 'Initiated' && 'bg-primary-container/10 text-primary-container',
                          doc.status === 'In Progress' && 'bg-secondary/10 text-secondary',
                          doc.status === 'Completed' && 'bg-primary/10 text-primary',
                          doc.status === 'Rejected' && 'bg-error/10 text-error',
                        )}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {doc.status === 'Completed' && doc.patientId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleViewRecord(doc.patientId)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              {doc.status === 'Initiated' ? 'Pending' : doc.status}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
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
                {mrdDocuments.length > 0
                  ? `${(page - 1) * 10 + 1}-${(page - 1) * 10 + mrdDocuments.length} of ${meta?.total ?? mrdDocuments.length}`
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
      </div>

      {/* Medical Record Dialog */}
      <MedicalRecordDialog
        patientId={selectedPatientIdForRecord}
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
      />
    </div>
  );
}

function MedicalRecordDialog({
  patientId,
  open,
  onOpenChange,
}: {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: patient, isLoading } = usePatientDetail(patientId);
  const { data: vitals } = usePatientVitals(patientId);
  const [tempUnit] = useTemperatureUnit();
  const { data: diagnoses } = usePatientDiagnoses(patientId);
  const { data: prescriptionsData } = usePrescriptions({ patientId, limit: 20 });
  const { data: notesData } = useProgressNotes({ patientId, limit: 20 });
  const { data: labOrdersData } = useLabOrders({ patientId, limit: 20 });

  const prescriptions = prescriptionsData?.data ?? [];
  const notes = notesData?.data ?? [];
  const labOrders = labOrdersData?.data ?? [];

  if (!patientId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Medical Record</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : patient ? (
          <div className="space-y-4">
            {/* Patient Info */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {patient.firstName?.[0]}{patient.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-foreground">
                  {patient.firstName} {patient.lastName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {patient.mrn} | {patient.phone} | {patient.gender}
                </p>
              </div>
            </div>

            <Tabs defaultValue="diagnoses">
              <TabsList variant="line">
                <TabsTrigger value="diagnoses">Diagnoses</TabsTrigger>
                <TabsTrigger value="vitals">Vitals</TabsTrigger>
                <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
                <TabsTrigger value="lab">Lab Results</TabsTrigger>
                <TabsTrigger value="notes">Progress Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="diagnoses">
                <div className="pt-3">
                  {diagnoses && diagnoses.length > 0 ? (
                    <div className="space-y-2">
                      {diagnoses.map((d) => (
                        <div key={d.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{d.description}</span>
                            {d.code && <span className="text-xs text-muted-foreground">ICD: {d.code}</span>}
                          </div>
                          {d.type && <p className="text-xs text-muted-foreground mt-1">Type: {d.type}</p>}
                          <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No diagnoses recorded.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="vitals">
                <div className="pt-3">
                  {vitals && vitals.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-surface-container">
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Temp</th>
                            <th className="px-3 py-2 text-left">BP</th>
                            <th className="px-3 py-2 text-left">HR</th>
                            <th className="px-3 py-2 text-left">SpO2</th>
                            <th className="px-3 py-2 text-left">Weight</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vitals.map((v) => (
                            <tr key={v.id} className="border-b">
                              <td className="px-3 py-2">{formatDateTime(v.createdAt)}</td>
                              <td className="px-3 py-2">{formatTemperature(v.temperature, tempUnit, '-')}</td>
                              <td className="px-3 py-2">{v.bloodPressureSystolic ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : '-'}</td>
                              <td className="px-3 py-2">{v.heartRate || '-'}</td>
                              <td className="px-3 py-2">{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '-'}</td>
                              <td className="px-3 py-2">{v.weight ? `${v.weight} kg` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No vitals recorded.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="prescriptions">
                <div className="pt-3">
                  {prescriptions.length > 0 ? (
                    <div className="space-y-3">
                      {prescriptions.map((p) => (
                        <div key={p.id} className="rounded-lg border p-3 text-sm">
                          <p className="text-xs text-muted-foreground mb-2">{formatDate(p.createdAt)}</p>
                          {p.items?.map((item, i) => (
                            <p key={i} className="text-xs">
                              {i + 1}. {item.drugName} - {item.dosage} - {item.frequency} x {item.duration}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No prescriptions found.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="lab">
                <div className="pt-3">
                  {labOrders.length > 0 ? (
                    <div className="space-y-2">
                      {labOrders.map((order) => (
                        <div key={order.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{order.orderNumber || order.id.slice(-6)}</span>
                            <span className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest',
                              order.status === 'completed' && 'bg-primary/10 text-primary',
                              order.status === 'ordered' && 'bg-primary-container/10 text-primary-container',
                              order.status === 'in_progress' && 'bg-secondary/10 text-secondary',
                            )}>
                              {order.status}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.tests?.map((t) => t.name).join(', ') || '-'}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No lab orders found.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notes">
                <div className="pt-3">
                  {notes.length > 0 ? (
                    <div className="space-y-2">
                      {notes.map((n) => (
                        <div key={n.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">
                              {n.noteType || 'Progress Note'}
                              {n.status === 'finalized' && <span className="text-primary text-xs ml-2">(Signed)</span>}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(n.createdAt)}
                            </span>
                          </div>
                          {n.content && <p className="text-xs whitespace-pre-line">{n.content}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No progress notes found.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-6">Patient not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
