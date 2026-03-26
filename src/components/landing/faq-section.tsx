'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'What is Hospital ERP ERP?',
    answer:
      'Hospital ERP is a comprehensive hospital management platform that covers every department in your hospital — from outpatient appointments and billing to laboratory, pharmacy, operation theatre, radiology, ward management, and advanced analytics. It is a cloud-based SaaS solution accessible from any device.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Book a free demo using the form above. Our team will review your request and set up a personalized trial for your hospital within 24 hours. We also provide guided onboarding and data migration assistance.',
  },
  {
    question: 'Can I manage multiple hospitals or clinics?',
    answer:
      'Yes. Hospital ERP supports multi-clinic management out of the box. You can switch between hospitals from a single dashboard, and consolidated reports give you a unified view across all your locations.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. We use industry-standard encryption (AES-256 at rest, TLS 1.3 in transit), role-based access control with 18 customizable roles, two-factor authentication, and regular security audits. Your data is hosted on SOC 2 certified infrastructure.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit and debit cards, UPI, net banking, and bank transfers. For Enterprise plans, we also support invoiced billing with custom payment terms.',
  },
  {
    question: 'Do you offer a free trial?',
    answer:
      'Yes! Book a free demo and our team will set up a personalized trial for your hospital. Trial duration and plan features are customized based on your needs.',
  },
  {
    question: 'Can I customize reports and dashboards?',
    answer:
      'Yes. Hospital ERP provides pre-built reports for common use cases (collection summaries, day-end reports, revenue analytics) and a custom report builder that lets you create tailored reports for your specific needs.',
  },
  {
    question: 'Do you provide customer support?',
    answer:
      'All plans include email support. Professional plans get priority support with faster response times, and Enterprise plans include a dedicated account manager and 24/7 phone support.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">
            FAQ
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Got questions? We&apos;ve got answers. If you can&apos;t find what
            you&apos;re looking for, reach out to our support team.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm"
              >
                <button
                  onClick={() => toggle(index)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium text-foreground pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-200 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
