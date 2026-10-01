'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Droplet, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, CreditCard, Eye } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@water.gov');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const roles = [
    { label: 'Admin', email: 'admin@water.gov', icon: ShieldCheck, color: 'text-sky-600 border-sky-200 bg-sky-50' },
    { label: 'Field Officer', email: 'field@water.gov', icon: UserCheck, color: 'text-emerald-600 border-emerald-200 bg-emerald-50' },
    { label: 'Accounts', email: 'accounts@water.gov', icon: CreditCard, color: 'text-amber-600 border-amber-200 bg-amber-50' },
    { label: 'Auditor', email: 'viewer@water.gov', icon: Eye, color: 'text-indigo-600 border-indigo-200 bg-indigo-50' },
  ];

  const handleRoleSelect = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('Admin@123456');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password. Default password is Admin@123456');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-slate-200 my-auto">
      <div className="text-center space-y-2">
        <div className="mx-auto h-12 w-12 bg-sky-600 rounded-xl flex items-center justify-center shadow-md text-white">
          <Droplet className="h-6 w-6 fill-white text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            WaterGrid Enterprise
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Kongu Basin Offline Desktop Administration
          </p>
        </div>
      </div>

      {/* Quick Role Fill Buttons */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Select Role Profile
        </label>
        <div className="grid grid-cols-2 gap-2">
          {roles.map((r) => {
            const Icon = r.icon;
            const isSelected = email === r.email;
            return (
              <button
                key={r.email}
                type="button"
                onClick={() => handleRoleSelect(r.email)}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs font-medium transition ${
                  isSelected
                    ? 'border-sky-600 bg-sky-50 text-sky-900 font-semibold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-sky-600' : 'text-slate-400'}`} />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-lg text-xs font-medium">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@water.gov"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Password
            </label>
            <span className="text-[11px] text-slate-400 font-mono">Default: Admin@123456</span>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 flex items-center justify-center py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Authenticating...' : 'Sign In to WaterGrid'}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </button>
      </form>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-600">
        <Link
          href="/beneficiary/login"
          className="hover:text-sky-600 inline-flex items-center gap-1 transition"
        >
          <span>Beneficiary Portal</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
        <Link
          href="/developer"
          className="text-slate-400 hover:text-slate-700 font-mono text-[11px]"
        >
          Developer Console →
        </Link>
      </div>
    </div>
  );
}
