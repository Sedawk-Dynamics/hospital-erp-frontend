'use client';

import { useState, useCallback } from 'react';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Download, ChevronDown, ChevronUp, Search, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePatientSearch,
  usePatientDetail,
  usePatientVitals,
  usePatientDiagnoses,
  usePrescriptions,
  useProgressNotes,
} from '@/hooks/use-doctor';

const registryTabs = [
  'Demographics',
  'Diagnosis',
  'Vitals',
  'Drug Name',
  'Allergies',
  'Immunization',
  'Category',
] as const;

const filterSections = [
  'Demographics',
  'Diagnosis',
  'Vitals',
  'Drug Name',
  'Allergies',
  'Patient Category',
] as const;

type RegistryTab = typeof registryTabs[number];

export default function DoctorRegistryPage() {
  const [activeTab, setActiveTab] = useState<RegistryTab>('Demographics');
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: searchResults, isLoading: searchLoading } = usePatientSearch(searchQuery);

  const toggleFilter = (section: string) => {
    setExpandedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleViewProfile = useCallback((patientId: string) => {
    setSelectedPatientId(patientId);
    setProfileOpen(true);
  }, []);

  const patients = searchResults ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Patient Registry</h1>

      {/* Tabs */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
        {registryTabs.map((tab, index) => (
          <div key={tab} className="flex items-center">
            <button
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-2 py-1 rounded transition-colors',
                activeTab === tab
                  ? 'text-primary font-medium'
                  : 'hover:text-foreground'
              )}
            >
              {tab}
            </button>
            {index < registryTabs.length - 1 && (
              <span className="text-muted-foreground/50 mx-1">/</span>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
        {/* Left: Data table */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden shadow-sm ring-1 ring-foreground/5">
          {/* Search + Export */}
          <div className="flex items-center justify-between p-3 border-b">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, MRN, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" title="Export">
              <Download className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient Name</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Contact Details</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Address</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody>
                {searchLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <p className="mt-2 text-sm text-muted-foreground">Searching...</p>
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center font-label text-on-surface-variant">
                      {searchQuery.length >= 2
                        ? 'No patients found matching your search.'
                        : 'Enter at least 2 characters to search patients.'}
                    </td>
                  </tr>
                ) : (
                  patients.map((patient) => (
                    <tr key={patient.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {patient.firstName?.[0]}{patient.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground truncate max-w-[200px]">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {patient.mrn} | {patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : '-'}
                              {patient.dateOfBirth && ` | DOB: ${formatDate(patient.dateOfBirth)}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p className="text-foreground">{patient.phone || '-'}</p>
                          {patient.email && (
                            <p className="text-xs text-muted-foreground">{patient.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground truncate max-w-[200px]">
                          {[patient.address, patient.city, patient.state].filter(Boolean).join(', ') || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View Profile"
                          onClick={() => handleViewProfile(patient.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
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
              <span className="font-medium">20</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{patients.length > 0 ? `1-${patients.length} of ${patients.length}` : '0-0 of 0'}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled>&#8249;</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled>&#8250;</Button>
            </div>
          </div>
        </div>

        {/* Right: Filter panel */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden shadow-sm ring-1 ring-foreground/5">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-foreground">Filter</h3>
          </div>

          <div className="divide-y">
            {filterSections.map((section) => (
              <div key={section}>
                <button
                  onClick={() => toggleFilter(section)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>{section}</span>
                  {expandedFilters.has(section) ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedFilters.has(section) && (
                  <div className="px-4 pb-3">
                    <Input placeholder={`Search ${section.toLowerCase()}...`} className="h-8 text-xs" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 p-4 border-t">
            <Button variant="outline" className="flex-1" onClick={() => { setSearchQuery(''); setExpandedFilters(new Set()); }}>
              Clear
            </Button>
            <Button className="flex-1" onClick={() => toast.info('Filters applied')}>
              Apply
            </Button>
          </div>
        </div>
      </div>

      {/* Patient Profile Dialog */}
      <PatientProfileDialog
        patientId={selectedPatientId}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </div>
  );
}

function PatientProfileDialog({
  patientId,
  open,
  onOpenChange,
}: {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: patient, isLoading: patientLoading } = usePatientDetail(patientId);
  const { data: vitals } = usePatientVitals(patientId);
  const { data: diagnoses } = usePatientDiagnoses(patientId);
  const { data: prescriptionsData } = usePrescriptions({ patientId, limit: 10 });
  const { data: notesData } = useProgressNotes({ patientId, limit: 10 });

  const prescriptions = prescriptionsData?.data ?? [];
  const notes = notesData?.data ?? [];

  if (!patientId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Patient Profile</DialogTitle>
        </DialogHeader>

        {patientLoading ? (
          <div className="py-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-2 text-sm text-muted-foreground">Loading patient details...</p>
          </div>
        ) : patient ? (
          <div className="space-y-4">
            {/* Patient Header */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {patient.firstName?.[0]}{patient.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg text-foreground">
                  {patient.firstName} {patient.lastName}
                </h3>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{patient.mrn}</span>
                  <span>{patient.gender === 'male' ? 'Male' : patient.gender === 'female' ? 'Female' : '-'}</span>
                  <span>{patient.phone}</span>
                  {patient.bloodGroup && <span>Blood: {patient.bloodGroup}</span>}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="vitals">
              <TabsList variant="line">
                <TabsTrigger value="vitals">Vitals</TabsTrigger>
                <TabsTrigger value="diagnoses">Diagnoses</TabsTrigger>
                <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="allergies">Allergies</TabsTrigger>
              </TabsList>

              <TabsContent value="vitals">
                <div className="pt-3">
                  {vitals && vitals.length > 0 ? (
                    <div className="space-y-2">
                      {vitals.slice(0, 5).map((v) => (
                        <div key={v.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-foreground">Recorded</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(v.createdAt)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {v.temperature && <span>Temp: {v.temperature} F</span>}
                            {v.bloodPressureSystolic && <span>BP: {v.bloodPressureSystolic}/{v.bloodPressureDiastolic}</span>}
                            {v.heartRate && <span>HR: {v.heartRate} bpm</span>}
                            {v.respiratoryRate && <span>RR: {v.respiratoryRate}/min</span>}
                            {v.oxygenSaturation && <span>SpO2: {v.oxygenSaturation}%</span>}
                            {v.weight && <span>Wt: {v.weight} kg</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No vitals recorded.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="diagnoses">
                <div className="pt-3">
                  {diagnoses && diagnoses.length > 0 ? (
                    <div className="space-y-2">
                      {diagnoses.map((d) => (
                        <div key={d.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">{d.description}</span>
                            {d.type && (
                              <span className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest',
                                d.type === 'primary' && 'bg-primary/10 text-primary',
                                d.type === 'secondary' && 'bg-secondary/10 text-secondary',
                                d.type === 'differential' && 'bg-tertiary/10 text-tertiary',
                              )}>
                                {d.type}
                              </span>
                            )}
                          </div>
                          {d.code && <p className="text-xs text-muted-foreground mt-1">Code: {d.code}</p>}
                          {d.notes && <p className="text-xs text-muted-foreground mt-1">{d.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No diagnoses found.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="prescriptions">
                <div className="pt-3">
                  {prescriptions.length > 0 ? (
                    <div className="space-y-2">
                      {prescriptions.map((p) => (
                        <div key={p.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-foreground">Prescription</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(p.createdAt)}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {p.items?.map((item, idx) => (
                              <p key={idx} className="text-xs text-foreground">
                                {item.drugName} - {item.dosage} - {item.frequency} x {item.duration}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No prescriptions found.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notes">
                <div className="pt-3">
                  {notes.length > 0 ? (
                    <div className="space-y-2">
                      {notes.map((n) => (
                        <div key={n.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-foreground">
                              {n.noteType || 'Progress Note'}
                              {n.status === 'finalized' && <span className="ml-2 text-primary text-xs">(Signed)</span>}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(n.createdAt)}
                            </span>
                          </div>
                          {n.content && <p className="text-xs text-foreground whitespace-pre-line">{n.content}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No progress notes found.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="allergies">
                <div className="pt-3">
                  {patient.allergies && patient.allergies.length > 0 ? (
                    <div className="space-y-2">
                      {patient.allergies.map((a) => (
                        <div key={a.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">{a.allergen}</span>
                            <span className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest',
                              a.severity === 'mild' && 'bg-primary/10 text-primary',
                              a.severity === 'moderate' && 'bg-secondary/10 text-secondary',
                              a.severity === 'severe' && 'bg-error/10 text-error',
                            )}>
                              {a.severity}
                            </span>
                          </div>
                          {a.reaction && <p className="text-xs text-muted-foreground mt-1">Reaction: {a.reaction}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No allergies recorded.</p>
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
