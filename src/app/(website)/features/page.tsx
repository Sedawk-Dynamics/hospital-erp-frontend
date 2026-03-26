import {
  CalendarCheck, Receipt, FlaskConical, Pill, Scissors, ScanLine,
  BedDouble, BarChart3, Shield, Users, Stethoscope, Building2,
  Smartphone, Globe, Clock, Lock,
} from 'lucide-react';

const modules = [
  {
    icon: CalendarCheck, title: 'Appointment Management',
    description: 'Smart queue management with walk-in and scheduled visit handling. Doctor assignment, real-time status tracking, token-based queuing, and slot management.',
    highlights: ['Queue tokens', 'Doctor schedules', 'Walk-in support', 'Status tracking'],
  },
  {
    icon: Receipt, title: 'Billing & Invoicing',
    description: 'Complete billing workflows — cash counter, credit settlements, insurance claims, receipt generation, and day-end reconciliation.',
    highlights: ['Insurance billing', 'Credit settlement', 'Auto receipts', 'Day-end reports'],
  },
  {
    icon: FlaskConical, title: 'Laboratory Management',
    description: 'End-to-end lab workflow from order to report. Sample collection, technician assignment, outsource tracking, and digital report delivery.',
    highlights: ['Sample tracking', 'Auto-notifications', 'Outsource labs', 'Report templates'],
  },
  {
    icon: Pill, title: 'Pharmacy & Inventory',
    description: 'POS-style pharmacy billing with batch management, expiry alerts, stock tracking, and automated purchase order generation.',
    highlights: ['POS billing', 'Batch tracking', 'Expiry alerts', 'Auto reorder'],
  },
  {
    icon: Scissors, title: 'Operation Theatre',
    description: 'Schedule surgeries, manage OT rooms, track equipment sterilization, and coordinate surgical teams with pre/post-op workflows.',
    highlights: ['OT scheduling', 'Team coordination', 'Equipment tracking', 'Pre-op checklists'],
  },
  {
    icon: ScanLine, title: 'Radiology & Imaging',
    description: 'Handle radiology orders, manage equipment schedules, store DICOM images, and deliver reports digitally.',
    highlights: ['Order management', 'DICOM support', 'Digital reports', 'Equipment scheduling'],
  },
  {
    icon: BedDouble, title: 'Ward & Bed Management',
    description: 'Real-time bed availability map, admission/discharge tracking, ward-wise occupancy, and patient transfer management.',
    highlights: ['Bed heatmap', 'Real-time occupancy', 'Transfer management', 'Ward analytics'],
  },
  {
    icon: BarChart3, title: 'Reports & Analytics',
    description: 'Comprehensive dashboards with collection summaries, revenue analytics, department-wise reports, and custom report builder.',
    highlights: ['Revenue analytics', 'Department reports', 'Custom builder', 'Export to Excel'],
  },
];

const capabilities = [
  { icon: Shield, title: 'Role-Based Access', description: '18 customizable roles with 192 granular permissions across 32 modules.' },
  { icon: Users, title: 'Multi-Hospital', description: 'Manage multiple hospitals from a single dashboard with consolidated reporting.' },
  { icon: Stethoscope, title: 'IP & OP Management', description: 'Complete inpatient and outpatient workflows with admissions, vitals, and discharge.' },
  { icon: Building2, title: 'Department Management', description: 'Configure departments, wards, rooms, and beds with drag-and-drop simplicity.' },
  { icon: Smartphone, title: 'Mobile Responsive', description: 'Access from any device — desktop, tablet, or mobile. Works on any modern browser.' },
  { icon: Globe, title: 'Cloud-Based SaaS', description: 'No installation needed. Access from anywhere with automatic updates and backups.' },
  { icon: Clock, title: 'Real-Time Sync', description: 'All modules stay in sync. Changes reflect instantly across the entire system.' },
  { icon: Lock, title: 'Enterprise Security', description: 'AES-256 encryption, TLS 1.3, two-factor authentication, and audit logs.' },
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 sm:pt-40 sm:pb-20 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-label text-sm font-bold uppercase tracking-widest text-primary mb-4 animate-fade-in-up">Features</p>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface sm:text-5xl animate-fade-in-up animate-stagger-1">
            Every Module Your Hospital Needs
          </h1>
          <p className="mt-6 font-label text-lg text-on-surface-variant max-w-2xl mx-auto animate-fade-in-up animate-stagger-2">
            From patient registration to discharge, Hospital ERP covers every department and every workflow in your hospital.
          </p>
        </div>
      </section>

      {/* Modules Grid */}
      <section className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {modules.map((mod, i) => (
              <div
                key={mod.title}
                className={`bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 animate-fade-in-up`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start gap-5">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <mod.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-headline text-lg font-bold text-on-surface mb-2">{mod.title}</h3>
                    <p className="font-label text-sm text-on-surface-variant leading-relaxed mb-4">{mod.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {mod.highlights.map((h) => (
                        <span key={h} className="font-label text-[10px] font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-full">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 sm:py-28 bg-surface-container-low">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="font-label text-sm font-bold uppercase tracking-widest text-primary mb-3">Platform Capabilities</p>
            <h2 className="font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">Built for Scale & Security</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {capabilities.map((cap, i) => (
              <div key={cap.title} className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 text-center animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <cap.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-headline text-sm font-bold text-on-surface mb-2">{cap.title}</h3>
                <p className="font-label text-xs text-on-surface-variant leading-relaxed">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
