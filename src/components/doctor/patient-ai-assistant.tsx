'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  useAiStatus,
  usePatientAiChat,
  useBloodReportAnalysis,
  type AiChatTurn,
  type BloodReportAnalysis,
} from '@/hooks/use-ai';
import { AiChatPanel, type AiChatMessage } from '@/components/ai/ai-chat-panel';
import { Sparkles, FileText, ListChecks, Activity, ImageOff, Bot } from 'lucide-react';

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

interface PatientAiAssistantProps {
  patientId: string;
  patientName?: string;
  className?: string;
  scrollClassName?: string;
}

// UC2 (Level 1): conversational AI assistant grounded in one patient's record.
// Text-only — radiology image diagnosis is intentionally a disabled "coming
// soon" affordance per the MVP scope.
export function PatientAiAssistant({
  patientId,
  patientName,
  className,
  scrollClassName,
}: PatientAiAssistantProps) {
  const { data: status } = useAiStatus();
  const chat = usePatientAiChat();
  const bloodReport = useBloodReportAnalysis();

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const history: AiChatTurn[] = messages
    .filter((m) => !m.extra)
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
          <p className="mt-1 text-xs text-muted-foreground">
            Ask about {patientName ?? 'this patient'}&apos;s history, labs, medications or next
            steps. Grounded in the record — radiology images are not interpreted.
          </p>
        </div>
      }
      quickActions={[
        {
          label: 'Summarise history',
          icon: <FileText className="h-3 w-3" />,
          onClick: () => send("Summarise this patient's history and current clinical status."),
        },
        {
          label: 'Analyse blood report',
          icon: <Activity className="h-3 w-3" />,
          onClick: analyseBloodReport,
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
