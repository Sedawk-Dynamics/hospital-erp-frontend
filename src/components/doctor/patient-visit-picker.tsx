'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, UserRound, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePatientSearch } from '@/hooks/use-doctor';
import { apiGet, apiPost } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/date-utils';

export interface SelectedPatient {
  id: string;
  firstName: string;
  lastName: string;
  mrn?: string;
}

export interface SelectedVisit {
  id: string;
  visitType: string;
  visitDate: string;
  status?: string;
}

// When `appointmentId` is set, the option is derived from a booked/active
// appointment that has no Visit yet — picking it materializes a Visit first.
interface VisitOption extends SelectedVisit {
  appointmentId?: string;
  doctorName?: string;
  startTime?: string;
}

function doctorLabel(doc: any): string | undefined {
  const u = doc?.user;
  if (!u) return undefined;
  const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return name ? `Dr. ${name}` : undefined;
}

interface PatientVisitPickerProps {
  selectedPatient: SelectedPatient | null;
  onSelectPatient: (patient: SelectedPatient | null) => void;
  selectedVisitId: string;
  onSelectVisitId: (id: string) => void;
  /** When true, shows the visit picker. When false, only the patient picker is rendered. */
  requireVisit?: boolean;
  /**
   * Current doctor's profile id. When provided, if the patient has no active
   * Visit, the picker falls back to the doctor's recent booked / checked-in
   * appointments with this patient and lazily creates a Visit on selection.
   */
  doctorId?: string;
}

export function PatientVisitPicker({
  selectedPatient,
  onSelectPatient,
  selectedVisitId,
  onSelectVisitId,
  requireVisit = true,
  doctorId,
}: PatientVisitPickerProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: patientResults, isLoading: patientsLoading } = usePatientSearch(debouncedQuery);

  // Fetch active visits once a patient is selected; fall back to recent
  // appointments with the requesting doctor when no visit exists yet.
  const [visits, setVisits] = useState<VisitOption[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [creatingVisit, setCreatingVisit] = useState(false);
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPatient || !requireVisit) {
      setVisits([]);
      return;
    }
    let cancelled = false;
    setVisitsLoading(true);
    (async () => {
      try {
        const visitsRes = await apiGet<Array<SelectedVisit & { doctor?: any }>>(
          '/clinical/visits',
          { params: { patientId: selectedPatient.id, status: 'active' } },
        );
        if (cancelled) return;
        const activeVisits = visitsRes.data ?? [];
        if (activeVisits.length > 0) {
          const enriched: VisitOption[] = activeVisits.map((v) => ({
            id: v.id,
            visitType: v.visitType,
            visitDate: v.visitDate,
            status: v.status,
            doctorName: doctorLabel(v.doctor),
          }));
          setVisits(enriched);
          if (!selectedVisitId) onSelectVisitId(enriched[0].id);
          return;
        }

        // No active visits — surface the doctor's open appointments so the
        // user can act on a booked consultation.
        if (!doctorId) {
          setVisits([]);
          return;
        }
        const apptRes = await apiGet<
          Array<{
            id: string;
            status: string;
            appointmentDate: string;
            startTime?: string;
            doctor?: any;
          }>
        >('/appointments', {
          params: { patientId: selectedPatient.id, doctorId, limit: 20 },
        });
        if (cancelled) return;
        const candidates = (apptRes.data ?? [])
          .filter((a) =>
            ['booked', 'confirmed', 'checked_in', 'in_consultation'].includes(a.status),
          )
          .sort(
            (a, b) =>
              new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime(),
          );
        const apptOptions: VisitOption[] = candidates.map((a) => ({
          id: `appt:${a.id}`,
          visitType: 'op',
          visitDate: a.appointmentDate,
          status: a.status,
          appointmentId: a.id,
          startTime: a.startTime,
          doctorName: doctorLabel(a.doctor),
        }));
        setVisits(apptOptions);
        // Do not auto-select an appointment option — selection triggers a
        // Visit POST and should be an explicit user action.
      } catch {
        if (!cancelled) setVisits([]);
      } finally {
        if (!cancelled) setVisitsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPatient, requireVisit, doctorId, onSelectVisitId, selectedVisitId]);

  const handleSelectPatient = useCallback(
    (p: { id: string; firstName?: string; lastName?: string; mrn?: string }) => {
      onSelectPatient({
        id: p.id,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        mrn: p.mrn,
      });
      onSelectVisitId('');
      setPendingValue(null);
      setQuery('');
      setDebouncedQuery('');
      setShowDropdown(false);
    },
    [onSelectPatient, onSelectVisitId],
  );

  // Materialize a Visit when an appointment-derived option is picked.
  const handleVisitChange = useCallback(
    async (value: string | null) => {
      if (!value) return;
      const opt = visits.find((v) => v.id === value);
      if (!opt) return;
      if (!opt.appointmentId) {
        onSelectVisitId(value);
        return;
      }
      if (!selectedPatient || !doctorId) return;
      setPendingValue(value);
      setCreatingVisit(true);
      try {
        const res = await apiPost<{ id: string }>('/clinical/visits', {
          patientId: selectedPatient.id,
          doctorId,
          appointmentId: opt.appointmentId,
          visitType: 'op',
          visitDate: new Date().toISOString(),
        });
        const newId = res.data!.id;
        setVisits((prev) =>
          prev.map((v) =>
            v.id === value
              ? {
                  id: newId,
                  visitType: 'op',
                  visitDate: opt.visitDate,
                  status: 'active',
                  doctorName: opt.doctorName,
                  startTime: opt.startTime,
                }
              : v,
          ),
        );
        onSelectVisitId(newId);
      } catch {
        // leave selection unchanged on failure
      } finally {
        setCreatingVisit(false);
        setPendingValue(null);
      }
    },
    [visits, selectedPatient, doctorId, onSelectVisitId],
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          Patient
        </Label>
        {selectedPatient ? (
          <div className="flex items-center gap-2 rounded-lg border p-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <UserRound className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </p>
              <p className="text-[10px] text-muted-foreground">MRN: {selectedPatient.mrn || '-'}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                onSelectPatient(null);
                onSelectVisitId('');
              }}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patient by name or MRN..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="pl-8 h-9 text-sm"
            />
            {showDropdown && debouncedQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                {patientsLoading ? (
                  <div className="flex items-center justify-center p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-xs text-muted-foreground">Searching...</span>
                  </div>
                ) : patientResults && patientResults.length > 0 ? (
                  patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                      onClick={() => handleSelectPatient(p)}
                    >
                      <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">{p.mrn || ''}</span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-muted-foreground">No patients found</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {requireVisit && selectedPatient && (
        <div className="space-y-1.5">
          <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            Visit
          </Label>
          {visitsLoading ? (
            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading visits...
            </div>
          ) : visits.length > 0 ? (
            <>
              <Select
                value={pendingValue ?? selectedVisitId}
                onValueChange={(v) => handleVisitChange(v)}
                disabled={creatingVisit}
              >
                <SelectTrigger className="w-full h-9" disabled={creatingVisit}>
                  <SelectValue placeholder="Select a visit" />
                </SelectTrigger>
                <SelectContent>
                  {visits.map((v) => {
                    const dateLabel = formatDate(v.visitDate);
                    const timeLabel = v.startTime ? ` ${formatTime(v.startTime)}` : '';
                    const statusLabel = v.appointmentId
                      ? (v.status ?? 'appointment').replace(/_/g, ' ')
                      : v.status;
                    const segments = [
                      v.visitType.toUpperCase(),
                      `${dateLabel}${timeLabel}`,
                      v.doctorName,
                    ].filter(Boolean) as string[];
                    return (
                      <SelectItem key={v.id} value={v.id}>
                        {segments.join(' · ')}
                        {statusLabel ? ` (${statusLabel})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {creatingVisit && (
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Preparing visit...
                </p>
              )}
            </>
          ) : (
            <p className="font-label text-xs p-2 rounded-lg bg-secondary/10 text-secondary">
              No active visits or open appointments found for this patient.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
