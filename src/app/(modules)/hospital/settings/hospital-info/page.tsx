'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Save, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useClinicStore } from '@/stores/clinic-store';
import { apiGet, apiPut } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import type { MyHospital } from '@/types';

// ─── Schema ─────────────────────────────────────────────
const hospitalInfoSchema = z.object({
  name: z.string().min(2, 'Hospital name must be at least 2 characters').max(255),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.email('Invalid email').optional().or(z.literal('')),
  website: z.string().optional(),
  licenseNumber: z.string().optional(),
});

type HospitalInfoForm = z.infer<typeof hospitalInfoSchema>;

// ─── Page ───────────────────────────────────────────────
export default function HospitalInfoPage() {
  const router = useRouter();
  const selectedClinic = useClinicStore((s) => s.selectedClinic);
  const queryClient = useQueryClient();

  const { data: hospital, isLoading, error } = useQuery({
    queryKey: ['hospital', 'my', selectedClinic?.id],
    queryFn: async () => {
      const res = await apiGet<MyHospital>(`/hospitals/my/${selectedClinic!.id}`);
      return res.data;
    },
    enabled: !!selectedClinic?.id,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<HospitalInfoForm>({
    resolver: zodResolver(hospitalInfoSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      state: '',
      country: '',
      phone: '',
      email: '',
      website: '',
      licenseNumber: '',
    },
  });

  // Populate form when hospital data loads
  useEffect(() => {
    if (hospital) {
      reset({
        name: hospital.name || '',
        address: hospital.address || '',
        city: hospital.city || '',
        state: hospital.state || '',
        country: hospital.country || '',
        phone: hospital.phone || '',
        email: hospital.email || '',
        website: hospital.website || '',
        licenseNumber: hospital.licenseNumber || '',
      });
    }
  }, [hospital, reset]);

  const updateMutation = useMutation({
    mutationFn: async (formData: HospitalInfoForm) => {
      const body = { ...formData, email: formData.email || undefined };
      const res = await apiPut<MyHospital>(`/hospitals/my/${selectedClinic!.id}`, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Hospital information updated successfully');
      queryClient.invalidateQueries({ queryKey: ['hospital', 'my', selectedClinic?.id] });
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to update hospital information');
    },
  });

  const onSubmit = (data: HospitalInfoForm) => {
    updateMutation.mutate(data);
  };

  // ─── Loading Skeleton ───────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-xl bg-surface-container-low" />
          <Skeleton className="h-7 w-48 bg-surface-container-low" />
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24 bg-surface-container-low" />
                <Skeleton className="h-8 w-full bg-surface-container-low" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <button
          onClick={() => router.push('/hospital/settings')}
          className="flex items-center gap-2 font-label text-sm text-on-surface-variant hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </button>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-on-surface-variant/40 mb-3" />
            <p className="font-label text-on-surface-variant">Failed to load hospital information.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['hospital', 'my'] })}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/hospital/settings')}
            className="flex items-center justify-center h-8 w-8 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-headline text-xl font-bold">Hospital Information</h1>
            <p className="font-label text-[10px] text-on-surface-variant">
              Manage your hospital details and contact information
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleSubmit(onSubmit)}
          disabled={!isDirty || updateMutation.isPending}
          className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow"
        >
          {updateMutation.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Form Card */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="flex items-center gap-2 border-b border-surface-container px-6 py-4">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-headline text-lg font-bold">Basic Details</h3>
            <p className="font-label text-[10px] text-on-surface-variant">Core information about your hospital</p>
          </div>
        </div>
        <div className="p-6">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2"
          >
            {/* Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Hospital Name *</Label>
              <Input id="name" {...register('name')} placeholder="Enter hospital name" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="hospital@example.com"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} placeholder="+91 XXXX XXXX" />
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input id="website" {...register('website')} placeholder="https://hospital.com" />
              {errors.website && (
                <p className="text-xs text-destructive">{errors.website.message}</p>
              )}
            </div>

            {/* License Number */}
            <div className="space-y-1.5">
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input
                id="licenseNumber"
                {...register('licenseNumber')}
                placeholder="Enter license number"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                {...register('address')}
                placeholder="Street address"
                className="min-h-16"
              />
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register('city')} placeholder="City" />
            </div>

            {/* State */}
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" {...register('state')} placeholder="State" />
            </div>

            {/* Country */}
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...register('country')} placeholder="Country" />
            </div>
          </form>
        </div>
      </div>

      {/* Info footer */}
      {hospital && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 font-label text-xs text-on-surface-variant">
            <span>
              Slug:{' '}
              <strong className="text-foreground">{hospital.slug}</strong>
            </span>
            <span>
              Status:{' '}
              <Badge variant={hospital.isActive ? 'default' : 'destructive'} className="ml-1">
                {hospital.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </span>
            <span>
              Created:{' '}
              <strong className="text-foreground">
                {formatDate(hospital.createdAt)}
              </strong>
            </span>
            <span>
              Updated:{' '}
              <strong className="text-foreground">
                {formatDate(hospital.updatedAt)}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
