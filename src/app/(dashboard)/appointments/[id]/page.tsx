'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate, formatDateLong } from '@/lib/date-utils';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PageLoading } from '@/components/shared/loading';
import { ArrowLeft, Calendar, Clock, User, Stethoscope, CheckCircle2, XCircle, PlayCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';
import type { Appointment } from '@/types';
import { PatientFormSubmissionsPanel } from '@/components/forms/patient-form-submissions-panel';

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchAppointment = async () => {
      try {
        const { data } = await apiClient.get(`/appointments/${id}`);
        setAppointment(data.data);
      } catch {
        toast.error('Failed to fetch appointment details');
        router.push('/appointments');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAppointment();
  }, [id, router]);

  const updateStatus = async (status: string) => {
    setIsUpdating(true);
    try {
      const { data } = await apiClient.patch(`/appointments/${id}/status`, { status });
      setAppointment(data.data);
      toast.success(`Appointment ${status.replace(/_/g, ' ')} successfully`);
    } catch {
      toast.error('Failed to update appointment status');
    } finally {
      setIsUpdating(false);
      setCancelDialogOpen(false);
    }
  };

  if (isLoading) return <PageLoading />;
  if (!appointment) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment Details"
        description={`Appointment on ${(() => { try { return formatDate(appointment.appointmentDate); } catch { return appointment.appointmentDate; } })()}`}
        action={
          <Button variant="outline" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Appointment Information</CardTitle>
              <StatusBadge status={appointment.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">
                    {(() => { try { return formatDateLong(appointment.appointmentDate); } catch { return appointment.appointmentDate; } })()}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="text-sm font-medium">{appointment.startTime} - {appointment.endTime}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <button
                    onClick={() => router.push(`/patients/${appointment.patientId}`)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {appointment.patient?.firstName} {appointment.patient?.lastName}
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Stethoscope className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Doctor</p>
                  <p className="text-sm font-medium">
                    {appointment.doctor?.user
                      ? `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`
                      : 'Not assigned'}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs text-muted-foreground mb-1">Type</p>
              <p className="text-sm font-medium capitalize">{appointment.type?.replace(/_/g, ' ')}</p>
            </div>

            {appointment.reason && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reason</p>
                <p className="text-sm">{appointment.reason}</p>
              </div>
            )}

            {appointment.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{appointment.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(appointment.status === 'booked' || appointment.status === 'confirmed') && (
              <>
                {appointment.status === 'booked' && (
                  <Button
                    className="w-full gap-2"
                    onClick={() => updateStatus('confirmed')}
                    disabled={isUpdating}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm
                  </Button>
                )}
                <Button
                  className="w-full gap-2"
                  onClick={() => updateStatus('checked_in')}
                  disabled={isUpdating}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Check In
                </Button>
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={isUpdating}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Appointment
                </Button>
              </>
            )}
            {appointment.status === 'checked_in' && (
              <Button
                className="w-full gap-2"
                onClick={() => updateStatus('in_consultation')}
                disabled={isUpdating}
              >
                <PlayCircle className="h-4 w-4" />
                Start Consultation
              </Button>
            )}
            {appointment.status === 'in_consultation' && (
              <Button
                className="w-full gap-2"
                onClick={() => updateStatus('completed')}
                disabled={isUpdating}
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </Button>
            )}
            {['completed', 'cancelled', 'no_show'].includes(appointment.status) && (
              <p className="text-sm text-center text-muted-foreground">
                No further actions available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Submissions */}
      {appointment.patientId && (
        <PatientFormSubmissionsPanel
          patientId={appointment.patientId}
          appointmentId={appointment.id}
          title="Submitted Forms"
        />
      )}

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Appointment"
        description="Are you sure you want to cancel this appointment? This action cannot be undone."
        confirmLabel="Yes, Cancel"
        onConfirm={() => updateStatus('cancelled')}
        isLoading={isUpdating}
      />
    </div>
  );
}
