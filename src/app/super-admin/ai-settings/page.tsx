'use client';

import { useEffect, useState } from 'react';
import { useAiConfig, useUpdateAiConfig } from '@/hooks/use-ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Sparkles, AlertTriangle, Save } from 'lucide-react';

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
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
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function FeatureRow({
  title,
  description,
  checked,
  onChange,
  disabled,
  badge,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium flex items-center gap-2">
          {title}
          {badge && (
            <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary">
              {badge}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'];

export default function AiSettingsPage() {
  const { data: config, isLoading } = useAiConfig();
  const update = useUpdateAiConfig();

  const [form, setForm] = useState({
    provider: 'gemini',
    textModel: 'gemini-2.0-flash',
    temperature: 0.4,
    maxOutputTokens: 1024,
    patientChatEnabled: true,
    platformChatEnabled: true,
    dischargeAiEnabled: true,
    radiologyAiEnabled: false,
  });

  useEffect(() => {
    if (config) {
      setForm({
        provider: config.provider,
        textModel: config.textModel,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        patientChatEnabled: config.features.patientChatEnabled,
        platformChatEnabled: config.features.platformChatEnabled,
        dischargeAiEnabled: config.features.dischargeAiEnabled,
        radiologyAiEnabled: config.features.radiologyAiEnabled,
      });
    }
  }, [config]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const keyMissing =
    config &&
    form.provider !== 'disabled' &&
    !config.providerKeys[form.provider as 'gemini' | 'openai'];

  const modelOptions = form.provider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS;

  const handleSave = async () => {
    try {
      await update.mutateAsync(form);
      toast.success('AI settings saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save');
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI / LLM Settings
        </h1>
        <p className="font-label text-sm text-on-surface-variant">
          Choose the language-model provider and toggle each AI feature. API keys are configured on
          the server via environment variables.
        </p>
      </div>

      {/* Provider + model */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Provider & Model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-1">Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => {
                  const provider = v ?? 'gemini';
                  set('provider', provider);
                  // Snap the model to a sensible default for the new provider.
                  set('textModel', provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini (recommended)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1">Model</Label>
              <Select
                value={form.textModel}
                onValueChange={(v) => set('textModel', v ?? form.textModel)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {keyMissing && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                No API key is set for <strong>{form.provider}</strong> on the server. AI features
                will stay off until <code>{form.provider === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY'}</code> is
                configured.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-1">Temperature ({form.temperature.toFixed(2)})</Label>
              <Input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={form.temperature}
                onChange={(e) => set('temperature', Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1">Max output tokens</Label>
              <Input
                type="number"
                min={64}
                max={8192}
                step={64}
                value={form.maxOutputTokens}
                onChange={(e) => set('maxOutputTokens', Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature flags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Features</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-foreground/5">
          <FeatureRow
            title="Patient AI assistant (doctors)"
            description="UC2 — conversational analysis of a patient's record for doctors."
            checked={form.patientChatEnabled}
            onChange={(v) => set('patientChatEnabled', v)}
          />
          <FeatureRow
            title="Platform support assistant"
            description="UC3 — read-only how-to help and own-organisation data questions."
            checked={form.platformChatEnabled}
            onChange={(v) => set('platformChatEnabled', v)}
          />
          <FeatureRow
            title="Discharge summary generation"
            description="UC4 — AI drafts the narrative sections of a discharge summary."
            checked={form.dischargeAiEnabled}
            onChange={(v) => set('dischargeAiEnabled', v)}
          />
          <FeatureRow
            title="Radiology image diagnosis"
            description="UC2.1 — DICOM/image interpretation. Deferred from the MVP."
            checked={form.radiologyAiEnabled}
            onChange={(v) => set('radiologyAiEnabled', v)}
            badge="Coming soon"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={update.isPending} className="gap-1.5">
          <Save className="h-4 w-4" />
          {update.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </div>
  );
}
