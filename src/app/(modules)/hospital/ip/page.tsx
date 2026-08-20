'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InPatientList } from '@/components/hospital/ip/in-patient-list';
import { ReservationTab } from '@/components/hospital/ip/reservation-tab';
import { BedAvailability } from '@/components/hospital/ip/bed-availability';
import { EstimationTab } from '@/components/hospital/ip/estimation-tab';
import { OccupancyTab } from '@/components/hospital/ip/occupancy-tab';
import { IpRequestsTab } from '@/components/hospital/ip/ip-requests-tab';
import { useAdmissionRequests } from '@/hooks/use-doctor';
import { useAdmissions } from '@/hooks/use-clinical';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

const TAB_VALUES = [
  'in-patient',
  'ip-requests',
  'reservation',
  'bed-availability',
  'estimation',
  'occupancy',
] as const;

export default function IPHomePage() {
  // Pending-count badge so front desk sees the queue at a glance.
  const { data } = useAdmissionRequests({ status: 'pending', limit: 1 });
  const pendingCount = data?.meta?.total ?? 0;

  // Patients who are admitted but still have no bed. They are easy to lose:
  // the row reads like any other, so a stay can sit without a location for
  // days. Counted here so the desk sees it without going looking. limit: 1 —
  // only the total is wanted.
  const { data: awaitingBed } = useAdmissions({
    status: 'admitted',
    unassignedBed: true,
    limit: 1,
  });
  const awaitingBedCount = awaitingBed?.meta?.total ?? 0;

  // An admission-request notification points here, and it is about a request —
  // so it has to be able to open on that tab rather than the ward list. Read
  // once as the initial value: after that the tab is the user's to move, and
  // re-reading the URL would drag them back on every render.
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab');
  const [tab, setTab] = useState<string>(
    requested && (TAB_VALUES as readonly string[]).includes(requested) ? requested : 'in-patient',
  );

  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Patient Home</h1>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
          <TabsList variant="line">
            <TabsTrigger value="in-patient">
              <span className="inline-flex items-center gap-1.5">
                Patients
                {awaitingBedCount > 0 && (
                  <span
                    className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                    title={`${awaitingBedCount} admitted patient${awaitingBedCount === 1 ? '' : 's'} still without a bed`}
                  >
                    {awaitingBedCount}
                  </span>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger value="ip-requests">
              <span className="inline-flex items-center gap-1.5">
                IP Requests
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white min-w-[18px]">
                    {pendingCount}
                  </span>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger value="reservation">Reservation</TabsTrigger>
            <TabsTrigger value="bed-availability">Bed Availability</TabsTrigger>
            <TabsTrigger value="estimation">Estimation</TabsTrigger>
            <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          </TabsList>

          <TabsContent value="in-patient" className="pt-4">
            <InPatientList />
          </TabsContent>

          <TabsContent value="ip-requests" className="pt-4">
            <IpRequestsTab />
          </TabsContent>

          <TabsContent value="reservation" className="pt-4">
            <ReservationTab />
          </TabsContent>

          <TabsContent value="bed-availability" className="pt-4">
            <BedAvailability />
          </TabsContent>

          <TabsContent value="estimation" className="pt-4">
            <EstimationTab />
          </TabsContent>

          <TabsContent value="occupancy" className="pt-4">
            <OccupancyTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
