'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Users,
  Search,
  Filter,
  Plus,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Shield,
  ShieldAlert,
  Lock,
  Unlock,
  UserX,
  UserCheck,
  Key,
  Smartphone,
  MapPin,
  Clock,
  Eye,
  Edit2,
  RotateCcw,
  Activity,
  Layers,
  Database,
  Radio,
  Check,
} from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

export default function UserManagementManager() {
  const queryClient = useQueryClient();

  // Search & Filter State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPresence, setSelectedPresence] = useState<string>('');

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'profile' | 'security' | 'scope' | 'devices' | 'audit'>('profile');

  // Create Form State
  const [createForm, setCreateForm] = useState({
    fullName: '',
    username: '',
    employeeId: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    roleId: '',
    districtId: '',
    panchayats: '',
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    fullName: '',
    username: '',
    employeeId: '',
    phone: '',
    email: '',
    roleId: '',
    status: '',
    districtId: '',
    panchayats: '',
  });

  // Action Reason State
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 1. Fetch Roles list
  const { data: rolesData } = useQuery({
    queryKey: ['system-roles-list'],
    queryFn: async () => {
      const res = await apiClient.get('/roles');
      return res.data || [];
    },
  });

  // 2. Fetch Locations list for scope assignment
  const { data: districtsData } = useQuery({
    queryKey: ['districts-list'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts');
      return res.data || [];
    },
  });

  // 3. Fetch Users list
  const { data: usersData, isLoading: isUsersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users-list', page, search, selectedRole, selectedStatus, selectedPresence],
    queryFn: async () => {
      const res = await apiClient.get('/users', {
        params: {
          page,
          limit: 15,
          search: search.trim() || undefined,
          roleId: selectedRole || undefined,
          status: selectedStatus || undefined,
          presence: selectedPresence || undefined,
        },
      });
      return res.data;
    },
  });

  // 4. Fetch User detail when drawer is opened
  const { data: userDetail, isLoading: isDetailLoading, refetch: refetchDetail } = useQuery({
    queryKey: ['admin-user-detail', selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser?.user_id) return null;
      const res = await apiClient.get(`/users/${selectedUser.user_id}`);
      return res.data;
    },
    enabled: Boolean(selectedUser?.user_id) && showDetailDrawer,
  });

  // 5. Fetch User Audit Activity
  const { data: userActivity } = useQuery({
    queryKey: ['admin-user-activity', selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser?.user_id) return [];
      const res = await apiClient.get(`/users/${selectedUser.user_id}/activity`);
      return res.data || [];
    },
    enabled: Boolean(selectedUser?.user_id) && showDetailDrawer && detailTab === 'audit',
  });

  const [createdUserCreds, setCreatedUserCreds] = useState<{ username: string; tempPass: string } | null>(null);

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/users', payload);
      return res.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      setShowCreateModal(false);
      resetCreateForm();
      if (data?.temporaryPassword) {
        setCreatedUserCreds({
          username: data.username || data.email,
          tempPass: data.temporaryPassword,
        });
      }
      setActionSuccess('User account provisioned successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      const msg = Array.isArray(err.response?.data?.message)
        ? err.response.data.message.join(', ')
        : err.response?.data?.message || err.message || 'Failed to create user';
      setActionError(msg);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiClient.patch(`/users/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
      setShowEditModal(false);
      setActionSuccess('User account updated successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Failed to update user');
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: string; reason?: string }) => {
      const res = await apiClient.post(`/users/${id}/${action}`, { reason });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
      setActionSuccess(`Account status updated (${variables.action}).`);
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Failed to change user status');
    },
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/users/${id}/revoke-sessions`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
      setActionSuccess('All user sessions revoked successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Failed to revoke sessions');
    },
  });

  const revokeDevicesMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post(`/users/${id}/revoke-devices`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
      setActionSuccess('All user field devices revoked successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Failed to revoke devices');
    },
  });

  const resetCreateForm = () => {
    setCreateForm({
      fullName: '',
      username: '',
      employeeId: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      roleId: '',
      districtId: '',
      panchayats: '',
    });
    setActionError(null);
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setEditForm({
      fullName: user.full_name || '',
      username: user.username || '',
      employeeId: user.employee_id || '',
      phone: user.phone || '',
      email: user.email || '',
      roleId: user.role_id || user.role?.role_id || '',
      status: user.status || 'ACTIVE',
      districtId: user.geographicScope?.district_id || '',
      panchayats: user.geographicScope?.panchayats ? user.geographicScope.panchayats.join(', ') : '',
    });
    setActionError(null);
    setShowEditModal(true);
  };

  const openDetailDrawer = (user: any) => {
    setSelectedUser(user);
    setDetailTab('profile');
    setShowDetailDrawer(true);
  };

  // Helper presence badge decorator
  const renderPresenceBadge = (presence?: string, lastSeen?: string) => {
    const isOnline = presence === 'ONLINE';
    const isSyncing = presence === 'SYNCING';
    const isDegraded = presence === 'DEGRADED';

    if (isSyncing) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 border border-amber-200">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> SYNCING
        </span>
      );
    }
    if (isDegraded) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 border border-rose-200">
          <AlertCircle className="w-3 h-3 mr-1" /> DEGRADED
        </span>
      );
    }
    if (isOnline) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span> ONLINE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-100 text-slate-500 border border-slate-200">
        <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span> OFFLINE
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">User Management & Device Control</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage accounts, assign roles & geographic scope, enforce Argon2id security, and control sessions & field devices.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button
            onClick={() => refetchUsers()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-md shadow-sky-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create User Account</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">{actionError}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, email, employee ID, username..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            <option value="">All Roles</option>
            {rolesData?.map((r: any) => (
              <option key={r.role_id} value={r.role_id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            <option value="">All Account Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="LOCKED">LOCKED</option>
            <option value="DISABLED">DISABLED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>

          {/* Presence Filter */}
          <select
            value={selectedPresence}
            onChange={(e) => {
              setSelectedPresence(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            <option value="">All Presence</option>
            <option value="ONLINE">ONLINE</option>
            <option value="OFFLINE">OFFLINE</option>
            <option value="SYNCING">SYNCING</option>
          </select>
        </div>
      </div>

      {/* Users DataTable */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-4">User Identity</th>
                <th className="p-4">Role & Scope</th>
                <th className="p-4">Status</th>
                <th className="p-4">Presence & Devices</th>
                <th className="p-4">Last Activity</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isUsersLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
                    Loading system user accounts...
                  </td>
                </tr>
              ) : usersData?.items?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No matching user accounts found.
                  </td>
                </tr>
              ) : (
                usersData?.items?.map((user: any) => {
                  const roleName = user.role?.name || 'USER';
                  const activeDevice = user.devices?.[0];
                  return (
                    <tr key={user.user_id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{user.full_name}</div>
                        <div className="text-slate-500 text-[11px] font-mono">
                          @{user.username || 'no-login-id'} &bull; {user.email}
                        </div>
                        {user.employee_id && (
                          <div className="text-slate-400 text-[10px] font-mono mt-0.5">Emp ID: {user.employee_id}</div>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="inline-block px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-bold text-[10px] uppercase font-mono mb-1">
                          {roleName}
                        </span>
                        <div className="text-slate-500 text-[11px] flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{user.geographicScope?.district_name || 'All Districts (Global)'}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <StatusBadge status={user.status} />
                      </td>

                      <td className="p-4 space-y-1">
                        <div>{renderPresenceBadge(user.presenceState || (activeDevice ? 'ONLINE' : 'OFFLINE'))}</div>
                        {activeDevice ? (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                            <Smartphone className="w-3 h-3 text-slate-400" />
                            <span>{activeDevice.device_name || activeDevice.platform || 'Device'}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 font-mono">No active field device</div>
                        )}
                      </td>

                      <td className="p-4 text-[11px] font-mono text-slate-500">
                        {user.last_login_at ? formatDate(user.last_login_at) : 'Never logged in'}
                      </td>

                      <td className="p-4 text-right space-x-1">
                        <button
                          onClick={() => openDetailDrawer(user)}
                          className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                          title="View Profile & Audit"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Edit User Account"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {user.status === 'ACTIVE' ? (
                          <button
                            onClick={() => {
                              if (confirm(`Disable account for ${user.full_name}? User will not be able to log in.`)) {
                                changeStatusMutation.mutate({ id: user.user_id, action: 'disable', reason: 'Admin soft deactivation' });
                              }
                            }}
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Deactivate Account"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              changeStatusMutation.mutate({ id: user.user_id, action: 'reactivate' });
                            }}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Reactivate Account"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {usersData && usersData.totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono">
              Page {usersData.page} of {usersData.totalPages} ({usersData.total} users total)
            </span>
            <div className="flex space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= usersData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm">Provision New System User Account</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (createForm.password && createForm.password !== createForm.confirmPassword) {
                  setActionError('Passwords do not match.');
                  return;
                }
                setActionError(null);
                createUserMutation.mutate({
                  fullName: createForm.fullName,
                  username: createForm.username || undefined,
                  employeeId: createForm.employeeId || undefined,
                  phone: createForm.phone || undefined,
                  email: createForm.email,
                  password: createForm.password || undefined,
                  roleId: createForm.roleId,
                  districtId: createForm.districtId || undefined,
                  panchayats: createForm.panchayats ? createForm.panchayats.split(',').map((s) => s.trim()) : undefined,
                });
              }}
              className="p-6 space-y-4 text-xs"
            >
              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ravi Kumar"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username / Login ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ravi.collection"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. ravi@watergrid.gov.in"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-2026-904"
                    value={createForm.employeeId}
                    onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Role *</label>
                  <select
                    required
                    value={createForm.roleId}
                    onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold text-slate-800"
                  >
                    <option value="">-- Select System Role --</option>
                    {rolesData?.map((r: any) => (
                      <option key={r.role_id} value={r.role_id}>
                        {r.name} ({r.description || 'System Role'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Password (Argon2id Hashed)</label>
                  <input
                    type="password"
                    placeholder="Leave blank to auto-generate"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Re-enter password"
                    value={createForm.confirmPassword}
                    onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Geographic Scope Assignment */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="block font-bold text-slate-700">Geographic Jurisdiction Scope</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Authorized District</label>
                    <select
                      value={createForm.districtId}
                      onChange={(e) => setCreateForm({ ...createForm, districtId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      <option value="">All Districts (Unrestricted Admin)</option>
                      {districtsData?.map((d: any) => (
                        <option key={d.district_id} value={d.district_id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Panchayats / Blocks (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Block X, Panchayat Y"
                      value={createForm.panchayats}
                      onChange={(e) => setCreateForm({ ...createForm, panchayats: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-md disabled:opacity-40"
                >
                  {createUserMutation.isPending ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATED USER TEMPORARY PASSWORD MODAL */}
      {createdUserCreds && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center space-x-3 text-emerald-600">
              <CheckCircle2 className="w-7 h-7 shrink-0" />
              <h3 className="font-bold text-base text-slate-900">User Account Provisioned</h3>
            </div>
            <p className="text-xs text-slate-600">
              A temporary password was generated for user <strong className="font-mono text-slate-900">{createdUserCreds.username}</strong>. Please record this password now:
            </p>
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex justify-between items-center font-mono text-sm font-bold text-slate-800">
              <span>{createdUserCreds.tempPass}</span>
              <button
                onClick={() => navigator.clipboard.writeText(createdUserCreds.tempPass)}
                className="text-xs font-sans text-sky-600 hover:text-sky-700 font-semibold px-2 py-1 bg-white rounded border border-slate-200 shadow-xs cursor-pointer"
              >
                Copy
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCreatedUserCreds(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Edit Account: {selectedUser.full_name}</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setActionError(null);
                updateUserMutation.mutate({
                  id: selectedUser.user_id,
                  payload: {
                    fullName: editForm.fullName,
                    username: editForm.username || undefined,
                    employeeId: editForm.employeeId || undefined,
                    phone: editForm.phone || undefined,
                    email: editForm.email,
                    roleId: editForm.roleId,
                    status: editForm.status,
                    districtId: editForm.districtId || null,
                    panchayats: editForm.panchayats ? editForm.panchayats.split(',').map((s) => s.trim()) : [],
                  },
                });
              }}
              className="p-6 space-y-4 text-xs"
            >
              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username (Audited)</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="LOCKED">LOCKED</option>
                    <option value="DISABLED">DISABLED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={editForm.roleId}
                    onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-bold"
                  >
                    {rolesData?.map((r: any) => (
                      <option key={r.role_id} value={r.role_id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-md disabled:opacity-40"
                >
                  {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER DETAIL & AUDIT DRAWER */}
      {showDetailDrawer && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
            {/* Drawer Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-base">{selectedUser.full_name}</h3>
                  <StatusBadge status={selectedUser.status} />
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  ID: {selectedUser.user_id} &bull; @{selectedUser.username}
                </div>
              </div>
              <button onClick={() => setShowDetailDrawer(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-5 text-xs font-bold text-slate-600">
              <button
                onClick={() => setDetailTab('profile')}
                className={`py-3 px-3 border-b-2 transition ${
                  detailTab === 'profile' ? 'border-sky-600 text-sky-700 bg-white' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Profile & Scope
              </button>
              <button
                onClick={() => setDetailTab('security')}
                className={`py-3 px-3 border-b-2 transition ${
                  detailTab === 'security' ? 'border-sky-600 text-sky-700 bg-white' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Security & Sessions
              </button>
              <button
                onClick={() => setDetailTab('devices')}
                className={`py-3 px-3 border-b-2 transition ${
                  detailTab === 'devices' ? 'border-sky-600 text-sky-700 bg-white' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Field Devices ({userDetail?.devices?.length || 0})
              </button>
              <button
                onClick={() => setDetailTab('audit')}
                className={`py-3 px-3 border-b-2 transition ${
                  detailTab === 'audit' ? 'border-sky-600 text-sky-700 bg-white' : 'border-transparent hover:text-slate-900'
                }`}
              >
                Audit History
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {isDetailLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
                  Loading detailed profile...
                </div>
              ) : (
                <>
                  {detailTab === 'profile' && (
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200">
                        <div className="font-bold text-slate-900 text-sm mb-2">Account Overview</div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Email:</span>
                          <span className="font-mono text-slate-800 font-bold">{userDetail?.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Phone:</span>
                          <span className="font-mono text-slate-800">{userDetail?.phone || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Employee ID:</span>
                          <span className="font-mono text-slate-800">{userDetail?.employee_id || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Assigned Role:</span>
                          <span className="font-bold text-sky-700">{userDetail?.role?.name}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200">
                        <div className="font-bold text-slate-900 text-sm mb-2">Geographic Jurisdiction</div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">District Scope:</span>
                          <span className="font-bold text-slate-800">
                            {userDetail?.geographicScope?.district_name || 'All Districts (Global)'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Panchayats / Blocks:</span>
                          <span className="font-mono text-slate-800">
                            {userDetail?.geographicScope?.panchayats?.length > 0
                              ? userDetail.geographicScope.panchayats.join(', ')
                              : 'All Panchayats'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailTab === 'security' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="font-bold text-slate-900 text-sm">Security Controls</div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            onClick={() => {
                              revokeSessionsMutation.mutate(selectedUser.user_id);
                            }}
                            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 rounded-xl transition flex items-center space-x-1"
                          >
                            <ShieldAlert className="w-4 h-4" />
                            <span>Revoke Active Sessions</span>
                          </button>

                          <button
                            onClick={() => {
                              revokeDevicesMutation.mutate({ id: selectedUser.user_id, reason: 'Admin device revocation' });
                            }}
                            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold border border-amber-200 rounded-xl transition flex items-center space-x-1"
                          >
                            <Smartphone className="w-4 h-4" />
                            <span>Revoke Field Devices</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailTab === 'devices' && (
                    <div className="space-y-3">
                      {userDetail?.devices?.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                          No registered field devices found for this user.
                        </div>
                      ) : (
                        userDetail?.devices?.map((dev: any) => (
                          <div key={dev.device_id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                            <div>
                              <div className="font-bold text-slate-900">{dev.device_name || dev.platform || 'Device'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">ID: {dev.device_id}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Registered: {formatDate(dev.registered_at)}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${dev.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                              {dev.is_active ? 'ACTIVE' : 'REVOKED'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === 'audit' && (
                    <div className="space-y-2">
                      {userActivity?.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                          No audit activity recorded for this user.
                        </div>
                      ) : (
                        userActivity?.map((act: any) => (
                          <div key={act.log_id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                            <div className="flex justify-between font-bold text-slate-900">
                              <span>{act.action} &bull; {act.entity_type}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{formatDate(act.timestamp)}</span>
                            </div>
                            {act.reason && <div className="text-slate-500 text-[11px]">{act.reason}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
