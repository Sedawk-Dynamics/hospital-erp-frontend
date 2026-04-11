'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Droplets, Heart, AlertTriangle, Clock, Syringe,
  RefreshCw, Users, CalendarClock,
} from 'lucide-react';
import { PatientFormSubmissionsPanel } from '@/components/forms/patient-form-submissions-panel';

interface BloodGroupInventory {
  bloodGroup: string;
  units: number;
  status: 'adequate' | 'low' | 'critical';
}

interface Donation {
  id: string;
  donorName: string;
  bloodGroup: string;
  units: number;
  donationDate: string;
  status: string;
}

interface TransfusionRequest {
  id: string;
  patientName: string;
  bloodGroup: string;
  units: number;
  urgency: 'routine' | 'urgent' | 'emergency';
  requestedBy: string;
  status: string;
  createdAt: string;
}

interface ExpiringUnit {
  id: string;
  bloodGroup: string;
  unitNumber: string;
  collectionDate: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'adequate':
      return 'bg-primary/10 text-primary';
    case 'low':
      return 'bg-secondary/10 text-secondary';
    case 'critical':
      return 'bg-error-container text-on-error-container';
    default:
      return 'bg-secondary/10 text-secondary';
  }
};

const getUrgencyColor = (urgency: string) => {
  switch (urgency) {
    case 'emergency':
      return 'bg-error-container text-on-error-container';
    case 'urgent':
      return 'bg-secondary/10 text-secondary';
    default:
      return 'bg-primary/10 text-primary';
  }
};

export function BloodBankDashboard() {
  const { data: inventory, isLoading: inventoryLoading, refetch: refetchInventory } = useQuery({
    queryKey: ['blood-bank', 'inventory'],
    queryFn: async () => {
      try {
        const response = await apiGet<BloodGroupInventory[]>('/blood-bank/inventory/by-group');
        return response.data;
      } catch {
        // Return empty inventory grouped by blood type
        return BLOOD_GROUPS.map((bg) => ({
          bloodGroup: bg,
          units: 0,
          status: 'critical' as const,
        }));
      }
    },
  });

  const { data: donations, isLoading: donationsLoading } = useQuery({
    queryKey: ['blood-bank', 'donations'],
    queryFn: async () => {
      const response = await apiGet<Donation[]>('/blood-bank/donations', {
        params: { limit: 10, sort: '-donationDate' },
      });
      return response.data;
    },
  });

  const { data: transfusions, isLoading: transfusionsLoading } = useQuery({
    queryKey: ['blood-bank', 'transfusions'],
    queryFn: async () => {
      const response = await apiGet<TransfusionRequest[]>('/blood-bank/transfusions', {
        params: { status: 'pending', limit: 10 },
      });
      return response.data;
    },
  });

  const { data: expiringUnits, isLoading: expiringLoading } = useQuery({
    queryKey: ['blood-bank', 'expiring'],
    queryFn: async () => {
      const response = await apiGet<ExpiringUnit[]>('/blood-bank/inventory/expiring', {
        params: { days: 7, limit: 10 },
      });
      return response.data;
    },
  });

  const inventoryData = inventory ?? [];
  const donationList = donations ?? [];
  const transfusionList = transfusions ?? [];
  const expiringList = expiringUnits ?? [];

  const totalUnits = inventoryData.reduce((sum, i) => sum + i.units, 0);
  const criticalGroups = inventoryData.filter((i) => i.status === 'critical').length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Blood Bank Dashboard</h1>
          <p className="font-label text-[10px] text-on-surface-variant mt-0.5">
            Inventory management, donations, and transfusion tracking
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => refetchInventory()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Units', value: totalUnits, icon: Droplets },
          { label: 'Critical Groups', value: criticalGroups, icon: AlertTriangle },
          { label: 'Pending Transfusions', value: transfusionList.length, icon: Syringe },
          { label: 'Expiring Soon', value: expiringList.length, icon: CalendarClock },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary transition-all duration-150 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-headline text-3xl font-extrabold">{stat.value}</p>
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Blood Group Inventory Grid */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Droplets className="h-4 w-4" />
            </div>
            Blood Group Inventory
          </h2>
        </div>
        <div className="p-4">
          {inventoryLoading ? (
            <div className="flex justify-center py-8">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {inventoryData.map((item) => (
                <div
                  key={item.bloodGroup}
                  className={cn(
                    'bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] p-3 text-center transition-all duration-150 hover:-translate-y-0.5',
                    getStatusColor(item.status),
                  )}
                >
                  <p className="font-headline font-bold text-lg">{item.bloodGroup}</p>
                  <p className="font-headline text-3xl font-extrabold mt-1">{item.units}</p>
                  <p className="font-label text-[10px] text-on-surface-variant mt-1 capitalize">{item.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Donations */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-container">
            <h2 className="font-headline text-lg font-bold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Heart className="h-4 w-4" />
              </div>
              Recent Donations
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                  <th className="px-4 pb-4 pt-5 text-left font-semibold">Donor</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold">Group</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold">Units</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {donationsLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center">
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </td>
                  </tr>
                ) : donationList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center font-label text-on-surface-variant">
                      No recent donations.
                    </td>
                  </tr>
                ) : (
                  donationList.map((d) => (
                    <tr key={d.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3 font-label text-sm font-bold">{d.donorName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error-container text-on-error-container">
                          {d.bloodGroup}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-label text-sm font-bold">{d.units}</td>
                      <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                        {formatDate(d.donationDate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expiring Units Alert */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-container">
            <h2 className="font-headline text-lg font-bold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <AlertTriangle className="h-4 w-4" />
              </div>
              Expiring Units (Next 7 Days)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                  <th className="px-4 pb-4 pt-5 text-left font-semibold">Unit #</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold">Group</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold">Expiry</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold">Days Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {expiringLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center">
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </td>
                  </tr>
                ) : expiringList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center font-label text-on-surface-variant">
                      No units expiring soon.
                    </td>
                  </tr>
                ) : (
                  expiringList.map((unit) => (
                    <tr key={unit.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3 font-label text-sm font-bold">{unit.unitNumber}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error-container text-on-error-container">
                          {unit.bloodGroup}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                        {formatDate(unit.expiryDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full',
                            unit.daysUntilExpiry <= 2
                              ? 'bg-error-container text-on-error-container'
                              : unit.daysUntilExpiry <= 4
                                ? 'bg-secondary/10 text-secondary'
                                : 'bg-primary/10 text-primary',
                          )}
                        >
                          {unit.daysUntilExpiry}d
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pending Transfusion Requests */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Syringe className="h-4 w-4" />
            </div>
            Pending Transfusion Requests
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold">Blood Group</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold">Units</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Urgency</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Requested By</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {transfusionsLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : transfusionList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No pending transfusion requests.
                  </td>
                </tr>
              ) : (
                transfusionList.map((req) => (
                  <tr key={req.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{req.patientName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error-container text-on-error-container">
                        {req.bloodGroup}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-label text-sm font-bold">{req.units}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', getUrgencyColor(req.urgency))}>
                        {req.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{req.requestedBy}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {formatDate(req.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forms assigned by admin to blood_bank_home view location appear here */}
      <PatientFormSubmissionsPanel
        title="Blood Bank Forms Submissions"
        viewLocation="blood_bank_home"
      />
    </div>
  );
}
