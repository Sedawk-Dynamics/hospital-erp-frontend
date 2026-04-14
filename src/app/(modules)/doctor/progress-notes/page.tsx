'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  useProgressNotes,
  useCreateProgressNote,
  useSignProgressNote,
  usePatientSearch,
  type ProgressNote,
} from '@/hooks/use-doctor';
import { apiPut, apiPost, apiGet } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';
import {
  Plus,
  Pencil,
  Lock,
  Pin,
  Search,
  FileText,
  Loader2,
  UserRound,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// ── Constants ────────────────────────────────────────────────

const NOTE_TYPES = [
  'complaint',
  'vitals',
  'investigation',
  'discussion',
  'impression',
  'advice',
  'general',
] as const;

type NoteType = (typeof NOTE_TYPES)[number];

const NOTE_TYPE_COLORS: Record<NoteType, { bg: string; text: string }> = {
  complaint: { bg: 'bg-red-100', text: 'text-red-700' },
  vitals: { bg: 'bg-blue-100', text: 'text-blue-700' },
  investigation: { bg: 'bg-purple-100', text: 'text-purple-700' },
  discussion: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  impression: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  advice: { bg: 'bg-teal-100', text: 'text-teal-700' },
  general: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const SECTION_HEADERS = [
  'Chief Complaints',
  'Vitals',
  'Investigations',
  'Discussion',
  'Impressions',
  'Advice',
] as const;

const STATUS_FILTERS = ['all', 'active', 'signed'] as const;

// ── Helpers ──────────────────────────────────────────────────

function parseSections(content: string | undefined | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of SECTION_HEADERS) {
    result[h] = '';
  }

  if (!content) return result;

  // Check if content has section headers
  const hasHeaders = SECTION_HEADERS.some((h) => content.includes(`**${h}:**`));
  if (!hasHeaders) {
    // Put everything in the first section as general content
    result._raw = content;
    return result;
  }

  for (let i = 0; i < SECTION_HEADERS.length; i++) {
    const header = SECTION_HEADERS[i];
    const marker = `**${header}:**`;
    const idx = content.indexOf(marker);
    if (idx === -1) continue;

    const start = idx + marker.length;
    // Find the next section header or end of string
    let end = content.length;
    for (let j = i + 1; j < SECTION_HEADERS.length; j++) {
      const nextMarker = `**${SECTION_HEADERS[j]}:**`;
      const nextIdx = content.indexOf(nextMarker, start);
      if (nextIdx !== -1) {
        end = nextIdx;
        break;
      }
    }
    result[header] = content.slice(start, end).trim();
  }

  return result;
}

function buildContent(sections: Record<string, string>): string {
  const parts: string[] = [];
  for (const h of SECTION_HEADERS) {
    const value = (sections[h] || '').trim();
    if (value) {
      parts.push(`**${h}:**\n${value}`);
    }
  }
  return parts.join('\n\n');
}

function truncateContent(content: string | undefined | null, maxLines = 3): string {
  if (!content) return '';
  // Strip markdown bold markers for display
  const clean = content.replace(/\*\*/g, '');
  const lines = clean.split('\n').filter((l) => l.trim());
  if (lines.length <= maxLines) return lines.join('\n');
  return lines.slice(0, maxLines).join('\n') + '...';
}

function getPatientDisplayName(note: ProgressNote): string {
  if (note.patient) {
    return `${note.patient.firstName || ''} ${note.patient.lastName || ''}`.trim().toUpperCase() || 'Unknown';
  }
  return 'Unknown';
}

function getPatientMRN(note: ProgressNote): string {
  return note.patient?.mrn || '-';
}

function isOlderThan24Hours(iso: string): boolean {
  try {
    return Date.now() - new Date(iso).getTime() > 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// ── Main Page ────────────────────────────────────────────────

export default function ProgressNotesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Filters
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ProgressNote | null>(null);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [noteToSign, setNoteToSign] = useState<ProgressNote | null>(null);

  // Fetch notes
  const { data: notesData, isLoading } = useProgressNotes({
    page,
    limit: 20,
    search: patientSearchQuery || undefined,
  });

  const notes = notesData?.data ?? [];
  const meta = notesData?.meta;

  // Filter notes by status client-side
  const filteredNotes = useMemo(() => {
    if (statusFilter === 'all') return notes;
    if (statusFilter === 'signed') return notes.filter((n) => n.status === 'finalized');
    if (statusFilter === 'active') return notes.filter((n) => n.status !== 'finalized');
    return notes;
  }, [notes, statusFilter]);

  // Mutations
  const createMutation = useCreateProgressNote();
  const signMutation = useSignProgressNote();

  const handleOpenCreate = useCallback(() => {
    setEditingNote(null);
    setCreateDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((note: ProgressNote) => {
    setEditingNote(note);
    setCreateDialogOpen(true);
  }, []);

  const handleOpenSign = useCallback((note: ProgressNote) => {
    setNoteToSign(note);
    setSignDialogOpen(true);
  }, []);

  const handleConfirmSign = useCallback(async () => {
    if (!noteToSign) return;
    try {
      await signMutation.mutateAsync(noteToSign.id);
      toast.success('Note signed successfully');
      setSignDialogOpen(false);
      setNoteToSign(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to sign note');
    }
  }, [noteToSign, signMutation]);

  const handleTogglePin = useCallback(
    async (note: ProgressNote) => {
      try {
        await apiPut(`/progress-notes/${note.id}`, {
          pinToDischargeSummary: !note.pinToDischargeSummary,
        });
        queryClient.invalidateQueries({ queryKey: ['doctor', 'progress-notes'] });
        toast.success(
          note.pinToDischargeSummary
            ? 'Unpinned from discharge summary'
            : 'Pinned to discharge summary',
        );
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to update pin status');
      }
    },
    [queryClient],
  );

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Progress Notes</h1>
        <Button size="sm" className="gap-1.5" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          New Note
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f}
              variant={statusFilter === f ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs capitalize"
              onClick={() => {
                setStatusFilter(f);
                setPage(1);
              }}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Signed'}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by patient name..."
            value={patientSearchQuery}
            onChange={(e) => {
              setPatientSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-8 text-xs w-[240px]"
          />
        </div>
      </div>

      {/* Notes List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading notes...</span>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No progress notes found.</p>
          <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={handleOpenCreate}>
            <Plus className="h-3.5 w-3.5" />
            Create your first note
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={handleOpenEdit}
              onSign={handleOpenSign}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest shadow-sanctuary px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Showing {filteredNotes.length} of {meta.total} notes
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {meta.totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <NoteFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        editingNote={editingNote}
        userId={user?.id || ''}
        createMutation={createMutation}
        queryClient={queryClient}
      />

      {/* Sign Confirmation Dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Sign Progress Note
            </DialogTitle>
            <DialogDescription>
              Once signed, this note cannot be edited. Are you sure you want to sign this note?
            </DialogDescription>
          </DialogHeader>
          {noteToSign && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{getPatientDisplayName(noteToSign)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {truncateContent(noteToSign.content, 2)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSignDialogOpen(false);
                setNoteToSign(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleConfirmSign}
              disabled={signMutation.isPending}
            >
              {signMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              Confirm Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Note Card ────────────────────────────────────────────────

function NoteCard({
  note,
  onEdit,
  onSign,
  onTogglePin,
}: {
  note: ProgressNote;
  onEdit: (note: ProgressNote) => void;
  onSign: (note: ProgressNote) => void;
  onTogglePin: (note: ProgressNote) => void;
}) {
  const noteType = (note.noteType || 'general') as NoteType;
  const colors = NOTE_TYPE_COLORS[noteType] || NOTE_TYPE_COLORS.general;
  const isPinned = note.pinToDischargeSummary === true;
  const isIP = !!note.admissionId;
  const isAutoClosedOP = !isIP && isOlderThan24Hours(note.createdAt);

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4 flex flex-col gap-3 group hover:shadow-md transition-shadow">
      {/* Top row: patient info + date */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UserRound className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{getPatientDisplayName(note)}</p>
            <p className="text-[10px] text-on-surface-variant font-label">
              MRN: {getPatientMRN(note)}
            </p>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
          {formatDateTime(note.createdAt)}
        </span>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
            colors.bg,
            colors.text,
          )}
        >
          {noteType}
        </span>

        {note.status === 'finalized' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-semibold">
            <Lock className="h-2.5 w-2.5" />
            Signed
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">
            Unsigned
          </span>
        )}

        {isPinned && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
            <Pin className="h-2.5 w-2.5" />
            Pinned to Discharge
          </span>
        )}

        {isAutoClosedOP && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-semibold">
            <Clock className="h-2.5 w-2.5" />
            Auto-closed
          </span>
        )}

        {isIP && note.status !== 'finalized' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 px-2 py-0.5 text-[10px] font-semibold">
            <Clock className="h-2.5 w-2.5" />
            Active until discharge
          </span>
        )}
      </div>

      {/* Content preview */}
      <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-3 whitespace-pre-line min-h-[3lh]">
        {truncateContent(note.content, 3)}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-auto pt-1 border-t border-border/50">
        {note.status !== 'finalized' && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => onEdit(note)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-green-700 hover:text-green-800 hover:bg-green-50"
              onClick={() => onSign(note)}
            >
              <Lock className="h-3 w-3" />
              Sign
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 text-xs gap-1 ml-auto',
            isPinned && 'text-primary',
          )}
          onClick={() => onTogglePin(note)}
          title={isPinned ? 'Unpin from discharge summary' : 'Pin to discharge summary'}
        >
          <Pin className={cn('h-3 w-3', isPinned && 'fill-current')} />
          {isPinned ? 'Unpin' : 'Pin'}
        </Button>
      </div>
    </div>
  );
}

// ── Note Form Dialog ─────────────────────────────────────────

function NoteFormDialog({
  open,
  onOpenChange,
  editingNote,
  userId,
  createMutation,
  queryClient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingNote: ProgressNote | null;
  userId: string;
  createMutation: ReturnType<typeof useCreateProgressNote>;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const isEditing = !!editingNote;

  // Patient search
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    mrn?: string;
  } | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const { data: patientResults, isLoading: patientsLoading } = usePatientSearch(patientQuery);

  // Form state
  const [noteType, setNoteType] = useState<NoteType>('general');
  const [sections, setSections] = useState<Record<string, string>>(() => {
    const empty: Record<string, string> = {};
    for (const h of SECTION_HEADERS) empty[h] = '';
    return empty;
  });
  const [rawContent, setRawContent] = useState('');
  const [useRawMode, setUseRawMode] = useState(false);
  const [pinnedToDischarge, setPinnedToDischarge] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Structured clinical fields (impressions / discussions / conclusions)
  const [impressions, setImpressions] = useState('');
  const [discussions, setDiscussions] = useState('');
  const [conclusions, setConclusions] = useState('');
  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>([]);
  const [showDetails, setShowDetails] = useState(false);

  // Templates — per-doctor reusable custom-field definitions
  const { data: templatesData } = useQuery({
    queryKey: ['doctor', 'progress-note-templates'],
    queryFn: async () => {
      const res = await apiGet<Array<{ id: string; name: string; fields: Array<{ label: string; defaultValue?: string }>; isDefault?: boolean }>>(
        '/progress-notes/templates',
      );
      return res.data ?? [];
    },
  });
  const templates = templatesData ?? [];

  // Reset form when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen && editingNote) {
        // Populate from editing note
        setNoteType((editingNote.noteType as NoteType) || 'general');
        setPinnedToDischarge(editingNote.pinToDischargeSummary || false);
        setImpressions((editingNote as any).impressions || '');
        setDiscussions((editingNote as any).discussions || '');
        setConclusions((editingNote as any).conclusions || '');
        const cf = (editingNote as any).customFields;
        setCustomFields(Array.isArray(cf) ? cf : []);
        setShowDetails(!!((editingNote as any).impressions || (editingNote as any).discussions || (editingNote as any).conclusions || (Array.isArray(cf) && cf.length > 0)));
        setSelectedPatient(
          editingNote.patient
            ? {
                id: editingNote.patient.id,
                firstName: editingNote.patient.firstName || '',
                lastName: editingNote.patient.lastName || '',
                mrn: editingNote.patient.mrn,
              }
            : null,
        );
        setPatientQuery('');

        const parsed = parseSections(editingNote.content);
        if (parsed._raw !== undefined) {
          setUseRawMode(true);
          setRawContent(parsed._raw);
          const empty: Record<string, string> = {};
          for (const h of SECTION_HEADERS) empty[h] = '';
          setSections(empty);
        } else {
          setUseRawMode(false);
          setRawContent('');
          const { _raw, ...rest } = parsed;
          setSections(rest);
        }
      } else if (isOpen && !editingNote) {
        // Reset for new note
        setNoteType('general');
        setPinnedToDischarge(false);
        setSelectedPatient(null);
        setPatientQuery('');
        setUseRawMode(false);
        setRawContent('');
        setImpressions('');
        setDiscussions('');
        setConclusions('');
        // Auto-apply default template's fields if one exists
        const defaultTpl = templates.find((t) => t.isDefault);
        setCustomFields(
          defaultTpl
            ? defaultTpl.fields.map((f) => ({ label: f.label, value: f.defaultValue || '' }))
            : [],
        );
        setShowDetails(false);
        const empty: Record<string, string> = {};
        for (const h of SECTION_HEADERS) empty[h] = '';
        setSections(empty);
      }
      onOpenChange(isOpen);
    },
    [editingNote, onOpenChange],
  );

  const handleSectionChange = useCallback((header: string, value: string) => {
    setSections((prev) => ({ ...prev, [header]: value }));
  }, []);

  const handleSelectPatient = useCallback(
    (patient: { id: string; firstName: string; lastName: string; mrn?: string }) => {
      setSelectedPatient(patient);
      setPatientQuery('');
      setShowPatientDropdown(false);
    },
    [],
  );

  const finalContent = useMemo(() => {
    if (useRawMode) return rawContent.trim();
    return buildContent(sections);
  }, [useRawMode, rawContent, sections]);

  const canSave =
    (isEditing || selectedPatient) && finalContent.length > 0 && finalContent.length <= 10000;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setIsSaving(true);

    try {
      if (isEditing && editingNote) {
        // Update existing note
        await apiPut(`/progress-notes/${editingNote.id}`, {
          content: finalContent,
          noteType,
          pinToDischargeSummary: pinnedToDischarge,
          impressions: impressions || null,
          discussions: discussions || null,
          conclusions: conclusions || null,
          customFields: customFields.length > 0 ? customFields : undefined,
        });
        queryClient.invalidateQueries({ queryKey: ['doctor', 'progress-notes'] });
        toast.success('Note updated successfully');
      } else if (selectedPatient) {
        // Create visit first if needed
        let visitId: string | undefined;
        try {
          const visitResponse = await apiPost<{ id: string }>('/clinical/visits', {
            patientId: selectedPatient.id,
            doctorId: userId,
            visitType: 'op',
            visitDate: new Date().toISOString(),
          });
          visitId = visitResponse.data?.id;
        } catch {
          // Visit creation may fail if endpoint doesn't exist or patient already has an active visit.
          // Proceed without visitId — the backend create note hook may handle this.
        }

        await createMutation.mutateAsync({
          patientId: selectedPatient.id,
          visitId: visitId!,
          noteType,
          content: finalContent,
          pinToDischargeSummary: pinnedToDischarge,
          impressions: impressions || undefined,
          discussions: discussions || undefined,
          conclusions: conclusions || undefined,
          customFields: customFields.length > 0 ? customFields : undefined,
        } as any);
        toast.success('Note created successfully');
      }

      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  }, [
    canSave,
    isEditing,
    editingNote,
    selectedPatient,
    finalContent,
    noteType,
    pinnedToDischarge,
    userId,
    createMutation,
    queryClient,
    handleOpenChange,
  ]);

  const contentLength = finalContent.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Progress Note' : 'New Progress Note'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the progress note content below.'
              : 'Create a new progress note for a patient.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient Search (only for new notes) */}
          {!isEditing ? (
            <div className="space-y-1.5">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Patient
              </Label>
              {selectedPatient ? (
                <div className="flex items-center gap-2 rounded-lg border p-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <UserRound className="h-3.5 w-3.5 text-primary" />
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
                    onClick={() => setSelectedPatient(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patient by name or MRN..."
                    value={patientQuery}
                    onChange={(e) => {
                      setPatientQuery(e.target.value);
                      setShowPatientDropdown(true);
                    }}
                    onFocus={() => setShowPatientDropdown(true)}
                    className="pl-8 h-9 text-sm"
                  />
                  {showPatientDropdown && patientQuery.length >= 2 && (
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
                            onClick={() =>
                              handleSelectPatient({
                                id: p.id,
                                firstName: p.firstName || '',
                                lastName: p.lastName || '',
                                mrn: p.mrn,
                              })
                            }
                          >
                            <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
          ) : (
            <div className="flex items-center gap-2 rounded-lg border p-2.5 bg-muted/30">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {editingNote?.patient
                  ? `${editingNote.patient.firstName} ${editingNote.patient.lastName}`
                  : 'Unknown Patient'}
              </span>
              <Badge variant="outline" className="text-[10px] ml-auto">
                {editingNote?.patient?.mrn || '-'}
              </Badge>
            </div>
          )}

          {/* Note Type */}
          <div className="space-y-1.5">
            <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Note Type
            </Label>
            <Select
              value={noteType}
              onValueChange={(val) => {
                if (val) setNoteType(val as NoteType);
              }}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Select note type" />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="capitalize">{t}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content Sections */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Content
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {contentLength}/10000
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => {
                    if (useRawMode) {
                      // Switching to section mode — try to parse raw content
                      const parsed = parseSections(rawContent);
                      if (parsed._raw !== undefined) {
                        // Can't parse, put in first section
                        const newSections: Record<string, string> = {};
                        for (const h of SECTION_HEADERS) newSections[h] = '';
                        newSections[SECTION_HEADERS[0]] = parsed._raw;
                        setSections(newSections);
                      } else {
                        const { _raw, ...rest } = parsed;
                        setSections(rest);
                      }
                    } else {
                      // Switching to raw mode
                      setRawContent(buildContent(sections));
                    }
                    setUseRawMode(!useRawMode);
                  }}
                >
                  {useRawMode ? 'Section Mode' : 'Raw Mode'}
                </Button>
              </div>
            </div>

            {useRawMode ? (
              <Textarea
                placeholder="Enter note content..."
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                className="min-h-[200px] text-sm"
                maxLength={10000}
              />
            ) : (
              <div className="space-y-3 rounded-lg border p-3">
                {SECTION_HEADERS.map((header) => (
                  <div key={header} className="space-y-1">
                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                      {header}
                    </label>
                    <Textarea
                      placeholder={`Enter ${header.toLowerCase()}...`}
                      value={sections[header] || ''}
                      onChange={(e) => handleSectionChange(header, e.target.value)}
                      className="min-h-[60px] text-sm resize-none"
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            )}

            {contentLength > 10000 && (
              <p className="text-xs text-destructive">
                Content exceeds maximum length of 10,000 characters.
              </p>
            )}
          </div>

          {/* Structured clinical details */}
          <div className="rounded-lg border">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              <span>Clinical Details (impressions, discussions, conclusions, custom fields)</span>
              <span className="text-xs text-muted-foreground">{showDetails ? 'Hide' : 'Show'}</span>
            </button>
            {showDetails && (
              <div className="space-y-3 border-t p-3">
                {/* Template controls */}
                {templates.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Apply template:</span>
                    <select
                      value=""
                      onChange={(e) => {
                        const tpl = templates.find((t) => t.id === e.target.value);
                        if (tpl) {
                          setCustomFields(
                            tpl.fields.map((f) => ({ label: f.label, value: f.defaultValue || '' })),
                          );
                        }
                      }}
                      className="rounded-md border bg-background px-2 py-1"
                    >
                      <option value="">—</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                    Impressions
                  </label>
                  <Textarea
                    value={impressions}
                    onChange={(e) => setImpressions(e.target.value)}
                    className="min-h-[50px] text-sm resize-none"
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                    Discussions
                  </label>
                  <Textarea
                    value={discussions}
                    onChange={(e) => setDiscussions(e.target.value)}
                    className="min-h-[50px] text-sm resize-none"
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                    Conclusions
                  </label>
                  <Textarea
                    value={conclusions}
                    onChange={(e) => setConclusions(e.target.value)}
                    className="min-h-[50px] text-sm resize-none"
                    rows={2}
                  />
                </div>

                {/* Custom fields */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                      Custom Fields
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 text-[11px]"
                      onClick={() =>
                        setCustomFields((prev) => [...prev, { label: '', value: '' }])
                      }
                    >
                      + Add Field
                    </Button>
                  </div>
                  {customFields.map((cf, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        placeholder="Field label"
                        value={cf.label}
                        onChange={(e) =>
                          setCustomFields((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                          )
                        }
                        className="w-40 rounded-md border bg-background px-2 py-1 text-xs"
                      />
                      <input
                        placeholder="Value"
                        value={cf.value}
                        onChange={(e) =>
                          setCustomFields((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)),
                          )
                        }
                        className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCustomFields((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-muted-foreground hover:text-destructive text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {customFields.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] mt-1"
                      onClick={async () => {
                        const name = window.prompt('Template name?');
                        if (!name) return;
                        const makeDefault = window.confirm('Set as default template?');
                        try {
                          await apiPost('/progress-notes/templates', {
                            name,
                            fields: customFields.map((c) => ({ label: c.label, type: 'text' as const })),
                            isDefault: makeDefault,
                          });
                          queryClient.invalidateQueries({ queryKey: ['doctor', 'progress-note-templates'] });
                          toast.success('Template saved');
                        } catch {
                          toast.error('Failed to save template');
                        }
                      }}
                    >
                      Save as template
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pin to Discharge */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pinnedToDischarge}
              onChange={(e) => setPinnedToDischarge(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm">Pin to Discharge Summary</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSave}
            disabled={!canSave || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {isEditing ? 'Update Note' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
