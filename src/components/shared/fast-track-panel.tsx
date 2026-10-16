'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FastTrackCodeDialog } from './fast-track-code-dialog';

interface FastTrackPanelProps {
  admissionId: string;
  visitId?: string;
  patientId: string;
  role: string;
}

export default function FastTrackPanel(_props: FastTrackPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-on-surface">Fast Track Codes</h3>
        <p className="text-xs text-on-surface-variant">
          Activate a rapid-response protocol code for this patient.
        </p>
      </div>

      <div className="flex justify-center py-6">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Code
        </Button>
      </div>

      <FastTrackCodeDialog open={dialogOpen} setOpen={setDialogOpen} />
    </div>
  );
}
