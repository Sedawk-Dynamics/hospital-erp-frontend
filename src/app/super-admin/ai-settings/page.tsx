'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useAiConfig,
  useUpdateAiConfig,
  useResetAiConfig,
  useAiModels,
  type AiModelInfo,
} from '@/hooks/use-ai';
import { useTenants } from '@/hooks/use-super-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Sparkles, AlertTriangle, Save, Building2, RotateCcw, Info } from 'lucide-react';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-surface-container-high',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

function FeatureRow({ title, description, checked, onChange, disabled, badge }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium flex items-center gap-2">
          {title}
          {badge && <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary">{badge}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

const PLATFORM = '__platform__';
// Backend caps fallbackModels at 5 — keep the UI in lockstep so a save never 400s.
const MAX_FALLBACKS = 5;

// Keep numeric inputs within the ranges the backend enforces (temperature 0–2,
// maxOutputTokens 64–8192). An empty / NaN field (e.g. the user clears the box)
// or an out-of-range value would otherwise be sent verbatim and rejected with a
// generic "Validation error". Falls back to a sane default when not a number.
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export default function AiSettingsPage() {
  const [scope, setScope] = useState<string>(PLATFORM); // PLATFORM or a tenantId
  const tenantId = scope === PLATFORM ? null : scope;

  const { data: tenantsResp } = useTenants({ limit: 100 });
  const hospitals = tenantsResp?.data ?? [];
  const { data: catalog } = useAiModels();
  const { data: config, isLoading } = useAiConfig(tenantId);
  const update = useUpdateAiConfig();
  const reset = useResetAiConfig();

  const [form, setForm] = useState({
    provider: 'gemini',
    textModel: 'gemini-2.5-flash',
    fallbackModels: [] as string[],
    temperature: 0.4,
    maxOutputTokens: 1024,
    patientChatEnabled: true,
    bloodReportEnabled: true,
    platformChatEnabled: true,
    dischargeAiEnabled: true,
    radiologyAiEnabled: false,
    progressNotesAiEnabled: true,
    ocrInvoiceEnabled: true,
  });

  useEffect(() => {
    if (config) {
      setForm({
        provider: config.provider,
        textModel: config.textModel,
        fallbackModels: config.fallbackModels ?? [],
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        patientChatEnabled: config.features.patientChatEnabled,
        bloodReportEnabled: config.features.bloodReportEnabled,
        platformChatEnabled: config.features.platformChatEnabled,
        dischargeAiEnabled: config.features.dischargeAiEnabled,
        radiologyAiEnabled: config.features.radiologyAiEnabled,
        progressNotesAiEnabled: config.features.progressNotesAiEnabled,
        ocrInvoiceEnabled: config.features.ocrInvoiceEnabled,
      });
    }
  }, [config]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const providerModels: AiModelInfo[] = useMemo(
    () => (catalog?.models ?? []).filter((m) => m.provider === form.provider),
    [catalog, form.provider],
  );
  const selectedModel = providerModels.find((m) => m.id === form.textModel);
  const keyMissing = config && form.provider !== 'disabled' && !config.providerKeys[form.provider as 'gemini' | 'openai'];
  const isInherited = !!tenantId && config?.inherited;

  const handleSave = async () => {
    try {
      // Final safety net: guarantee the payload is always within the backend's
      // allowed ranges regardless of what's currently in the number fields.
      await update.mutateAsync({
        tenantId,
        ...form,
        temperature: clampNumber(form.temperature, 0, 2, 0.4),
        maxOutputTokens: Math.round(clampNumber(form.maxOutputTokens, 64, 8192, 1024)),
        fallbackModels: form.fallbackModels.slice(0, MAX_FALLBACKS),
      });
      toast.success(tenantId ? 'Hospital AI settings saved' : 'Platform AI settings saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save');
    }
  };

  const handleReset = async () => {
    if (!tenantId) return;
    if (!confirm('Remove this hospital override and use the platform default?')) return;
    try {
      await reset.mutateAsync(tenantId);
      toast.success('Reverted to platform default');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to reset');
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI / LLM Settings
        </h1>
        <p className="font-label text-sm text-on-surface-variant">
          Choose the provider and model per hospital (or set the platform default). API keys are
          configured on the server. Default is Gemini; set the provider to &ldquo;Disabled&rdquo; to
          turn AI off for a hospital.
        </p>
      </div>

      {/* Scope selector */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs mb-1 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> Applies to
              </Label>
              <Select value={scope} onValueChange={(v) => setScope(v ?? PLATFORM)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PLATFORM}>Platform default (all hospitals)</SelectItem>
                  {hospitals.map((h: any) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tenantId && config && !config.inherited && (
              <Button variant="outline" onClick={handleReset} disabled={reset.isPending} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Reset to default
              </Button>
            )}
          </div>
          {isInherited && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-300/40 bg-blue-50/50 px-3 py-2 text-xs text-blue-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>This hospital currently uses the <strong>platform default</strong>. Saving will create an override just for it.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* Provider + model */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Provider & Model</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1">Provider</Label>
                  <Select
                    value={form.provider}
                    onValueChange={(v) => {
                      const provider = v ?? 'gemini';
                      const firstModel = (catalog?.models ?? []).find((m) => m.provider === provider && m.recommended)
                        ?? (catalog?.models ?? []).find((m) => m.provider === provider);
                      setForm((f) => ({
                        ...f,
                        provider,
                        textModel: provider === 'disabled' ? f.textModel : (firstModel?.id ?? f.textModel),
                        fallbackModels: [],
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Google Gemini (recommended)</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="disabled">Disabled (turn AI off)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs mb-1">Primary model</Label>
                  <Select
                    value={form.textModel}
                    onValueChange={(v) => set('textModel', v ?? form.textModel)}
                    disabled={form.provider === 'disabled'}
                  >
                    <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent>
                      {providerModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label} {m.free ? '· free tier' : '· paid'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedModel && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{selectedModel.limits}</p>
                  )}
                </div>
              </div>

              {keyMissing && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>No API key is set for <strong>{form.provider}</strong> on the server. AI stays off here until <code>{form.provider === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY'}</code> is configured.</span>
                </div>
              )}

              {/* Fallback models */}
              {form.provider !== 'disabled' && (
                <div>
                  <Label className="text-xs mb-1">Fallback models (tried when the primary is rate-limited / unavailable)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {providerModels.filter((m) => m.id !== form.textModel).map((m) => {
                      const on = form.fallbackModels.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (on) {
                              set('fallbackModels', form.fallbackModels.filter((x) => x !== m.id));
                            } else if (form.fallbackModels.length >= MAX_FALLBACKS) {
                              toast.warning(`Up to ${MAX_FALLBACKS} fallback models`);
                            } else {
                              set('fallbackModels', [...form.fallbackModels, m.id]);
                            }
                          }}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-xs transition-colors',
                            on ? 'border-primary bg-primary/10 text-primary' : 'border-foreground/15 text-muted-foreground hover:bg-surface-container-high',
                          )}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Leave empty to use sensible defaults. Each fallback has its own free-tier quota, so this rescues a rate-limited primary.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1">Temperature ({form.temperature.toFixed(2)})</Label>
                  <Input type="number" min={0} max={2} step={0.1} value={form.temperature} onChange={(e) => set('temperature', Number(e.target.value))} onBlur={() => set('temperature', clampNumber(form.temperature, 0, 2, 0.4))} />
                </div>
                <div>
                  <Label className="text-xs mb-1">Max output tokens</Label>
                  <Input type="number" min={64} max={8192} step={64} value={form.maxOutputTokens} onChange={(e) => set('maxOutputTokens', Number(e.target.value))} onBlur={() => set('maxOutputTokens', Math.round(clampNumber(form.maxOutputTokens, 64, 8192, 1024)))} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature flags — one switch per place AI is used, so a hospital can
              block AI in any single surface independently. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI features by place</CardTitle>
              <p className="text-xs text-muted-foreground">Turn AI off for any specific surface. A disabled feature hides its button and its endpoint refuses the request.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Clinical — Doctor</p>
                <div className="divide-y divide-foreground/5">
                  <FeatureRow title="Patient AI assistant" description="UC2 — conversational analysis of a patient's record." checked={form.patientChatEnabled} onChange={(v) => set('patientChatEnabled', v)} />
                  <FeatureRow title="Blood report analysis" description="UC2.2 — health-score + flags from lab results." checked={form.bloodReportEnabled} onChange={(v) => set('bloodReportEnabled', v)} />
                  <FeatureRow title="Progress-note smart suggestions" description="AI next-step suggestions on the SOAP pad." checked={form.progressNotesAiEnabled} onChange={(v) => set('progressNotesAiEnabled', v)} />
                  <FeatureRow title="Discharge summary generation" description="UC4 — AI drafts the narrative sections." checked={form.dischargeAiEnabled} onChange={(v) => set('dischargeAiEnabled', v)} />
                  <FeatureRow title="Radiology image diagnosis" description="UC2.1 — DICOM/image interpretation." checked={form.radiologyAiEnabled} onChange={(v) => set('radiologyAiEnabled', v)} badge="Coming soon" />
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Operations</p>
                <div className="divide-y divide-foreground/5">
                  <FeatureRow title="Invoice OCR scan (Add Stock)" description="Reads a supplier invoice photo/PDF into stock lines." checked={form.ocrInvoiceEnabled} onChange={(v) => set('ocrInvoiceEnabled', v)} />
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Platform</p>
                <div className="divide-y divide-foreground/5">
                  <FeatureRow title="Support assistant" description="UC3 — read-only how-to + own-org data questions." checked={form.platformChatEnabled} onChange={(v) => set('platformChatEnabled', v)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={update.isPending} className="gap-1.5">
              <Save className="h-4 w-4" />
              {update.isPending ? 'Saving…' : tenantId ? 'Save for this hospital' : 'Save platform default'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
