'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Mail,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  MoreVertical,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
  X,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  adminUserService,
  AdminUser,
  AdminInvitation,
  AdminRole,
} from '@/services/adminUserService';
import { rolesService, DynamicRole } from '@/services/rolesService';
import { useUserStore } from '@/services/userStore';

export default function AdminUsersPage() {
  const currentUser = useUserStore((state) => state.currentUser);

  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [availableRoles, setAvailableRoles] = useState<DynamicRole[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states: Invite
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState<string>('');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);

  // Form states: Create
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createRoleId, setCreateRoleId] = useState<string>('');
  const [createPassword, setCreatePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form states: Role change
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 6000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Also fetch dynamic roles
      const [rolesRes] = await Promise.all([
        rolesService.getRoles().catch(() => ({ success: false, data: [] })),
      ]);
      const fetchedRoles = rolesRes.data || [];
      setAvailableRoles(fetchedRoles);

      if (activeTab === 'users') {
        const queryRole = roleFilter === 'ALL' || roleFilter === 'QUARANTINED' ? undefined : (roleFilter as AdminRole);
        const queryActive =
          statusFilter === 'ALL'
            ? undefined
            : statusFilter === 'ACTIVE'
            ? true
            : false;

        const res = await adminUserService.getAdminUsers({
          search: searchTerm || undefined,
          role: queryRole,
          isActive: queryActive,
          page: currentPage,
          limit: 20,
        });

        let userList = res.data || [];
        if (roleFilter === 'QUARANTINED') {
          userList = userList.filter((u) => !u.roleId || !u.assignedRole);
        }

        setUsers(userList);
        setTotalCount(res.meta?.total || 0);
        setTotalPages(res.meta?.totalPages || 1);
      } else {
        const res = await adminUserService.getInvitations();
        setInvitations(res.data || []);
        setTotalCount(res.data?.length || 0);
      }
    } catch (err: any) {
      console.error('Failed to load admin user data:', err);
      setError(err?.message || 'Unable to connect to administrator management service.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, searchTerm, roleFilter, statusFilter, currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set default role selection when modal opens
  useEffect(() => {
    if (availableRoles.length > 0) {
      const orderMgr = availableRoles.find((r) => r.slug === 'order_manager');
      const defaultId = orderMgr?.id || availableRoles[0].id;
      if (!inviteRoleId) setInviteRoleId(defaultId);
      if (!createRoleId) setCreateRoleId(defaultId);
    }
  }, [availableRoles, inviteRoleId, createRoleId]);

  // Handle status toggle (Activate / Deactivate)
  const handleToggleStatus = async (user: AdminUser) => {
    if (currentUser?.id === user.id && user.isActive) {
      alert('You cannot deactivate your own administrative account.');
      return;
    }

    const isSuperAdmin = user.assignedRole?.slug === 'super_admin';
    const activeSuperAdmins = users.filter((u) => u.isActive && u.assignedRole?.slug === 'super_admin');
    if (isSuperAdmin && user.isActive && activeSuperAdmins.length <= 1) {
      alert('Cannot deactivate the last active Super Admin. At least one Super Admin must remain active at all times.');
      return;
    }

    const actionText = user.isActive ? 'deactivate' : 'activate';
    const confirmPrompt = user.isActive
      ? `Are you sure you want to deactivate ${user.name} (${user.email})? All active sessions and tokens will be revoked immediately.`
      : `Activate administrator account for ${user.name} (${user.email})?`;

    if (!window.confirm(confirmPrompt)) return;

    setActionLoading(true);
    try {
      const res = await adminUserService.updateAdminStatus(user.id, !user.isActive);
      showNotification(res.message);
      await loadData();
    } catch (err: any) {
      alert(err?.message || `Failed to ${actionText} administrator account.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle dynamic role update
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalUser || !selectedRoleId) return;

    const chosenRole = availableRoles.find((r) => r.id === selectedRoleId);
    if (!chosenRole) return;

    setActionLoading(true);
    try {
      // Pass dynamic roleId to updateAdminRole
      const legacyRole: AdminRole = chosenRole.slug === 'super_admin' ? 'ADMIN' : 'STAFF';
      const res = await adminUserService.updateAdminRole(roleModalUser.id, legacyRole, chosenRole.id);
      showNotification(res.message);
      setRoleModalUser(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update administrator role.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Send Invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const chosenRole = availableRoles.find((r) => r.id === inviteRoleId);
      const res = await adminUserService.inviteAdminUser({
        name: inviteName,
        email: inviteEmail,
        phone: invitePhone || undefined,
        role: chosenRole?.slug === 'super_admin' ? 'ADMIN' : 'STAFF',
        roleId: inviteRoleId || undefined,
      });

      if (res.data?.invitationUrl) {
        setGeneratedInviteUrl(res.data.invitationUrl);
      }

      showNotification(res.message);
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to send administrator invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Direct Account Creation
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const chosenRole = availableRoles.find((r) => r.id === createRoleId);
      const res = await adminUserService.createAdminUser({
        name: createName,
        email: createEmail,
        phone: createPhone || undefined,
        role: chosenRole?.slug === 'super_admin' ? 'ADMIN' : 'STAFF',
        roleId: createRoleId || undefined,
        password: createPassword,
      });

      showNotification(res.message);
      setShowCreateModal(false);
      setCreateName('');
      setCreateEmail('');
      setCreatePhone('');
      setCreatePassword('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create administrator account.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Revoke Invitation
  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    if (!window.confirm(`Revoke pending invitation for ${email}?`)) return;

    setActionLoading(true);
    try {
      const res = await adminUserService.revokeInvitation(invitationId);
      showNotification(res.message);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (user: AdminUser) => {
    // If account has no roleId or assignedRole, it is quarantined
    if (!user.roleId || !user.assignedRole) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>Quarantined (Unassigned Role)</span>
        </span>
      );
    }

    const slug = user.assignedRole.slug;
    if (slug === 'super_admin') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
          <span>Super Admin</span>
        </span>
      );
    }

    if (slug === 'project_manager') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
          <span>Project Manager</span>
        </span>
      );
    }

    if (slug === 'product_manager') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
          <span>Product Manager</span>
        </span>
      );
    }

    if (slug === 'order_manager') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span>Order Manager</span>
        </span>
      );
    }

    if (slug === 'customer_manager') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
          <span>Customer Manager</span>
        </span>
      );
    }

    // Custom Dynamic Role
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
        <span>{user.assignedRole.name}</span>
      </span>
    );
  };

  const activeSuperAdminsCount = users.filter(
    (u) => u.isActive && u.assignedRole?.slug === 'super_admin',
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-[#08275E] text-[#FFD21C] flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Administrator Accounts
              </h1>
              <p className="text-xs text-slate-500">
                Manage administrative personnel, dynamic roles, invitations, and advisory mutex invariants
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setGeneratedInviteUrl(null);
              setShowInviteModal(true);
            }}
            className="flex items-center gap-2 bg-[#08275E] hover:bg-[#103b8c] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4 text-[#FFD21C]" />
            <span>Invite Administrator</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-[#08275E]" />
            <span>Direct Create</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs flex items-center justify-between shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 space-x-6 text-sm font-bold">
        <button
          onClick={() => {
            setActiveTab('users');
            setCurrentPage(1);
          }}
          className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-[#08275E] text-[#08275E]'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>Administrators</span>
          {activeTab === 'users' && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
              {totalCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('invitations');
            setCurrentPage(1);
          }}
          className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'invitations'
              ? 'border-[#08275E] text-[#08275E]'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>Pending Invitations</span>
          {activeTab === 'invitations' && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
              {totalCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Controls & Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search name, email, phone..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#08275E]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-semibold">Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                >
                  <option value="ALL">All Roles</option>
                  <option value="QUARANTINED">Quarantined (Unassigned)</option>
                  <option value="ADMIN">ADMIN (Super Admin)</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="STAFF">STAFF</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-semibold">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Deactivated</option>
                </select>
              </div>

              <button
                onClick={loadData}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Refresh list"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-6 py-4">Administrator</th>
                    <th className="px-6 py-4">Dynamic Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#08275E]" />
                        <span>Loading administrator accounts...</span>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-red-500">
                        <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                        <span>{error}</span>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span>No administrator accounts match your criteria.</span>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const isSelf = currentUser?.id === user.id;
                      const isSuperAdmin = user.assignedRole?.slug === 'super_admin';
                      const isLastSuperAdmin =
                        isSuperAdmin && user.isActive && activeSuperAdminsCount <= 1;

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#08275E]/10 text-[#08275E] font-black flex items-center justify-center text-xs shrink-0">
                                {user.name?.charAt(0)?.toUpperCase() || 'A'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-2">
                                  <span>{user.name}</span>
                                  {isSelf && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 text-[11px]">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">{getRoleBadge(user)}</td>

                          <td className="px-6 py-4">
                            {user.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                <span>Deactivated</span>
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-slate-600 font-mono text-[11px]">
                            {user.phone || '—'}
                          </td>

                          <td className="px-6 py-4 text-slate-500 text-[11px]">
                            {new Date(user.createdAt).toLocaleDateString('en-GB', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Change Role Button */}
                              <button
                                onClick={() => {
                                  setRoleModalUser(user);
                                  setSelectedRoleId(user.roleId || availableRoles[0]?.id || '');
                                }}
                                disabled={isSelf || actionLoading}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                title={
                                  isSelf
                                    ? 'You cannot change your own role'
                                    : 'Assign or modify dynamic role'
                                }
                              >
                                {user.roleId ? 'Edit Role' : 'Assign Role'}
                              </button>

                              {/* Activate / Deactivate Toggle */}
                              <button
                                onClick={() => handleToggleStatus(user)}
                                disabled={isSelf || isLastSuperAdmin || actionLoading}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer ${
                                  user.isActive
                                    ? 'border border-red-200 text-red-600 hover:bg-red-50'
                                    : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                }`}
                                title={
                                  isSelf
                                    ? 'You cannot deactivate your own account'
                                    : isLastSuperAdmin
                                    ? 'Cannot deactivate the last active Super Admin'
                                    : user.isActive
                                    ? 'Deactivate account & revoke all sessions'
                                    : 'Activate account'
                                }
                              >
                                {user.isActive ? (
                                  <>
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Activate</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Invitations */}
      {activeTab === 'invitations' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-4">Recipient</th>
                  <th className="px-6 py-4">Assigned Dynamic Role</th>
                  <th className="px-6 py-4">Invited By</th>
                  <th className="px-6 py-4">Expires At</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#08275E]" />
                      <span>Loading pending invitations...</span>
                    </td>
                  </tr>
                ) : invitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <span>No pending administrator invitations found.</span>
                    </td>
                  </tr>
                ) : (
                  invitations.map((inv) => {
                    const isExpired = new Date(inv.expiresAt) < new Date();
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{inv.name}</div>
                          <div className="text-slate-400 text-[11px]">{inv.email}</div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {inv.roleRelation?.name || inv.role}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {inv.invitedBy?.name ? (
                            <div>
                              <div className="font-semibold text-slate-800">{inv.invitedBy.name}</div>
                              <div className="text-[10px] text-slate-400">{inv.invitedBy.email}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {isExpired ? (
                            <span className="text-red-600 font-bold text-[11px]">Expired</span>
                          ) : (
                            <span className="text-emerald-700 font-semibold text-[11px]">
                              {new Date(inv.expiresAt).toLocaleDateString('en-GB', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-slate-500 text-[11px]">
                          {new Date(inv.createdAt).toLocaleDateString('en-GB', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Invite Administrator */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#08275E]/10 text-[#08275E] flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Invite Administrator</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatedInviteUrl ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Invitation Created Successfully!</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    A secure, single-use token was generated. If the SMTP email service is in simulated mode, share this activation link directly with the user:
                  </p>
                  <div className="flex items-center gap-2 bg-white rounded-xl p-2 border border-emerald-200">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteUrl}
                      className="text-xs font-mono w-full bg-transparent focus:outline-none select-all text-slate-700"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInviteUrl);
                        alert('Invitation URL copied to clipboard!');
                      }}
                      className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors cursor-pointer"
                      title="Copy link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setGeneratedInviteUrl(null);
                      setShowInviteModal(false);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#08275E] text-white text-xs font-bold shadow-xs hover:bg-[#103b8c] cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Kasun Fernando"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="kasun.f@dslstationery.lk"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Dynamic Role</label>
                  <select
                    value={inviteRoleId}
                    onChange={(e) => setInviteRoleId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                  >
                    {availableRoles
                      .filter((r) => r.isActive)
                      .map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name} {role.isSystem ? '(System)' : '(Custom)'} — {role.slug === 'super_admin' ? 'Full bypass' : `${role._count?.permissions || 0} permissions`}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? 'Issuing Invitation...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Direct Account Creation */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#08275E]/10 text-[#08275E] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Direct Account Creation</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Ruwan Weerasinghe"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="ruwan.w@dslstationery.lk"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  placeholder="+94 71 234 5678"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assigned Dynamic Role</label>
                <select
                  value={createRoleId}
                  onChange={(e) => setCreateRoleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                >
                  {availableRoles
                    .filter((r) => r.isActive)
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name} {role.isSystem ? '(System)' : '(Custom)'} — {role.slug === 'super_admin' ? 'Full bypass' : `${role._count?.permissions || 0} permissions`}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Initial Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 number"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Must be at least 8 characters with uppercase, lowercase, and numeric digits.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change / Assign Dynamic Role */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {roleModalUser.roleId ? 'Change Dynamic Role' : 'Assign Dynamic Role'}
              </h3>
              <button
                onClick={() => setRoleModalUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold">Target User:</span> {roleModalUser.name}
              </div>
              <div className="text-slate-500 font-mono text-[11px]">{roleModalUser.email}</div>
              <div className="pt-1 flex items-center gap-1.5">
                <span className="font-bold">Current Role:</span>
                {roleModalUser.assignedRole ? (
                  <span className="font-semibold text-slate-900">
                    {roleModalUser.assignedRole.name}
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold">Quarantined (Unassigned)</span>
                )}
              </div>
            </div>

            <form onSubmit={handleUpdateRole} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Dynamic Role</label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                >
                  {availableRoles
                    .filter((r) => r.isActive)
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name} {role.isSystem ? '(System)' : '(Custom)'}
                      </option>
                    ))}
                </select>
              </div>

              {/* Advisory Mutex Warning if Super Admin */}
              {availableRoles.find((r) => r.id === selectedRoleId)?.slug === 'super_admin' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Super Admin Mutex Warning</span>
                  </div>
                  <p>
                    Assigning Super Admin grants full unrestricted system bypass and subjects all membership changes to PostgreSQL advisory lock synchronization.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Updating...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
