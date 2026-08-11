'use client';

// ────────────────────────────────────────────────────────────────────────
// Laboratory home — the shell only.
//
// This file was 2,056 lines: the shell, seven tabs, four dialogs, the result
// editors and the shared table primitives all in one place. The pieces now live
// under components/laboratory/home/ and this is just the role-aware frame that
// arranges them.
// ────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Inbox, ShieldCheck, UserX } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLabRole } from '@/hooks/use-lab-role';
import { LabDashboardSummary } from '@/components/laboratory/lab-dashboard-summary';
import { LabStatusTab, TestReportTab } from '@/components/laboratory/home/worklist-tabs';
import {
  IncomingOrderTab,
  TechniciansTab,
  OutsourceTab,
} from '@/components/laboratory/home/supervisor-tabs';

export default function LaboratoryHomePage() {
  // Nine tabs were shown to everyone, in no particular order, and three of them
  // were views of the same table. Each role now gets the surface it works from:
  //
  //   technician  — the bench: work queue, results to enter, what it finished
  //   supervisor  — intake to accept, the approval queue, then the same bench
  //                 views plus the two management ones
  //
  // Nothing was taken away from either role; the tabs a technician cannot act
  // on (accept/approve) were already 403 on the server and merely looked
  // available.
  const { isSupervisor } = useLabRole();
  const [tab, setTab] = useState(isSupervisor ? 'intake' : 'worklist');
  // Set by the Overdue card and the Overdue panel so the number and the list
  // are one click apart rather than a page apart.
  const [seedOverdue, setSeedOverdue] = useState(false);

  const showOverdue = () => {
    setSeedOverdue(true);
    setTab('worklist');
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-baseline justify-between">
        <h1 className="font-headline text-xl font-bold">Laboratory</h1>
        <span className="font-label text-[11px] uppercase tracking-widest text-on-surface-variant">
          {isSupervisor ? 'Supervisor' : 'Technician'}
        </span>
      </div>

      <LabDashboardSummary isSupervisor={isSupervisor} onShowOverdue={showOverdue} />

      <Tabs value={tab} onValueChange={(v) => setTab(v ?? 'worklist')}>
        <TabsList variant="line" className="flex-wrap">
          {/* Intake is the supervisor's first job — accept and assign. */}
          {isSupervisor && (
            <TabsTrigger value="intake">
              <Inbox className="mr-1.5 size-3.5" /> Intake
            </TabsTrigger>
          )}
          <TabsTrigger value="worklist">Work Queue</TabsTrigger>
          {isSupervisor && (
            <TabsTrigger value="awaiting-approval">
              <ShieldCheck className="mr-1.5 size-3.5" /> Awaiting Approval
            </TabsTrigger>
          )}
          <TabsTrigger value="results">Published</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="closed">
            <UserX className="mr-1.5 size-3.5" /> Cancelled
          </TabsTrigger>
          {isSupervisor && <TabsTrigger value="technicians">Workload</TabsTrigger>}
          {isSupervisor && <TabsTrigger value="outsource">Outsourced</TabsTrigger>}
        </TabsList>

        {isSupervisor && (
          <TabsContent value="intake" className="pt-4">
            <IncomingOrderTab />
          </TabsContent>
        )}
        <TabsContent value="worklist" className="pt-4">
          <LabStatusTab
            variant="pending"
            seedOverdue={seedOverdue}
            onSeedConsumed={() => setSeedOverdue(false)}
          />
        </TabsContent>
        {isSupervisor && (
          <TabsContent value="awaiting-approval" className="pt-4">
            <TestReportTab lockedStatus="review" />
          </TabsContent>
        )}
        <TabsContent value="results" className="pt-4">
          <TestReportTab lockedStatus="published" />
        </TabsContent>
        <TabsContent value="completed" className="pt-4">
          <LabStatusTab variant="completed" />
        </TabsContent>
        <TabsContent value="closed" className="pt-4">
          <LabStatusTab variant="cancelled" />
        </TabsContent>
        {isSupervisor && (
          <TabsContent value="technicians" className="pt-4">
            <TechniciansTab />
          </TabsContent>
        )}
        {isSupervisor && (
          <TabsContent value="outsource" className="pt-4">
            <OutsourceTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
