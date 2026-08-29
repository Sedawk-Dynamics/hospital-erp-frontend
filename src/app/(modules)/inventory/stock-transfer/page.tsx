'use client';

/**
 * The one place stock moves.
 *
 * Narcotics used to have a screen of their own, and ward stock another. Three
 * places to learn, and the transfer board — the one people actually used —
 * quietly lost drug stock: it decremented the pharmacy batch on dispatch and
 * credited nowhere, because departments do not hold drug stock and a transfer
 * could not name a ward.
 *
 * Now a drug transfer names its ward, receiving puts it on that ward's shelf,
 * and the shelf and its ledger are here beside the transfers that filled it.
 * All of it is the GENERAL ward-stock ledger, so it works for every drug —
 * paracetamol as much as morphine. A narcotic simply carries extra
 * requirements (a named custodian at dispatch), not a separate screen.
 *
 * The statutory NDPS records — Form 3C, Form 3E, disposal — stay on the
 * Controlled-Drug Register. They are narcotic-only by law, not by oversight,
 * and they capture fields no ordinary movement has.
 */

import { useState } from 'react';
import { ArrowLeftRight, BedDouble, ScrollText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { StockTransferBoard } from '@/components/shared/stock-transfer-board';
import {
  WardStockPanel, WardLedgerPanel, useWardOptions,
} from '@/components/pharmacy/ward-stock-board';

export default function InventoryStockTransferPage() {
  const wards = useWardOptions();
  const [wardId, setWardId] = useState('');

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Tabs defaultValue="transfers">
        <TabsList variant="line">
          <TabsTrigger value="transfers">
            <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Transfers
          </TabsTrigger>
          <TabsTrigger value="ward">
            <BedDouble className="mr-1.5 h-4 w-4" /> Ward stock
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <ScrollText className="mr-1.5 h-4 w-4" /> Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfers">
          <StockTransferBoard
            title="Stock Transfer"
            description="Issue stock from the pharmacy store to a ward, department or other location"
            fromPharmacyOnly
          />
        </TabsContent>

        {/* One ward chosen for both panels — picking it twice would be the kind
            of small friction that sends people back to the old screen. */}
        <TabsContent value="ward" className="space-y-4">
          <WardChooser wards={wards} value={wardId} onChange={setWardId} />
          {wardId ? (
            <WardStockPanel wardId={wardId} />
          ) : (
            <EmptyState
              icon={BedDouble}
              title="Pick a ward"
              description="Choose a ward to see what it holds and to dispense, return or correct it."
            />
          )}
        </TabsContent>

        <TabsContent value="ledger" className="space-y-4">
          <WardChooser wards={wards} value={wardId} onChange={setWardId} />
          {wardId ? (
            <WardLedgerPanel wardId={wardId} />
          ) : (
            <EmptyState
              icon={ScrollText}
              title="Pick a ward"
              description="Every movement of that ward's stock — received, dispensed, returned, corrected."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WardChooser({
  wards,
  value,
  onChange,
}: {
  wards: Array<{ id: string; name: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label="Ward"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-border bg-background px-2 text-sm"
    >
      <option value="">Select a ward…</option>
      {wards.map((w) => (
        <option key={w.id} value={w.id}>{w.name}</option>
      ))}
    </select>
  );
}
