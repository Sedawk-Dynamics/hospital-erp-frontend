'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon, Clock, User, Building2, Search,
  ChevronLeft, ChevronRight, Stethoscope, MapPin, Phone, Mail,
  CheckCircle2, CreditCard, Banknote, Shield, Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { toInputDateStr, formatTime24, getCurrentISTTime, isToday } from '@/lib/date-utils';
import { IntakeFormsModal } from '@/components/forms/intake-forms-modal';

// ── Types ──────────────────────────────────────────────────

interface BookingHospital {
  id: string;
  name: string;
  slug: string;
  hospitalCode: string | null;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

interface BookingDoctor {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  specialization: string | null;
  qualifications: string | null;
  consultationFee: number | null;
  experienceYears: number | null;
  department: { id: string; name: string } | null;
  availableDays: number[];
}

interface BookingDepartment {
  id: string;
  name: string;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

interface PaymentInfo {
  onlinePaymentAvailable: boolean;
}

interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  paymentId: string;
  billId: string;
}

type BookingStep = 'hospital' | 'doctor' | 'datetime' | 'confirm' | 'payment';

// ── Component ──────────────────────────────────────────────

export default function BookAppointmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Step state
  const [step, setStep] = useState<BookingStep>('hospital');
  const [selectedHospital, setSelectedHospital] = useState<BookingHospital | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<BookingDoctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [reason, setReason] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Hospital search + pagination
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitalSearchQuery, setHospitalSearchQuery] = useState('');
  const [hospitalPage, setHospitalPage] = useState(1);

  // Payment state
  const [bookedAppointmentId, setBookedAppointmentId] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Intake forms (assigned to the appointment_booking trigger by the hospital)
  const [showIntakeForms, setShowIntakeForms] = useState(false);
  const [postFormsRedirect, setPostFormsRedirect] = useState<string | null>(null);

  // ── Data Queries ───────────────────────────────────────

  // Paginated hospitals
  const { data: hospitalsData, isLoading: loadingHospitals } = useQuery({
    queryKey: ['patient', 'all-hospitals', hospitalSearchQuery, hospitalPage],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: hospitalPage, limit: 10 };
      if (hospitalSearchQuery) params.search = hospitalSearchQuery;
      const res = await apiGet<BookingHospital[]>('/patient-portal/all-hospitals', { params });
      return { data: res.data ?? [], meta: res.meta ?? { total: 0, page: 1, limit: 10, totalPages: 1 } };
    },
  });
  const hospitals = hospitalsData?.data ?? [];
  const hospitalMeta = hospitalsData?.meta ?? { total: 0, page: 1, totalPages: 1 };

  // Departments for selected hospital
  const { data: departmentsRaw } = useQuery({
    queryKey: ['patient', 'departments', selectedHospital?.id],
    queryFn: async () => {
      const res = await apiGet<BookingDepartment[]>('/patient-portal/departments', {
        params: { tenantId: selectedHospital!.id },
      });
      return res.data ?? [];
    },
    enabled: !!selectedHospital,
  });
  const departments = departmentsRaw ?? [];

  // Doctors for selected hospital
  const { data: doctorsRaw, isLoading: loadingDoctors } = useQuery({
    queryKey: ['patient', 'doctors', selectedHospital?.id, departmentFilter, doctorSearch],
    queryFn: async () => {
      const params: Record<string, string> = { tenantId: selectedHospital!.id };
      if (departmentFilter) params.departmentId = departmentFilter;
      if (doctorSearch.trim()) params.search = doctorSearch.trim();
      const res = await apiGet<BookingDoctor[]>('/patient-portal/doctors', { params });
      return res.data ?? [];
    },
    enabled: !!selectedHospital && step === 'doctor',
  });
  const doctors = doctorsRaw ?? [];

  // Available slots
  const dateStr = selectedDate ? toInputDateStr(selectedDate) : '';

  const { data: slotsRaw, isLoading: loadingSlots } = useQuery({
    queryKey: ['patient', 'slots', selectedDoctor?.id, dateStr, selectedHospital?.id],
    queryFn: async () => {
      const res = await apiGet<{ slots: TimeSlot[]; message?: string }>(
        `/patient-portal/doctors/${selectedDoctor!.id}/slots`,
        { params: { tenantId: selectedHospital!.id, date: dateStr } },
      );
      return res.data;
    },
    enabled: !!selectedDoctor && !!selectedDate && !!selectedHospital && step === 'datetime',
  });

  // Show all slots but mark past/booked status
  const allSlots = slotsRaw?.slots ?? [];
  const currentTime = getCurrentISTTime();
  const isTodaySelected = dateStr ? isToday(dateStr) : false;
  const slots = allSlots.map((slot) => ({
    ...slot,
    isPast: isTodaySelected && slot.startTime < currentTime,
  }));
  const slotsMessage = slotsRaw?.message;

  // Payment info for selected hospital
  const { data: paymentInfoRaw } = useQuery({
    queryKey: ['patient', 'payment-info', selectedHospital?.id],
    queryFn: async () => {
      const res = await apiGet<PaymentInfo>('/patient-portal/payment-info', {
        params: { tenantId: selectedHospital!.id },
      });
      return res.data;
    },
    enabled: !!selectedHospital,
  });
  const paymentInfo = paymentInfoRaw ?? { onlinePaymentAvailable: false };

  // ── Derived ────────────────────────────────────────────
  const consultationFee = selectedDoctor?.consultationFee ?? 0;
  const hasPayment = consultationFee > 0;
  const canPayOnline = paymentInfo.onlinePaymentAvailable;

  // ── Book Mutation ──────────────────────────────────────

  const bookMutation = useMutation({
    mutationFn: async () => {
      return apiPost<{ id: string }>('/patient-portal/book-appointment', {
        tenantId: selectedHospital!.id,
        doctorId: selectedDoctor!.id,
        appointmentDate: dateStr,
        startTime: selectedSlot!.startTime,
        endTime: selectedSlot!.endTime,
        reason: reason || undefined,
      });
    },
    onSuccess: (res) => {
      const appointmentId = res.data?.id;
      setBookedAppointmentId(appointmentId ?? null);
      queryClient.invalidateQueries({ queryKey: ['patient', 'appointments'] });
      // Always go to payment step — shows pay online / pay at front desk
      setStep('payment');
    },
  });

  // ── Razorpay Payment ──────────────────────────────────

  const initiateOnlinePayment = useCallback(async () => {
    if (!bookedAppointmentId) return;
    setPaymentProcessing(true);

    try {
      // 1. Create Razorpay order
      const orderRes = await apiPost<PaymentOrderResponse>('/patient-portal/create-payment-order', {
        appointmentId: bookedAppointmentId,
      });
      const order = orderRes.data;
      if (!order) throw new Error('Failed to create payment order');

      // 2. Open Razorpay checkout
      const options: RazorpayOptions = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: selectedHospital?.name || 'Hospital',
        description: `Consultation Fee – Dr. ${selectedDoctor?.firstName} ${selectedDoctor?.lastName}`,
        order_id: order.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            // 3. Verify payment
            await apiPost('/patient-portal/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setPaymentComplete(true);
            setPaymentProcessing(false);
            toast.success('Payment successful! Appointment confirmed.');
          } catch {
            setPaymentProcessing(false);
            toast.error('Payment verification failed. Contact hospital for help.');
          }
        },
        prefill: {
          name: user ? `${user.firstName} ${user.lastName}` : '',
          email: user?.email ?? '',
          contact: user?.phone ?? '',
        },
        theme: { color: '#0a685a' },
        modal: {
          ondismiss: () => {
            setPaymentProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setPaymentProcessing(false);
      toast.error(err?.response?.data?.message || 'Failed to initiate payment');
    }
  }, [bookedAppointmentId, selectedHospital, selectedDoctor, user]);

  // ── Disabled days for calendar ─────────────────────────

  const disabledDays = useMemo(() => {
    if (!selectedDoctor) return undefined;
    const available = new Set(selectedDoctor.availableDays);
    return (date: Date) => {
      // Always disable past dates
      if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
      // If doctor has schedule entries, only allow those days
      if (available.size > 0) return !available.has(date.getDay());
      // No schedule configured yet — allow all future dates
      return false;
    };
  }, [selectedDoctor]);

  // ── Helpers ────────────────────────────────────────────

  const formatTime = (t: string) => formatTime24(t) || t;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const goBack = () => {
    if (step === 'doctor') {
      setStep('hospital');
      setSelectedHospital(null);
      setSelectedDoctor(null);
      setDoctorSearch('');
      setDepartmentFilter('');
    } else if (step === 'datetime') {
      setStep('doctor');
      setSelectedDate(undefined);
      setSelectedSlot(null);
    } else if (step === 'confirm') {
      setStep('datetime');
    }
    // No back from payment step — appointment already created
  };

  const stepLabels: { key: BookingStep; label: string }[] = [
    { key: 'hospital', label: 'Hospital' },
    { key: 'doctor', label: 'Doctor' },
    { key: 'datetime', label: 'Date & Time' },
    { key: 'confirm', label: 'Confirm' },
    { key: 'payment', label: 'Payment' },
  ];
  const stepIndex = stepLabels.findIndex((s) => s.key === step);

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        {step !== 'hospital' && step !== 'payment' && (
          <button
            onClick={goBack}
            className="rounded-lg p-2 hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-foreground">Book Appointment</h1>
          <p className="text-sm text-muted-foreground">
            {step === 'hospital' && 'Select a hospital to book your appointment'}
            {step === 'doctor' && `Booking at ${selectedHospital?.name}`}
            {step === 'datetime' && `Dr. ${selectedDoctor?.firstName} ${selectedDoctor?.lastName}`}
            {step === 'confirm' && 'Review and confirm your appointment'}
            {step === 'payment' && 'Complete your payment'}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {stepLabels.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold flex-shrink-0 transition-colors',
                  i <= stepIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {i < stepIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn(
                'text-xs font-medium hidden sm:inline whitespace-nowrap',
                i <= stepIndex ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {s.label}
              </span>
            </div>
            {i < stepLabels.length - 1 && (
              <div className={cn(
                'h-0.5 w-full mx-2 rounded-full transition-colors',
                i < stepIndex ? 'bg-primary' : 'bg-muted',
              )} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Hospital ── */}
      {step === 'hospital' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search hospital by name, city, or address..."
                value={hospitalSearch}
                onChange={(e) => setHospitalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setHospitalSearchQuery(hospitalSearch.trim());
                    setHospitalPage(1);
                  }
                }}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => {
                setHospitalSearchQuery(hospitalSearch.trim());
                setHospitalPage(1);
              }}
            >
              Search
            </Button>
            {hospitalSearchQuery && (
              <Button
                variant="outline"
                onClick={() => {
                  setHospitalSearch('');
                  setHospitalSearchQuery('');
                  setHospitalPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {hospitalSearchQuery && (
            <p className="text-xs text-muted-foreground">
              Showing results for &quot;{hospitalSearchQuery}&quot; &mdash; {hospitalMeta.total} hospital{hospitalMeta.total !== 1 ? 's' : ''} found
            </p>
          )}

          {loadingHospitals ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : hospitals.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No hospitals found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {hospitalSearchQuery ? 'Try a different search term' : 'No hospitals are available at the moment'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {hospitals.map((hospital) => (
                <button
                  key={hospital.id}
                  onClick={() => {
                    setSelectedHospital(hospital);
                    setStep('doctor');
                  }}
                  className="flex w-full items-start gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 hover:border-primary/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0 mt-0.5">
                    {hospital.logoUrl ? (
                      <img src={hospital.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <Building2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{hospital.name}</p>
                      {hospital.hospitalCode && (
                        <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold font-mono text-primary tracking-wider shrink-0">
                          {hospital.hospitalCode}
                        </span>
                      )}
                    </div>
                    {hospital.address && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {hospital.address}
                          {hospital.city && `, ${hospital.city}`}
                          {hospital.state && `, ${hospital.state}`}
                        </span>
                      </div>
                    )}
                    {!hospital.address && (hospital.city || hospital.state) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{[hospital.city, hospital.state].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {hospital.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {hospital.phone}
                        </span>
                      )}
                      {hospital.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {hospital.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
                </button>
              ))}
            </div>
          )}

          {hospitalMeta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Page {hospitalMeta.page} of {hospitalMeta.totalPages} ({hospitalMeta.total} hospitals)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={hospitalPage <= 1} onClick={() => setHospitalPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={hospitalPage >= hospitalMeta.totalPages} onClick={() => setHospitalPage((p) => p + 1)}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Doctor ── */}
      {step === 'doctor' && (
        <div className="space-y-4">
          {selectedHospital && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{selectedHospital.name}</p>
                  {selectedHospital.hospitalCode && (
                    <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold font-mono text-primary tracking-wider shrink-0">
                      {selectedHospital.hospitalCode}
                    </span>
                  )}
                </div>
                {(selectedHospital.city || selectedHospital.state) && (
                  <p className="text-xs text-muted-foreground">
                    {[selectedHospital.city, selectedHospital.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search doctor by name..."
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {departments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setDepartmentFilter('')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                  !departmentFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                All
              </button>
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setDepartmentFilter(dept.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                    departmentFilter === dept.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          )}

          {loadingDoctors ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : doctors.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <Stethoscope className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No doctors found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or department filter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {doctors.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => { setSelectedDoctor(doc); setStep('datetime'); }}
                  className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 hover:border-primary/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">Dr. {doc.firstName} {doc.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.specialization ?? doc.department?.name ?? 'General'}
                    </p>
                    {doc.qualifications && (
                      <p className="text-xs text-muted-foreground mt-0.5">{doc.qualifications}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    {doc.consultationFee != null && doc.consultationFee > 0 && (
                      <p className="text-sm font-bold text-primary">&#8377;{doc.consultationFee}</p>
                    )}
                    {doc.experienceYears != null && (
                      <p className="text-xs text-muted-foreground">{doc.experienceYears} yrs exp</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Date & Time ── */}
      {step === 'datetime' && (
        <div className="space-y-5">
          {selectedDoctor && selectedHospital && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <User className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedDoctor.specialization ?? selectedDoctor.department?.name ?? 'General'}
                  {' \u00b7 '}{selectedHospital.name}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Select Date
            </h3>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => { setSelectedDate(date ?? undefined); setSelectedSlot(null); }}
                disabled={disabledDays}
                className="rounded-lg border"
              />
            </div>
          </div>

          {selectedDate && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Available Slots for {selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </h3>
              {loadingSlots ? (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : slotsMessage && slots.length === 0 ? (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-center">{slotsMessage}</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-center">No slots available</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {slots.map((slot) => {
                    const isDisabled = !slot.available || slot.isPast;
                    return (
                      <button
                        key={slot.startTime}
                        disabled={isDisabled}
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                          !slot.available && 'opacity-60 cursor-not-allowed bg-red-50 text-red-400 border-red-200 line-through dark:bg-red-950/20 dark:text-red-400/60 dark:border-red-900/30',
                          slot.available && slot.isPast && 'opacity-40 cursor-not-allowed text-muted-foreground',
                          slot.available && !slot.isPast && selectedSlot?.startTime === slot.startTime
                            ? 'border-primary bg-primary text-primary-foreground'
                            : slot.available && !slot.isPast && 'hover:border-primary hover:bg-primary/5',
                        )}
                      >
                        <span className="flex flex-col items-center leading-tight">
                          <span>{formatTime(slot.startTime)}</span>
                          {!slot.available && (
                            <span className="text-[9px] font-bold no-underline" style={{ textDecoration: 'none' }}>Booked</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {selectedSlot && (
            <Button className="w-full" size="lg" onClick={() => setStep('confirm')}>
              Continue to Confirm
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      )}

      {/* ── Step 4: Confirm ── */}
      {step === 'confirm' && selectedDoctor && selectedDate && selectedSlot && selectedHospital && (
        <div className="space-y-5">
          {/* Summary card */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Appointment Summary</h3>

            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Hospital</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{selectedHospital.name}</p>
                  {selectedHospital.hospitalCode && (
                    <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold font-mono text-primary tracking-wider">
                      {selectedHospital.hospitalCode}
                    </span>
                  )}
                </div>
                {selectedHospital.address && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedHospital.address}
                    {selectedHospital.city && `, ${selectedHospital.city}`}
                    {selectedHospital.state && `, ${selectedHospital.state}`}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t" />

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Doctor</p>
                <p className="text-sm font-semibold">
                  Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedDoctor.specialization ?? selectedDoctor.department?.name ?? 'General'}
                </p>
              </div>
            </div>

            <div className="border-t" />

            <div className="flex items-start gap-3">
              <CalendarIcon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Date & Time</p>
                <p className="text-sm font-semibold">
                  {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                </p>
              </div>
            </div>

            {hasPayment && (
              <>
                <div className="border-t" />
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Consultation Fee</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(consultationFee)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {canPayOnline
                        ? 'You can pay online or at the front desk'
                        : 'Payable at the hospital front desk'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Reason */}
          <div className="rounded-xl border bg-card p-5">
            <label className="text-sm font-semibold text-foreground mb-2 block">Reason for visit (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Follow-up checkup, headache, routine health checkup..."
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{reason.length}/500</p>
          </div>

          {bookMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">
                {(bookMutation.error as any)?.response?.data?.message || 'Failed to book appointment. Please try again.'}
              </p>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={() => bookMutation.mutate()}
            disabled={bookMutation.isPending}
          >
            {bookMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <CalendarIcon className="h-5 w-5 mr-2" />
            )}
            Confirm & Proceed to Payment
          </Button>
        </div>
      )}

      {/* ── Step 5: Payment ── */}
      {step === 'payment' && selectedDoctor && selectedHospital && (
        <div className="space-y-5">
          {/* Payment required banner */}
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <CreditCard className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Payment Required</p>
              <p className="text-xs text-amber-700">
                Complete payment to confirm your appointment with Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}. Leaving without payment will cancel the booking.
              </p>
            </div>
          </div>

          {/* Payment completed state */}
          {paymentComplete ? (
            <div className="rounded-xl border bg-card p-8 text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Payment Successful</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatCurrency(consultationFee)} paid for your consultation with Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                Payment secured by Razorpay
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  setPostFormsRedirect('/patient-portal/appointments');
                  setShowIntakeForms(true);
                }}
              >
                View My Appointments
              </Button>
            </div>
          ) : (
            /* Payment options */
            <div className="space-y-4">
              {/* Fee summary */}
              {hasPayment && (
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Consultation Fee</p>
                      <p className="text-xs text-muted-foreground">
                        Dr. {selectedDoctor.firstName} {selectedDoctor.lastName} &middot; {selectedHospital.name}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(consultationFee)}</p>
                  </div>
                </div>
              )}

              {/* Payment method options */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Choose Payment Method</h3>

                {/* Pay Online — only if hospital has bank connected */}
                {canPayOnline && hasPayment && (
                  <button
                    onClick={initiateOnlinePayment}
                    disabled={paymentProcessing}
                    className="flex w-full items-center gap-4 rounded-xl border-2 border-primary bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10 disabled:opacity-60 disabled:pointer-events-none"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">Pay Online</p>
                      <p className="text-xs text-muted-foreground">
                        UPI, Credit/Debit Card, Net Banking
                      </p>
                    </div>
                    {paymentProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                    ) : (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-sm font-bold text-primary">{formatCurrency(consultationFee)}</span>
                        <ChevronRight className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </button>
                )}

                {/* Online unavailable notice */}
                {!canPayOnline && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <Shield className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      Online payment is not available for this hospital. Please pay at the front desk.
                    </p>
                  </div>
                )}

                {/* Pay at Front Desk — always shown */}
                <button
                  onClick={async () => {
                    if (bookedAppointmentId) {
                      try {
                        await apiPost('/patient-portal/confirm-frontdesk-payment', {
                          appointmentId: bookedAppointmentId,
                        });
                      } catch {
                        // Bill creation failed — still redirect, front desk can handle
                      }
                    }
                    toast.success('Appointment booked! Please pay at the hospital front desk.');
                    setPostFormsRedirect('/patient-portal/appointments');
                    setShowIntakeForms(true);
                  }}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors hover:bg-muted/50 hover:border-primary/40',
                    !canPayOnline && 'border-2 border-primary bg-primary/5 hover:bg-primary/10',
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 flex-shrink-0">
                    <Banknote className="h-6 w-6 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Pay at Front Desk</p>
                    <p className="text-xs text-muted-foreground">
                      {hasPayment
                        ? 'Cash, Card, or UPI at the hospital reception'
                        : 'Consultation fee will be collected at the hospital'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </button>
              </div>

              {canPayOnline && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  Payments are secure and powered by Razorpay
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Intake forms — auto-prompts the patient to fill any forms the hospital has
          assigned to the 'appointment_booking' trigger. Front desk and doctor will see
          the responses on the patient/appointment view.
          We pass tenantId={selectedHospital.id} explicitly because the patient is
          registered under the platform tenant, not under this hospital. */}
      <IntakeFormsModal
        open={showIntakeForms}
        trigger="appointment_booking"
        tenantId={selectedHospital?.id}
        context={{ appointmentId: bookedAppointmentId ?? undefined }}
        onComplete={() => {
          setShowIntakeForms(false);
          if (postFormsRedirect) router.push(postFormsRedirect);
        }}
      />
    </div>
  );
}
