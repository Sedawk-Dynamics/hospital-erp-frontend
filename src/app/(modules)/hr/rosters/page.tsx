'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRosters, usePublishRoster, useHrSettings, useUpdateHrSettings } from '@/hooks/use-hr';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';
import {
  addDays, fromLocalYmd, startOfWeek, toLocalYmd, weekDays, weekHeading, WEEKDAY_NAMES,
} from '../_components/roster-week';
import { AddShiftDialog, useCanManageHr } from '../_components/hr-create-dialogs';

const SHIFT_TONE: Record<string, string> = {
  morning: 'bg-amber-50 text-amber-700 border-amber-200',
  afternoon: 'bg-orange-50 text-orange-700 border-orange-200',
  night: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  general: 'bg-sky-50 text-sky-700 border-sky-200',
};

export default function HrRostersPage() {
  // Gap 313: the week starts on the tenant's HR "roster week start day"
  // (default Sunday). `anchor` is any date inside the shown week, so a change
  // of setting re-anchors the same week; prev/next move it by 7 days.
  const { data: hrSettings } = useHrSettings();
  const updateHrSettings = useUpdateHrSettings();
  const weekStartDay = hrSettings?.rosterWeekStartDay ?? 0;
  const [anchor, setAnchor] = useState(() => new Date());
  const weekStart = startOfWeek(anchor, weekStartDay);
  // One list of local-date keys drives the query, the columns and the heading.
  const days = weekDays(weekStart);
  const canManage = useCanManageHr();
  const today = toLocalYmd(new Date());

  const { data, isLoading } = useRosters({ fromDate: days[0], toDate: days[6], limit: 200 });
  const publish = usePublishRoster();

  const rows = (data?.data ?? []) as Array<{
    id: string;
    shiftDate: string;
    shiftType: 'morning' | 'afternoon' | 'night' | 'general';
    startTime: string;
    endTime: string;
    role?: string | null;
    status: string;
    staff?: { user?: { firstName: string; lastName?: string | null } };
    ward?: { name: string } | null;
    department?: { name: string };
  }>;

  // Group by date
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.shiftDate.slice(0, 10);
    const arr = byDate.get(key) ?? [];
    arr.push(r);
    byDate.set(key, arr);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Duty Rosters</h1>
          <p className="text-sm text-on-surface-variant">
            {weekHeading(days)} — coverage by shift, ward, and role.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage ? (
            <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              Week starts
              <select
                aria-label="Roster week start day"
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={weekStartDay}
                disabled={updateHrSettings.isPending}
                onChange={(e) =>
                  updateHrSettings.mutate(
                    { rosterWeekStartDay: Number(e.target.value) },
                    {
                      onSuccess: (s) => toast.success(`Roster weeks now start on ${WEEKDAY_NAMES[s.rosterWeekStartDay]}`),
                      onError: (err) => toast.error(getApiErrorMessage(err, 'Could not save the week start day')),
                    },
                  )
                }
              >
                {WEEKDAY_NAMES.map((name, i) => (
                  <option key={name} value={i}>{name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setAnchor((a) => addDays(a, -7))} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>This week</Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor((a) => addDays(a, 7))} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {canManage && <AddShiftDialog defaultDate={days.includes(today) ? today : days[0]!} />}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-7">
          {days.map((day) => {
            const items = byDate.get(day) ?? [];
            return (
              <Card key={day} className="min-h-[160px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-on-surface-variant">
                    {fromLocalYmd(day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 pt-0">
                  {items.length === 0 ? (
                    <p className="text-xs text-on-surface-variant">No shifts.</p>
                  ) : (
                    items.map((r) => (
                      <div key={r.id} className="rounded-md border bg-card p-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className={SHIFT_TONE[r.shiftType] ?? ''}>{r.shiftType}</Badge>
                          {r.status === 'scheduled' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => publish.mutate(r.id)}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />Publish
                            </Button>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide text-emerald-600">{r.status}</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs font-medium">
                          {r.staff?.user?.firstName} {r.staff?.user?.lastName ?? ''}
                        </div>
                        <div className="text-[11px] text-on-surface-variant">
                          {r.role ?? r.department?.name ?? '—'}{r.ward?.name ? ` · ${r.ward.name}` : ''}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
