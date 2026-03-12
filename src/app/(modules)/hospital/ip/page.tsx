'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InPatientList } from '@/components/hospital/ip/in-patient-list';
import { ReservationTab } from '@/components/hospital/ip/reservation-tab';
import { BedAvailability } from '@/components/hospital/ip/bed-availability';
import { EstimationTab } from '@/components/hospital/ip/estimation-tab';
import { OccupancyTab } from '@/components/hospital/ip/occupancy-tab';

export default function IPHomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">IP Home</h1>

      <Tabs defaultValue="in-patient">
        <TabsList variant="line">
          <TabsTrigger value="in-patient">In Patient List</TabsTrigger>
          <TabsTrigger value="reservation">Reservation</TabsTrigger>
          <TabsTrigger value="bed-availability">Bed Availability</TabsTrigger>
          <TabsTrigger value="estimation">Estimation</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
        </TabsList>

        <TabsContent value="in-patient" className="pt-4">
          <InPatientList />
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
  );
}
