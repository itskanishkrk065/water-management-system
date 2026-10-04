'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Droplet, Lock, User, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid username/email or password');
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
            Kongu Basin Water Management System
          </p>
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
            Username / Email Identifier
          </label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter username or email address"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Password
          </label>
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
