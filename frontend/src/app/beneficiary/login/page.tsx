'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Droplet, Lock, Mail, ArrowRight, UserCheck } from 'lucide-react';
import Link from 'next/link';

export default function BeneficiaryLoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('beneficiary@water.gov');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail('beneficiary@water.gov');
    setPassword('Admin@123456');
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 bg-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-600/30 text-white">
            <Droplet className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight">
            Beneficiary Self-Service Portal
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to track your water allocation, land parcels, bills, and installments
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/beneficiary/forgot-password"
                className="text-xs text-amber-600 hover:text-amber-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </form>

        <div className="pt-6 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-3">
            Demo Beneficiary Account
          </p>
          <button
            onClick={handleQuickFill}
            className="w-full p-2.5 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 border border-amber-200 rounded-lg text-left transition flex items-center justify-between"
          >
            <div>
              <div className="font-semibold text-amber-800 text-sm flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4 text-amber-700" />
                <span>Ramasamy Gounder</span>
              </div>
              <div className="text-xs text-amber-700">beneficiary@water.gov (Password: Admin@123456)</div>
            </div>
            <span className="text-xs font-semibold text-amber-800 bg-amber-200/70 px-2 py-1 rounded">Quick Load</span>
          </button>
        </div>

        <div className="text-center pt-2 space-y-2">
          <div className="text-sm text-slate-600">
            Don&apos;t have an account?{' '}
            <Link href="/beneficiary/signup" className="text-amber-600 hover:text-amber-700 font-semibold underline">
              Sign Up as New Beneficiary
            </Link>
          </div>
          <div>
            <Link href="/login" className="text-xs text-slate-400 hover:text-slate-600">
              Go to Department Staff & Administration Login &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
