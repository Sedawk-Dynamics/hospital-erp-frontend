'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';

import { toast } from 'sonner';

import { Button } from '../ui/button';
import MedicoLegalPanelDialog from './medico-legal-panel-dialog';
import MedicoLegalRecordCard from './medico-legal-record-card';
import { addMedicoLegalInput } from '@/lib/schema/medico-legal-schema';
import { useAddMedicoLegal, useMedicoLegalRecords } from '@/hooks/use-medico-legal';

interface MedicoLegalPanelProps {
  admissionId: string;
  patientId: string;
  visitId?: string;
}

export default function MedicoLegalPanel({ admissionId, patientId, visitId }: MedicoLegalPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const addMedicoLegal = useAddMedicoLegal();
  const { data: records, isLoading } = useMedicoLegalRecords(admissionId);
  const hasRecords = (records?.length ?? 0) > 0;

  const addButton = (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
      <Plus className="h-4 w-4" />
      Add Medico Legal & Injury canvas
    </Button>
  );

  const handleSubmit = async (data: addMedicoLegalInput) => {
    try {
      await addMedicoLegal.mutateAsync({
        patientId,
        admissionId,
        visitId,
        ...data,
      });
      setDialogOpen(false);
    } catch {
      toast.error('Error in adding the medico-legal record');
    }
  };

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Medico-Legal &amp; Injury Canvas</h3>
          <p className="text-xs text-on-surface-variant">
            Flag the case as medico-legal (MLC) and record police intimation details.
          </p>
        </div>
        {hasRecords && addButton}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
        </div>
      ) : hasRecords ? (
        <div className="space-y-3">
          {records!.map((rec) => (
            <MedicoLegalRecordCard key={rec.id} record={rec} />
          ))}
        </div>
      ) : (
        <div className="flex justify-center py-6">{addButton}</div>
      )}

      <MedicoLegalPanelDialog open={dialogOpen} setOpen={setDialogOpen} onSave={handleSubmit} />
    </div>
  );
}
