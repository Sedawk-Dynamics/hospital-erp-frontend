'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRosters, usePublishRoster } from '@/hooks/use-hr';
import { CheckCircle2 } from 'lucide-react';

function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const SHIFT_TONE: Record<string, string> = {
  morning: 'bg-amber-50 text-amber-700 border-amber-200',
  afternoon: 'bg-orange-50 text-orange-700 border-orange-200',
  night: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  general: 'bg-sky-50 text-sky-700 border-sky-200',
};

export default function HrRostersPage() {
  const [weekStart] = useState(() => startOfWeek(new Date()));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const { data, isLoading } = useRosters({ fromDate: fmtDate(weekStart), toDate: fmtDate(weekEnd), limit: 200 });
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

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(fmtDate(d));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-headline">Duty Rosters</h1>
        <p className="text-sm text-on-surface-variant">
          Week of {weekStart.toLocaleDateString('en-IN')} — coverage by shift, ward, and role.
        </p>
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
                    {new Date(day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
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
