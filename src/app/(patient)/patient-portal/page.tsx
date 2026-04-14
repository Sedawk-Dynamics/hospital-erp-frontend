'use client';

import { useMemo } from 'react';
import { Calendar, FileText, TestTube, Pill, CreditCard, Clock, CalendarPlus, CalendarDays } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function PatientPortalHome() {
  const { user } = useAuthStore();

  const { data: appointments } = useQuery({
    queryKey: ['patient', 'upcoming-appointments'],
    queryFn: async () => {
      const res = await apiGet<Array<{
        id: string; appointmentDate: string; status: string;
        doctor?: { user?: { firstName: string; lastName: string }; specialization?: string };
      }>>('/patient-portal/appointments', { params: { limit: 5, sortOrder: 'asc' } });
      return res.data ?? [];
    },
  });

  const { data: bills } = useQuery({
    queryKey: ['patient', 'recent-bills'],
    queryFn: async () => {
      const res = await apiGet<Array<{
        id: string; billNumber: string; total: number; status: string; createdAt: string;
      }>>('/patient-portal/billing', { params: { limit: 5 } });
      return res.data ?? [];
    },
  });

  // Fetch recent prescriptions to check for follow-up reminders
  const { data: recentPrescriptions } = useQuery({
    queryKey: ['patient', 'recent-prescriptions-followup'],
    queryFn: async () => {
      const res = await apiGet<Array<{
        id: string; notes?: string; createdAt: string;
        doctor?: { user?: { firstName: string; lastName: string } };
      }>>('/patient-portal/prescriptions', { params: { limit: 5 } });
      return res.data ?? [];
    },
  });

  // Parse follow-up dates from prescription notes
  const followUpReminder = useMemo(() => {
    if (!recentPrescriptions) return null;
    for (const rx of recentPrescriptions) {
      if (!rx.notes) continue;
      const match = rx.notes.match(/Follow-up:\s*(.+)/i);
      if (!match) continue;
      const dateMatch = match[1].match(/(\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) continue;
      const parsed = new Date(dateMatch[1]);
      if (isNaN(parsed.getTime())) continue;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      parsed.setHours(0, 0, 0, 0);
      const diff = Math.round((parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < -30) continue; // Skip if more than 30 days overdue
      return {
        date: parsed,
        diffDays: diff,
        doctorName: rx.doctor?.user ? `Dr. ${rx.doctor.user.firstName} ${rx.doctor.user.lastName}` : undefined,
        prescriptionDate: rx.createdAt,
      };
    }
    return null;
  }, [recentPrescriptions]);

  const quickLinks = [
    { label: 'Book Appointment', href: '/patient-portal/book-appointment', icon: CalendarPlus, color: 'bg-primary/10 text-primary', desc: 'Schedule a visit' },
    { label: 'Appointments', href: '/patient-portal/appointments', icon: Calendar, color: 'bg-blue-50 text-blue-600', desc: 'View all appointments' },
    { label: 'Lab Reports', href: '/patient-portal/lab-reports', icon: TestTube, color: 'bg-orange-50 text-orange-600', desc: 'View test results' },
    { label: 'Prescriptions', href: '/patient-portal/prescriptions', icon: Pill, color: 'bg-green-50 text-green-600', desc: 'Current medications' },
    { label: 'Follow-Ups', href: '/patient-portal/follow-ups', icon: CalendarDays, color: 'bg-cyan-50 text-cyan-600', desc: 'Scheduled follow-ups' },
    { label: 'Bills', href: '/patient-portal/billing', icon: CreditCard, color: 'bg-purple-50 text-purple-600', desc: 'View & pay bills' },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome, {user?.firstName}
          </h1>
          <p className="text-muted-foreground mt-1">Here&apos;s an overview of your healthcare activity.</p>
        </div>
        <Link href="/patient-portal/book-appointment">
          <Button className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            Book Appointment
          </Button>
        </Link>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20"
          >
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', link.color)}>
              <link.icon className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">{link.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Follow-up Reminder Banner */}
      {followUpReminder && (
        <Link
          href="/patient-portal/book-appointment"
          className={cn(
            'flex items-center gap-4 rounded-xl border-2 px-5 py-4 transition-all hover:shadow-md',
            followUpReminder.diffDays < 0
              ? 'border-red-300 bg-red-50 hover:bg-red-100/70'
              : followUpReminder.diffDays === 0
                ? 'border-orange-300 bg-orange-50 hover:bg-orange-100/70'
                : followUpReminder.diffDays <= 3
                  ? 'border-amber-300 bg-amber-50 hover:bg-amber-100/70'
                  : 'border-blue-300 bg-blue-50 hover:bg-blue-100/70',
          )}
        >
          <div className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl shrink-0',
            followUpReminder.diffDays < 0 ? 'bg-red-200' : followUpReminder.diffDays <= 3 ? 'bg-orange-200' : 'bg-blue-200',
          )}>
            <CalendarDays className={cn(
              'h-5 w-5',
              followUpReminder.diffDays < 0 ? 'text-red-700' : followUpReminder.diffDays <= 3 ? 'text-orange-700' : 'text-blue-700',
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-bold',
              followUpReminder.diffDays < 0 ? 'text-red-900' : followUpReminder.diffDays <= 3 ? 'text-orange-900' : 'text-blue-900',
            )}>
              {followUpReminder.diffDays < 0
                ? 'Follow-up appointment overdue'
                : followUpReminder.diffDays === 0
                  ? 'Follow-up appointment is today!'
                  : followUpReminder.diffDays === 1
                    ? 'Follow-up appointment is tomorrow'
                    : `Follow-up appointment in ${followUpReminder.diffDays} days`}
            </p>
            <p className={cn(
              'text-xs mt-0.5',
              followUpReminder.diffDays < 0 ? 'text-red-700' : followUpReminder.diffDays <= 3 ? 'text-orange-700' : 'text-blue-700',
            )}>
              {followUpReminder.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {followUpReminder.doctorName && ` · ${followUpReminder.doctorName}`}
            </p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5" />
            Book Now
          </Button>
        </Link>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">Upcoming Appointments</h3>
            <div className="flex items-center gap-3">
              <Link href="/patient-portal/book-appointment" className="text-xs font-medium text-primary hover:underline">Book New</Link>
              <Link href="/patient-portal/appointments" className="text-xs font-medium text-muted-foreground hover:text-foreground">View All</Link>
            </div>
          </div>
          <div className="divide-y">
            {!appointments || appointments.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground mb-3">No upcoming appointments</p>
                <Link href="/patient-portal/book-appointment">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Book Appointment
                  </Button>
                </Link>
              </div>
            ) : (
              appointments.slice(0, 4).map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Dr. {apt.doctor?.user?.firstName} {apt.doctor?.user?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(apt.appointmentDate)}
                      {apt.doctor?.specialization && ` \u00b7 ${apt.doctor.specialization}`}
                    </p>
                  </div>
                  <span className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    apt.status === 'booked' && 'bg-blue-100 text-blue-800',
                    apt.status === 'confirmed' && 'bg-green-100 text-green-800',
                    apt.status === 'completed' && 'bg-gray-100 text-gray-800',
                    apt.status === 'cancelled' && 'bg-red-100 text-red-800',
                  )}>
                    {apt.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Bills */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">Recent Bills</h3>
            <Link href="/patient-portal/billing" className="text-xs font-medium text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y">
            {!bills || bills.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No bills found</div>
            ) : (
              bills.slice(0, 4).map((bill) => (
                <div key={bill.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{bill.billNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(bill.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{`\u20B9${Number(bill.total).toLocaleString('en-IN')}`}</p>
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      bill.status === 'paid' && 'bg-green-100 text-green-800',
                      bill.status === 'pending' && 'bg-amber-100 text-amber-800',
                      bill.status === 'partially_paid' && 'bg-blue-100 text-blue-800',
                    )}>
                      {bill.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
