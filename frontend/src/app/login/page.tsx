'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Droplet, Shield, Lock, Mail, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@water.gov');
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

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Admin@123456');
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 bg-sky-600 rounded-xl flex items-center justify-center shadow-md text-white">
            <Droplet className="h-6 w-6 fill-white text-white" />
          </div>
          <div>
            <div className="flex items-center justify-center space-x-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                WaterGrid <span className="text-sky-600 font-bold">V1</span>
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-sky-50 text-sky-700 border border-sky-200 rounded">
                Production-Grade
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Enterprise Water Resource & Infrastructure Management
            </p>
          </div>
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
                placeholder="name@water.gov"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-600/20 transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </form>

        <div className="pt-6 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-3">
            Quick-Select Demo Credentials
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <button
              onClick={() => handleQuickFill('admin@water.gov')}
              className="p-2 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 border border-slate-200 rounded-lg text-left transition"
            >
              <div className="font-semibold text-purple-700">ADMIN</div>
              <div className="text-[11px] text-slate-500 truncate">admin@water.gov</div>
            </button>
            <button
              onClick={() => handleQuickFill('field@water.gov')}
              className="p-2 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-lg text-left transition"
            >
              <div className="font-semibold text-emerald-700">FIELD OFFICER</div>
              <div className="text-[11px] text-slate-500 truncate">field@water.gov</div>
            </button>
            <button
              onClick={() => handleQuickFill('accounts@water.gov')}
              className="p-2 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-left transition"
            >
              <div className="font-semibold text-blue-700">ACCOUNTS</div>
              <div className="text-[11px] text-slate-500 truncate">accounts@water.gov</div>
            </button>
            <button
              onClick={() => handleQuickFill('viewer@water.gov')}
              className="p-2 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 border border-slate-200 rounded-lg text-left transition"
            >
              <div className="font-semibold text-slate-700">VIEWER</div>
              <div className="text-[11px] text-slate-500 truncate">viewer@water.gov</div>
            </button>
            <button
              onClick={() => handleQuickFill('beneficiary@water.gov')}
              className="p-2 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 border border-amber-200 rounded-lg text-left transition col-span-2 sm:col-span-2"
            >
              <div className="font-semibold text-amber-800">BENEFICIARY (SELF-SERVICE)</div>
              <div className="text-[11px] text-amber-700 truncate">beneficiary@water.gov</div>
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-400 mt-2">
            Default password: <code className="bg-slate-100 px-1 py-0.5 rounded">Admin@123456</code>
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <Link
              href="/beneficiary/login"
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 inline-flex items-center space-x-1"
            >
              <span>Switch to Dedicated Beneficiary Self-Service Portal &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
