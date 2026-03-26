'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiPost } from '@/lib/api';
import type { Patient } from '@/types';

// ============================================================
// Schema
// ============================================================

const createPatientSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  gender: z.enum(['male', 'female', 'other'], { error: 'Gender is required' }),
  dateOfBirth: z.string().optional(),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^[+]?[\d\s()-]{7,15}$/, 'Invalid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

type CreatePatientFormData = z.infer<typeof createPatientSchema>;

// ============================================================
// Constants
// ============================================================

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

// ============================================================
// Props
// ============================================================

interface CreatePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (patient: Patient) => void;
}

// ============================================================
// Component
// ============================================================

export function CreatePatientDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreatePatientDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePatientFormData>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      gender: 'male',
      dateOfBirth: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      bloodGroup: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
    },
  });

  const genderValue = watch('gender');
  const bloodGroupValue = watch('bloodGroup');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: CreatePatientFormData) => {
      // Build payload, stripping empty optional fields
      const payload: Record<string, unknown> = {
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        phone: data.phone,
      };
      if (data.dateOfBirth) payload.dateOfBirth = data.dateOfBirth;
      if (data.email) payload.email = data.email;
      if (data.address) payload.address = data.address;
      if (data.city) payload.city = data.city;
      if (data.state) payload.state = data.state;
      if (data.bloodGroup) payload.bloodGroup = data.bloodGroup;

      // Build emergency contact if provided
      if (data.emergencyContactName || data.emergencyContactPhone) {
        payload.emergencyContacts = [
          {
            name: data.emergencyContactName || '',
            phone: data.emergencyContactPhone || '',
            relationship: 'emergency',
          },
        ];
      }

      const response = await apiPost<Patient>('/patients', payload);
      return response.data;
    },
    onSuccess: (patient) => {
      toast.success('Patient registered successfully');
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      onOpenChange(false);
      onSuccess?.(patient);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to register patient');
    },
  });

  const onSubmit = (data: CreatePatientFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto backdrop-blur-sm bg-background/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Register New Patient
          </DialogTitle>
          <DialogDescription>
            Fill in the patient details below. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-firstName">First Name *</Label>
              <Input
                id="cp-firstName"
                placeholder="Enter first name"
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-lastName">Last Name *</Label>
              <Input
                id="cp-lastName"
                placeholder="Enter last name"
                {...register('lastName')}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Gender + DOB */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Gender *</Label>
              <Select
                value={genderValue}
                onValueChange={(value: string | null) => {
                  if (value) setValue('gender', value as 'male' | 'female' | 'other');
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="text-xs text-destructive">{errors.gender.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-dob">Date of Birth</Label>
              <Input
                id="cp-dob"
                type="date"
                {...register('dateOfBirth')}
              />
            </div>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-phone">Phone *</Label>
              <Input
                id="cp-phone"
                placeholder="Enter phone number"
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-email">Email</Label>
              <Input
                id="cp-email"
                type="email"
                placeholder="Enter email (optional)"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-address">Address</Label>
            <Input
              id="cp-address"
              placeholder="Enter address"
              {...register('address')}
            />
          </div>

          {/* City + State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-city">City</Label>
              <Input
                id="cp-city"
                placeholder="Enter city"
                {...register('city')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-state">State</Label>
              <Input
                id="cp-state"
                placeholder="Enter state"
                {...register('state')}
              />
            </div>
          </div>

          {/* Blood Group */}
          <div className="space-y-1.5">
            <Label>Blood Group</Label>
            <Select
              value={bloodGroupValue || ''}
              onValueChange={(value: string | null) => {
                setValue('bloodGroup', value || '');
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select blood group" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_GROUPS.map((bg) => (
                  <SelectItem key={bg} value={bg}>
                    {bg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Emergency Contact */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Emergency Contact
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-ecName">Contact Name</Label>
                <Input
                  id="cp-ecName"
                  placeholder="Emergency contact name"
                  {...register('emergencyContactName')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-ecPhone">Contact Phone</Label>
                <Input
                  id="cp-ecPhone"
                  placeholder="Emergency contact phone"
                  {...register('emergencyContactPhone')}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Registering...
                </span>
              ) : (
                'Register Patient'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
