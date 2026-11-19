'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  useAiStatus,
  usePatientAiChat,
  useBloodReportAnalysis,
  usePatientAiSummary,
  usePatientContextVersion,
  type AiChatTurn,
  type BloodReportAnalysis,
  type AiSource,
  useImagingReportAnalysis,
} from '@/hooks/use-ai';
import { Loader2 } from 'lucide-react';
import { AiChatPanel, type AiChatMessage } from '@/components/ai/ai-chat-panel';
import { MarkdownMessage } from '@/components/ai/markdown-message';
import {
  Sparkles,
  ListChecks,
  Activity,
  ImageOff,
  Bot,
  AlertTriangle,
  ShieldAlert,
  HeartPulse,
  FlaskConical,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PatientSummaryResponse } from '@/hooks/use-ai';
import { usePatientAiChatStore } from '@/stores/patient-ai-chat-store';
import { useImagingAnalytics } from '@/hooks/use-imaging';

/**
 * Replace the AI's inline `[[n]]` citation markers with Markdown links to the
 * matching guideline source. MarkdownMessage renders these; a custom `a` handler
 * there detects the cdss-source href and fetches the PDF with auth (blob).
 */
function linkifySources(reply: string, sources?: AiSource[]): string {
  if (!sources?.length) return reply;
  // The model cites either [[1]] or (often) collapses to [1] — match both,
  // and render the source's label as the clickable link text.
  return reply.replace(/\[\[?(\d+)\]\]?/g, (full, num) => {
    const s = sources.find((x) => x.n === Number(num));
    if (!s) return full;
    const label = s.label.replace(/[[\]]/g, ''); // strip brackets so markdown link text stays valid
    return `[${label}](${s.url})`;
  });
}

function ScoreCard({ data }: { data: BloodReportAnalysis }) {
  const color =
    data.score >= 80
      ? 'text-primary'
      : data.score >= 60
        ? 'text-amber-600'
        : data.score >= 40
          ? 'text-orange-600'
          : 'text-error';
  return (
    <div className="mt-2 rounded-xl border border-foreground/10 bg-surface-container-lowest p-3 text-foreground">
      <div className="flex items-center gap-3">
        <div className={cn('text-2xl font-bold', color)}>{data.score}</div>
        <div className="text-xs">
          <p className="font-semibold uppercase tracking-wide">{data.severity}</p>
          <p className="text-muted-foreground">Health score (of 100) · {data.resultCount} values</p>
        </div>
      </div>
      {data.summary && <p className="mt-2 text-xs">{data.summary}</p>}
      {data.flagged?.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {data.flagged.map((f, i) => (
            <li key={i} className="text-xs">
              <span className="font-medium">{f.parameter}</span>: {f.value}{' '}
              <span className="uppercase text-error">{f.status}</span>
              {f.note ? ` — ${f.note}` : ''}
            </li>
          ))}
        </ul>
      )}
      {data.recommendations?.length > 0 && (
        <ul className="mt-2 list-disc pl-4">
          {data.recommendations.map((r, i) => (
            <li key={i} className="text-xs">{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}


// The AI imaging read: shows the rendered X-ray frame(s) FIRST (so the doctor
// sees what the model looked at), then the analysis text below.
function ImagingResult({ images, summary }: { images: string[]; summary: string }) {
  return (
    <div className="space-y-2.5">
      {images?.length > 0 && (
        <div className="flex flex-col gap-2">
          {images.map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`X-ray frame ${i + 1}`}
                className="h-auto w-full rounded-lg border border-foreground/10 object-contain bg-black"
              />
            </a>
          ))}
        </div>
      )}
      {summary && <MarkdownMessage content={summary} />}
    </div>
  );
}


function AlertBadges({ alerts }: { alerts: PatientSummaryResponse['alerts'] }) {
  const groups: Array<{ label: string; icon: LucideIcon; items: string[] }> = [
    { label: 'Allergies', icon: ShieldAlert, items: alerts.allergies },
    { label: 'Abnormal vitals', icon: HeartPulse, items: alerts.abnormalVitals },
    { label: 'Abnormal labs', icon: FlaskConical, items: alerts.abnormalLabs },
  ].filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="mt-2.5 overflow-hidden rounded-xl border border-error/25 bg-error/[0.04] shadow-sm">
      {/* Header strip */}
      <div className="flex items-center gap-2 border-b border-error/15 bg-error/10 px-3 py-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
        <span className="text-xs font-bold uppercase tracking-wider text-error">
          Clinical alerts
        </span>
        <span className="ml-auto rounded-full bg-error px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {total}
        </span>
      </div>

      {/* Grouped rows */}
      <div className="divide-y divide-error/10">
        {groups.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.label} className="flex items-start gap-2.5 px-3 py-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-error/70" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-error/70">
                  {g.label}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.items.map((item, i) => (
                    <span
                      key={`${g.label}-${i}`}
                      className="inline-flex items-center gap-1 rounded-md bg-error/10 px-2 py-1 text-xs font-semibold text-error ring-1 ring-inset ring-error/20"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-error" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PatientAiAssistantProps {
  patientId: string;
  patientName?: string;
  className?: string;
  scrollClassName?: string;
  visitId?: string | null;
}
export function PatientAiAssistant({
  patientId,
  patientName,
  className,
  scrollClassName,
  visitId,
}: PatientAiAssistantProps) {
  const { data: status } = useAiStatus();
  const imaging=useImagingReportAnalysis();
  const { getMessages, setMessages: persistMessages } = usePatientAiChatStore();
  const chat = usePatientAiChat();
  const bloodReport = useBloodReportAnalysis();
  const summary = usePatientAiSummary(patientId, !!patientId, visitId);
  const contextVersion = usePatientContextVersion(patientId, !!patientId);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const summaryInserted = useRef(false);
  const lastVersion = useRef<string | undefined>(undefined);
  const wasRefreshed = useRef(false);

  useEffect(() => {
  const current = contextVersion.data;
  if (!current) return;                 // version not loaded yet
  if (summary.isFetching) return;       // a refetch already running
  const latestSummary = messages.findLast((m) => m.kind === 'summary');
  if (!latestSummary?.version) return;  
  if (latestSummary.version !== current) {
    wasRefreshed.current = true;
    void summary.refetch();
  }
}, [contextVersion.data, messages, summary.isFetching]);


  useEffect(() => {
  if (!summary.data) return;
  if (!wasRefreshed.current) return;    
  wasRefreshed.current = false;
  setMessages((prev) => [
    ...prev,                        
    {
      role: 'assistant',
      content:
        '🔄 **Updated summary** — the record changed, so this briefing was refreshed.\n\n' +
        linkifySources(summary.data!.summary, summary.data!.sources),
      kind: 'summary',
      version: contextVersion.data,     // stamp new version
      extra: <AlertBadges alerts={summary.data!.alerts} />,
    },
  ]);
}, [summary.data]);


  useEffect(() => {
    if (!visitId || messages.length === 0) return;
    persistMessages(
      visitId,
      messages.map((m) => ({
        role: m.role,
        content: m.content,
        excludeFromHistory: m.excludeFromHistory,
        kind: m.kind,
        version: m.version,
        images: m.images,
        summary: m.summary,
      })),
    );
  }, [messages, visitId, persistMessages]);


  useEffect(() => {
    if (summaryInserted.current) return;
    if (!summary.data && summary.isFetching) return;

    // With a real visit, restore that visit's saved thread if one exists.
    const saved = visitId ? getMessages(visitId) : [];
    if (saved.length > 0) {
      summaryInserted.current = true;
      setMessages(
        saved.map((m) => ({
          role: m.role,
          content: m.content,
          excludeFromHistory: m.excludeFromHistory,
          kind: m.kind,
          version: m.version,
          images: m.images,
          summary: m.summary,
          extra:
            m.kind === 'summary' && summary.data ? (
              <AlertBadges alerts={summary.data.alerts} />
            ) : m.kind === 'imaging' ? (
              <ImagingResult images={m.images ?? []} summary={m.summary ?? ''} />
            ) : undefined,
        })),
      );
    } else if (summary.data) {
      // No saved thread (or no visit created yet): seed the patient-level
      // history summary so the doctor can read it before entering anything.
      summaryInserted.current = true;
      setMessages([
        {
          role: 'assistant',
          content: linkifySources(summary.data.summary, summary.data.sources),
          kind: 'summary',
          version: contextVersion.data,
          extra: <AlertBadges alerts={summary.data.alerts} />,
        },
      ]);
    }
  }, [visitId, summary.data, summary.isFetching, getMessages]);

  const history: AiChatTurn[] = messages
    .filter((m) => !m.excludeFromHistory)
    .map((m) => ({ role: m.role, content: m.content }));

  const pending = chat.isPending || bloodReport.isPending || imaging.isPending;

  const send = async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    try {
      const res = await chat.mutateAsync({ patientId, message: text, history, visitId });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: linkifySources(res.reply, res.sources) },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err?.response?.data?.message ?? 'Sorry, I could not process that.',
        },
      ]);
    }
  };

  const analyseBloodReport = async () => {
    setMessages((prev) => [...prev, { role: 'user', content: 'Analyse the latest blood report.' }]);
    try {
      const res = await bloodReport.mutateAsync({ patientId });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Blood report analysis (score ${res.score}/100, ${res.severity}):`,
          extra: <ScoreCard data={res} />,
          excludeFromHistory: true,
          kind: 'blood-report',
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err?.response?.data?.message ?? 'No lab results available to analyse.',
        },
      ]);
    }
  };

  if (status && !status.features.patientChat) {
    return (
      <div className={cn('rounded-xl border border-foreground/10 bg-surface-container-lowest p-6 text-center', className)}>
        <Bot className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">AI assistant is not available</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {status.enabled
            ? 'The patient AI assistant has been disabled by your administrator.'
            : 'AI is not configured on this server yet.'}
        </p>
      </div>
    );
  }

  const analyseImagingReport = async () => {
    setMessages((prev) => [...prev, { role: 'user', content: 'Analyse the latest X-ray imaging.' }]);
    try {
      const res = await imaging.mutateAsync({ patientId });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          kind: 'imaging',
          images: res.images,
          summary: res.summary,
          extra: <ImagingResult images={res.images} summary={res.summary} />,
          excludeFromHistory: true,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err?.response?.data?.message ?? 'No X-ray imaging available to analyse.',
        },
      ]);
    }
  };

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {summary.isFetching && messages.length > 0 && (
        <div className="flex items-center gap-2 border-b border-outline-variant/40 px-4 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Updating summary — the record changed…
        </div>
      )}
    <AiChatPanel
      className="min-h-0 flex-1"
      scrollClassName={scrollClassName}
      messages={messages}
      onSend={send}
      disabled={summary.isFetching || chat.isPending}
      pending={pending}
      placeholder={`Ask about ${patientName ?? 'this patient'}…`}
      emptyState={
        <div className="px-4">
          <Sparkles className="mx-auto h-7 w-7 text-primary" />
          <p className="mt-2 text-sm font-medium">Patient AI Assistant</p>
          {summary.isLoading || summary.isFetching ? (
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Preparing {patientName ?? 'patient'} summary…
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Ask about {patientName ?? 'this patient'}&apos;s history, labs, medications or next
              steps. Grounded in the record — radiology images are not interpreted.
            </p>
          )}
        </div>
      }
      quickActions={[
        {
          label: 'Analyse blood report',
          icon: <Activity className="h-3 w-3" />,
          onClick: analyseBloodReport,
          disabled: !!status && !status.features.bloodReport,
          title: status && !status.features.bloodReport ? 'Blood report analysis is disabled by your administrator' : undefined,
        },
        {
          label: 'Suggest next steps',
          icon: <ListChecks className="h-3 w-3" />,
          onClick: () => send('Based on the record, what investigations or next steps would you suggest?'),
        },
        {
          label: 'Analyse imaging report',
          icon: <ImageOff className="h-3 w-3" />,
          onClick: analyseImagingReport,
          title: 'Analyse the latest X-ray with AI (decision support only)',
        },
      ]}
      footerNote="AI decision support — verify before acting. Images are not analysed."
    />
    </div>
  );
}











































































































































