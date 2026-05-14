'use client';

import { useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { useDicomWorklist } from '@/hooks/use-dicom';

const MODALITIES = ['', 'xray', 'ct', 'mri', 'ultrasound', 'mammography', 'fluoroscopy', 'angiography', 'echo', 'other'];

export default function DicomWorklistPage() {
  const [modality, setModality] = useState('');
  const [status, setStatus] = useState('');
  const { data, isLoading, refetch } = useDicomWorklist({
    modality: modality || undefined,
    status: status || undefined,
  });
  const entries = data ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> DICOM Modality Worklist
          </h1>
          <p className="text-xs text-muted-foreground">
            Scheduled imaging requests in MWL-compatible format. Modalities query this to pre-fill patient data.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={modality || 'all'} onValueChange={(v) => setModality(v === 'all' ? '' : (v ?? ''))}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Modality" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modalities</SelectItem>
              {MODALITIES.filter(Boolean).map((m) => (
                <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : (v ?? ''))}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Worklist empty"
            description="No scheduled imaging requests match the current filters."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Accession #</TableHead>
                <TableHead>Patient ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Body Part</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.requestId}>
                  <TableCell className="font-mono text-xs">{e.accessionNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{e.patient.patientId}</TableCell>
                  <TableCell className="font-medium">
                    {e.patient.patientName.replace(/\^/g, ' ').trim()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{e.scheduledProcedureStep.modality}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{e.scheduledProcedureStep.bodyPart ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.scheduledProcedureStep.scheduledProcedureStepStartDate
                      ? formatDateTimeAmPm(e.scheduledProcedureStep.scheduledProcedureStepStartDate)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-sm">{e.scheduledProcedureStep.room ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={e.scheduledProcedureStep.urgency === 'stat' ? 'destructive' : 'outline'} className="text-xs">
                      {e.scheduledProcedureStep.urgency}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{e.scheduledProcedureStep.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
