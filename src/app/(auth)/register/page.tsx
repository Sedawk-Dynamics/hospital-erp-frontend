'use client';

import Link from 'next/link';
import { HeartPulse } from 'lucide-react';
import { PhoneOtpForm } from '../_components/phone-otp-form';

export default function PatientRegisterPage() {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 animate-fade-in-up">
      <div className="text-center mb-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <HeartPulse className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-headline text-2xl font-extrabold tracking-tight">Create Your Account</h2>
        <p className="font-label text-sm text-on-surface-variant mt-1">
          Sign up with your phone number to access your health records, appointments, and more
        </p>
      </div>

      {/* Patient signup: a new number creates the account (asks for details);
          an existing number is rejected here and sent to sign in. */}
      <PhoneOtpForm mode="signup" />

      <div className="mt-6 pt-5 border-t border-surface-container text-center">
        <p className="font-label text-sm text-on-surface-variant">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline font-bold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
