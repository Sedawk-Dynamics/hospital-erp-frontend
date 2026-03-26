import Link from 'next/link';
import { Activity, ArrowRight, Play } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-secondary/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-label text-sm font-bold text-primary">Next-Gen Hospital Management</span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up animate-stagger-1 font-headline text-4xl font-extrabold tracking-tight text-on-surface sm:text-5xl lg:text-6xl">
            Complete Hospital{' '}
            <span className="text-primary">Management Solution</span>
          </h1>

          {/* Subtext */}
          <p className="animate-fade-in-up animate-stagger-2 mt-6 font-label text-lg leading-relaxed text-on-surface-variant sm:text-xl">
            Streamline your hospital operations with Hospital ERP. From appointments
            and billing to laboratory, pharmacy, and ward management — everything
            in one powerful, easy-to-use platform.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in-up animate-stagger-3 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/contact">
              <button className="h-12 px-8 bg-primary text-on-primary font-label font-bold text-base rounded-xl hover:shadow-lg transition-all flex items-center gap-2">
                Book a Free Demo
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/features">
              <button className="h-12 px-8 border border-outline-variant/30 text-on-surface font-label font-bold text-base rounded-xl hover:bg-surface-container-low transition-all flex items-center gap-2">
                <Play className="h-4 w-4" />
                Explore Features
              </button>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="animate-fade-in-up animate-stagger-4 mt-12 grid grid-cols-3 gap-8 max-w-md mx-auto">
            {[
              { value: '50+', label: 'Hospitals' },
              { value: '10K+', label: 'Patients' },
              { value: '99.9%', label: 'Uptime' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-headline text-2xl font-extrabold text-primary">{stat.value}</p>
                <p className="font-label text-xs text-on-surface-variant">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="animate-fade-in-up animate-stagger-5 relative mx-auto mt-16 max-w-4xl">
          <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-2">
            {/* Mock browser chrome */}
            <div className="flex items-center gap-2 rounded-t-lg bg-surface-container-low px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-error/50" />
                <span className="h-3 w-3 rounded-full bg-secondary/50" />
                <span className="h-3 w-3 rounded-full bg-primary/50" />
              </div>
              <div className="mx-auto flex items-center gap-2 rounded-md bg-surface-container-lowest px-4 py-1 font-label text-xs text-on-surface-variant">
                app.hospitalerp.in
              </div>
            </div>
            {/* Mock dashboard */}
            <div className="rounded-b-lg bg-gradient-to-br from-surface-container-low to-surface-container-lowest p-6 sm:p-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Appointments', value: '284', color: 'border-l-primary' },
                  { label: 'Revenue', value: '\u20B92.4L', color: 'border-l-secondary' },
                  { label: 'Patients', value: '1,205', color: 'border-l-primary-container' },
                  { label: 'Staff Active', value: '48', color: 'border-l-tertiary' },
                ].map((stat) => (
                  <div key={stat.label} className={`rounded-lg border-l-4 ${stat.color} bg-surface-container-lowest p-3 sm:p-4 shadow-sanctuary`}>
                    <p className="font-headline text-lg sm:text-2xl font-extrabold text-on-surface">{stat.value}</p>
                    <p className="font-label text-xs text-on-surface-variant">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[75, 60, 90, 45].map((width, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary/40" />
                    <div className="h-2.5 rounded-full bg-surface-container" style={{ width: `${width}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
