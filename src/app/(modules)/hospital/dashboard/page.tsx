'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Users, Calendar, BedDouble, Receipt, Stethoscope, UserCog } from 'lucide-react';
import type { DashboardStats } from '@/hooks/use-api';

const borderColors = [
  'border-primary', 'border-primary-container', 'border-secondary', 'border-tertiary',
  'border-primary', 'border-error', 'border-primary-container', 'border-primary',
  'border-secondary', 'border-tertiary', 'border-primary-container', 'border-secondary',
];

const iconStyles = [
  'bg-primary/10 text-primary', 'bg-primary-container/10 text-primary-container',
  'bg-secondary/10 text-secondary', 'bg-tertiary/10 text-tertiary',
  'bg-primary/10 text-primary', 'bg-error-container text-on-error-container',
  'bg-primary-container/10 text-primary-container', 'bg-primary/10 text-primary',
  'bg-secondary/10 text-secondary', 'bg-tertiary/10 text-tertiary',
  'bg-primary-container/10 text-primary-container', 'bg-secondary/10 text-secondary',
];

export default function HospitalDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['hospital', 'dashboard-stats'],
    queryFn: async () => {
      const response = await apiGet<DashboardStats>('/dashboard/stats');
      return response.data;
    },
  });

  const cards = [
    { label: 'Total Patients', value: stats?.patientStats?.total ?? 0, icon: Users },
    { label: 'Today New', value: stats?.patientStats?.todayNew ?? 0, icon: Users },
    { label: "Today's Appointments", value: stats?.appointmentStats?.todayTotal ?? 0, icon: Calendar },
    { label: 'Completed', value: stats?.appointmentStats?.completed ?? 0, icon: Calendar },
    { label: 'Pending', value: stats?.appointmentStats?.pending ?? 0, icon: Calendar },
    { label: 'Beds Occupied', value: stats?.bedStats?.occupied ?? 0, icon: BedDouble },
    { label: 'Beds Available', value: stats?.bedStats?.available ?? 0, icon: BedDouble },
    { label: "Today's Revenue", value: stats?.billingStats?.todayRevenue ?? 0, icon: Receipt },
    { label: 'Pending Bills', value: stats?.billingStats?.pendingBills ?? 0, icon: Receipt },
    { label: 'Total Doctors', value: stats?.staffStats?.totalDoctors ?? 0, icon: Stethoscope },
    { label: 'Total Nurses', value: stats?.staffStats?.totalNurses ?? 0, icon: UserCog },
    { label: 'Total Staff', value: stats?.staffStats?.totalStaff ?? 0, icon: UserCog },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-headline text-xl font-bold">Dashboard</h1>

      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 ${borderColors[index]} animate-fade-in-up`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg ${iconStyles[index]}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest mb-1">
                {card.label}
              </p>
              {isLoading ? (
                <div className="h-9 w-20 animate-shimmer rounded" />
              ) : (
                <h3 className="font-headline text-3xl font-extrabold">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </h3>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
