'use client';

// A patient's sign-in PIN: one per device. Set, change or remove the PIN of the
// device in hand, and see and remove the other devices. Everything is checked
// and audited server-side; staff have no PIN.

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import { formatDateTime } from '@/lib/date-utils';
import { authErrorCode, authErrorMessage, onlyDigits, sentByText, type CodeReceipt } from '@/lib/patient-auth';
import {
  forgetTrustedDevice,
  parseTrustedDevice,
  saveTrustedDevice,
  subscribeTrustedDevice,
  trustedDeviceSnapshot,
} from '@/lib/trusted-device';

interface PinDevice {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  locked: boolean;
}

const QUERY_KEY = ['auth', 'pin-devices'];

function PinInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="max-w-[12rem] space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(onlyDigits(e.target.value, 6))}
        required
      />
    </div>
  );
}

export function PatientPinCard({ name }: { name?: string }) {
  const queryClient = useQueryClient();
  const deviceRaw = useSyncExternalStore(subscribeTrustedDevice, trustedDeviceSnapshot, () => null);
  const here = useMemo(() => parseTrustedDevice(deviceRaw), [deviceRaw]);

  const [mode, setMode] = useState<'idle' | 'set' | 'change'>('idle');
  const [receipt, setReceipt] = useState<CodeReceipt | null>(null);
  const [code, setCode] = useState('');
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await apiGet<{ devices: PinDevice[] }>('/auth/me/pin/devices')).data?.devices ?? [],
    retry: false,
  });
  const devices = data ?? [];
  const thisDevice = here ? devices.find((d) => d.id === here.deviceId) : undefined;
  const pinHere = !!thisDevice && !thisDevice.locked;

  const reset = () => {
    setMode('idle');
    setReceipt(null);
    setCode('');
    setCurrent('');
    setPin('');
    setConfirm('');
    setError(null);
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const failed = (fallback: string) => (err: unknown) => setError(authErrorMessage(err, fallback));

  const sendCode = useMutation({
    mutationFn: async () => (await apiPost<CodeReceipt>('/auth/me/pin/code')).data,
    onSuccess: (r) => {
      setError(null);
      setReceipt(r);
      setMode('set');
    },
    onError: failed('Could not send the code. Try again.'),
  });

  const setNew = useMutation({
    mutationFn: async () =>
      (
        await apiPost<{ deviceId: string; deviceToken: string }>('/auth/me/pin', {
          pin,
          code,
          ...(here ? { deviceToken: here.deviceToken } : {}),
        })
      ).data,
    onSuccess: (d) => {
      saveTrustedDevice({ deviceId: d.deviceId, deviceToken: d.deviceToken, name });
      toast.success('PIN set for this device');
      reset();
      refresh();
    },
    onError: failed('Could not set the PIN. Try again.'),
  });

  const change = useMutation({
    mutationFn: () =>
      apiPut('/auth/me/pin', { deviceToken: here?.deviceToken, currentPin: current, newPin: pin }),
    onSuccess: () => {
      toast.success('PIN changed');
      reset();
      refresh();
    },
    onError: (err: unknown) => {
      if (here && authErrorCode(err) === 'PIN_LOCKED') {
        saveTrustedDevice({ ...here, locked: true });
        refresh();
      }
      failed('Could not change the PIN. Try again.')(err);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/auth/me/pin/devices/${id}`);
      return id;
    },
    onSuccess: (id) => {
      if (here?.deviceId === id) forgetTrustedDevice();
      toast.success('Device removed');
      refresh();
    },
    onError: failed('Could not remove the device. Try again.'),
  });

  const removeAll = useMutation({
    mutationFn: () => apiDelete('/auth/me/pin/devices'),
    onSuccess: () => {
      forgetTrustedDevice();
      toast.success('All devices removed');
      reset();
      refresh();
    },
    onError: failed('Could not remove the devices. Try again.'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== confirm) {
      setError('The PINs do not match');
      return;
    }
    setError(null);
    if (mode === 'change') change.mutate();
    else setNew.mutate();
  };

  const saving = setNew.isPending || change.isPending;
  const complete = pin.length === 6 && confirm.length === 6 && (mode === 'change' ? current.length === 6 : code.length === 6);

  return (
    <section
      aria-labelledby="pin-heading"
      className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <h2 id="pin-heading" className="font-headline text-lg font-bold">
            Sign-in PIN
          </h2>
        </div>
        {mode === 'idle' && !isLoading && !isError && (
          <div className="flex gap-2">
            {pinHere && (
              <Button size="sm" variant="outline" onClick={() => { reset(); setMode('change'); }}>
                Change PIN
              </Button>
            )}
            {!pinHere && (
              <Button size="sm" onClick={() => { setError(null); sendCode.mutate(); }} disabled={sendCode.isPending}>
                {sendCode.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Set a PIN on this device
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="font-label text-sm text-on-surface-variant">
        Sign in with 6 digits instead of a code. A PIN works only on the device it was set on. Five wrong tries lock
        it, and you sign in with a code again.
      </p>

      {mode !== 'idle' && (
        <form onSubmit={submit} className="space-y-3">
          {mode === 'set' && (
            <>
              {receipt && (
                <p className="font-label text-sm" data-testid="pin-code-sent">
                  {sentByText(receipt)}
                  <strong>{receipt.sentTo}</strong>. Enter it with your new PIN.
                </p>
              )}
              <div className="max-w-[12rem] space-y-1.5">
                <Label htmlFor="pin-code">Code</Label>
                <Input
                  id="pin-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(onlyDigits(e.target.value, 6))}
                  required
                />
              </div>
            </>
          )}
          {mode === 'change' && <PinInput id="pin-current" label="Current PIN" value={current} onChange={setCurrent} />}
          <PinInput id="pin-new" label="New PIN" value={pin} onChange={setPin} />
          <PinInput id="pin-confirm" label="New PIN again" value={confirm} onChange={setConfirm} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !complete}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {mode === 'change' ? 'Change PIN' : 'Set PIN'}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 font-label text-sm text-error">
          {error}
        </p>
      )}

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 font-label text-sm text-error">
          Couldn&apos;t load your devices.
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : devices.length === 0 ? (
        <p className="font-label text-sm text-on-surface-variant">No device has a PIN.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container-low p-3"
              >
                <div className="min-w-0">
                  <p className="font-label text-sm font-medium">
                    {d.label || 'Unknown device'}
                    {d.id === here?.deviceId && (
                      <Badge className="ml-2 border-0 bg-primary/10 text-[10px] font-bold text-primary">This device</Badge>
                    )}
                    {d.locked && (
                      <Badge className="ml-2 border-0 bg-error/10 text-[10px] font-bold text-error">Locked</Badge>
                    )}
                  </p>
                  <p className="font-label text-xs text-on-surface-variant">
                    Last used {formatDateTime(d.lastUsedAt ?? d.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Remove ${d.label || 'device'}`}
                  onClick={() => { setError(null); remove.mutate(d.id); }}
                  disabled={remove.isPending}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setError(null); removeAll.mutate(); }}
              disabled={removeAll.isPending}
            >
              Remove all devices
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
