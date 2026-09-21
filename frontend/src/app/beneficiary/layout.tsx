'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { AlertCircle, ArrowRight } from 'lucide-react';

export default function BeneficiaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAuthPage =
    pathname.startsWith('/beneficiary/login') ||
    pathname.startsWith('/beneficiary/signup') ||
    pathname.startsWith('/beneficiary/forgot-password') ||
    pathname.startsWith('/beneficiary/reset-password');

  useEffect(() => {
    if (!isLoading && !user && !isAuthPage) {
      router.push('/beneficiary/login');
    }
  }, [user, isLoading, isAuthPage, router]);

  const { data: profile } = useQuery({
    queryKey: ['beneficiary-me'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/me');
      return res.data;
    },
    enabled: !!user && !isAuthPage,
  });

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const completion = profile?.completion_percentage ?? 100;
  const isProfilePage = pathname === '/beneficiary/profile';

  return (
    <div className="space-y-6">
      {/* Profile Completion Sticky Alert if < 100% */}
      {completion < 100 && !isProfilePage && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-950 flex items-center space-x-2">
                <span>Profile Incomplete ({completion}% Completed)</span>
                <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-mono font-bold">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Complete your village jurisdiction, survey parcels, and address details to unlock water applications.
              </p>
            </div>
          </div>
          <Link
            href="/beneficiary/profile"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition shrink-0"
          >
            <span>Complete Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {children}
    </div>
  );
}
