'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { useDashboardStats } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';
import {
  Users,
  Calendar,
  Receipt,
  BedDouble,
  DollarSign,
  FileWarning,
  Stethoscope,
  UserCog,
  Clock,
  ClipboardList,
  Building2,
  BarChart3,
  Activity,
  ListTodo,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardStats } from '@/hooks/use-api';

// ============================================================
// Stat Card Configuration
// ============================================================

interface StatCardConfig {
  title: string;
  icon: LucideIcon;
  color: string;
  getValue: (stats: DashboardStats) => string;
  getSubtext: (stats: DashboardStats) => string;
}

const statCards: StatCardConfig[] = [
  {
    title: 'Total Patients',
    icon: Users,
    color: 'text-blue-600 bg-blue-100',
    getValue: (s) => s.patientStats.total.toLocaleString(),
    getSubtext: (s) => `${s.patientStats.todayNew} new today`,
  },
  {
    title: "Today's Appointments",
    icon: Calendar,
    color: 'text-teal-600 bg-teal-100',
    getValue: (s) => s.appointmentStats.todayTotal.toLocaleString(),
    getSubtext: (s) => `${s.appointmentStats.pending} pending`,
  },
  {
    title: 'Inpatient Count',
    icon: BedDouble,
    color: 'text-violet-600 bg-violet-100',
    getValue: (s) => s.patientStats.inpatient.toLocaleString(),
    getSubtext: (s) => `${s.patientStats.outpatient} outpatient`,
  },
  {
    title: 'Available Beds',
    icon: BedDouble,
    color: 'text-emerald-600 bg-emerald-100',
    getValue: (s) => `${s.bedStats.available}/${s.bedStats.total}`,
    getSubtext: (s) => {
      const rate = s.bedStats.total > 0 ? Math.round((s.bedStats.occupied / s.bedStats.total) * 100) : 0;
      return `${rate}% occupancy`;
    },
  },
  {
    title: "Today's Revenue",
    icon: DollarSign,
    color: 'text-green-600 bg-green-100',
    getValue: (s) => `$${s.billingStats.todayRevenue.toLocaleString()}`,
    getSubtext: (s) => `$${s.billingStats.totalRevenue.toLocaleString()} total`,
  },
  {
    title: 'Pending Bills',
    icon: FileWarning,
    color: 'text-amber-600 bg-amber-100',
    getValue: (s) => s.billingStats.pendingBills.toLocaleString(),
    getSubtext: () => 'Awaiting payment',
  },
  {
    title: 'Active Doctors',
    icon: Stethoscope,
    color: 'text-indigo-600 bg-indigo-100',
    getValue: (s) => s.staffStats.totalDoctors.toLocaleString(),
    getSubtext: (s) => `${s.staffStats.totalNurses} nurses`,
  },
  {
    title: 'Total Staff',
    icon: UserCog,
    color: 'text-rose-600 bg-rose-100',
    getValue: (s) => s.staffStats.totalStaff.toLocaleString(),
    getSubtext: (s) => `${s.staffStats.totalDoctors + s.staffStats.totalNurses} clinical`,
  },
];

// ============================================================
// Skeleton Components
// ============================================================

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Role-Specific Sections
// ============================================================

function DoctorSection({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Upcoming Appointments
          </CardTitle>
          <CardDescription>Your schedule for today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Completed</p>
                <p className="text-xs text-muted-foreground">Finished consultations</p>
              </div>
              <span className="text-xl font-bold text-emerald-600">{stats.appointmentStats.completed}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Pending</p>
                <p className="text-xs text-muted-foreground">Awaiting patients</p>
              </div>
              <span className="text-xl font-bold text-amber-600">{stats.appointmentStats.pending}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Cancelled</p>
                <p className="text-xs text-muted-foreground">Today&apos;s cancellations</p>
              </div>
              <span className="text-xl font-bold text-destructive">{stats.appointmentStats.cancelled}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            Patient Queue
          </CardTitle>
          <CardDescription>Current patient load</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Inpatients</p>
                <p className="text-xs text-muted-foreground">Currently admitted</p>
              </div>
              <span className="text-xl font-bold text-primary">{stats.patientStats.inpatient}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Outpatients</p>
                <p className="text-xs text-muted-foreground">Consulting today</p>
              </div>
              <span className="text-xl font-bold text-teal-600">{stats.patientStats.outpatient}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">New Patients Today</p>
                <p className="text-xs text-muted-foreground">First-time registrations</p>
              </div>
              <span className="text-xl font-bold text-blue-600">{stats.patientStats.todayNew}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminSection({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            Financial Overview
          </CardTitle>
          <CardDescription>Revenue and billing summary</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Today&apos;s Revenue</p>
                <p className="text-xs text-muted-foreground">Collections today</p>
              </div>
              <span className="text-xl font-bold text-emerald-600">
                ${stats.billingStats.todayRevenue.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Total Revenue</p>
                <p className="text-xs text-muted-foreground">All-time collections</p>
              </div>
              <span className="text-xl font-bold text-primary">
                ${stats.billingStats.totalRevenue.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Pending Bills</p>
                <p className="text-xs text-muted-foreground">Outstanding invoices</p>
              </div>
              <span className="text-xl font-bold text-amber-600">{stats.billingStats.pendingBills}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Department Stats
          </CardTitle>
          <CardDescription>Staff and resource overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Doctors</p>
                <p className="text-xs text-muted-foreground">Active physicians</p>
              </div>
              <span className="text-xl font-bold text-indigo-600">{stats.staffStats.totalDoctors}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Nurses</p>
                <p className="text-xs text-muted-foreground">Active nursing staff</p>
              </div>
              <span className="text-xl font-bold text-teal-600">{stats.staffStats.totalNurses}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Total Staff</p>
                <p className="text-xs text-muted-foreground">All departments</p>
              </div>
              <span className="text-xl font-bold text-primary">{stats.staffStats.totalStaff}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Bed Occupancy</p>
                <p className="text-xs text-muted-foreground">
                  {stats.bedStats.occupied} of {stats.bedStats.total} occupied
                </p>
              </div>
              <span className="text-xl font-bold text-rose-600">
                {stats.bedStats.total > 0
                  ? Math.round((stats.bedStats.occupied / stats.bedStats.total) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NurseSection({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            Ward Occupancy
          </CardTitle>
          <CardDescription>Bed availability and utilization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Total Beds</p>
                <p className="text-xs text-muted-foreground">Across all wards</p>
              </div>
              <span className="text-xl font-bold text-primary">{stats.bedStats.total}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Occupied</p>
                <p className="text-xs text-muted-foreground">Currently in use</p>
              </div>
              <span className="text-xl font-bold text-amber-600">{stats.bedStats.occupied}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Available</p>
                <p className="text-xs text-muted-foreground">Ready for admission</p>
              </div>
              <span className="text-xl font-bold text-emerald-600">{stats.bedStats.available}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-muted-foreground" />
            Pending Tasks
          </CardTitle>
          <CardDescription>Items requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Pending Appointments</p>
                <p className="text-xs text-muted-foreground">Patients to check in</p>
              </div>
              <span className="text-xl font-bold text-amber-600">{stats.appointmentStats.pending}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Inpatients</p>
                <p className="text-xs text-muted-foreground">Requiring rounds</p>
              </div>
              <span className="text-xl font-bold text-primary">{stats.patientStats.inpatient}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">New Admissions Today</p>
                <p className="text-xs text-muted-foreground">Recently admitted</p>
              </div>
              <span className="text-xl font-bold text-blue-600">{stats.patientStats.todayNew}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Dashboard Page
// ============================================================

export default function DashboardPage() {
  const { data: stats, isLoading, isError } = useDashboardStats();
  const user = useAuthStore((s) => s.user);

  const userRole = user?.role?.slug?.toLowerCase() ?? '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          user
            ? `Welcome back, ${user.firstName}! Here is an overview of your hospital.`
            : 'Welcome back! Here is an overview of your hospital.'
        }
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats
            ? statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Card key={card.title}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                          <p className="text-2xl font-bold">{card.getValue(stats)}</p>
                          <p className="text-xs text-muted-foreground">{card.getSubtext(stats)}</p>
                        </div>
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-lg ${card.color}`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            : null}
      </div>

      {/* Error State */}
      {isError && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">Failed to load dashboard data. Please try refreshing the page.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role-Specific Sections */}
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCardSkeleton />
          <SectionCardSkeleton />
        </div>
      ) : stats ? (
        <>
          {(userRole === 'doctor' || userRole === 'physician') && <DoctorSection stats={stats} />}
          {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'administrator') && (
            <AdminSection stats={stats} />
          )}
          {(userRole === 'nurse' || userRole === 'nursing') && <NurseSection stats={stats} />}
          {/* Fallback: show admin section for unrecognized roles or when no role */}
          {!['doctor', 'physician', 'admin', 'super_admin', 'administrator', 'nurse', 'nursing'].includes(
            userRole
          ) && <AdminSection stats={stats} />}
        </>
      ) : null}
    </div>
  );
}
