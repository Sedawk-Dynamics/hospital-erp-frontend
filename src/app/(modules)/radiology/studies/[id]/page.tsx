'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Maximize2, Image as ImageIcon, Layers, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { useDicomStudy, type DicomSeries, type DicomInstance } from '@/hooks/use-dicom';
import { DicomRenderer } from '@/components/radiology/dicom-renderer';

export default function DicomViewerPage() {
  const params = useParams<{ id: string }>();
  const studyId = params?.id;
  const { data: study, isLoading } = useDicomStudy(studyId ?? null);

  // Flatten all instances across series + study-level for the stack viewer.
  const allInstances = useMemo<DicomInstance[]>(() => {
    if (!study) return [];
    const arr: DicomInstance[] = [];
    study.series?.forEach((s) => s.instances.forEach((i) => arr.push(i)));
    study.instances?.forEach((i) => arr.push(i));
    return arr;
  }, [study]);

  const [activeSeriesId, setActiveSeriesId] = useState<string | 'all'>('all');
  const visibleInstances = useMemo(() => {
    if (activeSeriesId === 'all') return allInstances;
    if (!study) return [];
    const s = study.series?.find((x) => x.id === activeSeriesId);
    return s?.instances ?? [];
  }, [activeSeriesId, allInstances, study]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!study) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="Study not found"
        description="This DICOM study may have been removed."
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Link href="/radiology/studies">
          <Button size="sm" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-headline text-xl font-bold">
            {study.studyDescription ?? 'DICOM Study'}
          </h1>
          <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
            <span>Patient: <b>{study.patient?.firstName} {study.patient?.lastName}</b> · {study.patient?.mrn}</span>
            {study.modality && <Badge variant="outline">{study.modality}</Badge>}
            {study.studyDate && <span>Date: {formatDateTimeAmPm(study.studyDate)}</span>}
            <span className="font-mono">{study.studyInstanceUid}</span>
          </div>
        </div>
        {study.viewerUrl && (
          <a href={study.viewerUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="mr-1.5 h-4 w-4" /> Open OHIF
            </Button>
          </a>
        )}
      </div>

      <Tabs defaultValue="viewer">
        <TabsList>
          <TabsTrigger value="viewer">Viewer</TabsTrigger>
          <TabsTrigger value="series">Series ({study.series?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="viewer" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-3">
            {/* Series sidebar */}
            <aside className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-2 space-y-1 max-h-[600px] overflow-y-auto">
              <button
                onClick={() => setActiveSeriesId('all')}
                className={`w-full rounded p-2 text-xs text-left hover:bg-muted ${activeSeriesId === 'all' ? 'bg-primary/10' : ''}`}
              >
                <div className="font-medium">All series</div>
                <div className="text-[10px] text-muted-foreground">{allInstances.length} images</div>
              </button>
              {study.series?.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSeriesId(s.id)}
                  className={`w-full rounded p-2 text-xs text-left hover:bg-muted ${activeSeriesId === s.id ? 'bg-primary/10' : ''}`}
                >
                  <div className="font-medium">{s.seriesDescription ?? `Series ${s.seriesNumber}`}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {s.modality ?? '?'} · {s.instances.length} images
                  </div>
                </button>
              ))}
            </aside>

            <StackViewer instances={visibleInstances} />
          </div>
        </TabsContent>

        <TabsContent value="series" className="mt-3 space-y-3">
          {(study.series ?? []).length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No series"
              description="DICOM instances in this study aren't organized into series."
            />
          ) : (
            study.series!.map((s) => <SeriesCard key={s.id} series={s} />)
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-3">
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-2 text-sm">
            <Detail label="Study Instance UID" value={study.studyInstanceUid} mono />
            <Detail label="Accession Number" value={study.accessionNumber} mono />
            <Detail label="Modality" value={study.modality} />
            <Detail label="Description" value={study.studyDescription} />
            <Detail label="Number of Series" value={study.numberOfSeries} />
            <Detail label="Number of Instances" value={study.numberOfInstances} />
            <Detail label="Patient Name (DICOM)" value={study.patientName} />
            <Detail label="Patient DICOM ID" value={study.patientDicomId} mono />
            <Detail label="Referring Physician" value={study.referringPhysician} />
            <Detail label="Storage Path" value={study.storagePath} mono />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1 border-b last:border-b-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`col-span-2 ${mono ? 'font-mono text-xs' : ''}`}>
        {value === null || value === undefined || value === '' ? '—' : value}
      </div>
    </div>
  );
}

function SeriesCard({ series }: { series: DicomSeries }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold">{series.seriesDescription ?? `Series ${series.seriesNumber ?? '?'}`}</h3>
          <p className="text-xs text-muted-foreground">
            {series.modality ?? '?'} · {series.bodyPart ?? ''} · {series.instances.length} instances
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {series.instances.slice(0, 24).map((inst) => (
          <InstanceThumbnail key={inst.id} instance={inst} />
        ))}
      </div>
    </div>
  );
}

function InstanceThumbnail({ instance }: { instance: DicomInstance }) {
  const isImage = !!instance.mimeType && /^image\//.test(instance.mimeType);
  return (
    <div className="rounded-md bg-black aspect-square overflow-hidden flex items-center justify-center text-white">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={instance.fileUrl}
          alt={`Instance ${instance.instanceNumber}`}
          className="object-contain w-full h-full"
        />
      ) : (
        <div className="text-center px-2">
          <ImageIcon className="h-6 w-6 mx-auto mb-1 opacity-70" />
          <div className="text-[10px] opacity-70">#{instance.instanceNumber ?? '?'}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Stack viewer — basic image stack with prev/next + zoom controls.
// For full DICOM rendering (window/level, MPR), integrate
// @cornerstonejs/core + @cornerstonejs/dicom-image-loader and
// configure WADO-RS endpoints. This component renders preview
// images (PNG/JPEG) when available; for raw .dcm files it shows
// a placeholder and the file URL so the user can download.
// ============================================================
function StackViewer({ instances }: { instances: DicomInstance[] }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIdx(0);
  }, [instances.length]);

  if (instances.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <EmptyState
          icon={ImageIcon}
          title="No images"
          description="No DICOM instances in this view."
        />
      </div>
    );
  }

  const current = instances[idx];
  const isImage = !!current.mimeType && /^image\//.test(current.mimeType);

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(instances.length - 1, i + 1));

  return (
    <div className="bg-black rounded-xl shadow-sanctuary overflow-hidden flex flex-col" style={{ minHeight: 600 }}>
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 text-white text-xs">
        <div>
          Image {idx + 1} / {instances.length}
          {current.instanceNumber !== null && <span className="ml-2 opacity-70">#{current.instanceNumber}</span>}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={prev} disabled={idx === 0} className="h-7 text-white hover:bg-white/10">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={next} disabled={idx >= instances.length - 1} className="h-7 text-white hover:bg-white/10">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className="h-7 text-white hover:bg-white/10">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setZoom(1)} className="h-7 text-white hover:bg-white/10">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="h-7 text-white hover:bg-white/10">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-auto" style={{ minHeight: 500 }}>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.fileUrl}
            alt={`Instance ${current.instanceNumber}`}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              maxWidth: '100%',
              maxHeight: '500px',
            }}
            className="object-contain transition-transform"
          />
        ) : (
          // Native DICOM renderer (dicom-parser + canvas, with W/L controls).
          // For compressed transfer syntaxes the component shows an Open-OHIF
          // hint and a download link.
          <DicomRenderer fileUrl={current.fileUrl} zoom={zoom} className="w-full" />
        )}
      </div>
    </div>
  );
}
