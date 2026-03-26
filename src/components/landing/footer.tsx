import Link from 'next/link';
import { Activity } from 'lucide-react';

const footerLinks = {
  Product: [
    { label: 'Features', href: '/features' },
    { label: 'Book a Demo', href: '/contact' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Careers', href: '#' },
  ],
  Support: [
    { label: 'Help Center', href: '#' },
    { label: 'Status', href: '#' },
    { label: 'Security', href: '#' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Cookie Policy', href: '#' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-on-surface text-surface-container-high">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary-fixed" />
              </div>
              <span className="font-headline text-lg font-bold text-white">Hospital ERP</span>
            </Link>
            <p className="font-label text-sm leading-relaxed text-outline">
              Complete hospital management solution for modern healthcare providers.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 font-label text-xs font-bold text-outline-variant uppercase tracking-widest">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="font-label text-sm text-outline hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="font-label text-xs text-outline">
              &copy; {new Date().getFullYear()} Hospital ERP. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {['X', 'LinkedIn', 'GitHub'].map((name) => (
                <a key={name} href="#" className="font-label text-xs text-outline hover:text-white transition-colors" aria-label={name}>
                  {name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
