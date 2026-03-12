'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function PharmacyBillingPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Pharmacy Billing</h1>

      <Tabs defaultValue="billing">
        <TabsList variant="line">
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="return">Return Bills</TabsTrigger>
          <TabsTrigger value="cash-counter">Cash Counter</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="pt-4">
          <PharmacyPOS />
        </TabsContent>
        <TabsContent value="return" className="pt-4">
          <div className="py-8 text-center text-muted-foreground">Return Bills — Coming Soon</div>
        </TabsContent>
        <TabsContent value="cash-counter" className="pt-4">
          <div className="py-8 text-center text-muted-foreground">Cash Counter — Coming Soon</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PharmacyPOS() {
  const [patientSearch, setPatientSearch] = useState('');

  return (
    <div className="space-y-4">
      {/* Patient search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient mobile, name, consultant..."
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">IP List</Button>
        <Button variant="outline" size="sm">Prescription</Button>
      </div>

      {/* POS-style billing area */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Line items */}
        <div className="lg:col-span-2 rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Brand Name</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Batch</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Avl Qty</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Cost/Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">
                    Search for medicines to add to bill
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary panel */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-foreground">Bill Summary</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sub Amount</span>
              <span className="font-medium">0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount %</span>
              <span className="font-medium">0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Round Off</span>
              <span className="font-medium">0.00</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-base">
              <span className="font-semibold">Payable Amount</span>
              <span className="font-bold text-primary">0.00</span>
            </div>
          </div>

          {/* Payment mode */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Mode of Payment</p>
            <div className="flex flex-wrap gap-2">
              {['Cash', 'Card', 'UPI', 'Bank Transfer'].map((mode) => (
                <label key={mode} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" className="rounded border-border" />
                  {mode}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1">Save Draft</Button>
            <Button className="flex-1">Receive Payment</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
