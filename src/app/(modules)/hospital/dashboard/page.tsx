'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Users, Calendar, BedDouble, Receipt, Stethoscope, UserCog } from 'lucide-react';
import type { DashboardStats } from '@/hooks/use-api';

export default function HospitalDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['hospital', 'dashboard-stats'],
    queryFn: async () => {
      const response = await apiGet<DashboardStats>('/dashboard/stats');
      return response.data;
    },
  });

  const cards = [
    { label: 'Total Patients', value: stats?.patientStats?.total ?? 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Today New', value: stats?.patientStats?.todayNew ?? 0, icon: Users, color: 'text-green-600 bg-green-50' },
    { label: "Today's Appointments", value: stats?.appointmentStats?.todayTotal ?? 0, icon: Calendar, color: 'text-purple-600 bg-purple-50' },
    { label: 'Completed', value: stats?.appointmentStats?.completed ?? 0, icon: Calendar, color: 'text-teal-600 bg-teal-50' },
    { label: 'Pending', value: stats?.appointmentStats?.pending ?? 0, icon: Calendar, color: 'text-amber-600 bg-amber-50' },
    { label: 'Beds Occupied', value: stats?.bedStats?.occupied ?? 0, icon: BedDouble, color: 'text-red-600 bg-red-50' },
    { label: 'Beds Available', value: stats?.bedStats?.available ?? 0, icon: BedDouble, color: 'text-green-600 bg-green-50' },
    { label: "Today's Revenue", value: stats?.billingStats?.todayRevenue ?? 0, icon: Receipt, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Pending Bills', value: stats?.billingStats?.pendingBills ?? 0, icon: Receipt, color: 'text-orange-600 bg-orange-50' },
    { label: 'Total Doctors', value: stats?.staffStats?.totalDoctors ?? 0, icon: Stethoscope, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Total Nurses', value: stats?.staffStats?.totalNurses ?? 0, icon: UserCog, color: 'text-pink-600 bg-pink-50' },
    { label: 'Total Staff', value: stats?.staffStats?.totalStaff ?? 0, icon: UserCog, color: 'text-gray-600 bg-gray-50' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  {isLoading ? (
                    <div className="mt-1 h-6 w-12 animate-pulse rounded bg-muted" />
                  ) : (
                    <p className="text-xl font-bold text-foreground">
                      {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
