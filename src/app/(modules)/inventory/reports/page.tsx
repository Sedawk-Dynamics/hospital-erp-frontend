'use client';

import Link from 'next/link';
import {
  Boxes, Building2, ShoppingCart, AlertTriangle, FileCheck, ArrowRight, BarChart3,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';

const reportCards = [
  {
    title: 'Detailed Analysis',
    description:
      'Full one-page rollup: stock valuation by category, movement trend, low-stock, purchase spend, transfers, expiry/waste and department consumption — all with CSV export.',
    icon: BarChart3,
    href: '/inventory/reports/detailed',
    color: 'text-primary',
    bgColor: 'bg-primary/5',
    borderColor: 'border-primary/30',
  },
  {
    title: 'Stock Balance',
    description:
      'Daily/monthly inflow vs outflow per item with net change and current stock levels. Filter by item, category, or date window.',
    icon: Boxes,
    href: '/inventory/reports/stock-balance',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    title: 'Department Consumption',
    description:
      'Usage by department (pharmacy, OT, emergency, ICU, etc.) with cost analysis and per-item breakdown over a chosen date range.',
    icon: Building2,
    href: '/inventory/reports/dept-consumption',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  {
    title: 'Reorder History',
    description:
      'Past purchase orders with supplier, items, quantities and amounts. Supplier-wise totals to spot procurement patterns.',
    icon: ShoppingCart,
    href: '/inventory/reports/reorder-history',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  {
    title: 'Expiry & Waste',
    description:
      'Upcoming expiries within a window, expired removals (waste value), and returned goods — gives a full disposal-cost picture.',
    icon: AlertTriangle,
    href: '/inventory/reports/expiry-waste',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    title: 'Audit Logs',
    description:
      'Every stock action (additions, deductions, returns, adjustments, transfers) with user, timestamp, and before/after values.',
    icon: FileCheck,
    href: '/inventory/audit-logs',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
];

export default function InventoryReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Inventory Reports"
        description="Compliance-grade visibility across stock movement, consumption, procurement, expiry and audit trail"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map((report) => (
          <Link
            key={report.title}
            href={report.href}
            className={`group block rounded-xl shadow-sanctuary border-l-4 border-primary ${report.borderColor} ${report.bgColor} bg-surface-container-lowest p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg`}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white/80 p-3 shadow-sm">
                <report.icon className={`h-6 w-6 ${report.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-headline text-base font-bold">{report.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{report.description}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end text-xs text-primary font-medium">
              Open
              <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
