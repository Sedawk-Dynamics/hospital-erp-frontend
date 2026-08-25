'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Folder, Upload, Trash2, FileText, Download } from 'lucide-react';
import { apiGet, apiDelete } from '@/lib/api';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

interface DocumentEntry {
  id: string;
  title: string;
  documentType: string;
  fileUrl: string;
  fileSizeBytes?: number | null;
  mimeType?: string | null;
  notes?: string | null;
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

export default function MyDocumentsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('external_report');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading, error: listError } = useQuery({
    queryKey: ['patient', 'documents'],
    queryFn: async () => {
      const res = await apiGet<DocumentEntry[]>('/patient-portal/documents');
      return res.data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      if (title) fd.append('title', title);
      fd.append('documentType', docType);
      if (notes) fd.append('notes', notes);
      const res = await apiClient.post('/patient-portal/documents', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', 'documents'] });
      setTitle('');
      setNotes('');
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const uploadErrorMsg =
    upload.error && (upload.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
      || (upload.error as { message?: string } | null)?.message;
  const listErrorMsg =
    listError && (listError as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
      || (listError as { message?: string } | null)?.message;

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/patient-portal/documents/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', 'documents'] }),
    // Upload already reports failure inline (`uploadErrorMsg`); delete said
    // nothing at all, so a refused delete left the document on screen looking
    // like the click had missed.
    onError: (err) => toast.error(getApiErrorMessage(err) || 'Could not delete that document'),
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate(file);
  };

  const docs = data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Personal Vault
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          My Documents
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Upload external reports, prescriptions, or personal medical documents
        </p>
      </div>

      {/* Upload card */}
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-5 space-y-3">
        <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Upload new document
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="external_report">External Report</option>
            <option value="referral_letter">Referral Letter</option>
            <option value="id_proof">ID Proof</option>
            <option value="insurance_card">Insurance Card</option>
            <option value="consent_form">Consent Form</option>
            <option value="other">Other</option>
          </select>
        </div>
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx"
          onChange={onFileChange}
          className="hidden"
        />
        <div className="flex justify-end">
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {upload.isPending ? 'Uploading…' : 'Choose file & upload'}
          </Button>
        </div>
        <p className="font-label text-[11px] text-on-surface-variant">
          Max 10MB. PDF, images, or Word docs.
        </p>
        {uploadErrorMsg && (
          <p className="font-label text-xs text-error bg-error-container/40 rounded-lg px-3 py-2">
            Upload failed: {uploadErrorMsg}
          </p>
        )}
      </div>

      {listErrorMsg && (
        <div className="rounded-xl bg-error-container/40 text-on-error-container p-3">
          <p className="font-label text-xs">Could not load documents: {listErrorMsg}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
          <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
            <Folder className="h-5 w-5" />
          </div>
          <p className="font-label text-sm font-semibold text-on-surface">
            No documents uploaded yet
          </p>
          <p className="font-label text-xs text-on-surface-variant mt-1">
            Your uploaded files will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => {
            const fullUrl = d.fileUrl.startsWith('http') ? d.fileUrl : `${ORIGIN}${d.fileUrl}`;
            const sizeKB = d.fileSizeBytes ? Math.round(Number(d.fileSizeBytes) / 1024) : null;
            return (
              <div
                key={d.id}
                className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4 flex items-start gap-3"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-label text-sm font-bold text-on-surface truncate">{d.title}</p>
                    <span className="text-[10px] font-bold font-label px-2 py-0.5 rounded-full capitalize bg-tertiary-fixed text-on-tertiary-fixed-variant">
                      {d.documentType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {d.notes && (
                    <p className="font-label text-xs text-on-surface-variant mt-0.5">{d.notes}</p>
                  )}
                  <p className="font-label text-[10px] text-outline mt-1">
                    {new Date(d.createdAt).toLocaleDateString('en-IN')}
                    {sizeKB !== null && ` · ${sizeKB} KB`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  <button
                    onClick={() => remove.mutate(d.id)}
                    className="p-2 hover:bg-error-container/40 text-on-surface-variant hover:text-error rounded-lg transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
