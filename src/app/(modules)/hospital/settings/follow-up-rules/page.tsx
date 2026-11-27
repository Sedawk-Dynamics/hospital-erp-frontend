'use client';

// Follow-up fee rules: how long a return visit is free and what it costs after.

import Link from 'next/link';
import { ArrowLeft, CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFollowUpRules } from '@/hooks/use-follow-up-rules';
import { DepartmentFollowUpRules, HospitalFollowUpRuleCard } from '@/components/hospital/follow-up-rule-form';
import { rupees } from '@/lib/follow-up-fee';
import { getApiErrorMessage } from '@/lib/utils';

export default function FollowUpRulesPage() {
  const { data, isLoading, error } = useFollowUpRules();

  return (
    <div className="max-w-3xl space-y-4 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="mt-0.5 h-8 w-8"
          nativeButton={false}
          render={<Link href="/hospital/settings" aria-label="Back to settings" />}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="flex items-center gap-2 font-headline text-xl font-bold">
            <CalendarClock className="h-5 w-5 text-primary" /> Follow-up Rules
          </h1>
          <p className="text-xs text-muted-foreground">
            How long a return visit after a paid consultation is free, and what it costs after that. A
            doctor&apos;s own rule beats the department&apos;s, which beats the hospital&apos;s.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive">{getApiErrorMessage(error, 'Could not load the follow-up rules.')}</p>
      )}

      {data && (
        <>
          <HospitalFollowUpRuleCard rules={data} />
          <DepartmentFollowUpRules rules={data} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Doctors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                A doctor&apos;s own rule is set under{' '}
                <Link href="/hospital/settings/doctor-schedules" className="text-primary hover:underline">
                  Doctor Schedules &amp; Fees
                </Link>
                .
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Doctor</th>
                      <th className="py-1.5 pr-3 font-medium">Department</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Consultation fee</th>
                      <th className="py-1.5 font-medium">Follow-up rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.doctors.map((d) => {
                      const own = Object.values(d.override).some((v) => v !== null);
                      return (
                        <tr key={d.doctorId} className="border-b last:border-0">
                          <td className="py-1.5 pr-3">{d.name}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{d.department?.name ?? '—'}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {d.consultationFee === null ? '—' : rupees(d.consultationFee)}
                          </td>
                          <td className="py-1.5">
                            {d.summary ??
                              (d.override.freeDays
                                ? `Free for ${d.override.freeDays} days after a paid consultation`
                                : 'No rule set')}
                            {own && <span className="ml-1.5 text-xs text-primary">own rule</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
