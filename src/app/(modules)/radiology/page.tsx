'use client';

// ────────────────────────────────────────────────────────────────────────
// Radiology home — the shell only.
//
// This file was 958 lines: the shell, seven tabs, four dialogs and its own copy
// of the table furniture. The pieces now live under components/radiology/home/
// and this is the role-aware frame that arranges them — the same shape the
// laboratory home was reduced to, which is the point: a supervisor moving
// between the two departments should be looking at the same screen.
//
// The flow both departments now run:
//
//   doctor orders → ADMIN accepts (takes payment at this counter, or posts it to
//   the patient's stay ledger) and assigns → RADIOLOGIST uploads into a draft
//   they own → Mark as Done → ADMIN approves & publishes → the doctor sees it.
// ────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Inbox, ShieldCheck, UserX } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useRadiologyRole } from '@/hooks/use-radiology-role';
import { RadiologyDashboardSummary } from '@/components/radiology/radiology-dashboard-summary';
import { ImagingWorklistTab } from '@/components/radiology/home/worklist-tabs';
import { ResultsTab } from '@/components/radiology/home/results-tab';

export default function RadiologyHomePage() {
  // Each role gets the surface it works from:
  //
  //   radiologist — the bench: studies cleared to scan, what it finished
  //   admin       — intake to accept, the approval queue, then the same bench
  //                 views plus the closed list
  //
  // Nothing was taken away from either role; the actions a radiologist cannot
  // perform (accept, approve) were already 403 on the server and merely looked
  // available.
  const { isRadiologyAdmin } = useRadiologyRole();
  const [tab, setTab] = useState(isRadiologyAdmin ? 'intake' : 'worklist');
  // Set by the Overdue card so the number and the list are one click apart
  // rather than a page apart.
  const [seedOverdue, setSeedOverdue] = useState(false);

  const showOverdue = () => {
    setSeedOverdue(true);
    setTab('worklist');
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-baseline justify-between">
        <h1 className="font-headline text-xl font-bold">Radiology</h1>
        <span className="font-label text-[11px] uppercase tracking-widest text-on-surface-variant">
          {isRadiologyAdmin ? 'Admin' : 'Radiologist'}
        </span>
      </div>

      <RadiologyDashboardSummary
        isRadiologyAdmin={isRadiologyAdmin}
        onShowOverdue={showOverdue}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v ?? 'worklist')}>
        <TabsList variant="line" className="flex-wrap">
          {/* Intake is the admin's first job — collect, accept, assign. */}
          {isRadiologyAdmin && (
            <TabsTrigger value="intake">
              <Inbox className="mr-1.5 size-3.5" /> Intake
            </TabsTrigger>
          )}
          <TabsTrigger value="worklist">Work Queue</TabsTrigger>
          {isRadiologyAdmin && (
            <TabsTrigger value="awaiting-approval">
              <ShieldCheck className="mr-1.5 size-3.5" /> Awaiting Approval
            </TabsTrigger>
          )}
          <TabsTrigger value="results">Published</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="closed">
            <UserX className="mr-1.5 size-3.5" /> Closed / No-show
          </TabsTrigger>
        </TabsList>

        {isRadiologyAdmin && (
          <TabsContent value="intake" className="pt-4">
            <ImagingWorklistTab variant="intake" />
          </TabsContent>
        )}
        <TabsContent value="worklist" className="pt-4">
          <ImagingWorklistTab
            variant="worklist"
            seedOverdue={seedOverdue}
            onSeedConsumed={() => setSeedOverdue(false)}
          />
        </TabsContent>
        {isRadiologyAdmin && (
          <TabsContent value="awaiting-approval" className="pt-4">
            <ResultsTab lockedStatus="finalized" />
          </TabsContent>
        )}
        <TabsContent value="results" className="pt-4">
          <ResultsTab lockedStatus="published" />
        </TabsContent>
        <TabsContent value="completed" className="pt-4">
          <ImagingWorklistTab variant="completed" />
        </TabsContent>
        <TabsContent value="closed" className="pt-4">
          <ImagingWorklistTab variant="closed" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
