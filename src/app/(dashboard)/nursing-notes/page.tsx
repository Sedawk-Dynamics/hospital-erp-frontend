'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

interface NursingNote {
  id: string;
  patientId: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  nurseId: string;
  nurse: { firstName: string; lastName: string };
  visitId?: string;
  admissionId?: string;
  noteType: 'assessment' | 'care_plan' | 'intervention' | 'evaluation' | 'shift_note';
  content: string;
  vitalsSummary?: string;
  painAssessment?: string;
  medicationsGiven?: string;
  isSigned: boolean;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const noteTypeLabels: Record<string, string> = {
  assessment: 'Assessment',
  care_plan: 'Care Plan',
  intervention: 'Intervention',
  evaluation: 'Evaluation',
  shift_note: 'Shift Note',
};

export default function NursingNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<NursingNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/progress-notes/nursing', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
        },
      });
      setNotes(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch nursing notes');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const columns: Column<NursingNote>[] = [
    {
      key: 'patient',
      label: 'Patient',
      sortable: true,
      render: (note) => (
        <button
          onClick={() => router.push(`/patients/${note.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {note.patient?.firstName} {note.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'nurse',
      label: 'Nurse',
      render: (note) =>
        note.nurse ? `${note.nurse.firstName} ${note.nurse.lastName}` : '-',
    },
    {
      key: 'noteType',
      label: 'Type',
      render: (note) => (
        <Badge variant="secondary">
          {noteTypeLabels[note.noteType] || note.noteType}
        </Badge>
      ),
    },
    {
      key: 'content',
      label: 'Summary',
      render: (note) => (
        <span className="max-w-[250px] truncate block text-muted-foreground text-sm">
          {note.content?.slice(0, 100)}{note.content?.length > 100 ? '...' : ''}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (note) => {
        try {
          return format(new Date(note.createdAt), 'MMM dd, yyyy HH:mm');
        } catch {
          return note.createdAt;
        }
      },
    },
    {
      key: 'isSigned',
      label: 'Signed',
      render: (note) => (
        <StatusBadge
          status={note.isSigned ? 'Yes' : 'No'}
          variant={note.isSigned ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (note) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/nursing-notes/${note.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nursing Notes"
        description="Manage nursing assessment and care notes"
        action={
          <Button onClick={() => router.push('/nursing-notes/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Nursing Note
          </Button>
        }
      />

      <DataTable
        columns={columns as any}
        data={notes as any}
        searchPlaceholder="Search by patient name or MRN..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No nursing notes found."
      />
    </div>
  );
}
