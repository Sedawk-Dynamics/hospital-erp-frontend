import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
