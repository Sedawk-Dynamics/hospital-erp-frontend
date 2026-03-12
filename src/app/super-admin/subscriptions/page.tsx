'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { useTenants, useCreateSubscription, type Tenant } from '@/hooks/use-super-admin';

export default function SubscriptionsPage() {
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useTenants({ page, limit: 10 });
  const createSubscription = useCreateSubscription();

  const [formData, setFormData] = useState({
    tenantId: '',
    plan: 'basic' as 'free' | 'basic' | 'professional' | 'enterprise',
    billingCycle: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  const handleCreate = async () => {
    if (!formData.tenantId || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await createSubscription.mutateAsync({
        tenantId: formData.tenantId,
        plan: formData.plan,
        billingCycle: formData.billingCycle,
        startDate: formData.startDate,
        endDate: formData.endDate,
      });
      toast.success('Subscription created successfully');
      setDialogOpen(false);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create subscription';
      toast.error(message);
    }
  };

  const tenants = data?.data ?? [];

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      label: 'Hospital',
      render: (item) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.slug}</p>
        </div>
      ),
    },
    {
      key: 'subscription',
      label: 'Plan',
      render: (item) => {
        const sub = item.tenantSubscriptions?.[0];
        return sub ? (
          <Badge variant="secondary">{sub.planId}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">No subscription</span>
        );
      },
    },
    {
      key: 'billingCycle',
      label: 'Billing Cycle',
      render: (item) => {
        const sub = item.tenantSubscriptions?.[0];
        return sub?.billingCycle || '-';
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => {
        const sub = item.tenantSubscriptions?.[0];
        if (!sub) return <Badge variant="outline">None</Badge>;
        return (
          <Badge variant={sub.status === 'active' ? 'default' : 'destructive'}>
            {sub.status}
          </Badge>
        );
      },
    },
    {
      key: 'dates',
      label: 'Period',
      render: (item) => {
        const sub = item.tenantSubscriptions?.[0];
        if (!sub) return '-';
        return (
          <span className="text-xs">
            {new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">Manage hospital subscriptions and billing</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button>Assign Subscription</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Subscription</DialogTitle>
              <DialogDescription>Create a subscription for a hospital.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Hospital *</Label>
                <Select value={formData.tenantId} onValueChange={(v) => setFormData((p) => ({ ...p, tenantId: v ?? '' }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hospital" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plan *</Label>
                  <Select value={formData.plan} onValueChange={(v) => setFormData((p) => ({ ...p, plan: (v ?? 'basic') as typeof formData.plan }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select value={formData.billingCycle} onValueChange={(v) => setFormData((p) => ({ ...p, billingCycle: (v ?? 'monthly') as typeof formData.billingCycle }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createSubscription.isPending}>
                {createSubscription.isPending ? 'Creating...' : 'Create Subscription'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={(tenants) as unknown as Record<string, unknown>[]}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={data?.meta?.total ?? 0}
        onPageChange={setPage}
        emptyMessage="No hospitals found."
      />
    </div>
  );
}
