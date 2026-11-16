'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit,
  Trash2,
  Users,
  Check,
  X,
  Lock,
  Layers,
  ChevronRight,
  Info,
  Download,
  FileText,
  FileSpreadsheet,
  Search,
  Filter,
  History,
  Clock,
  Sparkles,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { rolesService, DynamicRole, Permission } from '@/services/rolesService';
import { useUserStore } from '@/services/userStore';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';
import { SensitiveActionConfirmationModal } from '@/components/admin/security/SensitiveActionConfirmationModal';

export default function RolesManagementPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const roleSlug = useUserStore((state) => state.roleSlug);
  const hasPermission = useUserStore((state) => state.hasPermission);

  const isSuperAdmin = roleSlug === 'super_admin';
  const canManageRoles = hasPermission('roles.manage') || isSuperAdmin;
  const canAssignPermissions = hasPermission('roles.assign_permissions') || isSuperAdmin;

  const [roles, setRoles] = useState<DynamicRole[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<DynamicRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SYSTEM' | 'CUSTOM'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [permMatrixSearch, setPermMatrixSearch] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<DynamicRole | null>(null);
  const [auditRole, setAuditRole] = useState<DynamicRole | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Form states: Create role
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createSelectedKeys, setCreateSelectedKeys] = useState<string[]>([]);
  const [createPermSearch, setCreatePermSearch] = useState('');

  // Form states: Edit role
  const [editRole, setEditRole] = useState<DynamicRole | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Permissions edit states
  const [permRole, setPermRole] = useState<DynamicRole | null>(null);
  const [permSelectedKeys, setPermSelectedKeys] = useState<string[]>([]);
  const [editPermSearch, setEditPermSearch] = useState('');
  const [showStepUpModal, setShowStepUpModal] = useState(false);
  const [pendingSaveRole, setPendingSaveRole] = useState<{ id: string; name: string; keys: string[] } | null>(null);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        rolesService.getRoles(),
        rolesService.getPermissions(),
      ]);

      const rolesList = rolesRes.data || [];
      setRoles(rolesList);
      setAllPermissions(permsRes.data || []);

      if (rolesList.length > 0) {
        setSelectedRole((prev) => {
          if (!prev) return rolesList[0];
          return rolesList.find((r) => r.id === prev.id) || rolesList[0];
        });
      }
    } catch (err: any) {
      console.error('Failed to load roles and permissions:', err);
      setError(err?.message || 'Unable to connect to roles and permissions service.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    return allPermissions.reduce((acc, perm) => {
      const cat = perm.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [allPermissions]);

  // Filtered roles list
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const matchesSearch =
        !searchTerm.trim() ||
        role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType =
        typeFilter === 'ALL' ||
        (typeFilter === 'SYSTEM' && role.isSystem) ||
        (typeFilter === 'CUSTOM' && !role.isSystem);

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && role.isActive) ||
        (statusFilter === 'INACTIVE' && !role.isActive);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [roles, searchTerm, typeFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = roles.length;
    const system = roles.filter((r) => r.isSystem).length;
    const custom = roles.filter((r) => !r.isSystem).length;
    const active = roles.filter((r) => r.isActive).length;
    const totalAdmins = roles.reduce((sum, r) => sum + (r._count?.users || 0), 0);
    return {
      total,
      system,
      custom,
      active,
      totalAdmins,
      totalPermissions: allPermissions.length,
    };
  }, [roles, allPermissions]);

  // Open Audit History
  const openAuditHistory = async (role: DynamicRole) => {
    setAuditRole(role);
    setAuditLogs([]);
    setLoadingAudit(true);
    try {
      const res = await rolesService.getAuditHistory(role.id);
      setAuditLogs(res.data || []);
    } catch (err: any) {
      console.error('Failed to load audit history:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Handle Create Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createSlug.trim()) {
      setActionError('Role name and slug are required');
      return;
    }
    if (createSelectedKeys.length === 0) {
      setActionError('At least one permission must be assigned to the custom role');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await rolesService.createRole({
        name: createName.trim(),
        slug: createSlug.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        description: createDescription.trim() || undefined,
        permissionKeys: createSelectedKeys,
      });

      showNotification(res.message || (res?.data?.name ? `Custom role "${res.data.name}" created successfully.` : 'Role created successfully.'));
      setShowCreateModal(false);
      setCreateName('');
      setCreateSlug('');
      setCreateDescription('');
      setCreateSelectedKeys([]);
      setCreatePermSearch('');
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create custom role');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit Role Details
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRole) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await rolesService.updateRole(editRole.id, {
        name: editName.trim() || undefined,
        description: editDescription.trim() || undefined,
        isActive: editIsActive,
      });

      showNotification(res.message || `Role "${editRole.name}" updated successfully.`);
      setShowEditModal(false);
      setEditRole(null);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Role
  const handleConfirmDelete = async () => {
    if (!deleteConfirmRole) return;
    if (deleteConfirmRole.isSystem) {
      setActionError('System roles are protected and cannot be deleted.');
      return;
    }
    if ((deleteConfirmRole._count?.users || 0) > 0) {
      setActionError(`Cannot delete role while ${deleteConfirmRole._count?.users} administrator(s) are assigned.`);
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await rolesService.deleteRole(deleteConfirmRole.id);
      showNotification(res.message || `Role "${deleteConfirmRole.name}" deleted permanently.`);
      if (selectedRole?.id === deleteConfirmRole.id) {
        setSelectedRole(roles.find((r) => r.id !== deleteConfirmRole.id) || null);
      }
      setDeleteConfirmRole(null);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete role');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Save Permissions
  const handleSavePermissions = () => {
    if (!permRole) return;
    setPendingSaveRole({ id: permRole.id, name: permRole.name, keys: permSelectedKeys });
    setShowStepUpModal(true);
  };

  const executeSavePermissions = async (confirmationPhrase?: string) => {
    if (!pendingSaveRole) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await rolesService.assignPermissions(pendingSaveRole.id, pendingSaveRole.keys, confirmationPhrase);
      showNotification(res.message || `Updated permissions for ${pendingSaveRole.name}.`);
      setShowPermissionsModal(false);
      setPermRole(null);
      setPendingSaveRole(null);
      setShowStepUpModal(false);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update role permissions');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminPageAccess permission="roles.view" pageTitle="Roles & Permissions">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#08275E] text-[#FFD21C] flex items-center justify-center shadow-xs">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Roles & Access Control (RBAC)
                </h1>
                <p className="text-xs text-slate-500">
                  Granular permission enforcement across {stats.totalPermissions} authoritative system privileges
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
              title="Refresh roles"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#08275E]' : ''}`} />
            </button>

            {/* Export Dropdown */}
            <div className="relative group">
              <button
                className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Export</span>
              </button>
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1 hidden group-hover:block z-30">
                <a
                  href={rolesService.getExportUrl('csv')}
                  download
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Export as CSV</span>
                </a>
                <a
                  href={rolesService.getExportUrl('xlsx')}
                  download
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
                  <span>Export as Excel (.xlsx)</span>
                </a>
              </div>
            </div>

            {canManageRoles && (
              <button
                onClick={() => {
                  setCreateName('');
                  setCreateSlug('');
                  setCreateDescription('');
                  setCreateSelectedKeys([]);
                  setCreatePermSearch('');
                  setActionError(null);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 bg-[#08275E] hover:bg-[#103b8c] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#FFD21C]" />
                <span>Create Custom Role</span>
              </button>
            )}
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

        {/* Global Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-xs flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 5 Live Overview Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Roles</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{stats.total}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{stats.active} Active across store</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">System Roles</span>
              <Lock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-900 mt-2">{stats.system}</div>
            <div className="text-[11px] text-blue-600 font-medium mt-0.5">Immutable base roles</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Custom Roles</span>
              <Sparkles className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-2">{stats.custom}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Tailored permission sets</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assigned Admins</span>
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-black text-purple-900 mt-2">{stats.totalAdmins}</div>
            <div className="text-[11px] text-purple-600 font-medium mt-0.5">Active administrators</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Permissions</span>
              <KeyRound className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-900 mt-2">{stats.totalPermissions}</div>
            <div className="text-[11px] text-amber-600 font-medium mt-0.5">Granular operations</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search roles by name, slug, or description..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Type:</span>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
            >
              <option value="ALL">All Types</option>
              <option value="SYSTEM">System Roles Only</option>
              <option value="CUSTOM">Custom Roles Only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Master-Detail Layout: Left Roles List, Right Details & Permission Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Roles Cards */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Configured Roles ({filteredRoles.length})
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {stats.system} System / {stats.custom} Custom
              </span>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 shadow-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#08275E]" />
                <span className="text-xs font-medium">Loading authoritative roles...</span>
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 shadow-xs">
                <Layers className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <span className="text-xs">No matching roles found.</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {filteredRoles.map((role) => {
                  const isSelected = selectedRole?.id === role.id;
                  const isSuperAdminRole = role.slug === 'super_admin';

                  return (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRole(role)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative ${
                        isSelected
                          ? 'bg-[#08275E] text-white border-[#08275E] shadow-md scale-[1.01]'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isSuperAdminRole ? (
                            <ShieldCheck
                              className={`w-4 h-4 shrink-0 ${
                                isSelected ? 'text-[#FFD21C]' : 'text-amber-500'
                              }`}
                            />
                          ) : role.isSystem ? (
                            <Lock
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'text-blue-300' : 'text-slate-400'
                              }`}
                            />
                          ) : (
                            <Layers
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'text-emerald-300' : 'text-emerald-600'
                              }`}
                            />
                          )}
                          <h3 className="font-bold text-sm leading-tight tracking-tight">
                            {role.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {role.isSystem ? (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              System
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                isSelected
                                  ? 'bg-emerald-400/20 text-emerald-200'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              Custom
                            </span>
                          )}

                          {!role.isActive && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isSelected ? 'bg-red-400/30 text-red-200' : 'bg-red-50 text-red-600'
                              }`}
                            >
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>

                      <p
                        className={`text-xs mt-1.5 line-clamp-2 ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {role.description || 'No description provided.'}
                      </p>

                      <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 opacity-70" />
                          <span>
                            {role._count?.users || 0}{' '}
                            {(role._count?.users || 0) === 1 ? 'Admin' : 'Admins'}
                          </span>
                        </div>
                        <span className="font-semibold font-mono">
                          {isSuperAdminRole
                            ? `${stats.totalPermissions} / ${stats.totalPermissions} (Full Bypass)`
                            : `${role._count?.permissions || 0} / ${stats.totalPermissions} Perms`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Selected Role Details & Permissions */}
          <div className="lg:col-span-8">
            {selectedRole ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Role Header Banner */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">
                          {selectedRole.name}
                        </h2>
                        <span className="font-mono text-xs text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                          {selectedRole.slug}
                        </span>
                        {selectedRole.isSystem ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            <Lock className="w-3 h-3" />
                            <span>Protected System Role</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Sparkles className="w-3 h-3" />
                            <span>Custom Dynamic Role</span>
                          </span>
                        )}
                        {!selectedRole.isActive && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            <span>Deactivated</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                        {selectedRole.description || 'No detailed description provided for this role.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => openAuditHistory(selectedRole)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer"
                        title="View role audit logs"
                      >
                        <History className="w-3.5 h-3.5 text-slate-500" />
                        <span>Audit Log</span>
                      </button>

                      {!selectedRole.isSystem && canManageRoles && (
                        <>
                          <button
                            onClick={() => {
                              setEditRole(selectedRole);
                              setEditName(selectedRole.name);
                              setEditDescription(selectedRole.description || '');
                              setEditIsActive(selectedRole.isActive);
                              setActionError(null);
                              setShowEditModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5 text-slate-500" />
                            <span>Edit Details</span>
                          </button>

                          {canAssignPermissions && (
                            <button
                              onClick={() => {
                                setPermRole(selectedRole);
                                const currentKeys =
                                  selectedRole.permissions?.map((p) => p.permission.key) || [];
                                setPermSelectedKeys(currentKeys);
                                setEditPermSearch('');
                                setActionError(null);
                                setShowPermissionsModal(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs transition cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-[#FFD21C]" />
                              <span>Edit Permissions</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setDeleteConfirmRole(selectedRole);
                              setActionError(null);
                            }}
                            className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Delete custom role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {selectedRole.slug === 'super_admin' && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                          <ShieldCheck className="w-4 h-4 text-amber-600" />
                          <span>Global Sovereignty Active</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Bar */}
                  <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-wrap items-center gap-6 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">Granted Privileges:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {selectedRole.slug === 'super_admin'
                          ? `${stats.totalPermissions} / ${stats.totalPermissions} (Full Super Admin Sovereign Bypass)`
                          : `${selectedRole._count?.permissions || 0} / ${stats.totalPermissions} Operational Privileges`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">Assigned Administrators:</span>
                      <span className="font-bold text-slate-900">
                        {selectedRole._count?.users || 0} Administrator(s)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">Role Status:</span>
                      {selectedRole.isActive ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="text-red-600 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Deactivated
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Categorized Permissions Grid */}
                <div className="p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Authoritative Permission Matrix ({allPermissions.length} total across 19 modules)
                      </h3>
                      {selectedRole.slug === 'super_admin' && (
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          Super Admin automatically bypasses all permission gates via PermissionsGuard & RolesGuard
                        </p>
                      )}
                    </div>

                    {/* Permission Search filter in matrix view */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={permMatrixSearch}
                        onChange={(e) => setPermMatrixSearch(e.target.value)}
                        placeholder="Filter privileges..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                      />
                      {permMatrixSearch && (
                        <button
                          onClick={() => setPermMatrixSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(permissionsByCategory)
                      .filter(([category, perms]) => {
                        if (!permMatrixSearch.trim()) return true;
                        const term = permMatrixSearch.toLowerCase();
                        return (
                          category.toLowerCase().includes(term) ||
                          perms.some(
                            (p) =>
                              p.displayName.toLowerCase().includes(term) ||
                              p.key.toLowerCase().includes(term),
                          )
                        );
                      })
                      .map(([category, perms]) => {
                        const assignedInCat = perms.filter((p) => {
                          if (selectedRole.slug === 'super_admin') return true;
                          return selectedRole.permissions?.some((rp) => rp.permission.key === p.key);
                        });

                        return (
                          <div
                            key={category}
                            className="rounded-2xl border border-slate-200 p-4 bg-slate-50/30"
                          >
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                {category.replace(/_/g, ' ')}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                  assignedInCat.length === perms.length
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : assignedInCat.length > 0
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-white text-slate-400 border-slate-200'
                                }`}
                              >
                                {assignedInCat.length} / {perms.length}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {perms.map((perm) => {
                                const isGranted =
                                  selectedRole.slug === 'super_admin' ||
                                  selectedRole.permissions?.some(
                                    (rp) => rp.permission.key === perm.key,
                                  );

                                return (
                                  <div
                                    key={perm.id}
                                    className={`flex items-start gap-2 text-xs py-1.5 px-2 rounded-xl transition-colors ${
                                      isGranted
                                        ? 'bg-emerald-50/80 text-emerald-900 font-medium'
                                        : 'text-slate-400 opacity-50 bg-white'
                                    }`}
                                  >
                                    {isGranted ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    ) : (
                                      <X className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="leading-tight font-medium text-slate-800">
                                        {perm.displayName}
                                      </div>
                                      <div className="text-[10px] font-mono opacity-70 truncate">
                                        {perm.key}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
                <KeyRound className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <span className="text-sm font-medium">Select a role to inspect permissions and configurations.</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Create Custom Role with 46 Permissions Checkbox Matrix */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#08275E] text-[#FFD21C] flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Create Custom Dynamic Role</h3>
                    <p className="text-xs text-slate-500">
                      Configure dynamic administrative privileges across {allPermissions.length} operations
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <form onSubmit={handleCreateRole} className="p-6 space-y-5 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Role Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={createName}
                      onChange={(e) => {
                        setCreateName(e.target.value);
                        if (!createSlug) {
                          setCreateSlug(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9]/g, '_')
                              .slice(0, 30),
                          );
                        }
                      }}
                      placeholder="e.g. Catalog Specialist"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#08275E] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Role Slug (Unique identifier) *
                    </label>
                    <input
                      type="text"
                      required
                      value={createSlug}
                      onChange={(e) =>
                        setCreateSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
                      }
                      placeholder="e.g. catalog_specialist"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-1 focus:ring-[#08275E] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role Description
                  </label>
                  <textarea
                    rows={2}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Describe operational responsibilities and privileges assigned to this role..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#08275E] focus:outline-none"
                  />
                </div>

                {/* Granular Permissions Checkbox Matrix */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-700">
                        Assign Granular Permissions ({createSelectedKeys.length} of {allPermissions.length} selected)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative w-48">
                        <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={createPermSearch}
                          onChange={(e) => setCreatePermSearch(e.target.value)}
                          placeholder="Search permissions..."
                          className="w-full pl-7 pr-2 py-1 text-[11px] rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setCreateSelectedKeys(allPermissions.map((p) => p.key))}
                        className="text-[11px] font-bold text-[#08275E] hover:underline cursor-pointer"
                      >
                        Select All ({allPermissions.length})
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setCreateSelectedKeys([])}
                        className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl p-4 max-h-72 overflow-y-auto space-y-4 bg-slate-50/50">
                    {Object.entries(permissionsByCategory)
                      .filter(([cat, perms]) => {
                        if (!createPermSearch.trim()) return true;
                        const term = createPermSearch.toLowerCase();
                        return (
                          cat.toLowerCase().includes(term) ||
                          perms.some(
                            (p) =>
                              p.displayName.toLowerCase().includes(term) ||
                              p.key.toLowerCase().includes(term),
                          )
                        );
                      })
                      .map(([category, perms]) => {
                        const allCatSelected = perms.every((p) =>
                          createSelectedKeys.includes(p.key),
                        );
                        const selectedInCat = perms.filter((p) =>
                          createSelectedKeys.includes(p.key),
                        );

                        return (
                          <div key={category} className="space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                {category.replace(/_/g, ' ')}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-slate-500">
                                  {selectedInCat.length}/{perms.length}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (allCatSelected) {
                                      setCreateSelectedKeys(
                                        createSelectedKeys.filter(
                                          (k) => !perms.some((p) => p.key === k),
                                        ),
                                      );
                                    } else {
                                      const keysToAdd = perms.map((p) => p.key);
                                      setCreateSelectedKeys(
                                        Array.from(new Set([...createSelectedKeys, ...keysToAdd])),
                                      );
                                    }
                                  }}
                                  className="text-[10px] font-bold text-[#08275E] hover:underline cursor-pointer"
                                >
                                  {allCatSelected ? 'Deselect Module' : 'Select Module'}
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {perms.map((p) => {
                                const isChecked = createSelectedKeys.includes(p.key);
                                return (
                                  <label
                                    key={p.key}
                                    className={`flex items-start gap-2.5 text-xs p-2.5 rounded-xl border cursor-pointer transition-colors ${
                                      isChecked
                                        ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setCreateSelectedKeys([...createSelectedKeys, p.key]);
                                        } else {
                                          setCreateSelectedKeys(
                                            createSelectedKeys.filter((k) => k !== p.key),
                                          );
                                        }
                                      }}
                                      className="rounded text-[#08275E] focus:ring-0 mt-0.5 cursor-pointer"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="leading-tight text-slate-900">{p.displayName}</div>
                                      <div className="text-[10px] font-mono text-slate-400 truncate">
                                        {p.key}
                                      </div>
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

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !createName.trim() || !createSlug.trim() || createSelectedKeys.length === 0}
                    className="px-5 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? 'Creating...' : `Create Role (${createSelectedKeys.length} Perms)`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Role Details */}
        {showEditModal && editRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Edit className="w-5 h-5 text-[#08275E]" />
                  <h3 className="font-black text-slate-900 text-base">Edit Role: {editRole.name}</h3>
                </div>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditRole(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <form onSubmit={handleUpdateRole} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#08275E] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role Slug (Protected Invariant)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editRole.slug}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Role slugs are permanent system identifiers and cannot be changed.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#08275E] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="rounded text-[#08275E] focus:ring-0 cursor-pointer"
                    />
                    <span>Role is Active</span>
                  </label>
                  <p className="text-[11px] text-slate-400 ml-5 mt-0.5">
                    Deactivated roles cannot be newly assigned to administrators.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditRole(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !editName.trim()}
                    className="px-5 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Role Permissions Checkbox Matrix */}
        {showPermissionsModal && permRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#08275E] text-[#FFD21C] flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      Edit Permissions: {permRole.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Synchronize granular privilege assignments for dynamic role
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setPermRole(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    {permSelectedKeys.length} of {allPermissions.length} Permissions Granted
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="relative w-48">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={editPermSearch}
                        onChange={(e) => setEditPermSearch(e.target.value)}
                        placeholder="Search permissions..."
                        className="w-full pl-7 pr-2 py-1 text-[11px] rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setPermSelectedKeys(allPermissions.map((p) => p.key))}
                      className="text-[11px] font-bold text-[#08275E] hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setPermSelectedKeys([])}
                      className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 space-y-4 bg-slate-50/50 max-h-96 overflow-y-auto">
                  {Object.entries(permissionsByCategory)
                    .filter(([cat, perms]) => {
                      if (!editPermSearch.trim()) return true;
                      const term = editPermSearch.toLowerCase();
                      return (
                        cat.toLowerCase().includes(term) ||
                        perms.some(
                          (p) =>
                            p.displayName.toLowerCase().includes(term) ||
                            p.key.toLowerCase().includes(term),
                        )
                      );
                    })
                    .map(([category, perms]) => {
                      const allCatSelected = perms.every((p) =>
                        permSelectedKeys.includes(p.key),
                      );
                      const selectedInCat = perms.filter((p) =>
                        permSelectedKeys.includes(p.key),
                      );

                      return (
                        <div key={category} className="space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                              {category.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-slate-500">
                                {selectedInCat.length}/{perms.length}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (allCatSelected) {
                                    setPermSelectedKeys(
                                      permSelectedKeys.filter((k) => !perms.some((p) => p.key === k)),
                                    );
                                  } else {
                                    const keysToAdd = perms.map((p) => p.key);
                                    setPermSelectedKeys(
                                      Array.from(new Set([...permSelectedKeys, ...keysToAdd])),
                                    );
                                  }
                                }}
                                className="text-[10px] font-bold text-[#08275E] hover:underline cursor-pointer"
                              >
                                {allCatSelected ? 'Deselect Module' : 'Select Module'}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {perms.map((p) => {
                              const isChecked = permSelectedKeys.includes(p.key);
                              return (
                                <label
                                  key={p.key}
                                  className={`flex items-start gap-2.5 text-xs p-2.5 rounded-xl border cursor-pointer transition-colors ${
                                    isChecked
                                      ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setPermSelectedKeys([...permSelectedKeys, p.key]);
                                      } else {
                                        setPermSelectedKeys(
                                          permSelectedKeys.filter((k) => k !== p.key),
                                        );
                                      }
                                    }}
                                    className="rounded text-[#08275E] focus:ring-0 mt-0.5 cursor-pointer"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="leading-tight text-slate-900">{p.displayName}</div>
                                    <div className="text-[10px] font-mono text-slate-400 truncate">
                                      {p.key}
                                    </div>
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

              <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setPermRole(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Saving...' : `Save Permissions (${permSelectedKeys.length} Selected)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Delete Custom Role Confirmation Dialog */}
        {deleteConfirmRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Delete Custom Role</h3>
                  <p className="text-xs text-slate-500">Permanent role removal</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete custom role{' '}
                <strong className="text-slate-900 font-semibold">"{deleteConfirmRole.name}"</strong>?
              </p>

              {(deleteConfirmRole._count?.users || 0) > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Action Blocked</span>
                  </div>
                  <p className="text-[11px]">
                    This role currently has{' '}
                    <strong>{deleteConfirmRole._count?.users} administrator(s)</strong> assigned. You must
                    reassign or quarantine those administrators before deleting this role.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  This action cannot be undone. All role configurations and permission mappings will be permanently removed.
                </div>
              )}

              {actionError && (
                <div className="p-2.5 bg-red-100 text-red-800 rounded-xl text-xs font-medium">
                  {actionError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmRole(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || (deleteConfirmRole._count?.users || 0) > 0}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Deleting...' : 'Delete Role Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Role Audit History Log */}
        {auditRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#08275E] text-[#FFD21C] flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      Audit History: {auditRole.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">{auditRole.slug}</p>
                  </div>
                </div>
                <button
                  onClick={() => setAuditRole(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {loadingAudit ? (
                  <div className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#08275E]" />
                    <span className="text-xs">Loading role audit history...</span>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <span className="text-xs">No audit logs recorded for this role yet.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log: any) => (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {log.action}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {log.actor && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <span className="font-semibold text-slate-700">Actor:</span>
                            <span>{log.actor.email}</span>
                            {log.actor.name && <span>({log.actor.name})</span>}
                          </div>
                        )}

                        {log.description && (
                          <div className="text-slate-600 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium leading-relaxed">
                            {log.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
                <button
                  type="button"
                  onClick={() => setAuditRole(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-300 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Super Admin Typed Confirmation Modal */}
        <SensitiveActionConfirmationModal
          isOpen={showStepUpModal}
          onClose={() => setShowStepUpModal(false)}
          actionTitle={`Update Role Permissions for "${pendingSaveRole?.name || 'Role'}"`}
          actionDescription="Assigning or revoking system privileges across administrative security boundaries"
          targetResourceType="Role"
          targetResourceName={pendingSaveRole?.name}
          expectedConfirmationPhrase="UPDATE ROLE PERMISSIONS"
          confirmButtonLabel="Confirm & Save Permissions"
          impactWarning="Modifying permissions will instantly alter access controls for all administrators assigned to this role."
          onConfirmed={async (phrase) => {
            await executeSavePermissions(phrase);
          }}
        />
      </div>
    </AdminPageAccess>
  );
}
