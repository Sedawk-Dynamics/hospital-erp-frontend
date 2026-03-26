import { HeartPulse } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 overflow-hidden">
      {/* Brand */}
      <div className="relative flex items-center gap-3 mb-10 animate-fade-in-up">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <HeartPulse className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-headline font-bold text-primary tracking-tight">
            {process.env.NEXT_PUBLIC_APP_NAME || 'Hospital ERP'}
          </h1>
          <p className="text-[11px] font-label text-on-surface-variant font-medium tracking-wider uppercase">
            Healthcare Platform
          </p>
        </div>
      </div>
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
