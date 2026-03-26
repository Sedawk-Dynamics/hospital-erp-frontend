'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubmitDemoRequest } from '@/hooks/use-demo-request';

const demoSchema = z.object({
  name: z.string().min(2, 'Name is required').max(120),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Phone number is required').max(20),
  hospitalName: z.string().min(2, 'Hospital/clinic name is required').max(255),
  designation: z.string().min(2, 'Designation is required').max(100),
  city: z.string().min(2, 'City is required').max(100),
  message: z.string().min(2, 'Message is required').max(2000),
});

type DemoFormData = z.infer<typeof demoSchema>;

export function DemoRequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const submitMutation = useSubmitDemoRequest();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DemoFormData>({
    resolver: zodResolver(demoSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      hospitalName: '',
      designation: '',
      city: '',
      message: '',
    },
  });

  const onSubmit = async (data: DemoFormData) => {
    try {
      await submitMutation.mutateAsync(data);
      setSubmitted(true);
      reset();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to submit request. Please try again.';
      toast.error(message);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12 px-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Request Submitted!</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Thank you for your interest. Our team will review your request and get back to you within 24 hours.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => setSubmitted(false)}
        >
          Submit Another Request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="demo-name">Full Name <span className="text-destructive">*</span></Label>
          <Input id="demo-name" placeholder="Dr. John Smith" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-email">Email <span className="text-destructive">*</span></Label>
          <Input id="demo-email" type="email" placeholder="john@hospital.com" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="demo-phone">Phone Number <span className="text-destructive">*</span></Label>
          <Input id="demo-phone" placeholder="+91 98765 43210" {...register('phone')} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-hospital">Hospital / Clinic Name <span className="text-destructive">*</span></Label>
          <Input id="demo-hospital" placeholder="City General Hospital" {...register('hospitalName')} />
          {errors.hospitalName && <p className="text-xs text-destructive">{errors.hospitalName.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="demo-designation">Designation <span className="text-destructive">*</span></Label>
          <Input id="demo-designation" placeholder="Hospital Administrator" {...register('designation')} />
          {errors.designation && <p className="text-xs text-destructive">{errors.designation.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="demo-city">City <span className="text-destructive">*</span></Label>
          <Input id="demo-city" placeholder="Mumbai" {...register('city')} />
          {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="demo-message">Message <span className="text-destructive">*</span></Label>
        <textarea
          id="demo-message"
          rows={3}
          placeholder="Tell us about your requirements..."
          {...register('message')}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
        {errors.message && <p className="text-xs text-destructive">{errors.message.message}</p>}
      </div>

      <Button
        type="submit"
        className="w-full h-11 text-base gap-2"
        disabled={submitMutation.isPending}
      >
        {submitMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Book a Free Demo
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Our team will review and set up your free trial within 24 hours.
      </p>
    </form>
  );
}
