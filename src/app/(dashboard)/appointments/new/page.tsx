'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { ArrowLeft, CalendarPlus } from 'lucide-react';
import apiClient from '@/lib/api-client';

const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  appointmentDate: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  type: z.enum(['consultation', 'follow_up', 'emergency', 'procedure']),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

export default function NewAppointmentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      type: 'consultation',
    },
  });

  const onSubmit = async (data: AppointmentFormData) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/appointments', data);
      toast.success('Appointment scheduled successfully!');
      router.push(`/appointments/${response.data.data.id}`);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to schedule appointment.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Appointment"
        description="Schedule a new patient appointment"
        action={
          <Button variant="outline" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appointment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID *</Label>
              <Input id="patientId" {...register('patientId')} placeholder="Enter patient ID" />
              {errors.patientId && <p className="text-sm text-destructive">{errors.patientId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctorId">Doctor ID *</Label>
              <Input id="doctorId" {...register('doctorId')} placeholder="Enter doctor ID" />
              {errors.doctorId && <p className="text-sm text-destructive">{errors.doctorId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentDate">Date *</Label>
              <Input id="appointmentDate" type="date" {...register('appointmentDate')} />
              {errors.appointmentDate && <p className="text-sm text-destructive">{errors.appointmentDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select defaultValue="consultation" onValueChange={(val) => setValue('type', (val ?? 'consultation') as AppointmentFormData['type'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="procedure">Procedure</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input id="startTime" type="time" {...register('startTime')} />
              {errors.startTime && <p className="text-sm text-destructive">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input id="endTime" type="time" {...register('endTime')} />
              {errors.endTime && <p className="text-sm text-destructive">{errors.endTime.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reason">Reason for Visit</Label>
              <Input id="reason" {...register('reason')} placeholder="Brief reason for the appointment" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" {...register('notes')} placeholder="Additional notes..." rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Scheduling...
              </>
            ) : (
              <>
                <CalendarPlus className="h-4 w-4" />
                Schedule Appointment
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
