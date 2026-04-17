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
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';

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

interface PatientVisitPickerProps {
  selectedPatient: SelectedPatient | null;
  onSelectPatient: (patient: SelectedPatient | null) => void;
  selectedVisitId: string;
  onSelectVisitId: (id: string) => void;
  /** When true, shows the visit picker. When false, only the patient picker is rendered. */
  requireVisit?: boolean;
}

export function PatientVisitPicker({
  selectedPatient,
  onSelectPatient,
  selectedVisitId,
  onSelectVisitId,
  requireVisit = true,
}: PatientVisitPickerProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: patientResults, isLoading: patientsLoading } = usePatientSearch(debouncedQuery);

  // Fetch active visits once a patient is selected
  const [visits, setVisits] = useState<SelectedVisit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);

  useEffect(() => {
    if (!selectedPatient || !requireVisit) {
      setVisits([]);
      return;
    }
    let cancelled = false;
    setVisitsLoading(true);
    apiGet<SelectedVisit[]>('/clinical/visits', {
      params: { patientId: selectedPatient.id, status: 'active' },
    })
      .then((res) => {
        if (cancelled) return;
        const list = res.data ?? [];
        setVisits(list);
        if (list.length > 0 && !selectedVisitId) onSelectVisitId(list[0].id);
      })
      .catch(() => {
        if (!cancelled) setVisits([]);
      })
      .finally(() => {
        if (!cancelled) setVisitsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPatient, requireVisit, onSelectVisitId, selectedVisitId]);

  const handleSelectPatient = useCallback(
    (p: { id: string; firstName?: string; lastName?: string; mrn?: string }) => {
      onSelectPatient({
        id: p.id,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        mrn: p.mrn,
      });
      onSelectVisitId('');
      setQuery('');
      setDebouncedQuery('');
      setShowDropdown(false);
    },
    [onSelectPatient, onSelectVisitId],
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
            <Select
              value={selectedVisitId}
              onValueChange={(v) => {
                if (v) onSelectVisitId(v);
              }}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Select a visit" />
              </SelectTrigger>
              <SelectContent>
                {visits.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.visitType.toUpperCase()} - {formatDate(v.visitDate)}{' '}
                    {v.status ? `(${v.status})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="font-label text-xs p-2 rounded-lg bg-secondary/10 text-secondary">
              No active visits found for this patient.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
