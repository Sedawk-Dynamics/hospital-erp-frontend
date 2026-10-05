'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Lock,
  Pin,
  Plus,
  RefreshCw,
  Stethoscope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/date-utils';
import { apiPut } from '@/lib/api';
import { useProgressNotes, type ProgressNote, type ProgressNotePinEntry } from '@/hooks/use-doctor';
import { VoiceInputButton } from '@/components/doctor/voice-input-button';

const DISCHARGE_SECTIONS: Array<{
  key: ProgressNotePinEntry['dischargeSection'];
  label: string;
}> = [
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'hospital_course', label: 'Hospital Course' },
  { key: 'procedure', label: 'Procedure' },
  { key: 'medication', label: 'Medication' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'advice', label: 'Advice' },
  { key: 'general', label: 'General' },
];

// Human labels for the ProgressNoteType enum.
const NOTE_TYPE_LABELS: Record<string, string> = {
  daily_soap_round: 'Daily SOAP Round',
  post_op_note: 'Post-Op Note',
  procedure_note: 'Procedure Note',
  consultation_note: 'Consultation Note',
  op_clinic_visit: 'OP Clinic Visit',
};

// Parse a note's content into its structured parts so the card can render the
// SOAP markers as tags instead of inline prefixes.
//   - `[Progress: X]`      → condition tag
//   - `S (Subjective): …`  → { tag: 'S', label: 'Subjective', text }
//   - anything else        → a plain line
type ParsedSection = { tag: string; label: string; text: string };
function parseNoteContent(content?: string): {
  condition: string | null;
  sections: ParsedSection[];
  other: string[];
} {
  const raw = (content ?? '').replace(/\*\*/g, '');
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  let condition: string | null = null;
  const sections: ParsedSection[] = [];
  const other: string[] = [];
  for (const line of lines) {
    const prog = line.match(/^\[Progress:\s*(.+?)\]$/i);
    if (prog) {
      condition = prog[1];
      continue;
    }
    const soap = line.match(/^([SOAP])\s*\(([^)]*)\):\s*(.*)$/);
    if (soap) {
      sections.push({ tag: soap[1], label: soap[2], text: soap[3] });
      continue;
    }
    other.push(line);
  }
  return { condition, sections, other };
}

function pinTextFromNote(note: ProgressNote): string {
  const raw = (note.content ?? '').replace(/\*\*/g, '').trim();
  if (!raw) return '';
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const cleaned = lines
    .filter((l) => !/^\[Progress:[^\]]*\]$/i.test(l))
    .map((l) => l.replace(/^[SOAP]\s*\([^)]*\):\s*/, ''))
    .join('\n')
    .trim();
  return cleaned || raw;
}

function SectionBadge({ section }: { section: ProgressNotePinEntry['dischargeSection'] }) {
  const label = DISCHARGE_SECTIONS.find((s) => s.key === section)?.label ?? section;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
      <Pin className="h-2 w-2" />
      {label}
    </span>
  );
}

// ── Compact note card ───────────────────────────────────────

function NoteEntry({
  note,
  onAddPin,
  onRefreshParent,
}: {
  note: ProgressNote;
  onAddPin: (note: ProgressNote) => void;
  onRefreshParent: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const [removingPinId, setRemovingPinId] = useState<string | null>(null);

  const isSigned = note.status === 'finalized';
  const doctor = note.doctor?.user
    ? `Dr. ${note.doctor.user.firstName} ${note.doctor.user.lastName ?? ''}`.trim()
    : 'Attending';

  const typeLabel = note.noteType
    ? NOTE_TYPE_LABELS[note.noteType] ?? note.noteType
    : null;
  const parsed = useMemo(() => parseNoteContent(note.content), [note.content]);
  // Short one-liner shown while collapsed so the card hints at its contents.
  const previewText = useMemo(
    () => parsed.sections.map((s) => s.text).join(' · ') || parsed.other.join(' '),
    [parsed],
  );

  const removePin = async (pinId: string) => {
    setRemovingPinId(pinId);
    try {
      // Remove a pin by sending the remaining pins via the note update
      // endpoint — the service replaces the entire pin collection.
      const remaining = (note.pins ?? [])
        .filter((p) => p.id !== pinId)
        .map((p) => ({ dischargeSection: p.dischargeSection, content: p.content }));
      await apiPut(`/progress-notes/${note.id}`, { pins: remaining });
      queryClient.invalidateQueries({ queryKey: ['doctor', 'progress-notes'] });
      onRefreshParent();
      toast.success('Pin removed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to remove pin');
    } finally {
      setRemovingPinId(null);
    }
  };

  return (
    <div className="rounded-lg bg-surface-container-lowest shadow-sanctuary p-2.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          {/* Title + type + hospital day */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {typeLabel && (
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                {typeLabel}
              </span>
            )}
            {note.hospitalDay != null && (
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                Day {note.hospitalDay}
              </span>
            )}
            {isSigned && (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-primary">
                <Lock className="h-2 w-2" />
                signed
              </span>
            )}
          </div>
          {/* Title + date-time on one row */}
          <div className="flex items-center  gap-2 flex-wrap">
            {note.noteTitle && (
              <span className="text-xs font-semibold text-foreground truncate">{note.noteTitle}</span>
            )}
            <span className="text-[10px] font-medium text-muted-foreground">
              {formatDateTime(note.createdAt)}
            </span>
          </div>
          {/* Author on the next line */}
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Stethoscope className="h-2.5 w-2.5" />
            {doctor}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-md p-1 hover:bg-muted"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Pin badges */}
      {note.pins && note.pins.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.pins.map((p) => (
            <span
              key={p.id}
              className="group inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary pl-1.5 pr-0.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            >
              <Pin className="h-2 w-2" />
              {DISCHARGE_SECTIONS.find((s) => s.key === p.dischargeSection)?.label ?? p.dischargeSection}
              <button
                type="button"
                onClick={() => removePin(p.id)}
                disabled={removingPinId === p.id}
                className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove pin"
              >
                {removingPinId === p.id ? (
                  <Loader2 className="h-2 w-2 animate-spin" />
                ) : (
                  <svg className="h-2 w-2" viewBox="0 0 8 8" fill="currentColor">
                    <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Full note body — only when expanded (chevron down). Collapsed shows
          just the header + pin badges. */}
      {expanded && (
        <div className="space-y-1.5 pt-0.5">
          {/* Condition tag */}
          {parsed.condition && (
            <div>
              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                {parsed.condition}
              </span>
            </div>
          )}

          {/* SOAP sections — the marker (S/O/A/P + label) is a tag, kept
              visually distinct from the actual note text beside it. */}
          {parsed.sections.length > 0 && (
            <div className="space-y-1.5">
              {parsed.sections.map((sec, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                    title={sec.label}
                  >
                    <span className="font-bold">{sec.tag}</span>
                    <span className="hidden sm:inline">· {sec.label}</span>
                  </span>
                  <p className="flex-1 text-[11px] text-on-surface-variant whitespace-pre-line leading-snug">
                    {sec.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Any non-SOAP free text */}
          {parsed.other.length > 0 && (
            <p className="text-[11px] text-on-surface-variant whitespace-pre-line leading-snug">
              {parsed.other.join('\n')}
            </p>
          )}
        </div>
      )}

      {/* Collapsed preview — a hint of the contents so the card reads as
          "has details", with the condition tag + a clamped one-liner. */}
      {!expanded && (parsed.condition || previewText) && (
        <div className="flex items-center gap-1.5">
          {parsed.condition && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
              {parsed.condition}
            </span>
          )}
          {previewText && (
            <p className="flex-1 min-w-0 truncate text-[11px] text-on-surface-variant leading-snug">
              {previewText}
            </p>
          )}
        </div>
      )}

      {/* <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 text-primary hover:text-primary/80"
          onClick={() => onAddPin(note)}
        >
          <Plus className="h-2.5 w-2.5" />
          Pin section
        </Button>
      </div> */}
    </div>
  );
}

// ── Add-pin dialog ──────────────────────────────────────────

function AddPinDialog({
  open,
  onOpenChange,
  note,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: ProgressNote | null;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<ProgressNotePinEntry['dischargeSection']>('diagnosis');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    if (open && note) {
      setContent(pinTextFromNote(note));
      setSection('diagnosis');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note?.id]);

  const handleSave = async () => {
    if (!note) return;
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error('Pin content is required.');
      return;
    }
    setSaving(true);
    try {
      const nextPins = [
        ...(note.pins ?? []).map((p) => ({
          dischargeSection: p.dischargeSection,
          content: p.content,
        })),
        { dischargeSection: section, content: trimmed },
      ];
      await apiPut(`/progress-notes/${note.id}`, { pins: nextPins });
      queryClient.invalidateQueries({ queryKey: ['doctor', 'progress-notes'] });
      onSaved();
      toast.success('Pinned to discharge summary');
      onOpenChange(false);
      setContent('');
      setSection('diagnosis');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to pin');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary" />
            Pin to Discharge Summary
          </DialogTitle>
          <DialogDescription>
            Pinned text is appended to the matching discharge summary section on next Refresh.
            Manual edits on the summary side are preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs mb-1 block">Discharge Section</Label>
            <select
              value={section}
              onChange={(e) =>
                setSection(e.target.value as ProgressNotePinEntry['dischargeSection'])
              }
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
            >
              {DISCHARGE_SECTIONS.map((ds) => (
                <option key={ds.key} value={ds.key}>
                  {ds.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Content</Label>
              <VoiceInputButton value={content} onChange={setContent} fieldLabel="Pin content" />
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Text to include in the discharge summary…"
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pin className="h-3 w-3" />}
            Pin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main panel ──────────────────────────────────────────────

export function DischargeProgressNotesPanel({
  admissionId,
  onRefreshSummary,
}: {
  admissionId: string;
  onRefreshSummary: () => void;
}) {
  const { data, isLoading, refetch } = useProgressNotes({
    admissionId,
    limit: 50,
  } as any);

  const notes = data?.data ?? [];

  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<ProgressNote | null>(null);

  // Count pins grouped by section for a quick header summary.
  const pinSummary = useMemo(() => {
    const counts: Partial<Record<ProgressNotePinEntry['dischargeSection'], number>> = {};
    for (const n of notes) {
      for (const p of n.pins ?? []) {
        counts[p.dischargeSection] = (counts[p.dischargeSection] ?? 0) + 1;
      }
    }
    return counts;
  }, [notes]);

  const totalPins = Object.values(pinSummary).reduce((sum, v) => sum + (v ?? 0), 0);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span className="font-headline text-sm font-semibold">Progress Notes</span>
            <span className="text-[10px] text-muted-foreground">({notes.length})</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3 w-3" />
            Reload
          </Button>
        </div>

        {totalPins > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t">
            <span className="text-[10px] text-muted-foreground">
              {totalPins} pinned across:
            </span>
            {Object.entries(pinSummary).map(([k, v]) =>
              v && v > 0 ? (
                <span
                  key={k}
                  className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                >
                  {DISCHARGE_SECTIONS.find((s) => s.key === k)?.label ?? k}: {v}
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-6 text-center text-xs text-muted-foreground">
            No progress notes found for this admission.
          </div>
        ) : (
          notes.map((n) => (
            <NoteEntry
              key={n.id}
              note={n}
              onAddPin={(note) => {
                setPinTarget(note);
                setPinDialogOpen(true);
              }}
              onRefreshParent={onRefreshSummary}
            />
          ))
        )}
      </div>

      <AddPinDialog
        open={pinDialogOpen}
        onOpenChange={(open) => {
          setPinDialogOpen(open);
          if (!open) setPinTarget(null);
        }}
        note={pinTarget}
        onSaved={onRefreshSummary}
      />
    </div>
  );
}
