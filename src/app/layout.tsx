import type { Metadata } from 'next';
import Script from 'next/script';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from '@/components/layout/providers';

const manrope = localFont({
  variable: '--font-sans',
  display: 'swap',
  src: [
    { path: './fonts/Manrope-300.woff2', weight: '300', style: 'normal' },
    { path: './fonts/Manrope-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Manrope-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/Manrope-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/Manrope-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/Manrope-800.woff2', weight: '800', style: 'normal' },
  ],
});

const manropeHeadline = localFont({
  variable: '--font-headline',
  display: 'swap',
  src: [
    { path: './fonts/Manrope-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Manrope-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/Manrope-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/Manrope-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/Manrope-800.woff2', weight: '800', style: 'normal' },
  ],
});

const inter = localFont({
  variable: '--font-label',
  display: 'swap',
  src: [
    { path: './fonts/Inter-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Inter-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/Inter-600.woff2', weight: '600', style: 'normal' },
  ],
});

export const metadata: Metadata = {
  title: 'Hospital ERP',
  description: 'Comprehensive Hospital Enterprise Resource Planning System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <body
        className={`${manrope.variable} ${manropeHeadline.variable} ${inter.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
