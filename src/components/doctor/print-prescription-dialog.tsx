'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Printer, Pill, Loader2, FileText, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  usePatientSearch,
  usePrescriptions,
  usePrescriptionDetail,
} from '@/hooks/use-doctor';
import { useAuthStore } from '@/stores/auth-store';
import { printPrescription } from '@/lib/print-prescription';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { SelectedPatient } from './patient-visit-picker';

interface PrintPrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPatient?: SelectedPatient | null;
}

export function PrintPrescriptionDialog({
  open,
  onOpenChange,
  initialPatient = null,
}: PrintPrescriptionDialogProps) {
  const { user } = useAuthStore();

  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(initialPatient);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedRxId, setSelectedRxId] = useState<string>('');
  const [pendingPrintId, setPendingPrintId] = useState<string | null>(null);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedPatient(initialPatient);
      setQuery('');
      setDebouncedQuery('');
      setShowDropdown(false);
      setSelectedRxId('');
      setPendingPrintId(null);
    } else {
      setSelectedPatient(initialPatient);
    }
  }, [open, initialPatient]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: patientResults, isLoading: patientsLoading } = usePatientSearch(debouncedQuery);

  // Prescriptions for the selected patient by the current doctor
  const { data: rxData, isLoading: rxLoading } = usePrescriptions(
    selectedPatient
      ? { patientId: selectedPatient.id, doctorId: user?.id, limit: 20 }
      : undefined,
  );
  const prescriptions = useMemo(() => rxData?.data ?? [], [rxData]);

  // When user clicks Print on a row, fetch full detail (with items) and print once loaded
  const { data: detailToPrint, isFetching: detailFetching } = usePrescriptionDetail(
    pendingPrintId ?? '',
  );

  useEffect(() => {
    if (pendingPrintId && detailToPrint && detailToPrint.id === pendingPrintId) {
      printPrescription(detailToPrint as any);
      setPendingPrintId(null);
    }
  }, [pendingPrintId, detailToPrint]);

  const handleSelectPatient = useCallback(
    (p: { id: string; firstName?: string; lastName?: string; mrn?: string }) => {
      setSelectedPatient({
        id: p.id,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        mrn: p.mrn,
      });
      setSelectedRxId('');
      setQuery('');
      setDebouncedQuery('');
      setShowDropdown(false);
    },
    [],
  );

  const handlePrintRx = useCallback(
    (rxId: string) => {
      setSelectedRxId(rxId);
      setPendingPrintId(rxId);
    },
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Print Prescription
          </DialogTitle>
          <DialogDescription>
            Pick a patient and a prescription to print. The browser&apos;s print dialog will open —
            choose &ldquo;Save as PDF&rdquo; if you just need a file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Patient picker */}
          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Patient
            </Label>
            {selectedPatient ? (
              <div className="flex items-center gap-2 rounded-lg border p-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    MRN: {selectedPatient.mrn || '-'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSelectedPatient(null);
                    setSelectedRxId('');
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
                          <span className="font-medium">
                            {p.firstName} {p.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {p.mrn || ''}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        No patients found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prescription list */}
          {selectedPatient && (
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Prescriptions ({prescriptions.length})
              </Label>
              {rxLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">Loading...</span>
                </div>
              ) : prescriptions.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center">
                  <Pill className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No prescriptions for this patient yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {prescriptions.map((rx) => {
                    const itemCount = rx.items?.length ?? 0;
                    const firstDrug = rx.items?.[0]?.drugName || '—';
                    const moreCount = itemCount > 1 ? ` +${itemCount - 1}` : '';
                    const loading = pendingPrintId === rx.id && detailFetching;
                    return (
                      <div
                        key={rx.id}
                        className={cn(
                          'flex items-center justify-between rounded-lg border p-3 transition-colors',
                          selectedRxId === rx.id && 'bg-primary/5 border-primary/30',
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {firstDrug}
                            {moreCount && (
                              <span className="text-xs text-muted-foreground ml-1">{moreCount}</span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(rx.createdAt)} · {itemCount}{' '}
                            {itemCount === 1 ? 'drug' : 'drugs'} · {rx.status}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 ml-2"
                          onClick={() => handlePrintRx(rx.id)}
                          disabled={loading}
                        >
                          {loading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Printer className="h-3.5 w-3.5" />
                          )}
                          Print
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
