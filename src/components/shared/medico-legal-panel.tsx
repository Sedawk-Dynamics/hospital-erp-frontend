'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '../ui/button';
import MedicoLegalPanelDialog from './medico-legal-panel-dialog';

export default function MedicoLegalPanel() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const addButton = (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
      <Plus className="h-4 w-4" />
      Add Medico Legal & Injury canvas
    </Button>
  );

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Medico-Legal &amp; Injury Canvas</h3>
          <p className="text-xs text-on-surface-variant">
            Flag the case as medico-legal (MLC) and record police intimation details.
          </p>
        </div>
      </div>

      <div className="flex justify-center py-6">{addButton}</div>

      <MedicoLegalPanelDialog open={dialogOpen} setOpen={setDialogOpen} />
    </div>
  );
}
