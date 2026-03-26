'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { PageLoading } from '@/components/shared/loading';
import { ArrowLeft, Printer, CreditCard, Receipt } from 'lucide-react';
import apiClient from '@/lib/api-client';
import type { Bill } from '@/types';

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [bill, setBill] = useState<Bill | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const { data } = await apiClient.get(`/bills/${id}`);
        setBill(data.data);
      } catch {
        toast.error('Failed to fetch bill details');
        router.push('/billing');
      } finally {
        setIsLoading(false);
      }
    };
    fetchBill();
  }, [id, router]);

  if (isLoading) return <PageLoading />;
  if (!bill) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bill ${bill.billNumber}`}
        description={`Created ${(() => { try { return formatDate(bill.createdAt); } catch { return ''; } })()}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bill Items */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Bill Items</CardTitle>
              <StatusBadge status={bill.status} />
            </div>
          </CardHeader>
          <CardContent>
            {bill.items && bill.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">${item.unitPrice?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${item.total?.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4}>Subtotal</TableCell>
                    <TableCell className="text-right">${bill.subtotal?.toFixed(2)}</TableCell>
                  </TableRow>
                  {bill.discount > 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>Discount</TableCell>
                      <TableCell className="text-right text-emerald-600">-${bill.discount?.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                  {bill.tax > 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>Tax</TableCell>
                      <TableCell className="text-right">${bill.tax?.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold">
                    <TableCell colSpan={4}>Total</TableCell>
                    <TableCell className="text-right">${bill.total?.toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            ) : (
              <EmptyState
                icon={Receipt}
                title="No Items"
                description="No items have been added to this bill."
              />
            )}
          </CardContent>
        </Card>

        {/* Summary & Payments */}
        <div className="space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patient</CardTitle>
            </CardHeader>
            <CardContent>
              {bill.patient ? (
                <div>
                  <button
                    onClick={() => router.push(`/patients/${bill.patientId}`)}
                    className="font-medium text-primary hover:underline"
                  >
                    {bill.patient.firstName} {bill.patient.lastName}
                  </button>
                  <p className="text-xs text-muted-foreground">MRN: {bill.patient.mrn}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Patient not found</p>
              )}
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">${bill.total?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium text-emerald-600">${bill.paidAmount?.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Balance</span>
                <span className={bill.balanceAmount > 0 ? 'text-destructive' : 'text-emerald-600'}>
                  ${bill.balanceAmount?.toFixed(2)}
                </span>
              </div>
              {bill.balanceAmount > 0 && (
                <Button className="w-full gap-2 mt-2">
                  <CreditCard className="h-4 w-4" />
                  Record Payment
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {bill.payments && bill.payments.length > 0 ? (
                <div className="space-y-3">
                  {bill.payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium capitalize">{payment.method?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {(() => { try { return formatDate(payment.createdAt); } catch { return ''; } })()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">${payment.amount?.toFixed(2)}</p>
                        <StatusBadge status={payment.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No payments recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
