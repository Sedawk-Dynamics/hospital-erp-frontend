'use client';

// ============================================================
// G-5 (gap #266): the hospital's e-invoice (IRP) and e-way bill portal logins,
// with Test connection.
//
// Secrets are write-only from here: the server stores them encrypted and only
// ever answers with a masked username and "set" flags, so the inputs start
// empty and a blank password on an update keeps the saved one.
// ============================================================

import { useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, KeyRound, Loader2, PlugZap, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/utils';
import {
  useDeletePortalCredentials,
  useGstPortalStatus,
  useSavePortalCredentials,
  useTestPortalConnection,
  type GstPortal,
  type PortalReadiness,
  type PortalStatus,
} from '@/hooks/use-gst-portal';

const fmtWhen = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
    : '—';

/** "Ready" / "Not available" chip, used here and beside the switches. */
export function ReadinessChip({ ready }: { ready: boolean }) {
  return ready ? (
    <span className="inline-flex items-center rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
      Ready
    </span>
  ) : (
    <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      Not available
    </span>
  );
}

function PortalCredentialsForm({
  portal,
  readiness,
  status,
}: {
  portal: GstPortal;
  readiness: PortalReadiness;
  status: PortalStatus;
}) {
  const save = useSavePortalCredentials();
  const remove = useDeletePortalCredentials();
  const test = useTestPortalConnection();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const c = readiness.credentials;
  const canStore = status.encryption.available;
  const providerReady = status.provider.configured;

  const onSave = async () => {
    try {
      await save.mutateAsync({
        portal,
        input: {
          ...(username.trim() ? { username: username.trim() } : {}),
          ...(password ? { password } : {}),
          ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
          ...(clientSecret ? { clientSecret } : {}),
        },
      });
      // Never keep a secret in component state longer than needed.
      setPassword('');
      setClientSecret('');
      toast.success(`${readiness.label} credentials saved. Run Test connection to check them.`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save the credentials.'));
    }
  };

  const onTest = async () => {
    try {
      const r = await test.mutateAsync(portal);
      if (r.ok) toast.success(r.message);
      else toast.error(`Connection failed: ${r.message}`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Test connection failed.'));
    }
  };

  const onRemove = async () => {
    try {
      await remove.mutateAsync(portal);
      toast.success(`${readiness.label} credentials removed.`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not remove the credentials.'));
    }
  };

  return (
    <div className="space-y-2 rounded-md border bg-background px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4 text-primary" /> {readiness.label} portal login
        </div>
        <ReadinessChip ready={readiness.ready} />
      </div>

      <p className="text-[12px] text-muted-foreground">
        {c.set ? (
          <>
            Saved: username <span className="font-mono">{c.usernameHint ?? '—'}</span>, password{' '}
            {c.passwordSet ? 'set' : 'not set'}, client ID {c.clientIdSet ? 'set' : 'not set'}, client secret{' '}
            {c.clientSecretSet ? 'set' : 'not set'} · updated {fmtWhen(c.updatedAt)}
          </>
        ) : (
          'No login saved yet.'
        )}
      </p>
      {c.problem ? <p className="text-[12px] text-red-700 dark:text-red-300">{c.problem}</p> : null}
      {!readiness.ready && readiness.reason ? (
        <p className="text-[12px] text-amber-800 dark:text-amber-300">Not available: {readiness.reason}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">API username</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={c.set ? 'Leave blank to keep' : 'Portal API username'}
            autoComplete="off"
            maxLength={100}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">API password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={c.passwordSet ? '•••••• (set — leave blank to keep)' : 'Portal API password'}
            autoComplete="new-password"
            maxLength={200}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Client ID (if your GSP issues one)</Label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={c.clientIdSet ? 'Set — leave blank to keep' : 'Optional'}
            autoComplete="off"
            maxLength={200}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Client secret</Label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={c.clientSecretSet ? '•••••• (set — leave blank to keep)' : 'Optional'}
            autoComplete="new-password"
            maxLength={300}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={onSave}
          disabled={save.isPending || !canStore || (!c.set && (!username.trim() || !password))}
          title={!canStore ? status.encryption.reason ?? 'Credentials cannot be stored on this server' : undefined}
          className="gap-1.5"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
          Save login
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onTest}
          disabled={test.isPending || !c.set || !providerReady}
          title={!providerReady ? status.provider.reason ?? 'No provider configured' : !c.set ? 'Save the login first' : undefined}
          className="gap-1.5"
        >
          {test.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
          Test connection
        </Button>
        {c.set ? (
          <Button size="sm" variant="ghost" onClick={onRemove} disabled={remove.isPending} className="gap-1.5 text-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
        ) : null}
      </div>

      {readiness.lastTest ? (
        <p
          className={`flex items-start gap-1.5 text-[12px] ${
            readiness.lastTest.ok ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
          }`}
        >
          {readiness.lastTest.ok ? (
            <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          Last test {fmtWhen(readiness.lastTest.at)} IST via {readiness.lastTest.provider ?? '—'}:{' '}
          {readiness.lastTest.ok ? 'connected' : 'failed'} — {readiness.lastTest.message}
        </p>
      ) : c.set ? (
        <p className="text-[12px] text-muted-foreground">Not tested since it was saved.</p>
      ) : null}
    </div>
  );
}

/**
 * The portal card on the GST settings page. Returns the status so the page can
 * disable the switches, via `useGstPortalStatus` — both read the same query.
 */
export function GstPortalSettingsCard() {
  const { data: status, isLoading, isError, error } = useGstPortalStatus();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">E-invoice and e-way bill portal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking the integration…
          </div>
        ) : isError || !status ? (
          <p className="text-[12px] text-red-700 dark:text-red-300">
            {getApiErrorMessage(error, 'The integration status could not be read.')} Until it can, e-invoicing and e-way
            bills stay unavailable.
          </p>
        ) : (
          <>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-[12px]">
              <p>
                <span className="text-muted-foreground">Provider (GSP): </span>
                {status.provider.configured ? (
                  <span className="font-medium">{status.provider.provider}</span>
                ) : (
                  <span className="font-medium text-red-700 dark:text-red-300">
                    Not configured — {status.provider.reason}
                  </span>
                )}
              </p>
              <p className="text-muted-foreground">
                Configured by the server administrator (EINVOICE_PROVIDER). An IRN can be cancelled within{' '}
                {status.cancelWindowHours} hours of its acknowledgement.
              </p>
              {status.provider.sandbox && status.provider.configured ? (
                <p className="mt-1 rounded border border-amber-400 bg-amber-50 px-2 py-1 font-semibold text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
                  {status.sandboxLabel}. IRNs and e-way bills generated here are fake, for testing only, and are labelled
                  so on every print.
                </p>
              ) : null}
              {!status.encryption.available ? (
                <p className="mt-1 text-red-700 dark:text-red-300">
                  Credentials cannot be stored: {status.encryption.reason}
                </p>
              ) : status.encryption.source === 'development-fallback' ? (
                <p className="mt-1 text-amber-800 dark:text-amber-300">
                  Using a development encryption key — set GST_PORTAL_CREDENTIALS_KEY before going live.
                </p>
              ) : null}
            </div>
            <PortalCredentialsForm portal="einvoice" readiness={status.einvoice} status={status} />
            <PortalCredentialsForm portal="eway" readiness={status.eway} status={status} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
