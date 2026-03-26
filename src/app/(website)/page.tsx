import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
import { TestimonialsSection } from '@/components/landing/testimonials-section';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      {/* CTA Banner */}
      <section className="py-20 bg-primary relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-headline text-3xl font-extrabold text-on-primary sm:text-4xl">
            Ready to Transform Your Hospital?
          </h2>
          <p className="mt-4 font-label text-lg text-on-primary/80">
            Join 50+ hospitals already using Hospital ERP to streamline operations and improve patient care.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/contact" className="inline-flex items-center gap-2 bg-white text-primary font-label font-bold text-sm px-8 py-3.5 rounded-xl hover:shadow-lg transition-all">
              Book a Free Demo
            </a>
            <a href="/features" className="inline-flex items-center gap-2 border border-white/30 text-on-primary font-label font-bold text-sm px-8 py-3.5 rounded-xl hover:bg-white/10 transition-all">
              Explore Features
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
