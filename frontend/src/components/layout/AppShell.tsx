'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/' ||
    pathname.startsWith('/beneficiary/login') ||
    pathname.startsWith('/beneficiary/signup') ||
    pathname.startsWith('/beneficiary/forgot-password') ||
    pathname.startsWith('/beneficiary/reset-password');

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 overflow-y-auto">
        {children}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      <Navbar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6 w-full custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
