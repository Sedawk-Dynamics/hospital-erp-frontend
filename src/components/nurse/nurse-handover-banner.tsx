'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ArrowDownLeft, ArrowRight, ClipboardList, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useHandovers, useAcknowledgeHandover, type ShiftHandover } from '@/hooks/use-nurse';
import { useAuthStore } from '@/stores/auth-store';

const SHIFT_LABEL: Record<string, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    night: 'Night',
    general: 'General',
};

export default function NurseHandoverBanner({
    shiftType,
    shiftDate,
}: {
    shiftType: 'morning' | 'afternoon' | 'night' | 'general';
    shiftDate: string;
}) {
    const { user } = useAuthStore();
    const { data: notesData } = useHandovers({ shiftType, shiftDate, isAcknowledged: 'false' });
    const notes = (notesData?.data ?? []).filter(
        (n) => n.fromNurseId !== user?.id && (!n.toNurseId || n.toNurseId === user?.id),
    );

    if (notes.length === 0) return null;


    return (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-900">
                <ArrowDownLeft className="h-4 w-4" />
                {notes.length} shift note{notes.length === 1 ? '' : 's'} handed to you from the previous shift
            </div>

            <ul className="space-y-2">
                {notes.slice(0,2).map((note) => (
                    <HandoverNoteRow key={note.id} note={note} />
                ))}
            </ul>

            {notes.length > 2 ? (
                <div className="mt-2 flex items-center justify-between border-t border-emerald-200 pt-2 text-sm">
                    <span className="font-extrabold text-emerald-800">
                        +{notes.length - 2} more handover note{notes.length - 2 === 1 ? '' : 's'}
                    </span>
                    <Link
                        href="/nurse/handover"
                        className="inline-flex items-center gap-1 font-medium text-sm rounded-md border border-emerald-200 bg-white px-2 py-0.5  text-emerald-800 hover:bg-emerald-50"
                    >
                        See all
                        <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
            ) : null}
        </div>
    );
}

function HandoverNoteRow({ note }: { note: ShiftHandover }) {
    const fromName = note.fromNurse
        ? `${note.fromNurse.firstName} ${note.fromNurse.lastName ?? ''}`.trim()
        : 'Previous nurse';

    const acknowledge = useAcknowledgeHandover();

    const handleAcknowledge = async (note: ShiftHandover) => {
        try {
            await acknowledge.mutateAsync(note.id);
            toast.success('Handover acknowledged');
        } catch {
            toast.error('Failed to acknowledge');
        }
    };

    return (
        <li className="rounded-md border border-emerald-200 bg-white p-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-900">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold">{fromName}</span>
                <ArrowRight className="h-3 w-3 opacity-60" />
                <span className="font-semibold">You</span>
                {note.ward?.name ? (
                    <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{note.ward.name}</span>
                    </>
                ) : null}
                <span className="text-muted-foreground">
                    {SHIFT_LABEL[note.shiftType] ?? note.shiftType} · {format(parseISO(note.shiftDate), 'dd/MM')} @{' '}
                    {format(new Date(note.createdAt), 'HH:mm')}
                </span>
            </div>

            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-emerald-900/90">
                <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                {note.content}
            </p>

            <div className="mt-2 flex justify-end">
                {note.isAcknowledged ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Acknowledged{note.acknowledgedAt ? ` at ${format(new Date(note.acknowledgedAt), 'HH:mm')}` : ''}
                    </span>
                ) : (
                    <Button onClick={()=>handleAcknowledge(note)} disabled={acknowledge.isPending} size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {acknowledge.isPending ? 'Acknowledging…' : 'Acknowledge'}
                    </Button>
                )}
            </div>
        </li>
    );
}





















