'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

interface ProgressNote {
  id: string;
  patientId: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  visitId?: string;
  authorId: string;
  author: { firstName: string; lastName: string };
  noteType: 'soap' | 'progress' | 'procedure' | 'consultation';
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  content?: string;
  isSigned: boolean;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const noteTypeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  soap: 'default',
  progress: 'secondary',
  procedure: 'outline',
  consultation: 'secondary',
};

export default function ProgressNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<ProgressNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/progress-notes', {
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
      toast.error('Failed to fetch progress notes');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const getSummary = (note: ProgressNote): string => {
    const text = note.content || note.subjective || note.assessment || note.objective || note.plan || '';
    if (text.length > 200) {
      return text.slice(0, 200) + '...';
    }
    return text || '-';
  };

  const columns: Column<ProgressNote>[] = [
    {
      key: 'patient',
      label: 'Patient Name',
      sortable: true,
      render: (note) => (
        <button
          onClick={() => router.push(`/patients/${note.patient?.id || note.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {note.patient?.firstName} {note.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'author',
      label: 'Author',
      render: (note) =>
        note.author
          ? `Dr. ${note.author.firstName} ${note.author.lastName}`
          : '-',
    },
    {
      key: 'noteType',
      label: 'Type',
      render: (note) => (
        <Badge variant={noteTypeVariant[note.noteType] || 'secondary'}>
          {note.noteType.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (note) => {
        try {
          return formatDate(note.createdAt);
        } catch {
          return note.createdAt;
        }
      },
    },
    {
      key: 'summary',
      label: 'Summary',
      render: (note) => (
        <span className="text-muted-foreground text-sm line-clamp-2">
          {getSummary(note)}
        </span>
      ),
    },
    {
      key: 'isSigned',
      label: 'Signed',
      render: (note) => (
        <StatusBadge status={note.isSigned ? 'yes' : 'no'} variant={note.isSigned ? 'success' : 'warning'} />
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
          onClick={() => router.push(`/progress-notes/${note.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress Notes"
        description="Manage clinical progress notes"
        action={
          <Button onClick={() => router.push('/progress-notes/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Progress Note
          </Button>
        }
      />
      <DataTable
        columns={columns as any}
        data={notes as any}
        searchPlaceholder="Search progress notes..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No progress notes found."
      />
    </div>
  );
}
