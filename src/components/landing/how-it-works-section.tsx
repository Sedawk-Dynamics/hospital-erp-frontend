import { CalendarCheck, UserCheck, Rocket } from 'lucide-react';

const steps = [
  {
    icon: CalendarCheck,
    number: '01',
    title: 'Book a Demo',
    description:
      'Fill out the demo request form with your hospital details. No credit card required.',
  },
  {
    icon: UserCheck,
    number: '02',
    title: 'Get Your Trial',
    description:
      'Our team reviews your request and sets up a personalized free trial with your hospital pre-configured.',
  },
  {
    icon: Rocket,
    number: '03',
    title: 'Start Managing',
    description:
      'Log in with your credentials, configure departments, invite staff, and go live in under an hour.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-surface-container-low">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">
            How It Works
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Up and Running in 3 Simple Steps
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Getting started with Hospital ERP is quick and straightforward.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          {/* Connector line (desktop only) */}
          <div className="pointer-events-none absolute top-16 left-[16.67%] right-[16.67%] hidden md:block">
            <div className="h-0.5 w-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
          </div>

          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`relative text-center animate-fade-in-up animate-stagger-${index + 1}`}
            >
              {/* Number + Icon */}
              <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-primary/10 rotate-6 transition-transform group-hover:rotate-12" />
                <div className="relative flex h-full w-full items-center justify-center rounded-2xl bg-white border border-border shadow-sm">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                  {index + 1}
                </span>
              </div>

              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
