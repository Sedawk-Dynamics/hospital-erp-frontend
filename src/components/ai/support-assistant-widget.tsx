'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { usePlatformAiChat, useAiStatus, type AiChatTurn } from '@/hooks/use-ai';
import { useAuthStore } from '@/stores/auth-store';
import { AiChatPanel, type AiChatMessage } from '@/components/ai/ai-chat-panel';
import { Bot, X, MessageCircleQuestion } from 'lucide-react';

// Collapse the many DB role slugs (incl. doctor specializations) to the canonical
// set used for tailoring the assistant — mirrors the backend ai.roles.ts.
const DOCTOR_SLUGS = new Set([
  'doctor', 'general_physician', 'ent', 'diabetologist', 'obstetrics_gynaecologist',
  'cardiologist', 'dermatologist', 'neurologist', 'ophthalmologist', 'orthopedic',
  'pediatrician', 'psychiatrist', 'pulmonologist', 'surgeon', 'urologist', 'opt',
  'physiotherapist',
]);

function normalizeRole(slug?: string | null): string {
  const n = (slug || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (DOCTOR_SLUGS.has(n)) return 'doctor';
  if (n === 'pathologist') return 'lab_supervisor';
  return n;
}

// Role → (label, three starter prompts) shown as quick actions + hint.
const ROLE_HINTS: Record<string, { label: string; prompts: string[] }> = {
  super_admin: { label: 'Super Admin', prompts: ['How do I onboard a new hospital?', 'How do I change the AI model?', 'How do I add an ICD code?'] },
  admin: { label: 'Hospital Admin', prompts: ['How do I create a user and assign a role?', 'How many patients registered this month?', "What is today's total revenue?"] },
  doctor: { label: 'Doctor', prompts: ['How do I write a prescription?', 'How do I order a lab test?', 'How many patients are currently admitted?'] },
  nurse: { label: 'Nurse', prompts: ['How do I record vitals?', 'How do I give a medication on the eMAR?', 'How do I do a shift handover?'] },
  nurse_admin: { label: 'Nurse Admin', prompts: ['How do I assign nurses to beds?', 'How do I map a nurse to a doctor?', 'How do I publish the roster?'] },
  front_desk: { label: 'Front Desk', prompts: ['How do I register a new patient?', 'How do I book an appointment?', 'How many appointments today?'] },
  billing_admin: { label: 'Billing Admin', prompts: ['How do I create and finalize a bill?', 'How do I approve a refund?', "What is today's total revenue?"] },
  cashier: { label: 'Cashier', prompts: ['How do I take a payment at the counter?', 'How do I print a receipt?', "How do I look up a patient's bill?"] },
  pharmacist: { label: 'Pharmacist', prompts: ['How do I dispense a prescription?', 'How do I process a drug return?', 'How do I put an item on pre-pack hold?'] },
  pharmacy_admin: { label: 'Pharmacy Admin', prompts: ['How do I add / receive drug stock?', 'How do I recall a drug batch?', 'Where are the statutory (NDPS) reports?'] },
  lab_technician: { label: 'Lab Technician', prompts: ['How do I accept a lab order?', 'How do I enter results and mark a test done?', 'How do I upload a report file?'] },
  lab_supervisor: { label: 'Lab Supervisor', prompts: ['How do I approve and publish a report?', 'How do I issue a correction?', 'How do I add a test to our catalog?'] },
  radiologist: { label: 'Radiologist', prompts: ['How do I upload an imaging result?', 'How do I finalize an imaging report?', 'Why is a request not in my worklist yet?'] },
  radiology_admin: { label: 'Radiology Admin', prompts: ['How do I verify payment on a request?', 'How do I approve a report for the patient?', 'How do I close a no-show?'] },
  inventory_manager: { label: 'Inventory Manager', prompts: ['How do I add a new stock item?', 'How do I create a purchase order?', 'Where do I see low-stock alerts?'] },
  insurance_staff: { label: 'Insurance Staff', prompts: ['How do I submit a claim?', 'How do I raise a pre-authorization?', 'How do I add an insurer or TPA?'] },
  hr_staff: { label: 'HR Staff', prompts: ['How do I add a staff member?', 'How do I run payroll?', 'How do I approve a leave request?'] },
  blood_bank_staff: { label: 'Blood Bank Staff', prompts: ['How do I register a blood donor?', 'How do I record a donation?', 'How do I process a transfusion?'] },
  patient: { label: 'Patient', prompts: ['How do I book an appointment?', 'Where can I see my lab reports?', 'How do I pay my bill online?'] },
};

const DEFAULT_HINT = {
  label: '',
  prompts: ['How do I add a patient?', 'How many patients registered this month?', 'How many beds are available right now?'],
};

// UC3 (Level 1): floating platform-wide support assistant. Read-only and
// ROLE-AWARE — answers how-to questions and aggregate questions about the
// user's OWN organisation, tailored to the signed-in user's role. Rendered
// globally in the modules layout; self-hides when the feature is off.
export function SupportAssistantWidget() {
  const { data: status } = useAiStatus();
  const user = useAuthStore((s) => s.user);
  const chat = usePlatformAiChat();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);

  const hint = useMemo(() => {
    const role = normalizeRole(user?.role?.name ?? user?.roles?.[0]);
    return ROLE_HINTS[role] ?? DEFAULT_HINT;
  }, [user]);

  if (!status?.features.platformChat) return null;

  const history: AiChatTurn[] = messages
    .filter((m) => !m.extra)
    .map((m) => ({ role: m.role, content: m.content }));

  const send = async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    try {
      const res = await chat.mutateAsync({ message: text, history });
      const tag = res.mode === 'data' && !res.restricted ? '📊 ' : '';
      setMessages((prev) => [...prev, { role: 'assistant', content: `${tag}${res.reply}` }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: err?.response?.data?.message ?? 'Sorry, something went wrong.' },
      ]);
    }
  };

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Support assistant"
        className={cn(
          'fixed bottom-5 right-5 z-50 flex items-center justify-center rounded-full bg-primary text-on-primary shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 print:hidden',
          'h-12 w-12',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex w-[min(92vw,380px)] flex-col rounded-2xl border border-foreground/10 bg-surface-container-lowest shadow-2xl print:hidden">
          <div className="flex items-center gap-2 border-b border-foreground/5 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircleQuestion className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Support Assistant</p>
              <p className="text-[10px] text-muted-foreground">
                {hint.label ? `${hint.label} · ` : ''}How-to help &amp; read-only data
              </p>
            </div>
            <a
              href="/help"
              className="ml-auto rounded-full border border-foreground/10 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              Full guide ↗
            </a>
          </div>

          <div className="p-3">
            <AiChatPanel
              messages={messages}
              onSend={send}
              pending={chat.isPending}
              placeholder="Ask how to use the software…"
              scrollClassName="h-[46vh] min-h-[260px]"
              emptyState={
                <div className="px-3">
                  <Bot className="mx-auto h-7 w-7 text-primary" />
                  <p className="mt-2 text-sm font-medium">
                    Hi{hint.label ? `, ${hint.label}` : ''}! How can I help?
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ask how to do something in your portal, or about your hospital&apos;s numbers —
                    tailored to your role.
                  </p>
                </div>
              }
              quickActions={hint.prompts.map((p) => ({ label: p, onClick: () => send(p) }))}
              footerNote="Read-only assistant — tailored to your role, scoped to your organisation."
            />
          </div>
        </div>
      )}
    </>
  );
}
