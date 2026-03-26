import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote:
      'Hospital ERP transformed our hospital operations. Billing that used to take hours is now done in minutes, and our staff actually enjoy using the system.',
    name: 'Dr. Rajesh Sharma',
    role: 'Medical Director',
    hospital: 'City Care Hospital, Mumbai',
    initials: 'RS',
  },
  {
    quote:
      'The laboratory module alone saved us two full-time employees worth of manual data entry. The ROI was clear within the first month.',
    name: 'Priya Nair',
    role: 'Hospital Administrator',
    hospital: 'Green Valley Medical Center, Kochi',
    initials: 'PN',
  },
  {
    quote:
      'We manage three hospitals on a single Hospital ERP account. The multi-clinic support and consolidated reporting make it incredibly easy to stay on top of everything.',
    name: 'Dr. Arun Mehta',
    role: 'CEO & Founder',
    hospital: 'Mehta Healthcare Group, Delhi',
    initials: 'AM',
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">
            Testimonials
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Trusted by Hospitals Across India
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            See what healthcare leaders are saying about Hospital ERP.
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((t, index) => (
            <div
              key={t.name}
              className={`relative rounded-xl border border-border bg-card p-6 sm:p-8 animate-fade-in-up animate-stagger-${index + 1}`}
            >
              {/* Quote icon */}
              <Quote className="mb-4 h-8 w-8 text-primary/20" />

              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.role}, {t.hospital}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
