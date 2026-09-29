import './globals.css';
import Providers from './providers';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';

export const metadata = {
  title: 'WaterGrid V1 | Water Management System',
  description: 'Water Resource Allocation, 5-Stage Installment Billing, and Infrastructure Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="bg-slate-50 h-full text-slate-900 flex flex-col overflow-hidden antialiased">
        <Providers>
          <Navbar />
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <Sidebar />
            <main className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6 w-full">
              <div className="max-w-7xl mx-auto space-y-6">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
