'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, FileImage, Download, FolderOpen, UserRound, Building2 } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/date-utils';
import { resolveAttachmentUrl, formatFileSize, isImageMime } from '@/hooks/use-lab-attachments';

/**
 * Everything on file for this person — the referral letters, outside scans and
 * old reports the patient uploaded from the portal under "My Documents", plus
 * anything staff attached to the record.
 *
 * These were write-only for a long time: the portal saved them happily but no
 * endpoint listed them, so a document the patient uploaded *for their doctor*
 * never reached one.
 */

export interface PatientDocument {
  id: string;
  documentType: string;
  title: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSizeBytes?: number | string | null;
  notes?: string | null;
  isVerified: boolean;
  createdAt: string;
  uploader?: string | null;
  /** Uploaded by the patient themselves rather than by hospital staff. */
  uploadedByPatient?: boolean;
  /** Set when the document was filed at a DIFFERENT hospital. */
  sourceHospital?: string | null;
}

export function patientDocumentsKey(patientId: string) {
  return ['patient', 'documents', patientId] as const;
}

export function PatientDocumentsPanel({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: patientDocumentsKey(patientId),
    queryFn: async () => {
      const res = await apiGet<PatientDocument[]>(`/patients/${patientId}/documents`);
      return res.data ?? [];
    },
    enabled: !!patientId,
  });

  const documents = data ?? [];

  if (isLoading) {
    return <p className="py-3 text-xs text-muted-foreground">Loading files…</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        <FolderOpen className="mx-auto mb-1 h-6 w-6 opacity-40" />
        No files on record. Anything the patient uploads from their portal appears here.
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {documents.map((d) => {
        const url = resolveAttachmentUrl(d.fileUrl);
        const isImg = isImageMime(d.mimeType ?? '');
        const Icon = isImg ? FileImage : FileText;
        const size = d.fileSizeBytes != null ? formatFileSize(Number(d.fileSizeBytes)) : null;
        return (
          <li key={d.id} className="flex items-start gap-2 rounded-md border bg-card px-2 py-1.5">
            {isImg ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 shrink-0 overflow-hidden rounded border bg-muted"
              >
                {/* Plain <img>: these are user uploads served from /uploads, not
                    build-time assets next/image can optimise. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={d.title} className="h-full w-full object-cover" />
              </a>
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium">{d.title}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="capitalize">{d.documentType.replace(/_/g, ' ')}</span>
                {size && <span>· {size}</span>}
                <span>· {formatDateTime(d.createdAt)}</span>
                {/* A clinician reads a document the patient brought in
                    differently from one the hospital produced. */}
                {d.uploadedByPatient && (
                  <Badge className="gap-0.5 bg-sky-100 text-[9px] text-sky-700">
                    <UserRound className="h-2.5 w-2.5" /> Patient upload
                  </Badge>
                )}
                {d.sourceHospital && (
                  <Badge className="gap-0.5 bg-violet-100 text-[9px] text-violet-700">
                    <Building2 className="h-2.5 w-2.5" /> {d.sourceHospital}
                  </Badge>
                )}
              </div>
              {d.notes && (
                <p className={cn('mt-0.5 text-[11px] text-muted-foreground')}>{d.notes}</p>
              )}
            </div>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              download={d.title}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Open / download"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
