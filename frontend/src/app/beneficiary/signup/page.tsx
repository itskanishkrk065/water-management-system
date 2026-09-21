'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { UserPlus, Lock, Mail, Phone, User, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function BeneficiarySignupPage() {
  const { registerBeneficiary } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter and one number');
      return;
    }

    if (!/^\d{10}$/.test(formData.phone)) {
      setError('Phone number must be exactly 10 digits');
      return;
    }

    setLoading(true);
    try {
      await registerBeneficiary({
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email,
        password: formData.password,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 bg-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-600/30 text-white">
            <UserPlus className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight">
            Register as Beneficiary
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Create your account to apply for agricultural water allocation and manage land holdings
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Legal Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="e.g. Ramasamy Gounder"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mobile Phone (10 Digits)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                required
                maxLength={10}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="9876543210"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@domain.com"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
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
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 8 characters (A-Z, 0-9)"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Re-enter password"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
            <div className="font-semibold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
              <span>Two-Stage Onboarding</span>
            </div>
            <p>After creating your account, you will immediately proceed to step 2: configuring your revenue village and land parcels.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Continue to Profile Setup'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </form>

        <div className="text-center pt-2 space-y-2 border-t border-slate-200">
          <div className="text-sm text-slate-600">
            Already registered?{' '}
            <Link href="/beneficiary/login" className="text-amber-600 hover:text-amber-700 font-semibold underline">
              Sign In here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
