'use client';

import { useMemo } from 'react';
import {
  Calendar,
  FileText,
  TestTube,
  ScanLine,
  Pill,
  CreditCard,
  CalendarPlus,
  CalendarDays,
  ChevronRight,
  TrendingUp,
  Stethoscope,
  ArrowRight,
  BedDouble,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { usePatientProfileStore } from '@/stores/patient-profile-store';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import Link from 'next/link';

export default function PatientPortalHome() {
  const { user } = useAuthStore();
  const { selectedProfileId, profiles } = usePatientProfileStore();
  const activeProfile = profiles.find((p) => p.id === selectedProfileId);
  const profileParam = selectedProfileId ? { profileId: selectedProfileId } : {};

  const { data: appointments } = useQuery({
    queryKey: ['patient', 'upcoming-appointments', selectedProfileId],
    queryFn: async () => {
      const res = await apiGet<Array<{
        id: string; appointmentDate: string; status: string;
        doctor?: { user?: { firstName: string; lastName: string }; specialization?: string };
        // `upcoming` matters as much as the sort: without it this asked for the
        // five OLDEST appointments on record, so a patient with any history saw
        // visits from months ago here and a just-booked one not at all.
      }>>('/patient-portal/appointments', {
        params: { limit: 5, sortOrder: 'asc', upcoming: true, ...profileParam },
      });
      return res.data ?? [];
    },
  });

  const { data: bills } = useQuery({
    queryKey: ['patient', 'recent-bills', selectedProfileId],
    queryFn: async () => {
      const res = await apiGet<Array<{
        id: string; billNumber: string; total: number; status: string; createdAt: string;
      }>>('/patient-portal/billing', { params: { limit: 5, ...profileParam } });
      return res.data ?? [];
    },
  });

  const { data: prescriptions } = useQuery({
    queryKey: ['patient', 'recent-prescriptions', selectedProfileId],
    queryFn: async () => {
      const res = await apiGet<Array<{ id: string }>>('/patient-portal/prescriptions', {
        params: { limit: 50, ...profileParam },
      });
      return res.data ?? [];
    },
  });

  const { data: labReports } = useQuery({
    queryKey: ['patient', 'recent-labs', selectedProfileId],
    queryFn: async () => {
      const res = await apiGet<Array<{ id: string }>>('/patient-portal/lab-reports', {
        params: { limit: 50, ...profileParam },
      });
      return res.data ?? [];
    },
  });

  const { data: followUps } = useQuery({
    queryKey: ['patient', 'dashboard-follow-ups', selectedProfileId],
    queryFn: async () => {
      const res = await apiGet<Array<{
        followUpDate: string;
        prescriptionDate: string;
        doctor?: { user?: { firstName: string; lastName: string } };
      }>>('/patient-portal/follow-ups', { params: { limit: 10, ...profileParam } });
      return res.data ?? [];
    },
  });

  const { data: admissions } = useQuery({
    queryKey: ['patient', 'dashboard-admissions', selectedProfileId],
    queryFn: async () => {
      const res = await apiGet<Array<{
        id: string; status: string; admissionDate?: string | null; ward?: string | null;
        bed?: string | null; doctor?: string | null; hospital?: string | null; primaryDiagnosis?: string | null;
      }>>('/patient-portal/admissions', { params: profileParam });
      return res.data ?? [];
    },
  });
  const activeAdmission = (admissions ?? []).find((a) => a.status === 'admitted') ?? null;

  const followUpReminder = useMemo(() => {
    if (!followUps || followUps.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let best: { date: Date; diffDays: number; doctorName?: string; prescriptionDate: string } | null = null;
    for (const fu of followUps) {
      const d = new Date(fu.followUpDate);
      if (isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < -30) continue;
      const entry = {
        date: d,
        diffDays: diff,
        doctorName: fu.doctor?.user ? `Dr. ${fu.doctor.user.firstName} ${fu.doctor.user.lastName}` : undefined,
        prescriptionDate: fu.prescriptionDate,
      };
      if (!best || Math.abs(diff) < Math.abs(best.diffDays)) best = entry;
    }
    return best;
  }, [followUps]);

  const pendingBills = (bills ?? []).filter((b) => b.status === 'pending' || b.status === 'partially_paid').length;
  const outstandingTotal = (bills ?? [])
    .filter((b) => b.status === 'pending' || b.status === 'partially_paid')
    .reduce((sum, b) => sum + Number(b.total || 0), 0);

  const stats = [
    {
      label: 'Upcoming Visits',
      value: appointments?.length ?? 0,
      tag: activeProfile ? activeProfile.firstName : 'This account',
      accent: 'border-primary',
      iconBg: 'bg-primary/10 text-primary',
      tagColor: 'text-primary bg-primary/5',
      Icon: Calendar,
    },
    {
      label: 'Prescriptions',
      value: prescriptions?.length ?? 0,
      tag: 'Lifetime total',
      accent: 'border-secondary',
      iconBg: 'bg-secondary/10 text-secondary',
      tagColor: 'text-secondary bg-secondary/5',
      Icon: Pill,
    },
    {
      label: 'Lab Reports',
      value: labReports?.length ?? 0,
      tag: 'All results',
      accent: 'border-primary-container',
      iconBg: 'bg-primary-container/10 text-primary-container',
      tagColor: 'text-primary-container bg-primary-container/5',
      Icon: TestTube,
    },
    {
      label: 'Pending Bills',
      value: pendingBills,
      tag: outstandingTotal > 0 ? `Rs ${Math.round(outstandingTotal).toLocaleString('en-IN')}` : 'All clear',
      accent: 'border-tertiary',
      iconBg: 'bg-tertiary/10 text-tertiary',
      tagColor: 'text-tertiary bg-tertiary/5',
      Icon: CreditCard,
    },
  ];

  const quickLinks = [
    { label: 'Book Appointment', href: '/patient-portal/book-appointment', icon: CalendarPlus },
    { label: 'Appointments', href: '/patient-portal/appointments', icon: Calendar },
    { label: 'Lab Reports', href: '/patient-portal/lab-reports', icon: TestTube },
    { label: 'Imaging Reports', href: '/patient-portal/imaging-reports', icon: ScanLine },
    { label: 'Prescriptions', href: '/patient-portal/prescriptions', icon: Pill },
    { label: 'Hospitalizations', href: '/patient-portal/admissions', icon: BedDouble },
    { label: 'Follow-Ups', href: '/patient-portal/follow-ups', icon: CalendarDays },
    { label: 'Bills', href: '/patient-portal/billing', icon: CreditCard },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome row */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
            Your Sanctuary
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            Welcome, {user?.firstName}
          </h1>
          <p className="font-label text-sm text-on-surface-variant mt-1.5">
            {activeProfile
              ? `Viewing ${activeProfile.firstName}${activeProfile.lastName ? ' ' + activeProfile.lastName : ''}'s records${activeProfile.isSelf ? '' : ` · ${activeProfile.relationship}`}.`
              : "Here\u2019s an overview of your healthcare activity."}
          </p>
        </div>
        <Link
          href="/patient-portal/book-appointment"
          className="inline-flex items-center gap-2 bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow"
        >
          <CalendarPlus className="h-4 w-4" />
          Book Appointment
        </Link>
      </div>

      {/* Top Summary Strip */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              'bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4',
              s.accent,
            )}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn('p-2 rounded-lg', s.iconBg)}>
                <s.Icon className="h-5 w-5" />
              </div>
              <span className={cn('text-xs font-label font-bold px-2 py-1 rounded-full', s.tagColor)}>
                {s.tag}
              </span>
            </div>
            <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest mb-1">
              {s.label}
            </p>
            <h3 className="font-headline text-3xl font-extrabold">{s.value}</h3>
          </div>
        ))}
      </section>

      {/* Currently-admitted banner — the patient's active hospitalization */}
      {activeAdmission && (
        <Link
          href={`/patient-portal/admissions/${activeAdmission.id}`}
          className="flex items-center gap-4 rounded-xl border-l-4 border-emerald-500 bg-emerald-50 px-5 py-4 shadow-sanctuary transition-all hover:shadow-lg"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 shrink-0">
            <BedDouble className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-headline text-sm font-bold text-emerald-900">Currently admitted</p>
            <p className="font-label text-xs text-emerald-800/80 mt-0.5 truncate">
              {[
                activeAdmission.primaryDiagnosis,
                [activeAdmission.ward, activeAdmission.bed].filter(Boolean).join(' · '),
                activeAdmission.doctor,
                activeAdmission.hospital,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-bold text-emerald-700 shrink-0">
            View details
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      )}

      {/* Follow-up reminder */}
      {followUpReminder && (
        <Link
          href="/patient-portal/book-appointment"
          className={cn(
            'flex items-center gap-4 rounded-xl px-5 py-4 shadow-sanctuary transition-all hover:shadow-lg border-l-4',
            followUpReminder.diffDays < 0
              ? 'bg-error-container/40 border-error'
              : followUpReminder.diffDays <= 3
                ? 'bg-secondary-fixed/50 border-secondary'
                : 'bg-primary-fixed/30 border-primary',
          )}
        >
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl shrink-0',
              followUpReminder.diffDays < 0
                ? 'bg-error/10 text-error'
                : followUpReminder.diffDays <= 3
                  ? 'bg-secondary/10 text-secondary'
                  : 'bg-primary/10 text-primary',
            )}
          >
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-headline text-sm font-bold text-on-surface">
              {followUpReminder.diffDays < 0
                ? 'Follow-up appointment overdue'
                : followUpReminder.diffDays === 0
                  ? 'Follow-up appointment is today'
                  : followUpReminder.diffDays === 1
                    ? 'Follow-up appointment is tomorrow'
                    : `Follow-up appointment in ${followUpReminder.diffDays} days`}
            </p>
            <p className="font-label text-xs text-on-surface-variant mt-0.5">
              {followUpReminder.date.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {followUpReminder.doctorName && ` · ${followUpReminder.doctorName}`}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-white text-primary font-label font-bold text-xs px-4 py-2 rounded-lg shrink-0">
            <CalendarPlus className="h-3.5 w-3.5" />
            Book Now
          </div>
        </Link>
      )}

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-6 xl:gap-8">
        {/* Quick Access tiles */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest p-8 rounded-xl shadow-sanctuary relative overflow-hidden">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="font-headline text-xl font-bold mb-1">Quick Access</h2>
              <p className="font-label text-sm text-on-surface-variant">
                Jump to the records and services you use most
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-primary font-bold text-xs font-label">
              <TrendingUp className="h-4 w-4" />
              Personal Dashboard
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-4 p-4 rounded-xl bg-surface-container-low hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-primary shrink-0 shadow-sm">
                  <link.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label text-sm font-semibold text-on-surface truncate">
                    {link.label}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-outline opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Financial card (secondary/warm) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-secondary text-on-secondary p-6 rounded-xl shadow-lg relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <p className="font-label text-xs uppercase tracking-widest opacity-70 mb-1">
              Outstanding Balance
            </p>
            <h3 className="font-headline text-2xl font-bold mb-4">
              Rs {Math.round(outstandingTotal).toLocaleString('en-IN')}
            </h3>
            <Link
              href="/patient-portal/billing"
              className="flex justify-between items-center bg-white/10 p-3 rounded-lg backdrop-blur-sm hover:bg-white/15 transition-colors"
            >
              <div className="text-xs">
                <p className="opacity-70">Bills pending</p>
                <p className="font-bold">{pendingBills} {pendingBills === 1 ? 'invoice' : 'invoices'}</p>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary">
            <h2 className="font-headline text-lg font-bold mb-4">Health Snapshot</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-label text-sm font-semibold">Active Profile</p>
                    <p className="font-label text-[10px] text-on-surface-variant truncate max-w-[140px]">
                      {activeProfile
                        ? `${activeProfile.firstName}${activeProfile.lastName ? ' ' + activeProfile.lastName : ''}`
                        : 'Primary account'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold font-label text-primary bg-primary/5 px-2 py-1 rounded-full capitalize">
                  {activeProfile?.relationship || 'self'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-label text-sm font-semibold">Prescriptions</p>
                    <p className="font-label text-[10px] text-on-surface-variant">
                      {prescriptions?.length ?? 0} records on file
                    </p>
                  </div>
                </div>
                <Link
                  href="/patient-portal/prescriptions"
                  className="text-xs font-bold font-label text-secondary hover:text-primary"
                >
                  View
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary">
                    <TestTube className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-label text-sm font-semibold">Lab Reports</p>
                    <p className="font-label text-[10px] text-on-surface-variant">
                      {labReports?.length ?? 0} results available
                    </p>
                  </div>
                </div>
                <Link
                  href="/patient-portal/lab-reports"
                  className="text-xs font-bold font-label text-tertiary hover:text-primary"
                >
                  View
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming appointments */}
        <div className="col-span-12 lg:col-span-7 bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-headline text-lg font-bold">Upcoming Appointments</h2>
            <div className="flex items-center gap-4">
              <Link
                href="/patient-portal/book-appointment"
                className="text-xs font-label text-primary font-bold hover:underline"
              >
                Book New
              </Link>
              <Link
                href="/patient-portal/appointments"
                className="text-xs font-label text-on-surface-variant font-bold hover:text-primary"
              >
                View All
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {!appointments || appointments.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
                  <Calendar className="h-5 w-5" />
                </div>
                <p className="font-label text-sm text-on-surface-variant mb-4">
                  No upcoming appointments
                </p>
                <Link
                  href="/patient-portal/book-appointment"
                  className="inline-flex items-center gap-1.5 bg-primary text-white font-label font-bold text-xs px-4 py-2 rounded-lg hover:shadow-md transition-shadow"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Book Appointment
                </Link>
              </div>
            ) : (
              appointments.slice(0, 4).map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center gap-4 p-4 hover:bg-surface-container-low rounded-xl transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label text-sm font-bold truncate">
                      Dr. {apt.doctor?.user?.firstName} {apt.doctor?.user?.lastName}
                    </p>
                    <p className="font-label text-[11px] text-on-surface-variant">
                      {formatDate(apt.appointmentDate)}
                      {apt.doctor?.specialization && ` \u00b7 ${apt.doctor.specialization}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-bold font-label px-2 py-1 rounded-full capitalize',
                      apt.status === 'booked' && 'bg-primary/10 text-primary',
                      apt.status === 'confirmed' && 'bg-primary/10 text-primary',
                      apt.status === 'in_progress' && 'bg-secondary/10 text-secondary',
                      apt.status === 'completed' && 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
                      apt.status === 'cancelled' && 'bg-error/10 text-error',
                    )}
                  >
                    {apt.status?.replace('_', ' ')}
                  </span>
                  <ChevronRight className="h-4 w-4 text-outline opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent bills */}
        <div className="col-span-12 lg:col-span-5 bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-headline text-lg font-bold">Recent Bills</h2>
            <Link
              href="/patient-portal/billing"
              className="text-xs font-label text-primary font-bold hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {!bills || bills.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="font-label text-sm text-on-surface-variant">No bills found</p>
              </div>
            ) : (
              bills.slice(0, 4).map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-4 hover:bg-surface-container-low rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-label text-sm font-bold truncate">{bill.billNumber}</p>
                      <p className="font-label text-[11px] text-on-surface-variant">
                        {formatDate(bill.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="font-headline text-sm font-bold">
                      Rs {Number(bill.total).toLocaleString('en-IN')}
                    </p>
                    <span
                      className={cn(
                        'text-[10px] font-bold font-label px-2 py-0.5 rounded-full capitalize',
                        bill.status === 'paid' && 'bg-primary/10 text-primary',
                        bill.status === 'pending' && 'bg-secondary/10 text-secondary',
                        bill.status === 'partially_paid' && 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
                      )}
                    >
                      {bill.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer — matches code.html */}
      <footer className="mt-12 pb-4 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center text-primary mb-4">
          <HeartPulseIcon />
        </div>
        <p className="font-headline font-bold text-sm text-on-surface">Sanctuary Patient Portal</p>
        <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mt-1">
          End-to-End Encrypted Healthcare Protocol
        </p>
      </footer>
    </div>
  );
}

function HeartPulseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </svg>
  );
}
