'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';

import { toast } from 'sonner';

import { Button } from '../ui/button';
import IntoxicationExamRecordCard from './intoxication-exam-record-card';
import { AddIntoxicationExamInput as IntoxicationFormValues } from '@/lib/schema/intoxication-exam-schema';
import { useAddIntoxicationExam, useIntoxicationExams } from '@/hooks/use-intoxication-exam';
import { useAuth } from '@/hooks/use-auth';
import IntoxicationExamDialog from './intoxication-exam-dialog';

interface MedicoLegalPanelProps {
    admissionId: string;
    patientId: string;
    visitId?: string;
}

export default function IntoxicationExamPanel({ admissionId, patientId, visitId }: MedicoLegalPanelProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const addIntoxicationExam = useAddIntoxicationExam();
    const { user } = useAuth();
    const roleSlug = (user?.role?.slug ?? user?.role?.name ?? '').toLowerCase();
    const isDoctor = roleSlug === "doctor";
    const { data: records, isLoading } = useIntoxicationExams(admissionId);
    const hasRecords = (records?.length ?? 0) > 0;

    const addButton = (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Intoxication Examination
        </Button>
    );

    const onsubmit = async (data: IntoxicationFormValues) => {
        try {
            await addIntoxicationExam.mutateAsync({
                patientId,
                admissionId,
                visitId,
                ...data,
            });
            setDialogOpen(false);
        } catch {
            toast.error('Error in adding the intoxication exam');
        }
    };

    return (
        <div className="rounded-xl border border-outline-variant/40 bg-white p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-on-surface">Statutory Examination for Alcohol & Substance Intoxication (Form 39)
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                        Mandatory medico-legal protocol under Section 185 Motor Vehicles Act 1988 & Bharatiya Nagarik Suraksha Sanhita (BNSS 2023).
                    </p>
                </div>
                {(hasRecords && isDoctor) && addButton}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
                </div>
            ) : hasRecords ? (
                <div className="space-y-3">
                    {records!.map((rec) => (
                        <IntoxicationExamRecordCard key={rec.id} record={rec} />
                    ))}
                </div>
            ) : (
                <div className="flex justify-center py-6">{isDoctor && addButton}</div>
            )}

            <IntoxicationExamDialog open={dialogOpen} setOpen={setDialogOpen} onSave={onsubmit} />
        </div>
    );
}


