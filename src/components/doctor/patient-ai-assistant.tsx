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
} from '@/hooks/use-ai';
import { Loader2 } from 'lucide-react';
import { AiChatPanel, type AiChatMessage } from '@/components/ai/ai-chat-panel';
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

// Critical items pulled as structured data (not from the model's prose), shown
// as fixed red badges so the doctor can never miss an allergy or abnormal value.
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
  const { getMessages, setMessages: persistMessages } = usePatientAiChatStore();
  const chat = usePatientAiChat();
  const bloodReport = useBloodReportAnalysis();
  const summary = usePatientAiSummary(patientId, !!patientId);
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
        summary.data!.summary,
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
      })),
    );
  }, [messages, visitId, persistMessages]);


  useEffect(() => {
    if (summaryInserted.current || !visitId) return;
    if (!summary.data && summary.isFetching) return;

    const saved = getMessages(visitId);
    if (saved.length > 0) {
      summaryInserted.current = true;
      setMessages(
        saved.map((m) => ({
          role: m.role,
          content: m.content,
          excludeFromHistory: m.excludeFromHistory,
          kind: m.kind,
          version: m.version,
          extra:
            m.kind === 'summary' && summary.data ? (
              <AlertBadges alerts={summary.data.alerts} />
            ) : undefined,
        })),
      );
    } else if (summary.data) {
      summaryInserted.current = true;
      setMessages([
        {
          role: 'assistant',
          content: summary.data.summary,
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

  const pending = chat.isPending || bloodReport.isPending;

  const send = async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    try {
      const res = await chat.mutateAsync({ patientId, message: text, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
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

  return (
    <AiChatPanel
      className={className}
      scrollClassName={scrollClassName}
      messages={messages}
      onSend={send}
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
          label: 'Analyse imaging',
          icon: <ImageOff className="h-3 w-3" />,
          onClick: () => {},
          disabled: true,
          title: 'Radiology image diagnosis — coming soon',
        },
      ]}
      footerNote="AI decision support — verify before acting. Images are not analysed."
    />
  );
}











































































































































