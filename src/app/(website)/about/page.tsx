import { Heart, Target, Eye, Users, Shield, Zap } from 'lucide-react';

const values = [
  { icon: Heart, title: 'Patient First', description: 'Every feature we build is designed to improve patient outcomes and experience.' },
  { icon: Shield, title: 'Data Security', description: 'Enterprise-grade security with encryption, audit logs, and compliance standards.' },
  { icon: Zap, title: 'Simplicity', description: 'Complex hospital workflows made simple. No training manuals needed.' },
  { icon: Users, title: 'Collaboration', description: 'Built to help doctors, nurses, admins, and pharmacists work together seamlessly.' },
];

const stats = [
  { value: '50+', label: 'Hospitals' },
  { value: '10,000+', label: 'Patients Managed' },
  { value: '32', label: 'Modules' },
  { value: '18', label: 'User Roles' },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 sm:pt-40 sm:pb-20 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-label text-sm font-bold uppercase tracking-widest text-primary mb-4 animate-fade-in-up">About Us</p>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface sm:text-5xl animate-fade-in-up animate-stagger-1">
            Reimagining Hospital Management
          </h1>
          <p className="mt-6 font-label text-lg text-on-surface-variant max-w-2xl mx-auto animate-fade-in-up animate-stagger-2">
            We believe every hospital — from a single-doctor clinic to a multi-location chain — deserves software that just works.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 animate-fade-in-up">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-headline text-2xl font-bold text-on-surface mb-4">Our Mission</h2>
              <p className="font-label text-sm text-on-surface-variant leading-relaxed">
                To simplify hospital operations across India by providing an affordable, all-in-one management platform that empowers healthcare providers to focus on what matters most — patient care.
              </p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 animate-fade-in-up animate-stagger-1">
              <div className="h-12 w-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-6">
                <Eye className="h-6 w-6 text-secondary" />
              </div>
              <h2 className="font-headline text-2xl font-bold text-on-surface mb-4">Our Vision</h2>
              <p className="font-label text-sm text-on-surface-variant leading-relaxed">
                A future where every hospital in India runs on intelligent, connected software — reducing paperwork, eliminating errors, and delivering better outcomes for every patient who walks through the door.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-primary relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-headline text-4xl font-extrabold text-on-primary">{stat.value}</p>
                <p className="font-label text-sm text-on-primary/70 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="font-label text-sm font-bold uppercase tracking-widest text-primary mb-3">Our Values</p>
            <h2 className="font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">What Drives Us</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <div key={v.title} className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 text-center animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-headline text-base font-bold text-on-surface mb-2">{v.title}</h3>
                <p className="font-label text-sm text-on-surface-variant leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
