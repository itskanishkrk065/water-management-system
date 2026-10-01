import './globals.css';
import Providers from './providers';
import AppShell from '@/components/layout/AppShell';

export const metadata = {
  title: 'WaterGrid Enterprise | Water Management System',
  description: 'Water Resource Allocation, 5-Stage Installment Billing, and Infrastructure Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full text-slate-900 antialiased overflow-hidden">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
