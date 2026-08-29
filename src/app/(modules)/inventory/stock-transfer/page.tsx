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
import {
  ArrowLeftRight, BedDouble, ScrollText, ShieldAlert,
  PackagePlus, Syringe, Trash2, Boxes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { StockTransferBoard } from '@/components/shared/stock-transfer-board';
import {
  WardStockPanel, WardLedgerPanel, useWardOptions,
} from '@/components/pharmacy/ward-stock-board';
import {
  LocationDialog, ReceiveDialog, ConsumptionDialog, DisposalDialog,
} from '@/components/pharmacy/ndps-statutory';

export default function InventoryStockTransferPage() {
  const wards = useWardOptions();
  const [wardId, setWardId] = useState('');
  const [dialog, setDialog] = useState<null | 'receive' | 'consume' | 'dispose' | 'location'>(null);

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
          <TabsTrigger value="ndps">
            <ShieldAlert className="mr-1.5 h-4 w-4" /> NDPS records
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
        {/* ── The statutory NDPS records ──
            Here so that every stock action is on one page, but in a tab of
            their own because they are not ordinary movements: each captures
            what the NDPS Act requires — a Form 3C consignment number, the
            prescriber's registration, a destruction reference — and each
            refuses any drug not on the narcotic list. That refusal is correct;
            it was only confusing when the buttons sat among general actions. */}
        <TabsContent value="ndps" className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs">
              <span className="font-semibold">Narcotics only.</span> These record what the NDPS Act
              requires and will refuse any drug not on the narcotic list. Ordinary stock movement —
              any medicine, these included — is the other tabs on this page.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialog('receive')}>
              <PackagePlus className="mr-1.5 h-4 w-4" /> Receive (Form 3C)
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog('consume')}>
              <Syringe className="mr-1.5 h-4 w-4" /> Administer (Form 3E)
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog('dispose')}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Disposal
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDialog('location')}>
              <Boxes className="mr-1.5 h-4 w-4" /> New sub-store
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            What these produce — the register, the running balances and Form 35 — is read on the
            Controlled-Drug Register.
          </p>
        </TabsContent>
      </Tabs>

      <ReceiveDialog open={dialog === 'receive'} onOpenChange={(o) => setDialog(o ? 'receive' : null)} />
      <ConsumptionDialog open={dialog === 'consume'} onOpenChange={(o) => setDialog(o ? 'consume' : null)} />
      <DisposalDialog open={dialog === 'dispose'} onOpenChange={(o) => setDialog(o ? 'dispose' : null)} />
      <LocationDialog open={dialog === 'location'} onOpenChange={(o) => setDialog(o ? 'location' : null)} />
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
