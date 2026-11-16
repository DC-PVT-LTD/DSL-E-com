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
  Download,
  Users,
  Clock,
  Key,
  Edit,
  Shield,
  Layers,
  Phone,
  FileSpreadsheet,
  FileText,
  History,
  ChevronRight,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import {
  adminUserService,
  AdminUser,
  AdminInvitation,
  AdminRole,
} from '@/services/adminUserService';
import { rolesService, DynamicRole, Permission } from '@/services/rolesService';
import { useUserStore } from '@/services/userStore';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';
import { SensitiveActionConfirmationModal } from '@/components/admin/security/SensitiveActionConfirmationModal';

export default function AdminUsersPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const roleSlug = useUserStore((state) => state.roleSlug);
  const hasPermission = useUserStore((state) => state.hasPermission);

  const canManageAdmins = hasPermission('admins.manage') || roleSlug === 'super_admin';
  const canInviteAdmins = hasPermission('admins.invite') || roleSlug === 'super_admin';
  const isSuperAdmin = roleSlug === 'super_admin';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');

  // Overview stats
  const [stats, setStats] = useState<{
    totalAdmins: number;
    activeAdmins: number;
    inactiveAdmins: number;
    pendingInvitations: number;
    totalRoles: number;
    customRoles: number;
  }>({
    totalAdmins: 0,
    activeAdmins: 0,
    inactiveAdmins: 0,
    pendingInvitations: 0,
    totalRoles: 0,
    customRoles: 0,
  });

  // Table data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [availableRoles, setAvailableRoles] = useState<DynamicRole[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
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

  // Modals & Panels
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInlineRoleModal, setShowInlineRoleModal] = useState(false);
  const [parentModalForInlineRole, setParentModalForInlineRole] = useState<'invite' | 'create' | 'changeRole' | null>(null);

  const [detailsUser, setDetailsUser] = useState<AdminUser | null>(null);
  const [detailsAuditLogs, setDetailsAuditLogs] = useState<any[]>([]);
  const [loadingDetailsAudit, setLoadingDetailsAudit] = useState(false);

  const [editProfileUser, setEditProfileUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: AdminUser; roleId: string; roleName: string } | null>(null);

  const [confirmDeactivateUser, setConfirmDeactivateUser] = useState<AdminUser | null>(null);
  const [confirmReactivateUser, setConfirmReactivateUser] = useState<AdminUser | null>(null);
  const [confirmRemoveRoleUser, setConfirmRemoveRoleUser] = useState<AdminUser | null>(null);
  const [confirmResetPasswordUser, setConfirmResetPasswordUser] = useState<AdminUser | null>(null);
  const [confirmRevokeInvitation, setConfirmRevokeInvitation] = useState<AdminInvitation | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  // Inline role creation states (Scenario 3)
  const [inlineRoleName, setInlineRoleName] = useState('');
  const [inlineRoleSlug, setInlineRoleSlug] = useState('');
  const [inlineRoleDescription, setInlineRoleDescription] = useState('');
  const [inlineSelectedKeys, setInlineSelectedKeys] = useState<string[]>([]);
  const [inlinePermSearch, setInlinePermSearch] = useState('');

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 6000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rolesRes, permsRes, statsRes] = await Promise.all([
        rolesService.getRoles().catch(() => ({ success: false, data: [] })),
        rolesService.getPermissions().catch(() => ({ success: false, data: [] })),
        adminUserService.getStats().catch(() => ({
          success: false,
          data: {
            totalAdmins: 0,
            activeAdmins: 0,
            inactiveAdmins: 0,
            pendingInvitations: 0,
            totalRoles: 0,
            customRoles: 0,
          },
        })),
      ]);

      const fetchedRoles = rolesRes.data || [];
      setAvailableRoles(fetchedRoles);
      setAllPermissions(permsRes.data || []);
      if (statsRes?.data) {
        setStats(statsRes.data);
      }

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
      console.error('Failed to load administrator data:', err);
      setError(err?.message || 'Unable to connect to administrator management service.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, searchTerm, roleFilter, statusFilter, currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set default role selection
  useEffect(() => {
    if (availableRoles.length > 0) {
      const orderMgr = availableRoles.find((r) => r.slug === 'order_manager');
      const defaultId = orderMgr?.id || availableRoles[0].id;
      if (!inviteRoleId) setInviteRoleId(defaultId);
      if (!createRoleId) setCreateRoleId(defaultId);
    }
  }, [availableRoles, inviteRoleId, createRoleId]);

  // Load audit logs when opening details drawer
  const openUserDetails = async (user: AdminUser) => {
    setDetailsUser(user);
    setDetailsAuditLogs([]);
    setLoadingDetailsAudit(true);
    try {
      const res = await adminUserService.getAuditHistory(user.id);
      setDetailsAuditLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load user audit history:', err);
    } finally {
      setLoadingDetailsAudit(false);
    }
  };

  // Open Edit Profile Modal
  const openEditProfile = (user: AdminUser) => {
    setEditProfileUser(user);
    setEditName(user.name || '');
    setEditPhone(user.phone || '');
    setActionError(null);
  };

  const handleSaveProfile = async () => {
    if (!editProfileUser) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await adminUserService.updateAdminProfile(editProfileUser.id, {
        name: editName.trim(),
        phone: editPhone.trim() || null,
      });
      showNotification(`Profile for ${editProfileUser.email} updated successfully.`);
      setEditProfileUser(null);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update administrator profile.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Change Role Modal
  const openChangeRole = (user: AdminUser) => {
    setRoleModalUser(user);
    setSelectedRoleId(user.roleId || (availableRoles[0]?.id ?? ''));
    setActionError(null);
  };

  const handleSaveRole = () => {
    if (!roleModalUser || !selectedRoleId) return;
    const selectedRole = availableRoles.find((r) => r && r.id === selectedRoleId);
    setPendingRoleChange({ user: roleModalUser, roleId: selectedRoleId, roleName: selectedRole?.name || 'Role' });
  };

  // Remove Role Access (Quarantine)
  const handleConfirmRemoveRole = async () => {
    if (!confirmRemoveRoleUser) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await adminUserService.removeAdminRole(confirmRemoveRoleUser.id);
      showNotification(`Removed dynamic role access from ${confirmRemoveRoleUser.email}. Account is now Quarantined.`);
      setConfirmRemoveRoleUser(null);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to remove role access.');
    } finally {
      setActionLoading(false);
    }
  };

  // Deactivate
  const handleConfirmDeactivate = async () => {
    if (!confirmDeactivateUser) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await adminUserService.updateAdminStatus(confirmDeactivateUser.id, false);
      showNotification(`Administrator ${confirmDeactivateUser.email} has been deactivated.`);
      setConfirmDeactivateUser(null);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to deactivate administrator.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reactivate
  const handleConfirmReactivate = async () => {
    if (!confirmReactivateUser) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await adminUserService.updateAdminStatus(confirmReactivateUser.id, true);
      showNotification(`Administrator ${confirmReactivateUser.email} has been reactivated.`);
      setConfirmReactivateUser(null);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to reactivate administrator.');
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger Password Reset
  const handleConfirmResetPassword = async () => {
    if (!confirmResetPasswordUser) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await adminUserService.triggerPasswordReset(confirmResetPasswordUser.id);
      showNotification(`Password reset link dispatched to ${confirmResetPasswordUser.email}.`);
      setConfirmResetPasswordUser(null);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to trigger password reset.');
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke Invitation
  const handleConfirmRevokeInvitation = async () => {
    if (!confirmRevokeInvitation) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await adminUserService.revokeInvitation(confirmRevokeInvitation.id);
      showNotification(`Invitation for ${confirmRevokeInvitation.email} was revoked.`);
      setConfirmRevokeInvitation(null);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to revoke invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      await adminUserService.createAdminUser({
        name: createName.trim(),
        email: createEmail.trim(),
        phone: createPhone.trim() || undefined,
        roleId: createRoleId,
        password: createPassword,
        role: 'ADMIN',
      });
      showNotification(`Administrator account for ${createEmail} created successfully.`);
      setShowCreateModal(false);
      setCreateName('');
      setCreateEmail('');
      setCreatePhone('');
      setCreatePassword('');
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create administrator.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Invite Admin
  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await adminUserService.inviteAdminUser({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        phone: invitePhone.trim() || undefined,
        roleId: inviteRoleId,
        role: 'ADMIN',
      });
      setGeneratedInviteUrl(res.data?.invitationUrl || null);
      showNotification(`Invitation dispatched to ${inviteEmail}.`);
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to issue administrator invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Scenario 3: Inline Role Creation from Dropdown
  const openInlineRoleCreation = (source: 'invite' | 'create' | 'changeRole') => {
    setParentModalForInlineRole(source);
    setInlineRoleName('');
    setInlineRoleSlug('');
    setInlineRoleDescription('');
    setInlineSelectedKeys([]);
    setInlinePermSearch('');
    setShowInlineRoleModal(true);
    setActionError(null);
  };

  const handleCreateInlineRole = async () => {
    if (!inlineRoleName.trim() || !inlineRoleSlug.trim()) {
      setActionError('Role name and slug are required.');
      return;
    }
    if (inlineSelectedKeys.length === 0) {
      setActionError('At least one permission must be selected.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await rolesService.createRole({
        name: inlineRoleName.trim(),
        slug: inlineRoleSlug.trim(),
        description: inlineRoleDescription.trim(),
        permissionKeys: inlineSelectedKeys,
      });

      const newRole = (res?.data || res) as DynamicRole;
      if (newRole && newRole.id) {
        setAvailableRoles((prev) => [...prev.filter((r) => r && r.id !== newRole.id), newRole]);

        // Automatically select the newly created role in the originating modal (Scenario 3)
        if (parentModalForInlineRole === 'invite') {
          setInviteRoleId(newRole.id);
        } else if (parentModalForInlineRole === 'create') {
          setCreateRoleId(newRole.id);
        } else if (parentModalForInlineRole === 'changeRole') {
          setSelectedRoleId(newRole.id);
        }

        showNotification(`Custom role '${newRole.name}' created and auto-selected!`);
      }
      setShowInlineRoleModal(false);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create role.');
    } finally {
      setActionLoading(false);
    }
  };

  // Group permissions by category for inline role creation
  const permissionsByCategory = allPermissions.reduce((acc, perm) => {
    const cat = perm.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const filteredCategories = Object.entries(permissionsByCategory).filter(([cat, perms]) => {
    if (!inlinePermSearch.trim()) return true;
    const term = inlinePermSearch.toLowerCase();
    return (
      cat.toLowerCase().includes(term) ||
      perms.some((p) => p.displayName.toLowerCase().includes(term) || p.key.toLowerCase().includes(term))
    );
  });

  return (
    <AdminPageAccess permission="admins.view" pageTitle="Administrator Accounts">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#0066CC]" />
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Administrator Accounts</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Manage authoritative store administrative accounts, dynamic roles, and invitation lifecycles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2.5 text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-sm disabled:opacity-50"
              title="Refresh administrator data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0066CC]' : ''}`} />
            </button>

            {/* Export Dropdown */}
            <div className="relative group">
              <button
                className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition shadow-sm"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Export</span>
              </button>
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1 hidden group-hover:block z-20">
                <a
                  href={adminUserService.getExportUrl({
                    search: searchTerm || undefined,
                    role: roleFilter !== 'ALL' && roleFilter !== 'QUARANTINED' ? roleFilter : undefined,
                    isActive: statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined,
                    format: 'csv',
                  })}
                  download
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Export as CSV</span>
                </a>
                <a
                  href={adminUserService.getExportUrl({
                    search: searchTerm || undefined,
                    role: roleFilter !== 'ALL' && roleFilter !== 'QUARANTINED' ? roleFilter : undefined,
                    isActive: statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined,
                    format: 'xlsx',
                  })}
                  download
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
                  <span>Export as Excel (.xlsx)</span>
                </a>
              </div>
            </div>

            {canInviteAdmins && (
              <button
                onClick={() => {
                  setShowInviteModal(true);
                  setGeneratedInviteUrl(null);
                  setActionError(null);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#0066CC] text-[#0066CC] hover:bg-blue-50 font-bold text-xs rounded-xl transition shadow-sm"
              >
                <Mail className="w-4 h-4" />
                <span>Invite Admin</span>
              </button>
            )}

            {isSuperAdmin && (
              <button
                onClick={() => {
                  setShowCreateModal(true);
                  setActionError(null);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#08275E] hover:bg-[#061d47] text-white font-bold text-xs rounded-xl transition shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Notifications */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3.1 Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Admins</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
              {isLoading ? '...' : stats.totalAdmins}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Active</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600 font-mono">
              {isLoading ? '...' : stats.activeAdmins}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Inactive</span>
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-700 font-mono">
              {isLoading ? '...' : stats.inactiveAdmins}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Pending Invites</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-600 font-mono">
              {isLoading ? '...' : stats.pendingInvitations}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Roles</span>
              <KeyRound className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
              {isLoading ? '...' : stats.totalRoles}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Custom Roles</span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-purple-600 font-mono">
              {isLoading ? '...' : stats.customRoles}
            </div>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveTab('users');
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'users'
                    ? 'bg-[#08275E] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Administrators ({stats.totalAdmins})
              </button>
              <button
                onClick={() => {
                  setActiveTab('invitations');
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'invitations'
                    ? 'bg-[#08275E] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Pending Invitations ({stats.pendingInvitations})
              </button>
            </div>

            <span className="text-xs text-slate-400 font-medium">
              Showing {totalCount} total {activeTab}
            </span>
          </div>

          {activeTab === 'users' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search administrators by name or email..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Static ADMIN Enum</option>
                <option value="MANAGER">Static MANAGER Enum</option>
                <option value="STAFF">Static STAFF Enum</option>
                <option value="QUARANTINED">⚠️ Quarantined (No Dynamic Role)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Accounts</option>
                <option value="INACTIVE">Deactivated Accounts</option>
              </select>
            </div>
          )}
        </div>

        {/* 3.2 Administrator Table */}
        {activeTab === 'users' ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Administrator</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Dynamic Role</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Permissions</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0066CC] mb-2" />
                        <span>Loading administrators from database...</span>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <span className="font-bold text-slate-600 block">No administrator accounts found</span>
                        <span className="text-[11px]">Try adjusting your search filters or invite an administrator.</span>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isQuarantined = !u.roleId || !u.assignedRole;
                      const isSelf = currentUser?.id === u.id;
                      const isSuperAdminRole = u.assignedRole?.slug === 'super_admin';
                      const permCount = isSuperAdminRole ? 46 : (u.assignedRole as any)?._count?.permissions || 0;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition group">
                          {/* Administrator & initials */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#08275E] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm shrink-0">
                                {u.name ? u.name.slice(0, 2) : u.email.slice(0, 2)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{u.name || 'Unnamed Administrator'}</span>
                                  {isSelf && (
                                    <span className="text-[9px] bg-blue-50 text-blue-600 font-extrabold px-1.5 py-0.2 rounded border border-blue-200">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">{u.id.slice(0, 12)}...</span>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">
                            {u.email}
                          </td>

                          {/* Phone */}
                          <td className="py-3 px-4 text-slate-600">
                            {u.phone || <span className="text-slate-300">—</span>}
                          </td>

                          {/* Dynamic Role */}
                          <td className="py-3 px-4">
                            {isQuarantined ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Quarantined</span>
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isSuperAdminRole
                                    ? 'bg-[#08275E] text-white'
                                    : u.assignedRole?.isSystem
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}>
                                  <Key className="w-2.5 h-2.5" />
                                  <span>{u.assignedRole?.name}</span>
                                </span>
                                <span className="block text-[10px] text-slate-400 font-mono">
                                  {u.assignedRole?.slug}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Account Status */}
                          <td className="py-3 px-4">
                            {u.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                <XCircle className="w-3 h-3" />
                                <span>Deactivated</span>
                              </span>
                            )}
                          </td>

                          {/* Effective Permissions */}
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {isQuarantined ? '0' : `${permCount} perms`}
                            </span>
                          </td>

                          {/* Created Date */}
                          <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openUserDetails(u)}
                                className="p-1.5 text-slate-500 hover:text-[#0066CC] hover:bg-slate-100 rounded-lg transition"
                                title="View administrator details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {canManageAdmins && (
                                <button
                                  onClick={() => openEditProfile(u)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                                  title="Edit profile"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}

                              {isSuperAdmin && (
                                <button
                                  onClick={() => openChangeRole(u)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                                  title="Change role"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>
                              )}

                              {isSuperAdmin && !isQuarantined && (
                                <button
                                  onClick={() => {
                                    setConfirmRemoveRoleUser(u);
                                    setActionError(null);
                                  }}
                                  disabled={isSelf}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-30"
                                  title="Remove role access (quarantine)"
                                >
                                  <ShieldAlert className="w-4 h-4" />
                                </button>
                              )}

                              {canManageAdmins && (
                                <>
                                  {u.isActive ? (
                                    <button
                                      onClick={() => {
                                        setConfirmDeactivateUser(u);
                                        setActionError(null);
                                      }}
                                      disabled={isSelf}
                                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-30"
                                      title="Deactivate account"
                                    >
                                      <UserX className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setConfirmReactivateUser(u);
                                        setActionError(null);
                                      }}
                                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                                      title="Reactivate account"
                                    >
                                      <UserCheck className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Invitations Table */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Invited Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Intended Role</th>
                    <th className="py-3 px-4">Invited By</th>
                    <th className="py-3 px-4">Expires In</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0066CC] mb-2" />
                        <span>Loading pending invitations...</span>
                      </td>
                    </tr>
                  ) : invitations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <span className="font-bold text-slate-600 block">No pending invitations</span>
                        <span className="text-[11px]">All issued administrator invitations have been accepted or expired.</span>
                      </td>
                    </tr>
                  ) : (
                    invitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{inv.name}</td>
                        <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">{inv.email}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {inv.roleRelation?.name || inv.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {inv.invitedBy?.email || 'System'}
                        </td>
                        <td className="py-3 px-4 text-amber-600 font-mono text-[11px]">
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canInviteAdmins && (
                            <button
                              onClick={() => {
                                setConfirmRevokeInvitation(inv);
                                setActionError(null);
                              }}
                              className="px-2.5 py-1 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-xs font-bold transition"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. ADMINISTRATOR DETAILS SIDE PANEL */}
        {detailsUser && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
            <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#08275E] text-white flex items-center justify-center font-bold text-sm uppercase shadow-sm">
                      {detailsUser.name ? detailsUser.name.slice(0, 2) : detailsUser.email.slice(0, 2)}
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 leading-tight">
                        {detailsUser.name || 'Unnamed Administrator'}
                      </h2>
                      <p className="text-xs text-slate-500 font-mono">{detailsUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailsUser(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                {/* Personal Information */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Personal Information
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Admin ID</span>
                      <span className="font-mono text-slate-800 break-all">{detailsUser.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone Number</span>
                      <span className="text-slate-800 font-medium">{detailsUser.phone || 'Not recorded'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Created</span>
                      <span className="text-slate-800 font-mono text-[11px]">
                        {new Date(detailsUser.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Last Updated</span>
                      <span className="text-slate-800 font-mono text-[11px]">
                        {new Date(detailsUser.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Account & Role Information */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Role & Account Status
                  </span>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Assigned Dynamic Role:</span>
                      <span className="font-bold text-slate-900">
                        {detailsUser.assignedRole?.name || 'Quarantined (Unassigned)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Role Slug:</span>
                      <span className="font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {detailsUser.assignedRole?.slug || 'none'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">System Role:</span>
                      <span className="font-bold">
                        {detailsUser.assignedRole?.isSystem ? (
                          <span className="text-blue-600">Yes (System Role)</span>
                        ) : (
                          <span className="text-purple-600">No (Custom Role)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Active Status:</span>
                      <span className="font-bold">
                        {detailsUser.isActive ? (
                          <span className="text-emerald-600">Active</span>
                        ) : (
                          <span className="text-red-600">Deactivated</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Effective Permissions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Effective Permissions
                    </span>
                    <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {detailsUser.assignedRole?.slug === 'super_admin' ? '46 Authoritative (Full Sovereignty)' : `${detailsUser.assignedRole?.permissions?.length || 0} permissions`}
                    </span>
                  </div>

                  {detailsUser.assignedRole?.slug === 'super_admin' ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs text-emerald-800 font-medium space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Root Super Admin Sovereignty</span>
                      </div>
                      <p className="text-[11px]">
                        This administrator account holds the Root Super Admin role and automatically possesses unrestricted access across all 46 system permissions.
                      </p>
                    </div>
                  ) : !detailsUser.roleId || !detailsUser.assignedRole ? (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 font-medium">
                      <span className="font-bold block">Quarantined Account</span>
                      No dynamic permissions are assigned. This account is blocked from all protected administrative routes.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailsUser.assignedRole.permissions?.map((p: any) => (
                        <div
                          key={p.permission.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-800 block">{p.permission.displayName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{p.permission.key}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                            {p.permission.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Administrator Activity / Audit Trail */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Administrator Activity Audit Trail
                  </span>

                  {loadingDetailsAudit ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[#0066CC] mb-1" />
                      <span>Loading chronological activity...</span>
                    </div>
                  ) : detailsAuditLogs.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 text-center">
                      No security audit events recorded for this administrator yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {detailsAuditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold font-mono text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                              {log.action}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-700 text-[11px] leading-relaxed">{log.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                {canManageAdmins && (
                  <button
                    onClick={() => {
                      setConfirmResetPasswordUser(detailsUser);
                      setDetailsUser(null);
                    }}
                    className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Reset Password
                  </button>
                )}
                <button
                  onClick={() => setDetailsUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Edit Profile */}
        {editProfileUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Edit className="w-5 h-5 text-[#0066CC]" />
                  <h3 className="font-black text-slate-900 text-base">Edit Administrator Profile</h3>
                </div>
                <button onClick={() => setEditProfileUser(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                  {actionError}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                    placeholder="e.g. Kamal Perera"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                    placeholder="+94 77 123 4567"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Email (Immutable)</label>
                  <input
                    type="text"
                    disabled
                    value={editProfileUser.email}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditProfileUser(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#08275E] text-white rounded-xl text-xs font-bold hover:bg-[#061d47] disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Change Role (with Scenario 3 Inline Create Role button) */}
        {roleModalUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-black text-slate-900 text-base">Assign Administrator Role</h3>
                </div>
                <button onClick={() => setRoleModalUser(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                  {actionError}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Select a dynamic role to assign to <span className="font-bold text-slate-900">{roleModalUser.email}</span>:
                </p>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Select Role</label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:outline-none"
                  >
                    {availableRoles.filter((r) => r && r.id).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.slug}) {r.isSystem ? '• System' : '• Custom'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scenario 3: + Create New Role button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => openInlineRoleCreation('changeRole')}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#0066CC] hover:text-blue-800 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Create New Role</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRole}
                  disabled={actionLoading || !selectedRoleId}
                  className="px-4 py-2 bg-[#08275E] text-white rounded-xl text-xs font-bold hover:bg-[#061d47] disabled:opacity-50"
                >
                  {actionLoading ? 'Assigning...' : 'Assign Role'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Create Admin (Direct Super Admin Create) */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#0066CC]" />
                  <h3 className="font-black text-slate-900 text-base">Directly Create Administrator</h3>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleCreateAdmin} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                    placeholder="e.g. Kasun Fernando"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                    placeholder="kasun.f@dslstationery.lk"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number (Optional)</label>
                  <input
                    type="text"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                    placeholder="+94 77 123 4567"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Assign Role</label>
                    <button
                      type="button"
                      onClick={() => openInlineRoleCreation('create')}
                      className="text-[11px] font-bold text-[#0066CC] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Create New Role</span>
                    </button>
                  </div>
                  <select
                    value={createRoleId}
                    onChange={(e) => setCreateRoleId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:outline-none"
                  >
                    {availableRoles.filter((r) => r && r.id).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.slug}) {r.isSystem ? '• System' : '• Custom'}
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
                      className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#08275E] text-white rounded-xl text-xs font-bold hover:bg-[#061d47] disabled:opacity-50"
                  >
                    {actionLoading ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Invite Admin */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-[#0066CC]" />
                  <h3 className="font-black text-slate-900 text-base">Invite Administrator</h3>
                </div>
                <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                  {actionError}
                </div>
              )}

              {generatedInviteUrl ? (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-2">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Invitation Dispatched Successfully!</span>
                    </span>
                    <p className="text-[11px] text-emerald-700">
                      An invitation email has been sent. In development mode, you can also copy the direct single-use URL below:
                    </p>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-300 font-mono text-[10px] break-all">
                      <span className="flex-1 select-all">{generatedInviteUrl}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedInviteUrl);
                          showNotification('Invitation link copied to clipboard!');
                        }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600 shrink-0"
                        title="Copy URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2 bg-[#08275E] text-white rounded-xl text-xs font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleInviteAdmin} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                      placeholder="e.g. Priyantha Jayasuriya"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                      placeholder="priyantha.j@dslstationery.lk"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Phone Number (Optional)</label>
                    <input
                      type="text"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                      placeholder="+94 77 987 6543"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">Assign Role</label>
                      <button
                        type="button"
                        onClick={() => openInlineRoleCreation('invite')}
                        className="text-[11px] font-bold text-[#0066CC] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Create New Role</span>
                      </button>
                    </div>
                    <select
                      value={inviteRoleId}
                      onChange={(e) => setInviteRoleId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:outline-none"
                    >
                      {availableRoles.filter((r) => r && r.id).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.slug}) {r.isSystem ? '• System' : '• Custom'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-2 bg-[#0066CC] text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {actionLoading ? 'Dispatching...' : 'Dispatch Invitation'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* MODAL: Scenario 3 Inline Role Creation */}
        {showInlineRoleModal && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col justify-between animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Create Custom Role</h3>
                    <p className="text-[11px] text-slate-500">
                      Configure a new role and choose permissions with checkboxes. It will be auto-selected.
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowInlineRoleModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                  {actionError}
                </div>
              )}

              <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Role Name</label>
                    <input
                      type="text"
                      required
                      value={inlineRoleName}
                      onChange={(e) => {
                        setInlineRoleName(e.target.value);
                        setInlineRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                      placeholder="e.g. Warehouse Dispatcher"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Role Slug</label>
                    <input
                      type="text"
                      required
                      value={inlineRoleSlug}
                      onChange={(e) => setInlineRoleSlug(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                      placeholder="warehouse_dispatcher"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Description</label>
                  <input
                    type="text"
                    value={inlineRoleDescription}
                    onChange={(e) => setInlineRoleDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                    placeholder="Brief summary of duties..."
                  />
                </div>

                {/* Permission Checkbox Interface */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">Permission Selection</span>
                      <span className="text-[11px] text-purple-600 font-bold font-mono">
                        {inlineSelectedKeys.length} of {allPermissions.length} selected
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInlineSelectedKeys(allPermissions.map((p) => p.key))}
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        Select All (46)
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setInlineSelectedKeys([])}
                        className="text-[11px] font-bold text-slate-500 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={inlinePermSearch}
                    onChange={(e) => setInlinePermSearch(e.target.value)}
                    placeholder="Search permissions..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />

                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                    {filteredCategories.map(([cat, perms]) => {
                      const allCatKeys = perms.map((p) => p.key);
                      const isAllCatSelected = allCatKeys.every((k) => inlineSelectedKeys.includes(k));

                      return (
                        <div key={cat} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                            <span className="font-black text-slate-800 text-[11px] uppercase tracking-wider">{cat}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (isAllCatSelected) {
                                  setInlineSelectedKeys((prev) => prev.filter((k) => !allCatKeys.includes(k)));
                                } else {
                                  setInlineSelectedKeys((prev) => Array.from(new Set([...prev, ...allCatKeys])));
                                }
                              }}
                              className="text-[10px] font-bold text-[#0066CC] hover:underline"
                            >
                              {isAllCatSelected ? 'Deselect Module' : 'Select Module'}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            {perms.map((p) => {
                              const checked = inlineSelectedKeys.includes(p.key);
                              return (
                                <label
                                  key={p.id}
                                  className={`flex items-start gap-2 p-1.5 rounded-lg border cursor-pointer transition ${
                                    checked
                                      ? 'bg-purple-50/70 border-purple-200 text-purple-900 font-bold'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setInlineSelectedKeys((prev) => [...prev, p.key]);
                                      } else {
                                        setInlineSelectedKeys((prev) => prev.filter((k) => k !== p.key));
                                      }
                                    }}
                                    className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                  />
                                  <div className="leading-tight">
                                    <span className="block text-[11px]">{p.displayName}</span>
                                    <span className="text-[9px] text-slate-400 font-mono">{p.key}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInlineRoleModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateInlineRole}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Creating Role...' : 'Save Role & Select'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRMATION: Deactivate (with Typed Confirmation: User Email) */}
        {confirmDeactivateUser && (
          <SensitiveActionConfirmationModal
            isOpen={Boolean(confirmDeactivateUser)}
            onClose={() => setConfirmDeactivateUser(null)}
            actionTitle="Deactivate Administrator Account"
            actionDescription="Revoke access and terminate active sessions"
            targetResourceType="Administrator"
            targetResourceName={confirmDeactivateUser.email}
            expectedConfirmationPhrase={confirmDeactivateUser.email}
            confirmButtonLabel="Confirm Deactivation"
            impactWarning="Deactivating this administrator will revoke all active refresh tokens immediately. Further API requests will be blocked on the next call."
            onConfirmed={async (phrase) => {
              await adminUserService.updateAdminStatus(confirmDeactivateUser.id, false, phrase);
              showNotification(`Administrator ${confirmDeactivateUser.email} has been deactivated.`);
              setConfirmDeactivateUser(null);
              await loadData();
            }}
          />
        )}

        {/* CONFIRMATION: Change Role (with Typed Confirmation: CHANGE ADMIN ROLE) */}
        {pendingRoleChange && (
          <SensitiveActionConfirmationModal
            isOpen={Boolean(pendingRoleChange)}
            onClose={() => setPendingRoleChange(null)}
            actionTitle="Change Administrator Role"
            actionDescription={`Reassign administrative role for ${pendingRoleChange.user.email} to ${pendingRoleChange.roleName}`}
            targetResourceType="Administrator"
            targetResourceName={pendingRoleChange.user.email}
            expectedConfirmationPhrase="CHANGE ADMIN ROLE"
            confirmButtonLabel="Confirm Role Change"
            impactWarning="Changing this administrator's role will immediately update their effective platform permissions."
            isDestructive={false}
            onConfirmed={async (phrase) => {
              await adminUserService.updateAdminRole(pendingRoleChange.user.id, 'ADMIN', pendingRoleChange.roleId, phrase);
              showNotification(`Assigned dynamic role ${pendingRoleChange.roleName} to ${pendingRoleChange.user.email}.`);
              setPendingRoleChange(null);
              setRoleModalUser(null);
              await loadData();
            }}
          />
        )}

        {/* CONFIRMATION: Reactivate */}
        {confirmReactivateUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-emerald-600">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Reactivate Administrator?</h3>
                  <p className="text-xs text-slate-500">{confirmReactivateUser.email}</p>
                </div>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                  {actionError}
                </div>
              )}

              <p className="text-xs text-slate-600">
                This account will be marked active. The administrator can sign in and resume operations allowed by their dynamic role.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmReactivateUser(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReactivate}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Reactivating...' : 'Confirm Reactivation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRMATION: Remove Role Access (Quarantine) */}
        {confirmRemoveRoleUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-amber-600">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Remove Role Access?</h3>
                  <p className="text-xs text-slate-500">{confirmRemoveRoleUser.email}</p>
                </div>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                  {actionError}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                <span className="font-bold block">Quarantine Account</span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Removing the dynamic role leaves roleId as null. The administrator loses all protected API access immediately until a new role is explicitly assigned.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmRemoveRoleUser(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRemoveRole}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Removing...' : 'Remove Role Access'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRMATION: Reset Password */}
        {confirmResetPasswordUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-blue-600">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Send Password Reset Link?</h3>
                  <p className="text-xs text-slate-500">{confirmResetPasswordUser.email}</p>
                </div>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                  {actionError}
                </div>
              )}

              <p className="text-xs text-slate-600">
                A single-use cryptographically secure password reset link will be emailed to <span className="font-bold">{confirmResetPasswordUser.email}</span> with a 1-hour expiration window.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmResetPasswordUser(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmResetPassword}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#08275E] text-white rounded-xl text-xs font-bold hover:bg-[#061d47] disabled:opacity-50"
                >
                  {actionLoading ? 'Sending...' : 'Dispatch Reset Email'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRMATION: Revoke Invitation */}
        {confirmRevokeInvitation && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Revoke Invitation?</h3>
                  <p className="text-xs text-slate-500">{confirmRevokeInvitation.email}</p>
                </div>
              </div>

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                  {actionError}
                </div>
              )}

              <p className="text-xs text-slate-600">
                This pending invitation will be deleted. The invitee will no longer be able to accept the token or establish account credentials.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmRevokeInvitation(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRevokeInvitation}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Revoking...' : 'Revoke Invitation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPageAccess>
  );
}
