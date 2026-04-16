'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, User, Stethoscope, CalendarDays, Repeat } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDoctorsList } from '@/hooks/use-hospital';
import { DoctorScheduleManager } from '@/components/shared/doctor-schedule-manager';
import { AdminScheduleCalendar } from '@/components/hospital/admin-schedule-calendar';

type AdminTab = 'weekly' | 'monthly';

export default function DoctorSchedulesPage() {
  const router = useRouter();
  const { data: doctorsRaw, isLoading } = useDoctorsList();
  const [selectedDoctor, setSelectedDoctor] = useState<{
    id: string;
    userId: string;
    name: string;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<AdminTab>('weekly');

  const doctors = (doctorsRaw || []).map((d) => ({
    id: d.id,
    userId: d.userId,
    name: `Dr. ${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim(),
    specialization: d.specialization,
    department: d.department?.name,
  }));

  const filtered = search.trim()
    ? doctors.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.specialization?.toLowerCase().includes(search.toLowerCase()) ||
        d.department?.toLowerCase().includes(search.toLowerCase()),
      )
    : doctors;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (selectedDoctor) {
              setSelectedDoctor(null);
              setTab('weekly');
            } else {
              router.push('/hospital/settings');
            }
          }}
          className="rounded-lg p-2 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-headline text-xl font-bold">Doctor Schedules & Fees</h1>
          <p className="text-sm text-muted-foreground">
            {selectedDoctor
              ? `Managing ${selectedDoctor.name}`
              : 'Select a doctor to manage their weekly schedule, fees, and monthly calendar'}
          </p>
        </div>
      </div>

      {!selectedDoctor ? (
        /* ── Doctor List ── */
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search doctor by name, specialization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <Stethoscope className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No doctors found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? 'Try a different search term' : 'No doctors registered in this hospital'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoctor({ id: doc.id, userId: doc.userId, name: doc.name })}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 hover:border-primary/40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.specialization ?? doc.department ?? 'General'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Tabs: Weekly | Monthly Calendar ── */
        <div className="space-y-4">
          <div className="inline-flex rounded-lg border overflow-hidden bg-card">
            <button
              onClick={() => setTab('weekly')}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-r',
                tab === 'weekly'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Repeat className="h-4 w-4" />
              Weekly Schedule & Fees
            </button>
            <button
              onClick={() => setTab('monthly')}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
                tab === 'monthly'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <CalendarDays className="h-4 w-4" />
              Monthly Calendar
            </button>
          </div>

          {tab === 'weekly' ? (
            <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-5">
              <DoctorScheduleManager
                doctorId={selectedDoctor.id}
                doctorName={selectedDoctor.name}
              />
            </div>
          ) : (
            <AdminScheduleCalendar
              doctorId={selectedDoctor.id}
              doctorName={selectedDoctor.name}
              doctorUserId={selectedDoctor.userId}
            />
          )}
        </div>
      )}
    </div>
  );
}
