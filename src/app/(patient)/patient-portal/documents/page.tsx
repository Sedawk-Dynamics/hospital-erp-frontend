'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Folder, Upload, Trash2, FileText, Download } from 'lucide-react';
import { apiGet, apiDelete } from '@/lib/api';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

  const { data, isLoading } = useQuery({
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
      await apiClient.post('/patient-portal/documents', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', 'documents'] });
      setTitle('');
      setNotes('');
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/patient-portal/documents/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', 'documents'] }),
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate(file);
  };

  const docs = data ?? [];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Folder className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">My Documents</h1>
          <p className="text-xs text-muted-foreground">
            Upload external reports, prescriptions, or personal medical documents.
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold">Upload new document</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
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
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
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
        <p className="text-[11px] text-muted-foreground">
          Max 10MB. PDF, images, or Word docs.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Folder className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => {
            const fullUrl = d.fileUrl.startsWith('http') ? d.fileUrl : `${ORIGIN}${d.fileUrl}`;
            const sizeKB = d.fileSizeBytes ? Math.round(Number(d.fileSizeBytes) / 1024) : null;
            return (
              <div key={d.id} className="rounded-xl border-2 bg-card p-3 flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold truncate">{d.title}</p>
                    <Badge className="text-[10px] px-1.5 py-0 capitalize">
                      {d.documentType.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {d.notes && <p className="text-xs text-foreground/70 mt-0.5">{d.notes}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
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
                    className="p-2 hover:bg-muted rounded-md"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
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
