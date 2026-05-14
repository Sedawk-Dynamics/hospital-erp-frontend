'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ScanLine, Search, Image, Eye, Activity,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { useDicomStudies, useDicomWorklist } from '@/hooks/use-dicom';

export default function DicomStudiesPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useDicomStudies({
    search: search || undefined,
    limit: 50,
  });
  const studies = data?.data ?? [];

  const { data: worklist } = useDicomWorklist();

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <ScanLine className="h-5 w-5" /> DICOM Studies
        </h1>
        <p className="text-xs text-muted-foreground">
          Stored DICOM studies from CT, MRI, X-Ray, USG modalities. Click View to launch the embedded viewer.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Tile label="Total studies" value={data?.meta?.total ?? studies.length} icon={Image} />
        <Tile label="Pending worklist" value={worklist?.length ?? '—'} icon={Activity} />
        <Tile label="Modality mix" value={new Set(studies.map((s) => s.modality).filter(Boolean)).size} icon={ScanLine} />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by accession, description, patient, study UID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : studies.length === 0 ? (
          <EmptyState
            icon={Image}
            title="No DICOM studies"
            description="Studies pushed from imaging modalities (CT/MRI/X-Ray) appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Accession</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Series / Inst.</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studies.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.patient ? (
                      <div>
                        <div className="font-medium">{s.patient.firstName} {s.patient.lastName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{s.patient.mrn}</div>
                      </div>
                    ) : (s.patientName || '-')}
                  </TableCell>
                  <TableCell>
                    {s.modality ? <Badge variant="outline">{s.modality}</Badge> : '-'}
                  </TableCell>
                  <TableCell className="text-sm">{s.studyDescription ?? '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{s.accessionNumber ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.studyDate ? formatDateTimeAmPm(s.studyDate) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {s.numberOfSeries ?? 0} / {s.numberOfInstances ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/radiology/studies/${s.id}`}>
                      <Button size="sm" variant="outline">
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View
                      </Button>
                    </Link>
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

function Tile({
  label, value, icon: Icon,
}: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-headline text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="size-6 text-primary" />
      </div>
    </div>
  );
}
