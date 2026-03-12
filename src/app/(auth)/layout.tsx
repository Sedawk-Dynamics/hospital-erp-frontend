import { Activity } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-background to-teal-50 dark:from-background dark:via-background dark:to-background px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <Activity className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold text-foreground">
          {process.env.NEXT_PUBLIC_APP_NAME || 'Hospital ERP'}
        </span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
