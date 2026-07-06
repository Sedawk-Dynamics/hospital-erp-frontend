'use client';

import { useMemo, useState } from 'react';
import {
  Bot, Sparkles, ShieldCheck, Search, ChevronDown, CheckCircle2, XCircle,
  MessageSquare, BarChart3, Ban, MapPin,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import {
  ROLES, TIERS, TIER_ORDER, DATA_ROWS, FAQ, findRole, normalizeGuideRole,
  type RoleGuide, type TierKey, type Ask, type DataRow,
} from '../_data/guide';

// Only these roles may ask the assistant for revenue (finance/admin). Mirrors
// the backend INTENT_ACCESS gate in ai.platform.service.ts.
const REVENUE_ROLES = new Set(['super_admin', 'admin', 'billing_admin', 'cashier']);
function canAskFigure(roleSlug: string | undefined, row: DataRow): boolean {
  if (!roleSlug || roleSlug === 'patient') return false; // patients get no aggregates
  if (roleSlug === 'super_admin' || roleSlug === 'admin') return true;
  return row.ok ? true : REVENUE_ROLES.has(roleSlug); // row.ok=false ⇒ restricted (revenue)
}

// ---- tiny inline markup renderer: **bold** and `code` ----
function Inline({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(<strong key={i++} className="font-semibold text-on-surface">{tok.slice(2, -2)}</strong>);
    } else {
      nodes.push(
        <code key={i++} className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-[0.82em] text-primary">
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

const TIER_CHIP: Record<TierKey, string> = {
  platform: 'bg-violet-500/12 text-violet-600',
  admin: 'bg-primary/12 text-primary',
  head: 'bg-blue-500/12 text-blue-600',
  ops: 'bg-emerald-500/12 text-emerald-600',
  front: 'bg-amber-500/15 text-amber-600',
  self: 'bg-slate-500/12 text-slate-500',
};
const TIER_BAR: Record<TierKey, string> = {
  platform: 'bg-violet-500',
  admin: 'bg-primary',
  head: 'bg-blue-500',
  ops: 'bg-emerald-500',
  front: 'bg-amber-500',
  self: 'bg-slate-400',
};

const ASK_BADGE: Record<Ask['b'], { label: string; cls: string; icon: React.ReactNode }> = {
  help: { label: 'how-to', cls: 'bg-primary/12 text-primary', icon: <MessageSquare className="h-3 w-3" /> },
  data: { label: 'your numbers', cls: 'bg-violet-500/12 text-violet-600', icon: <BarChart3 className="h-3 w-3" /> },
  stop: { label: 'not your role', cls: 'bg-amber-500/15 text-amber-600', icon: <Ban className="h-3 w-3" /> },
};

function AskRow({ a }: { a: Ask }) {
  const b = ASK_BADGE[a.b];
  return (
    <div className="space-y-1.5">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 font-label text-[13px] text-on-primary">
          {a.q}
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-surface-container-high px-3.5 py-2 text-[13px] text-on-surface">
          <span className={`mr-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-[1px] text-[9.5px] font-semibold uppercase tracking-wide ${b.cls}`}>
            {b.icon}{b.label}
          </span>
          <Inline text={a.a} />
        </div>
      </div>
    </div>
  );
}

function RoleCard({ role, defaultOpen = false, spotlight = false }: { role: RoleGuide; defaultOpen?: boolean; spotlight?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const tier = TIERS[role.tier];
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-surface-container-lowest shadow-sanctuary ${spotlight ? 'border-primary/40 ring-1 ring-primary/20' : 'border-outline-variant/25'}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className={`h-9 w-1 shrink-0 rounded-full ${TIER_BAR[role.tier]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-headline text-[15px] font-bold text-on-surface">{role.name}</span>
            <span className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide ${TIER_CHIP[role.tier]}`}>
              {tier.label}
            </span>
            {spotlight && (
              <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-on-primary">
                Your role
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate font-label text-[11.5px] text-on-surface-variant">
            {role.portal} · {role.perm} · <span className="font-mono">{role.slug}</span>
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-outline-variant/25 px-4 py-4 sm:px-5">
          <p className="text-[13.5px] leading-relaxed text-on-surface-variant">{role.who}</p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {role.mods.map((mod) => (
              <span key={mod} className="rounded-md border border-outline-variant/40 bg-surface-container px-2 py-0.5 font-mono text-[10.5px] text-on-surface-variant">
                {mod}
              </span>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-surface-container-low p-3.5">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Can do
              </p>
              <ul className="space-y-1.5">
                {role.can.map((c, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-on-surface-variant">
                    <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" />
                    <span><Inline text={c} /></span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-surface-container-low p-3.5">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                <XCircle className="h-3.5 w-3.5" /> Cannot do
              </p>
              <ul className="space-y-1.5">
                {role.cant.map((c, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-on-surface-variant">
                    <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/70" />
                    <span><Inline text={c} /></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">Key workflows</p>
            <div className="space-y-3">
              {role.wf.map((w, i) => (
                <div key={i} className="rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-3.5">
                  <p className="mb-2 font-label text-[13.5px] font-semibold text-on-surface">{w.t}</p>
                  <ol className="space-y-2">
                    {w.s.map((step, j) => (
                      <li key={j} className="flex gap-2.5 text-[13px] text-on-surface-variant">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-[11px] font-bold text-primary">
                          {j + 1}
                        </span>
                        <span className="pt-0.5"><Inline text={step} /></span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-outline-variant/25 bg-surface-container-low p-3.5">
            <p className="mb-1 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">
              <Bot className="h-3.5 w-3.5" /> Ask the Support Assistant
            </p>
            <p className="mb-3 font-label text-[11px] text-on-surface-variant">
              Signed in as {role.name} — the assistant tailors every answer to this role.
            </p>
            <div className="space-y-3">
              {role.ask.map((a, i) => <AskRow key={i} a={a} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant/25 bg-surface-container-lowest">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="font-label text-[14px] font-semibold text-on-surface">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-4 pb-4 text-[13.5px] leading-relaxed text-on-surface-variant">{a}</p>}
    </div>
  );
}

export default function HelpPage() {
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');

  const myRole = useMemo(() => findRole(user?.role?.name ?? user?.roles?.[0]), [user]);

  // Only the super-admin sees the FULL manual (every role). Every other role
  // sees just their own guide — the functionality that role actually has.
  const isSuperAdmin = useMemo(() => {
    const raw = [user?.role?.name, ...(user?.roles ?? [])].filter(Boolean) as string[];
    return raw.some((r) => normalizeGuideRole(r) === 'super_admin');
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ROLES;
    return ROLES.filter(
      (r) => `${r.name} ${r.slug} ${r.who} ${r.portal}`.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      {/* Hero */}
      <div className="animate-fade-in-up">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          {isSuperAdmin ? 'Platform User Manual' : 'User Manual'}
        </p>
        <h1 className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">
          {isSuperAdmin ? 'How every role uses the platform' : `Your guide${myRole ? ` — ${myRole.name}` : ''}`}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
          {isSuperAdmin ? (
            <>
              The complete manual for every role, plus the built-in{' '}
              <span className="font-semibold text-on-surface">Support Assistant</span>. Each role sees only their own
              section; you see all of them.
            </>
          ) : (
            <>
              This is the guide for <span className="font-semibold text-on-surface">your role</span> — what you can do,
              your key workflows, and how the built-in{' '}
              <span className="font-semibold text-on-surface">Support Assistant</span> answers for you. Read-only, and
              scoped to your hospital.
            </>
          )}
        </p>
      </div>

      {/* Your role guide (everyone sees their own; super-admin also sees all below) */}
      {myRole ? (
        <section className="mt-8">
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="font-headline text-sm font-bold uppercase tracking-wide text-on-surface-variant">
              {isSuperAdmin ? 'Your role' : 'Your role guide'}
            </h2>
          </div>
          <RoleCard role={myRole} defaultOpen spotlight />
        </section>
      ) : (
        !isSuperAdmin && (
          <section className="mt-8">
            <div className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-5 shadow-sanctuary">
              <p className="text-[13.5px] leading-relaxed text-on-surface-variant">
                Your role doesn&apos;t have a dedicated guide section yet. Use the Support Assistant (bottom-right) for
                step-by-step help tailored to your access, or ask your administrator.
              </p>
            </div>
          </section>
        )
      )}

      {/* Assistant explainer */}
      <section className="mt-10">
        <h2 className="font-headline text-xl font-bold text-on-surface">The Support Assistant</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-on-surface-variant">
          A floating assistant (bottom-right on every screen) that answers for the role you&apos;re signed in as — a
          nurse and a doctor asking the same words get answers grounded in their own workflow.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-4 shadow-sanctuary">
            <p className="flex items-center gap-2 font-label text-sm font-semibold text-on-surface">
              <MessageSquare className="h-4 w-4 text-primary" /> How-to &amp; navigation
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-on-surface-variant">
              &ldquo;How do I write a prescription?&rdquo; → step-by-step navigation from <em>your</em> landing page, using
              your portal&apos;s real menu names. Out-of-scope tasks are redirected to the role that can do them.
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-4 shadow-sanctuary">
            <p className="flex items-center gap-2 font-label text-sm font-semibold text-on-surface">
              <BarChart3 className="h-4 w-4 text-violet-600" /> Your hospital&apos;s numbers
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-on-surface-variant">
              &ldquo;How many beds are free right now?&rdquo; → a safe, pre-approved count for <em>your hospital only</em>.
              Sensitive figures (like revenue) are limited to finance &amp; admin roles.
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-[13px] leading-relaxed text-on-surface-variant">
            <span className="font-semibold text-on-surface">Read-only &amp; private.</span> The assistant never creates,
            edits or deletes anything — it explains and reports. Every data question is hard-scoped to your own hospital;
            only a fixed whitelist of counts can run.
          </p>
        </div>
      </section>

      {/* Role directory — FULL manual, super-admin only */}
      {isSuperAdmin && (
        <section className="mt-10">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-headline text-xl font-bold text-on-surface">All roles</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter roles…"
                className="w-56 rounded-lg border border-outline-variant/40 bg-surface-container-lowest py-2 pl-9 pr-3 font-label text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <p className="mb-4 font-label text-[12px] text-on-surface-variant">
            You&apos;re a super-admin, so you see every role&apos;s manual. Each staff role only sees their own section here.
          </p>

          <div className="space-y-6">
            {TIER_ORDER.map((tk) => {
              const rs = filtered.filter((r) => r.tier === tk);
              if (!rs.length) return null;
              return (
                <div key={tk}>
                  <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                    {TIERS[tk].label}
                  </p>
                  <div className="space-y-2.5">
                    {rs.map((r) => <RoleCard key={r.slug} role={r} defaultOpen={false} spotlight={r.slug === myRole?.slug} />)}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-6 text-center font-label text-sm text-on-surface-variant">No roles match &ldquo;{query}&rdquo;.</p>
            )}
          </div>
        </section>
      )}

      {/* Data table — full "who may ask" for super-admin, a personalised
          "can you ask?" view for every other role. */}
      <section className="mt-10">
        <h2 className="font-headline text-xl font-bold text-on-surface">
          {isSuperAdmin ? 'What the assistant can count' : 'Numbers you can ask the assistant for'}
        </h2>
        <p className="mt-2 text-[14px] text-on-surface-variant">
          {isSuperAdmin
            ? 'Data questions run only these pre-approved, hospital-scoped counts.'
            : 'These pre-approved counts are scoped to your hospital. Here is what your role can ask for.'}
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-outline-variant/25 shadow-sanctuary">
          <table className="w-full min-w-[520px] text-[13.5px]">
            <thead>
              <tr className="bg-surface-container">
                <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Figure</th>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Example question</th>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  {isSuperAdmin ? 'Who may ask' : 'You can ask?'}
                </th>
              </tr>
            </thead>
            <tbody>
              {DATA_ROWS.map((d) => {
                const allowed = canAskFigure(myRole?.slug, d);
                return (
                  <tr key={d.fig} className="border-t border-outline-variant/20 bg-surface-container-lowest">
                    <td className="px-4 py-3 font-semibold text-on-surface">{d.fig}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{d.ex}</td>
                    {isSuperAdmin ? (
                      <td className={`px-4 py-3 font-mono text-[12px] ${d.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{d.who}</td>
                    ) : (
                      <td className="px-4 py-3">
                        {allowed ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-amber-600">
                            <XCircle className="h-3.5 w-3.5" /> No{!d.ok ? ' — finance/admin only' : ''}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="mb-4 font-headline text-xl font-bold text-on-surface">Tips &amp; FAQ</h2>
        <div className="space-y-2">
          {FAQ.map((f) => <FaqRow key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      <footer className="mt-12 flex items-center gap-2 border-t border-outline-variant/25 pt-6 text-on-surface-variant">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <p className="font-label text-[12px]">Support Assistant — read-only, role-aware, scoped to your hospital.</p>
      </footer>
    </div>
  );
}
