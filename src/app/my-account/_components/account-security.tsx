'use client';

// Gap 297: My Account — two-factor sign-in (set up / turn off) and changing
// the phone number with a one-time code. Every action here is checked and
// audited server-side; this file only collects input and shows the outcome.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiPost } from '@/lib/api';

/** The server's message (validation detail first), or a fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string; errors?: { message: string }[] } } })?.response
    ?.data;
  return data?.errors?.[0]?.message || data?.message || fallback;
}

const digitsOnly = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 font-label text-sm text-error">
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────
// Two-factor sign-in
// ─────────────────────────────────────────────────────────────

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
}

export function TwoFactorCard({
  enabled,
  onChanged,
}: {
  /** undefined while the live profile has not loaded. */
  enabled: boolean | undefined;
  onChanged: () => void;
}) {
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSetup(null);
    setCode('');
    setPassword('');
    setDisabling(false);
    setError(null);
  };

  const start = useMutation({
    mutationFn: async () => (await apiPost<SetupResponse>('/auth/2fa/setup')).data,
    onSuccess: (data) => {
      setError(null);
      setCode('');
      if (data) setSetup(data);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not start two-factor setup. Try again.')),
  });

  const verify = useMutation({
    mutationFn: () => apiPost('/auth/2fa/verify', { code }),
    onSuccess: () => {
      toast.success('Two-factor sign-in is on');
      reset();
      onChanged();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not verify the code. Try again.')),
  });

  const disable = useMutation({
    mutationFn: () => apiPost('/auth/2fa/disable', { currentPassword: password, code }),
    onSuccess: () => {
      toast.success('Two-factor sign-in is off');
      reset();
      onChanged();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not turn off two-factor sign-in. Try again.')),
  });

  return (
    <section
      aria-labelledby="twofa-heading"
      className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 id="twofa-heading" className="font-headline text-lg font-bold">
            Two-factor sign-in
          </h2>
          {enabled !== undefined && (
            <Badge
              className={`border-0 text-[10px] font-bold ${
                enabled ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {enabled ? 'On' : 'Off'}
            </Badge>
          )}
        </div>
        {enabled === false && !setup && (
          <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
            {start.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Set up two-factor sign-in
          </Button>
        )}
        {enabled === true && !disabling && (
          <Button size="sm" variant="outline" onClick={() => { setError(null); setDisabling(true); }}>
            Turn off
          </Button>
        )}
      </div>

      <p className="font-label text-sm text-on-surface-variant">
        {enabled
          ? 'Signing in asks for a code from your authenticator app as well as your password.'
          : 'Add a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) to your sign-in.'}
      </p>

      {enabled === false && setup && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            verify.mutate();
          }}
          className="space-y-4"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="self-center rounded-lg bg-white p-3 sm:self-start" data-testid="twofa-qr">
              <QRCodeSVG value={setup.otpauthUrl} size={160} />
            </div>
            <div className="min-w-0 space-y-2 font-label text-sm">
              <p>1. Scan this QR code with your authenticator app.</p>
              <p className="text-on-surface-variant">
                Can&apos;t scan it? Enter this key in the app instead:
              </p>
              <code className="block break-all rounded bg-surface-container-low px-2 py-1 font-mono text-sm">
                {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
              </code>
              <p className="pt-2">2. Enter the 6-digit code the app shows.</p>
              <div className="max-w-[12rem] space-y-1.5">
                <Label htmlFor="twofa-code">Code from the app</Label>
                <Input
                  id="twofa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(digitsOnly(e.target.value, 6))}
                  required
                />
              </div>
            </div>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button type="submit" disabled={verify.isPending || code.length !== 6}>
              {verify.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Verify and turn on
            </Button>
          </div>
        </form>
      )}

      {enabled === true && disabling && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            disable.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="twofa-off-password">Current password</Label>
              <Input
                id="twofa-off-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="twofa-off-code">Code from your authenticator app</Label>
              <Input
                id="twofa-off-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(digitsOnly(e.target.value, 6))}
                required
              />
            </div>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={disable.isPending || !password || code.length !== 6}>
              {disable.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Turn off two-factor sign-in
            </Button>
          </div>
        </form>
      )}

      {!setup && !disabling && error && <ErrorText>{error}</ErrorText>}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Phone number change with a one-time code
// ─────────────────────────────────────────────────────────────

interface PhoneRequestResponse {
  channel: 'email' | 'sms' | 'whatsapp';
  sentTo: string;
  expiresInSeconds: number;
}

export function PhoneChangeCard({
  currentPhone,
  onChanged,
}: {
  currentPhone: string | null | undefined;
  onChanged: (phone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<PhoneRequestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setPhone('');
    setCode('');
    setSent(null);
    setError(null);
  };

  const request = useMutation({
    mutationFn: async () => (await apiPost<PhoneRequestResponse>('/auth/me/phone/request', { phone })).data,
    onSuccess: (data) => {
      setError(null);
      setCode('');
      if (data) setSent(data);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not send the code. Try again.')),
  });

  const verify = useMutation({
    mutationFn: async () =>
      (await apiPost<{ phone: string }>('/auth/me/phone/verify', { phone, code })).data,
    onSuccess: (data) => {
      toast.success('Phone number updated');
      const updated = data?.phone ?? phone;
      reset();
      onChanged(updated);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not verify the code. Try again.')),
  });

  return (
    <section
      aria-labelledby="phone-heading"
      className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h2 id="phone-heading" className="font-headline text-lg font-bold">
            Phone number
          </h2>
          <span className="font-label text-sm text-on-surface-variant">{currentPhone || 'Not set'}</span>
        </div>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Change phone
          </Button>
        )}
      </div>

      {open && !sent && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            request.mutate();
          }}
          className="space-y-3"
        >
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="new-phone">New mobile number</Label>
            <Input
              id="new-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <p className="font-label text-xs text-on-surface-variant">
            A 10-digit Indian mobile number. We&apos;ll send a one-time code to confirm the change.
          </p>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button type="submit" disabled={request.isPending || phone.replace(/\D/g, '').length < 10}>
              {request.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Send code
            </Button>
          </div>
        </form>
      )}

      {open && sent && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            verify.mutate();
          }}
          className="space-y-3"
        >
          <p className="font-label text-sm" data-testid="phone-code-sent">
            We sent a 6-digit code {{ sms: 'by SMS', whatsapp: 'on WhatsApp', email: 'by email' }[sent.channel]} to{' '}
            <strong>{sent.sentTo}</strong>. It expires in {Math.round(sent.expiresInSeconds / 60)} minutes.
          </p>
          <div className="max-w-[12rem] space-y-1.5">
            <Label htmlFor="phone-code">Code</Label>
            <Input
              id="phone-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(digitsOnly(e.target.value, 6))}
              required
            />
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={request.isPending}
              onClick={() => {
                setError(null);
                request.mutate();
              }}
            >
              Send a new code
            </Button>
            <Button type="submit" disabled={verify.isPending || code.length !== 6}>
              {verify.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Verify and change
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
