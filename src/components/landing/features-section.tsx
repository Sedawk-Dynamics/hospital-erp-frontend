import {
  CalendarCheck,
  Receipt,
  FlaskConical,
  Pill,
  Scissors,
  ScanLine,
  BedDouble,
  BarChart3,
} from 'lucide-react';

const features = [
  {
    icon: CalendarCheck,
    title: 'Appointments',
    description:
      'Manage walk-ins and scheduled visits with smart queue management, doctor assignment, and real-time status tracking.',
  },
  {
    icon: Receipt,
    title: 'Billing & Invoicing',
    description:
      'Complete billing workflows including insurance claims, credit settlements, receipt generation, and cash counter management.',
  },
  {
    icon: FlaskConical,
    title: 'Laboratory',
    description:
      'Track lab orders from sample collection to report delivery with technician assignment, outsource management, and auto-notifications.',
  },
  {
    icon: Pill,
    title: 'Pharmacy',
    description:
      'POS-style pharmacy billing with inventory tracking, batch management, and purchase order automation.',
  },
  {
    icon: Scissors,
    title: 'Operation Theatre',
    description:
      'Schedule surgeries, manage OT rooms, track equipment sterilization, and coordinate surgical teams efficiently.',
  },
  {
    icon: ScanLine,
    title: 'Radiology',
    description:
      'Handle radiology orders, manage equipment schedules, store DICOM images, and deliver reports digitally.',
  },
  {
    icon: BedDouble,
    title: 'Ward Management',
    description:
      'Monitor bed availability in real-time, manage admissions and discharges, and track ward-wise occupancy rates.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description:
      'Comprehensive dashboards with collection summaries, day-end reports, revenue analytics, and custom report builder.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">
            Features
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything You Need to Run Your Hospital
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From patient registration to final discharge, Hospital ERP covers every
            department and every workflow in your hospital.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 animate-fade-in-up animate-stagger-${Math.min(index + 1, 6)}`}
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
