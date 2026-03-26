import type { Metadata } from 'next';
import Script from 'next/script';
import { Manrope, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/providers';

const manrope = Manrope({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

const manropeHeadline = Manrope({
  variable: '--font-headline',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const inter = Inter({
  variable: '--font-label',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
    <html lang="en">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <body
        className={`${manrope.variable} ${manropeHeadline.variable} ${inter.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
