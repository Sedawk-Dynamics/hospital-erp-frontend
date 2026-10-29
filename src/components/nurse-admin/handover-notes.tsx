'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowRight, CheckCircle2, ClipboardList, Clock } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWards } from '@/hooks/use-clinical';
import { useHandovers, type ShiftHandover } from '@/hooks/use-nurse';

const SHIFTS: Array<{ value: string; label: string; hours: string }> = [
  { value: 'morning', label: 'Morning', hours: '07:00 – 15:00' },
  { value: 'afternoon', label: 'Afternoon', hours: '15:00 – 23:00' },
  { value: 'night', label: 'Night', hours: '23:00 – 07:00' },
];

const SHIFT_LABEL: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
  general: 'General',
};

function nurseName(n?: { firstName: string; lastName?: string | null } | null, fallback = '—') {
  return n ? `${n.firstName} ${n.lastName ?? ''}`.trim() : fallback;
}

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HandoverNotes() {
  const [shiftDate, setShiftDate] = useState<string>(todayStr());
  const [shiftType, setShiftType] = useState<string>('morning');
  const [ward, setWard] = useState<string>('all');
  const { data: wards } = useWards();
  const {data:notes}=useHandovers({shiftDate,shiftType,wardId:ward==="all"?undefined:ward})
  const handoverNotes=notes?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Shift handover notes</h2>
        <p className="text-sm text-muted-foreground">
          Notes nurses have passed between shifts. Filter by date, shift, or ward.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Shift date</label>
            <Input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              className="mt-1 h-9"
            />
          </div>

          <div >
            <label className="text-xs font-medium text-muted-foreground">Shift</label>
            <Select
              value={shiftType}
              onValueChange={(value) => {
                if (value) setShiftType(value);
              }}
            >
              <SelectTrigger className="mt-1 h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label} <span className="text-muted-foreground">({s.hours})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Ward</label>
            <Select
              value={ward}
              onValueChange={(value) => {
                if (value) setWard(value);
              }}
            >
              <SelectTrigger className="mt-1 h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All wards</SelectItem>
                {(wards ?? []).map((w) => (
                  <SelectItem  key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {handoverNotes.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {handoverNotes.length} handover note{handoverNotes.length === 1 ? '' : 's'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {handoverNotes.map((note) => (
                <HandoverNoteRow key={note.id} note={note} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10">
            <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <ClipboardList className="h-8 w-8 opacity-50" />
              <p className="text-sm font-medium">No handover notes to show yet</p>
              <p className="text-xs">Handover notes for the selected filters will appear here.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HandoverNoteRow({ note }: { note: ShiftHandover }) {
  return (
    <li className="rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
          {nurseName(note.fromNurse, 'Previous nurse')}
        </span>
        <ArrowRight className="h-3 w-3 opacity-60" />
        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
          {nurseName(note.toNurse, 'Next shift')}
        </span>
        {note.ward?.name ? (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{note.ward.name}</span>
          </>
        ) : null}
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {SHIFT_LABEL[note.shiftType] ?? note.shiftType} ·{' '}
          {format(parseISO(note.shiftDate), 'dd/MM')} @ {format(new Date(note.createdAt), 'HH:mm')}
        </span>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-sm">
        <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
        {note.content}
      </p>

      <div className="mt-2 flex justify-end">
        {note.isAcknowledged ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Acknowledged
            {note.acknowledgedAt ? ` at ${format(new Date(note.acknowledgedAt), 'HH:mm')}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
            <Clock className="h-3.5 w-3.5" />
            Awaiting acknowledgement
          </span>
        )}
      </div>
    </li>
  );
}
