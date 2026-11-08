'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { rolesService, DynamicRole, Permission } from '@/services/rolesService';
import { useUserStore } from '@/services/userStore';

export default function RolesManagementPage() {
  const currentUser = useUserStore((state) => state.currentUser);

  const [roles, setRoles] = useState<DynamicRole[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<DynamicRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  // Form states: Create role
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createSelectedKeys, setCreateSelectedKeys] = useState<string[]>([]);

  // Form states: Edit role
  const [editRole, setEditRole] = useState<DynamicRole | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Permissions edit states
  const [permRole, setPermRole] = useState<DynamicRole | null>(null);
  const [permSelectedKeys, setPermSelectedKeys] = useState<string[]>([]);

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

      if (rolesList.length > 0 && !selectedRole) {
        setSelectedRole(rolesList[0]);
      } else if (selectedRole) {
        const updated = rolesList.find((r) => r.id === selectedRole.id);
        if (updated) setSelectedRole(updated);
      }
    } catch (err: any) {
      console.error('Failed to load roles and permissions:', err);
      setError(err?.message || 'Unable to connect to roles and permissions service.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group permissions by category
  const permissionsByCategory = allPermissions.reduce((acc, perm) => {
    const cat = perm.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Handle Create Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createSlug.trim()) {
      alert('Role name and slug are required');
      return;
    }

    setActionLoading(true);
    try {
      const res = await rolesService.createRole({
        name: createName.trim(),
        slug: createSlug.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        description: createDescription.trim() || undefined,
        permissionKeys: createSelectedKeys,
      });

      showNotification(res.message);
      setShowCreateModal(false);
      setCreateName('');
      setCreateSlug('');
      setCreateDescription('');
      setCreateSelectedKeys([]);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create custom role');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit Role
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRole) return;

    setActionLoading(true);
    try {
      const res = await rolesService.updateRole(editRole.id, {
        name: editName.trim() || undefined,
        description: editDescription.trim() || undefined,
        isActive: editIsActive,
      });

      showNotification(res.message);
      setShowEditModal(false);
      setEditRole(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Role
  const handleDeleteRole = async (role: DynamicRole) => {
    if (role.isSystem) {
      alert('System roles are protected and cannot be deleted.');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete custom role "${role.name}"? This cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await rolesService.deleteRole(role.id);
      showNotification(res.message);
      if (selectedRole?.id === role.id) {
        setSelectedRole(roles.find((r) => r.id !== role.id) || null);
      }
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete role');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Save Permissions
  const handleSavePermissions = async () => {
    if (!permRole) return;

    setActionLoading(true);
    try {
      const res = await rolesService.assignPermissions(permRole.id, permSelectedKeys);
      showNotification(res.message);
      setShowPermissionsModal(false);
      setPermRole(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update role permissions');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-[#08275E] text-[#FFD21C] flex items-center justify-center shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Roles & Granular Permissions
              </h1>
              <p className="text-xs text-slate-500">
                Authoritative RBAC matrix: 38 operational permissions across 15 categories with advisory mutex synchronization
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setCreateName('');
              setCreateSlug('');
              setCreateDescription('');
              setCreateSelectedKeys([]);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-[#08275E] hover:bg-[#103b8c] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FFD21C]" />
            <span>Create Custom Role</span>
          </button>
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh roles"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs flex items-center justify-between shadow-2xs">
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

      {/* Main Grid: Left Roles List, Right Role Details & Permission Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Roles Cards */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Configured Roles ({roles.length})
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              5 System / {Math.max(0, roles.length - 5)} Custom
            </span>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#08275E]" />
              <span className="text-xs">Loading roles...</span>
            </div>
          ) : error ? (
            <div className="bg-white rounded-3xl border border-red-200 p-6 text-center text-red-500">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <span className="text-xs">{error}</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {roles.map((role) => {
                const isSelected = selectedRole?.id === role.id;
                const isSuperAdmin = role.slug === 'super_admin';

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
                        {isSuperAdmin ? (
                          <ShieldCheck
                            className={`w-4 h-4 ${
                              isSelected ? 'text-[#FFD21C]' : 'text-amber-500'
                            }`}
                          />
                        ) : role.isSystem ? (
                          <Lock
                            className={`w-3.5 h-3.5 ${
                              isSelected ? 'text-blue-300' : 'text-slate-400'
                            }`}
                          />
                        ) : (
                          <Layers
                            className={`w-3.5 h-3.5 ${
                              isSelected ? 'text-emerald-300' : 'text-emerald-600'
                            }`}
                          />
                        )}
                        <h3 className="font-bold text-sm leading-tight tracking-tight">
                          {role.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5">
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
                          {(role._count?.users || 0) === 1 ? 'Administrator' : 'Administrators'}
                        </span>
                      </div>
                      <span className="font-semibold font-mono">
                        {isSuperAdmin ? '38 / 38 (Full Bypass)' : `${role._count?.permissions || 0} / 38 Perms`}
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
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        {selectedRole.name}
                      </h2>
                      <span className="font-mono text-xs text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-md">
                        {selectedRole.slug}
                      </span>
                      {selectedRole.isSystem ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <Lock className="w-3 h-3" />
                          <span>Protected System Role</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span>Custom Dynamic Role</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                      {selectedRole.description || 'No detailed description provided for this role.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!selectedRole.isSystem && (
                      <>
                        <button
                          onClick={() => {
                            setEditRole(selectedRole);
                            setEditName(selectedRole.name);
                            setEditDescription(selectedRole.description || '');
                            setEditIsActive(selectedRole.isActive);
                            setShowEditModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => {
                            setPermRole(selectedRole);
                            const currentKeys =
                              selectedRole.permissions?.map((p) => p.permission.key) || [];
                            setPermSelectedKeys(currentKeys);
                            setShowPermissionsModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[#FFD21C]" />
                          <span>Edit Permissions</span>
                        </button>

                        <button
                          onClick={() => handleDeleteRole(selectedRole)}
                          className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete custom role"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {selectedRole.slug === 'super_admin' && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                        <span>Protected Mutex Invariant Active</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status bar */}
                <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-wrap items-center gap-6 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">Granted Permissions:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedRole.slug === 'super_admin'
                        ? '38 / 38 (Full Super Admin Access)'
                        : `${selectedRole._count?.permissions || 0} / 38 Operational Privileges`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">Assigned Users:</span>
                    <span className="font-bold text-slate-900">
                      {selectedRole._count?.users || 0} Active Administrators
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">Status:</span>
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
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Authoritative Permission Matrix ({allPermissions.length} total)
                  </h3>
                  {selectedRole.slug === 'super_admin' && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-semibold border border-amber-200">
                      Super Admin automatically bypasses all permissions via PermissionsGuard
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => {
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
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
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
                                className={`flex items-start gap-2 text-xs py-1 px-1.5 rounded-lg transition-colors ${
                                  isGranted
                                    ? 'bg-emerald-50/80 text-emerald-900 font-medium'
                                    : 'text-slate-400 opacity-60'
                                }`}
                              >
                                {isGranted ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                  <X className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <div className="leading-tight">{perm.displayName}</div>
                                  <div className="text-[10px] font-mono opacity-70">
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
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
              <KeyRound className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <span>Select a role to inspect permissions and configurations.</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Custom Role */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#08275E] text-[#FFD21C] flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Create Custom Dynamic Role</h3>
                  <p className="text-xs text-slate-500">Define dynamic administrative role with granular permissions</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="p-6 space-y-4 overflow-y-auto flex-1">
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
                    placeholder="e.g. Content Editor"
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
                    onChange={(e) => setCreateSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    placeholder="e.g. content_editor"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-1 focus:ring-[#08275E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Responsibilities and purpose of this dynamic role..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#08275E] focus:outline-none"
                />
              </div>

              {/* Permissions Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Assign Permissions ({createSelectedKeys.length} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateSelectedKeys(allPermissions.map((p) => p.key))}
                      className="text-[11px] font-bold text-[#08275E] hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setCreateSelectedKeys([])}
                      className="text-[11px] font-bold text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl p-3 max-h-60 overflow-y-auto space-y-3 bg-slate-50/50">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category} className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {category.replace(/_/g, ' ')}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {perms.map((p) => {
                          const isChecked = createSelectedKeys.includes(p.key);
                          return (
                            <label
                              key={p.key}
                              className={`flex items-center gap-2 text-xs p-2 rounded-xl border cursor-pointer transition-colors ${
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
                                className="rounded text-[#08275E] focus:ring-0"
                              />
                              <div className="truncate">
                                <div>{p.displayName}</div>
                                <div className="text-[9px] font-mono text-slate-400">{p.key}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Custom Role Details */}
      {showEditModal && editRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-black text-slate-900 text-base">Edit Role: {editRole.name}</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditRole(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRole} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Role Display Name
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
                    className="rounded text-[#08275E] focus:ring-0"
                  />
                  <span>Active Role Status</span>
                </label>
                <p className="text-[11px] text-slate-400 ml-5 mt-0.5">
                  Deactivated roles cannot be assigned to administrators.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditRole(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Role Permissions */}
      {showPermissionsModal && permRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
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
                    Select permissions to assign to this custom dynamic role
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPermissionsModal(false);
                  setPermRole(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  {permSelectedKeys.length} of {allPermissions.length} Permissions Selected
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPermSelectedKeys(allPermissions.map((p) => p.key))}
                    className="text-[11px] font-bold text-[#08275E] hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setPermSelectedKeys([])}
                    className="text-[11px] font-bold text-slate-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 space-y-4 bg-slate-50/50">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category} className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {category.replace(/_/g, ' ')}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {perms.map((p) => {
                        const isChecked = permSelectedKeys.includes(p.key);
                        return (
                          <label
                            key={p.key}
                            className={`flex items-center gap-2 text-xs p-2 rounded-xl border cursor-pointer transition-colors ${
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
                              className="rounded text-[#08275E] focus:ring-0"
                            />
                            <div className="truncate">
                              <div>{p.displayName}</div>
                              <div className="text-[9px] font-mono text-slate-400">{p.key}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setShowPermissionsModal(false);
                  setPermRole(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

