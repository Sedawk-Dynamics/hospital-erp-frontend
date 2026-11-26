'use client';

import { useState } from 'react';
import {
    Droplets,
    Wind,
    ClipboardCheck,
    Syringe,
    Gauge,
    Activity,
} from 'lucide-react';
import { Loader2, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { FluidBalanceForm } from '@/components/hospital/ip/icu/fluid-balance-form';
import { AbgVentForm } from '@/components/hospital/ip/icu/abg-vent-form';
import { FastHugSepsisForm } from '@/components/hospital/ip/icu/fasthug-sepsis-form';
import { InvasiveLineForm } from '@/components/hospital/ip/icu/invasive-line-form';
import { InfusionPumpForm } from '@/components/hospital/ip/icu/infusion-pump-form';
import { SeverityScoresForm } from '@/components/hospital/ip/icu/severity-scores-form';
import {
    useFluidBalanceList,
    useAbgVentList,
    useFastHugSepsisList,
    useSeverityScoreList,
    useInvasiveLineList,
    useInfusionPumpList,
} from '@/hooks/use-icu';

interface IcuDetailPanelProps {
    admissionId: string;
    visitId?: string;
    patientId: string;
    role: string;
}

const URINE_LABELS: Record<string, string> = {
    clear_amber: 'Clear Amber',
    hazy_cloudy: 'Hazy / Cloudy',
    hematuria: 'Hematuria',
    concentrated_dark: 'Concentrated / Dark',
};

function fmtTime(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function FluidBalanceList({ admissionId }: { admissionId: string }) {
    const { data: rows, isLoading } = useFluidBalanceList(admissionId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
        );
    }

    if (!rows || rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">
                No fluid balance entries yet.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-foreground/10 shadow-sm">
            <table className="w-full min-w-180 text-sm">
                <thead className="bg-primary/10 text-[11px] font-semibold tracking-wide text-primary border-b border-primary/20">
                    <tr className="[&_th]:px-3 [&_th]:py-2.5 [&_th]:text-center [&_th]:font-semibold [&_th]:tracking-wide [&_th]:whitespace-nowrap">
                        <th className="sticky left-0 z-20 bg-card border-r border-foreground/10">Time</th>
                        <th>IV Cryst (mL)</th>
                        <th>Blood Prod (mL)</th>
                        <th>Carrier Med (mL)</th>
                        <th>Enteral (mL)</th>
                        <th>Foley Urine (mL)</th>
                        <th>Drains / ICD (mL)</th>
                        <th>Urine</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                    {rows.map((r: any) => (
                        <tr key={r.id} className="[&_td]:px-3 [&_td]:py-2.5 [&_td]:text-center [&_td]:whitespace-nowrap [&_td]:tabular-nums even:bg-surface-container-high/20 transition-colors hover:bg-primary/5">
                            <td className="sticky left-0 z-10 bg-card border-r border-foreground/10 font-medium">{fmtTime(r.recordedAt)}</td>
                            <td>{r.ivCrystMl ?? '—'}</td>
                            <td>{r.bloodProdMl ?? '—'}</td>
                            <td>{r.carrierMedMl ?? '—'}</td>
                            <td>{r.enteralMl ?? '—'}</td>
                            <td>{r.foleyUrineMl ?? '—'}</td>
                            <td>{r.drainsIcdMl ?? '—'}</td>
                            <td>{r.urineCharacter ? (URINE_LABELS[r.urineCharacter] ?? r.urineCharacter) : '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AbgVentList({ admissionId }: { admissionId: string }) {
    const { data: rows, isLoading } = useAbgVentList(admissionId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
        );
    }

    if (!rows || rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">
                No ABG / ventilator entries yet.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-foreground/10 shadow-sm">
            <table className="w-full min-w-225 text-sm">
                <thead className="bg-primary/10 text-[11px] font-semibold tracking-wide text-primary border-b border-primary/20">
                    <tr className="[&_th]:px-3 [&_th]:py-2.5 [&_th]:text-center [&_th]:font-semibold [&_th]:tracking-wide [&_th]:whitespace-nowrap">
                        <th className="sticky left-0 z-20 bg-card border-r border-foreground/10">Time</th>
                        <th>pH</th>
                        <th>PaO₂ (mmHg)</th>
                        <th>PaCO₂ (mmHg)</th>
                        <th>HCO₃ (mEq/L)</th>
                        <th>BE (mEq/L)</th>
                        <th>Lactate (mmol/L)</th>
                        <th>FiO₂ (%)</th>
                        <th>Na⁺ (mEq/L)</th>
                        <th>Cl⁻ (mEq/L)</th>
                        <th>Mode</th>
                        <th>TV (mL)</th>
                        <th>PEEP (cmH₂O)</th>
                        <th>PIP (cmH₂O)</th>
                        <th>Pplat (cmH₂O)</th>
                        <th>RR (/min)</th>
                        <th>ETT cuff (cmH₂O)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                    {rows.map((r: any) => (
                        <tr key={r.id} className="[&_td]:px-3 [&_td]:py-2.5 [&_td]:text-center [&_td]:whitespace-nowrap [&_td]:tabular-nums even:bg-surface-container-high/20 transition-colors hover:bg-primary/5">
                            <td className="sticky left-0 z-10 bg-card border-r border-foreground/10 font-medium">{fmtTime(r.recordedAt)}</td>
                            <td>{r.ph ?? '—'}</td>
                            <td>{r.paO2Mmhg ?? '—'}</td>
                            <td>{r.paCo2Mmhg ?? '—'}</td>
                            <td>{r.hco3Meql ?? '—'}</td>
                            <td>{r.baseExcessMeql ?? '—'}</td>
                            <td>{r.lactateMmoll ?? '—'}</td>
                            <td>{r.fio2Pct ?? '—'}</td>
                            <td>{r.sodiumMeql ?? '—'}</td>
                            <td>{r.chlorideMeql ?? '—'}</td>
                            <td className="uppercase">{r.mode ?? '—'}</td>
                            <td>{r.tidalVolumeMl ?? '—'}</td>
                            <td>{r.peepCmh2o ?? '—'}</td>
                            <td>{r.pipCmh2o ?? '—'}</td>
                            <td>{r.pplatCmh2o ?? '—'}</td>
                            <td>{r.breathingRatePerMin ?? '—'}</td>
                            <td>{r.ettCuffCmh2o ?? '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const yn = (v?: boolean) => (v == null ? '—' : v ? 'Yes' : 'No');

function FastHugSepsisList({ admissionId }: { admissionId: string }) {
    const { data: rows, isLoading } = useFastHugSepsisList(admissionId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
        );
    }

    if (!rows || rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">
                No FAST-HUG / sepsis entries yet.
            </div>
        );
    }

    const withDetail = (done?: boolean, detail?: string) =>
        done == null && !detail ? '—' : `${yn(done)}${detail ? ` · ${detail}` : ''}`;

    return (
        <div className="overflow-x-auto rounded-xl border border-foreground/10 shadow-sm">
            <table className="w-full min-w-275 text-sm">
                <thead className="bg-primary/10 text-[11px] font-semibold tracking-wide text-primary border-b border-primary/20">
                    <tr className="[&_th]:px-3 [&_th]:py-2.5 [&_th]:text-center [&_th]:font-semibold [&_th]:tracking-wide [&_th]:whitespace-nowrap">
                        <th className="sticky left-0 z-20 bg-card border-r border-foreground/10">Time</th>
                        <th>Feeding</th>
                        <th>Analgesia</th>
                        <th>Sedation</th>
                        <th>Thrombo</th>
                        <th>Head of bed</th>
                        <th>Ulcer prophy</th>
                        <th>Glucose</th>
                        <th>Bowel</th>
                        <th>Blood cultures</th>
                        <th>Antibiotics</th>
                        <th>Lactate</th>
                        <th>Fluid bolus</th>
                        <th>Vasopressors</th>
                        <th>MAP target</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                    {rows.map((r: any) => (
                        <tr key={r.id} className="[&_td]:px-3 [&_td]:py-2.5 [&_td]:text-center [&_td]:whitespace-nowrap [&_td]:tabular-nums even:bg-surface-container-high/20 transition-colors hover:bg-primary/5">
                            <td className="sticky left-0 z-10 bg-card border-r border-foreground/10 font-medium">{fmtTime(r.recordedAt)}</td>
                            <td>{r.feeding || '—'}</td>
                            <td>{r.analgesia || '—'}</td>
                            <td>{r.sedation || '—'}</td>
                            <td>{r.thromboprophylaxis || '—'}</td>
                            <td>{r.headOfBed || '—'}</td>
                            <td>{r.ulcerProphylaxis || '—'}</td>
                            <td>{r.glucoseControl || '—'}</td>
                            <td>{r.bowelCare || '—'}</td>
                            <td className="whitespace-nowrap">{withDetail(r.bloodCulturesDone, r.bloodCulturesTime ? fmtTime(r.bloodCulturesTime) : undefined)}</td>
                            <td className="whitespace-nowrap">{withDetail(r.antibioticsGiven, r.antibioticName || undefined)}</td>
                            <td className="whitespace-nowrap">{withDetail(r.lactateDone, r.lactateMmoll != null ? `${r.lactateMmoll}` : undefined)}</td>
                            <td className="whitespace-nowrap">{withDetail(r.fluidBolusGiven, r.bolusVolumeMl != null ? `${r.bolusVolumeMl} mL` : undefined)}</td>
                            <td>{yn(r.vasopressorsStarted)}</td>
                            <td>{yn(r.mapTargetReached)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SeverityScoreList({ admissionId }: { admissionId: string }) {
    const { data: rows, isLoading } = useSeverityScoreList(admissionId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
        );
    }

    if (!rows || rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">
                No severity score entries yet.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-foreground/10 shadow-sm">
            <table className="w-full min-w-180 text-sm">
                <thead className="bg-primary/10 text-[11px] font-semibold tracking-wide text-primary border-b border-primary/20">
                    <tr className="[&_th]:px-3 [&_th]:py-2.5 [&_th]:text-center [&_th]:font-semibold [&_th]:tracking-wide [&_th]:whitespace-nowrap">
                        <th className="sticky left-0 z-20 bg-card border-r border-foreground/10">Time</th>
                        <th>Resp</th>
                        <th>Coag</th>
                        <th>Liver</th>
                        <th>CVS</th>
                        <th>CNS</th>
                        <th>Renal</th>
                        <th>SOFA total</th>
                        <th>APACHE II</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                    {rows.map((r: any) => (
                        <tr key={r.id} className="[&_td]:px-3 [&_td]:py-2.5 [&_td]:text-center [&_td]:whitespace-nowrap [&_td]:tabular-nums even:bg-surface-container-high/20 transition-colors hover:bg-primary/5">
                            <td className="sticky left-0 z-10 bg-card border-r border-foreground/10 font-medium">{fmtTime(r.recordedAt)}</td>
                            <td>{r.sofaRespiration ?? '—'}</td>
                            <td>{r.sofaCoagulation ?? '—'}</td>
                            <td>{r.sofaLiver ?? '—'}</td>
                            <td>{r.sofaCardiovascular ?? '—'}</td>
                            <td>{r.sofaCns ?? '—'}</td>
                            <td>{r.sofaRenal ?? '—'}</td>
                            <td className="font-semibold">{r.sofaTotal ?? '—'} / 24</td>
                            <td className="font-semibold">{r.apacheScore ?? '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function InvasiveLineList({ admissionId }: { admissionId: string }) {
    const { data: rows, isLoading } = useInvasiveLineList(admissionId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
        );
    }

    if (!rows || rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">
                No invasive line entries yet.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-foreground/10 shadow-sm">
            <table className="w-full min-w-225 text-sm">
                <thead className="bg-primary/10 text-[11px] font-semibold tracking-wide text-primary border-b border-primary/20">
                    <tr className="[&_th]:px-3 [&_th]:py-2.5 [&_th]:text-center [&_th]:font-semibold [&_th]:tracking-wide [&_th]:whitespace-nowrap">
                        <th className="sticky left-0 z-20 bg-card border-r border-foreground/10">Device</th>
                        <th>Status</th>
                        <th>Body site</th>
                        <th>Details</th>
                        <th>Inserted</th>
                        <th>Inserted by</th>
                        <th>Dressing due</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                    {rows.map((r: any) => (
                        <tr key={r.id} className="[&_td]:px-3 [&_td]:py-2.5 [&_td]:text-center [&_td]:whitespace-nowrap [&_td]:tabular-nums even:bg-surface-container-high/20 transition-colors hover:bg-primary/5">
                            <td className="sticky left-0 z-10 bg-card border-r border-foreground/10 font-medium">{r.deviceType || '—'}</td>
                            <td className="capitalize">{r.status || '—'}</td>
                            <td>{r.bodySite || '—'}</td>
                            <td>{r.details || '—'}</td>
                            <td className="whitespace-nowrap">{r.insertedAt ? fmtTime(r.insertedAt) : '—'}</td>
                            <td>{r.insertedBy || '—'}</td>
                            <td className="whitespace-nowrap">{r.dressingDue ? fmtTime(r.dressingDue) : '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function InfusionPumpList({ admissionId }: { admissionId: string }) {
    const { data: rows, isLoading } = useInfusionPumpList(admissionId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
        );
    }

    if (!rows || rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">
                No infusion pump entries yet.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-foreground/10 shadow-sm">
            <table className="w-full min-w-180 text-sm">
                <thead className="bg-primary/10 text-[11px] font-semibold tracking-wide text-primary border-b border-primary/20">
                    <tr className="[&_th]:px-3 [&_th]:py-2.5 [&_th]:text-center [&_th]:font-semibold [&_th]:tracking-wide [&_th]:whitespace-nowrap">
                        <th className="sticky left-0 z-20 bg-card border-r border-foreground/10">Recorded</th>
                        <th>Syringe (mg)</th>
                        <th>Dose (mcg/kg/min)</th>
                        <th>Weight (kg)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                    {rows.map((r: any) => (
                        <tr key={r.id} className="[&_td]:px-3 [&_td]:py-2.5 [&_td]:text-center [&_td]:whitespace-nowrap [&_td]:tabular-nums even:bg-surface-container-high/20 transition-colors hover:bg-primary/5">
                            <td className="sticky left-0 z-10 bg-card border-r border-foreground/10 font-medium">{fmtTime(r.createdAt)}</td>
                            <td>{r.noradSyringeMg ?? '—'}</td>
                            <td>{r.noradDoseMcgKgMin ?? '—'}</td>
                            <td>{r.weightKg ?? '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const ICU_SECTIONS = [
    { value: 'fluid', label: 'ICU Fluid Balance', icon: Droplets },
    { value: 'abg', label: 'ABG Analyzer & Ventilator Mechanics', icon: Wind },
    { value: 'fasthug', label: 'FAST-HUG & Sepsis-3', icon: ClipboardCheck },
    { value: 'lines', label: 'Invasive Device Lines', icon: Syringe },
    { value: 'pumps', label: 'Titrated Infusion Pumps', icon: Gauge },
    { value: 'scores', label: 'SOFA & Apache Scoring ', icon: Activity },
] as const;

const SECTION_LISTS: Record<string, (p: { admissionId: string }) => React.ReactElement> = {
    fluid: FluidBalanceList,
    abg: AbgVentList,
    fasthug: FastHugSepsisList,
    scores: SeverityScoreList,
    lines: InvasiveLineList,
    pumps: InfusionPumpList,
};

export default function IcuDetailPanel({ admissionId }: IcuDetailPanelProps) {
    const [addOpen, setAddOpen] = useState<
        null | 'fluid' | 'abg' | 'fasthug' | 'lines' | 'pumps' | 'scores'
    >(null);

    return (
        <div className="space-y-4">
            <Tabs defaultValue="fluid" className="w-full min-w-0">
                <div className="w-full max-w-full overflow-x-auto sanctuary-scrollbar">
                    <TabsList className="flex w-max flex-nowrap justify-start gap-1">
                        {ICU_SECTIONS.map((s) => {
                            const Icon = s.icon;
                            return (
                                <TabsTrigger
                                    key={s.value}
                                    value={s.value}
                                    className="flex-none gap-1.5 whitespace-nowrap text-xs"
                                >
                                    <Icon className="h-3.5 w-3.5 shrink-0" />
                                    <span>{s.label}</span>
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </div>

                {ICU_SECTIONS.map((s) => {
                    const List = SECTION_LISTS[s.value];
                    return (
                        <TabsContent key={s.value} value={s.value} className="mt-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold">{s.label}</h3>
                                <Button
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => setAddOpen(s.value as typeof addOpen)}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add entry
                                </Button>
                            </div>
                            <List admissionId={admissionId} />
                        </TabsContent>
                    );
                })}
            </Tabs>

            <Dialog open={addOpen !== null} onOpenChange={(open) => !open && setAddOpen(null)}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Add — {ICU_SECTIONS.find((s) => s.value === addOpen)?.label}
                        </DialogTitle>
                    </DialogHeader>
                    {addOpen === 'fluid' && <FluidBalanceForm admissionId={admissionId} onSaved={() => setAddOpen(null)} />}
                    {addOpen === 'abg' && <AbgVentForm admissionId={admissionId} onSaved={() => setAddOpen(null)} />}
                    {addOpen === 'fasthug' && <FastHugSepsisForm admissionId={admissionId} onSaved={() => setAddOpen(null)} />}
                    {addOpen === 'lines' && <InvasiveLineForm admissionId={admissionId} onSaved={() => setAddOpen(null)} />}
                    {addOpen === 'pumps' && <InfusionPumpForm admissionId={admissionId} onSaved={() => setAddOpen(null)} />}
                    {addOpen === 'scores' && <SeverityScoresForm admissionId={admissionId} onSaved={() => setAddOpen(null)} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}
