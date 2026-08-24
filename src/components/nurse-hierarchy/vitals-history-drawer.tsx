'use client';

import { format, parseISO } from 'date-fns';
import { Loader2, Clock } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useVitalHistory, type Vital } from '@/hooks/use-vital-history';
import { formatTemperature, temperatureIn, temperatureUnitLabel, temperatureValue } from '@/lib/vitals-temperature';
import { useTemperatureUnit } from '@/stores/temperature-unit-store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vitalId: string | undefined;
}

/**
 * Sliding drawer showing the full correction chain for a single vital row.
 * Newest entry is surfaced first; superseded readings are struck through.
 */
export function VitalsHistoryDrawer({ open, onOpenChange, vitalId }: Props) {
  const { data: chain, isLoading } = useVitalHistory(vitalId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Vitals history</SheetTitle>
          <SheetDescription>
            Full audit chain — newest first. Superseded readings stay visible for traceability.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading history…
            </div>
          ) : !chain || chain.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No history available.
            </div>
          ) : (
            chain.map((v, idx) => <HistoryRow key={v.id} vital={v} isLatest={idx === 0} />)
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HistoryRow({ vital, isLatest }: { vital: Vital; isLatest: boolean }) {
  const [tempUnit] = useTemperatureUnit();
  const when = format(parseISO(vital.recordedAt), 'dd/MM/yyyy HH:mm');
  const who = vital.recorder
    ? `${vital.recorder.firstName} ${vital.recorder.lastName ?? ''}`
    : '—';
  const correctedBy =
    vital.corrector && vital.isCorrection
      ? `${vital.corrector.firstName} ${vital.corrector.lastName ?? ''}`
      : null;

  return (
    <div
      className={`rounded-lg border p-3 ${
        isLatest ? 'border-primary/40 bg-primary/5' : 'bg-muted/30'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {when} IST · Recorded by <span className="font-medium text-foreground">{who}</span>
        </div>
        <div className="flex items-center gap-1">
          {isLatest ? (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Current
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-muted text-muted-foreground line-through">
              Superseded
            </Badge>
          )}
          {vital.isCorrection ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              Correction
            </Badge>
          ) : null}
        </div>
      </div>

      {vital.correctionReason ? (
        <div className="mb-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          <span className="font-medium">Reason:</span> {vital.correctionReason}
          {correctedBy ? <span className="ml-2 text-amber-700">— {correctedBy}</span> : null}
        </div>
      ) : null}

      <div className={`grid grid-cols-3 gap-2 text-xs ${!isLatest ? 'opacity-70' : ''}`}>
        <Cell label="BP" value={bp(vital)} />
        <Cell label="Pulse" value={vital.pulseRate ?? '—'} />
        <Cell label={`Temp (${temperatureUnitLabel(tempUnit)})`} value={temperatureValue(vital.temperature, tempUnit)} />
        <Cell label="RR" value={vital.respiratoryRate ?? '—'} />
        <Cell label="SpO2 (%)" value={vital.oxygenSaturation ?? '—'} />
        <Cell label="Blood sugar" value={vital.bloodSugar ?? '—'} />
        <Cell label="Weight" value={vital.weightKg ?? '—'} />
        <Cell label="Height" value={vital.heightCm ?? '—'} />
        <Cell label="BMI" value={vital.bmi ?? '—'} />
      </div>
      {vital.notes ? (
        <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">{vital.notes}</div>
      ) : null}
    </div>
  );
}

function bp(v: Vital) {
  const sys = v.bloodPressureSystolic ?? '—';
  const dia = v.bloodPressureDiastolic ?? '—';
  return `${sys}/${dia}`;
}

function Cell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
