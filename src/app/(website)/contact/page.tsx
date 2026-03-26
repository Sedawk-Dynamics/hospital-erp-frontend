import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { DemoRequestForm } from '@/components/landing/demo-request-form';

const contactInfo = [
  { icon: Mail, label: 'Email', value: 'hello@hospitalerp.in', href: 'mailto:hello@hospitalerp.in' },
  { icon: Phone, label: 'Phone', value: '+91 98765 43210', href: 'tel:+919876543210' },
  { icon: MapPin, label: 'Office', value: 'Mumbai, Maharashtra, India', href: '#' },
  { icon: Clock, label: 'Hours', value: 'Mon - Sat, 9 AM - 7 PM IST', href: '#' },
];

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 sm:pt-40 sm:pb-20 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-label text-sm font-bold uppercase tracking-widest text-primary mb-4 animate-fade-in-up">Contact Us</p>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface sm:text-5xl animate-fade-in-up animate-stagger-1">
            Book a Free Demo
          </h1>
          <p className="mt-6 font-label text-lg text-on-surface-variant max-w-2xl mx-auto animate-fade-in-up animate-stagger-2">
            Fill in your details and our team will set up a personalized demo and free trial for your hospital within 24 hours.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Contact info */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">Get in Touch</h2>
                <p className="font-label text-sm text-on-surface-variant leading-relaxed">
                  Have questions before booking a demo? Reach out to us through any of these channels.
                </p>
              </div>

              <div className="space-y-4">
                {contactInfo.map((info) => (
                  <a
                    key={info.label}
                    href={info.href}
                    className="flex items-center gap-4 bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 hover:shadow-lg transition-all group"
                  >
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                      <info.icon className="h-5 w-5 text-primary group-hover:text-on-primary" />
                    </div>
                    <div>
                      <p className="font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{info.label}</p>
                      <p className="font-label text-sm font-medium text-on-surface">{info.value}</p>
                    </div>
                  </a>
                ))}
              </div>

              {/* Trust note */}
              <div className="bg-primary/5 rounded-xl p-6">
                <h3 className="font-headline text-sm font-bold text-primary mb-2">What happens after you submit?</h3>
                <ol className="space-y-2 font-label text-sm text-on-surface-variant">
                  <li className="flex gap-2"><span className="font-bold text-primary shrink-0">1.</span> Our team reviews your request within 24 hours</li>
                  <li className="flex gap-2"><span className="font-bold text-primary shrink-0">2.</span> We set up your hospital with a free trial plan</li>
                  <li className="flex gap-2"><span className="font-bold text-primary shrink-0">3.</span> You receive login credentials via email</li>
                  <li className="flex gap-2"><span className="font-bold text-primary shrink-0">4.</span> Start managing your hospital immediately</li>
                </ol>
              </div>
            </div>

            {/* Demo form */}
            <div className="lg:col-span-3">
              <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 animate-fade-in-up">
                <div className="mb-6">
                  <h2 className="font-headline text-xl font-bold text-on-surface">Request a Demo</h2>
                  <p className="font-label text-sm text-on-surface-variant mt-1">
                    Fill in your details to get started with a free trial
                  </p>
                </div>
                <DemoRequestForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
