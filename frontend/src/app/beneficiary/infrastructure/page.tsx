'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate, getStatusBadgeClass } from '@/lib/utils';
import {
  Building2,
  CheckCircle2,
  Clock,
  Hammer,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';
import Link from 'next/link';

export default function BeneficiaryInfrastructurePage() {
  const { data: infra, isLoading } = useQuery({
    queryKey: ['beneficiary-infrastructure'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/infrastructure');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const stages = [
    {
      id: 'PLANNED',
      name: 'Planned',
      desc: 'Route alignment survey, material allocation, and initial clearance',
      date: infra?.planned_date,
      icon: Clock,
    },
    {
      id: 'UNDER_CONSTRUCTION',
      name: 'Under Construction',
      desc: 'Trenching, HDPE pipe fusion, sluice valve placement, and sump construction',
      date: infra?.construction_start_date,
      icon: Hammer,
    },
    {
      id: 'COMPLETED',
      name: 'Physical Works Completed',
      desc: 'Hydrostatic pressure testing, pump machinery checks, and safety certification',
      date: infra?.completion_date,
      icon: CheckCircle2,
    },
    {
      id: 'COMMISSIONED',
      name: 'Officially Commissioned',
      desc: 'Water release activated; regular maintenance and monthly running charges begin',
      date: infra?.commissioned_date,
      icon: Sparkles,
    },
  ];

  const currentStatus = infra?.status || 'PLANNED';
  const currentStageIndex = stages.findIndex((s) => s.id === currentStatus);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Pipeline Infrastructure Grid
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time tracking of dedicated field pipeline construction, pressure tests, and commissioning milestones
        </p>
      </div>

      {/* 4-Stage Lifecycle Stepper */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Engineering Lifecycle Progression</h2>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full font-semibold border ${getStatusBadgeClass(
              currentStatus
            )}`}
          >
            CURRENT: {currentStatus}
          </span>
        </div>

        {/* Stepper Progression */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {stages.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex || currentStatus === 'COMMISSIONED';
            const isCurrent = idx === currentStageIndex && currentStatus !== 'COMMISSIONED';
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className={`p-4 rounded-xl border relative transition flex flex-col justify-between ${
                  isCompleted
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                    : isCurrent
                    ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                      Stage {idx + 1}
                    </span>
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="text-sm font-bold">{stage.name}</div>
                  <p className="text-xs mt-1 leading-relaxed opacity-80">{stage.desc}</p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-current/10 flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-wider opacity-75">Milestone</span>
                  <span className="font-mono font-bold">
                    {stage.date ? formatDate(stage.date) : isCompleted ? 'Verified' : isCurrent ? 'In Progress' : 'Pending'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dedicated Pipeline Details */}
      {infra ? (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Grid Specifications &amp; Milestone Records
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-semibold uppercase">1. Planned Date</span>
              <div className="text-sm font-bold font-mono text-slate-900 mt-1">
                {formatDate(infra.planned_date)}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-semibold uppercase">2. Construction Start</span>
              <div className="text-sm font-bold font-mono text-slate-900 mt-1">
                {formatDate(infra.construction_start_date)}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-semibold uppercase">3. Completion Date</span>
              <div className="text-sm font-bold font-mono text-slate-900 mt-1">
                {formatDate(infra.completion_date)}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-semibold uppercase">4. Commissioned Date</span>
              <div className="text-sm font-bold font-mono text-emerald-700 mt-1">
                {formatDate(infra.commissioned_date)}
              </div>
            </div>
          </div>

          {infra.remarks && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs mt-2">
              <span className="text-slate-500 font-semibold uppercase tracking-wider">Engineering Inspection Notes</span>
              <p className="text-slate-800 mt-1 font-medium italic">"{infra.remarks}"</p>
            </div>
          )}

          {infra.status === 'COMMISSIONED' ? (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start space-x-3 mt-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Infrastructure Officially Commissioned</div>
                <p className="mt-0.5">
                  Water is currently flowing through your delivery terminal. Monthly recurring running charges are now active.
                </p>
                <Link
                  href="/beneficiary/running-charges"
                  className="mt-2 inline-flex items-center space-x-1 font-semibold text-emerald-800 hover:text-emerald-900 underline"
                >
                  <span>View Monthly Running Charges</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start space-x-3 mt-4">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Commissioning Gate Active</div>
                <p className="mt-0.5">
                  In compliance with safety and billing bylaws, monthly running maintenance charges remain deactivated until physical pipeline completion and formal commissioning by the executive engineer.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
          No dedicated infrastructure record linked to your account yet. Infrastructure pipeline works are scheduled upon approval of your water application.
        </div>
      )}
    </div>
  );
}
