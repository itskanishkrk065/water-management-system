'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api';
import { KeyRound, Lock, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        token,
        new_password: newPassword,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Password reset failed. Invalid or expired token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 bg-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-600/30 text-white">
            <KeyRound className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight">
            Choose New Password
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your reset security token and set a new password
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold">Password Reset Successfully</div>
                <p className="mt-1 text-xs text-emerald-700">
                  Your password has been securely updated. You can now log into your beneficiary account.
                </p>
              </div>
            </div>
            <Link
              href="/beneficiary/login"
              className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow transition"
            >
              Sign In with New Password
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Reset Token
              </label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter reset token"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, uppercase & digit"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition disabled:opacity-50"
            >
              {loading ? 'Updating Password...' : 'Reset Password'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>

            <div className="text-center pt-2">
              <Link
                href="/beneficiary/login"
                className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
