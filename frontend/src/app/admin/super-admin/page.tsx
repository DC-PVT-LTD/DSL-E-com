'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  KeyRound,
  Users,
  Layers,
  FileText,
  Download,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Eye,
  Sliders,
  Database,
  Calendar,
  X,
  Code,
  UserCheck,
  UserX,
  ExternalLink,
} from 'lucide-react';
import { useUserStore } from '@/services/userStore';
import {
  securityService,
  AdminActivityItem,
} from '@/services/securityService';
import { rolesService, DynamicRole, Permission } from '@/services/rolesService';
import { adminUserService, AdminUser } from '@/services/adminUserService';
import { auditService } from '@/services/auditService';
import { AuditSummaryResponse } from '@/types/audit';

type SuperAdminTab =
  | 'OVERVIEW'
  | 'ADMINS'
  | 'ROLES'
  | 'PERMISSIONS'
  | 'ACTIVITIES'
  | 'REPORTS'
  | 'SETTINGS';

export default function SuperAdminControlCenterPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const roleSlug = useUserStore((state) => state.roleSlug);
  const isSuperAdmin = roleSlug === 'super_admin' || currentUser?.roleSlug === 'super_admin';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('OVERVIEW');

  // Overview metrics
  const [adminCount, setAdminCount] = useState<number>(0);
  const [roleCount, setRoleCount] = useState<number>(0);
  const [permCount, setPermCount] = useState<number>(51);
  const [activityCount, setActivityCount] = useState<number>(0);
  const [auditSummary, setAuditSummary] = useState<AuditSummaryResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Tab 2: Admins
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminsLoading, setAdminsLoading] = useState(false);

  // Tab 3: Roles
  const [rolesList, setRolesList] = useState<DynamicRole[]>([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [rolesLoading, setRolesLoading] = useState(false);

  // Tab 4: Permissions
  const [permsList, setPermsList] = useState<Permission[]>([]);
  const [permCategoryFilter, setPermCategoryFilter] = useState('ALL');
  const [permSearch, setPermSearch] = useState('');
  const [permsLoading, setPermsLoading] = useState(false);

  // Tab 5: Activities
  const [activities, setActivities] = useState<AdminActivityItem[]>([]);
  const [activitySearch, setActivitySearch] = useState<string>('');
  const [activityStatus, setActivityStatus] = useState<string>('ALL');
  const [activityAction, setActivityAction] = useState<string>('');
  const [activityLoading, setActivityLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<AdminActivityItem | null>(null);

  // Tab 6: Reports
  const [isExporting, setIsExporting] = useState(false);

  // Load Overview Metrics
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const [adminsRes, rolesRes, permsRes, activitiesRes, summaryRes] = await Promise.all([
        adminUserService.getAdminUsers({ limit: 1 }).catch(() => null),
        rolesService.getRoles().catch(() => null),
        rolesService.getPermissions().catch(() => null),
        securityService.getAdminActivities({ limit: 1 }).catch(() => null),
        auditService.fetchAuditSummary().catch(() => null),
      ]);

      if (adminsRes?.meta) setAdminCount(adminsRes.meta.total || 0);
      if (rolesRes?.data) setRoleCount(rolesRes.data.length || 0);
      if (permsRes?.data) setPermCount(permsRes.data.length || 51);
      if (activitiesRes?.meta) setActivityCount(activitiesRes.meta.totalItems || 0);
      if (summaryRes) setAuditSummary(summaryRes);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // Load Admins for Tab 2
  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const res = await adminUserService.getAdminUsers({ limit: 50 });
      setAdminsList(res.data || []);
    } catch (err) {
      console.error('Failed to load admins:', err);
    } finally {
      setAdminsLoading(false);
    }
  }, []);

  // Load Roles for Tab 3
  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const res = await rolesService.getRoles();
      setRolesList(res.data || []);
    } catch (err) {
      console.error('Failed to load roles:', err);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  // Load Permissions for Tab 4
  const loadPermissions = useCallback(async () => {
    setPermsLoading(true);
    try {
      const res = await rolesService.getPermissions();
      setPermsList(res.data || []);
    } catch (err) {
      console.error('Failed to load permissions:', err);
    } finally {
      setPermsLoading(false);
    }
  }, []);

  // Load Activities for Tab 5
  const loadActivities = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await securityService.getAdminActivities({
        status: activityStatus !== 'ALL' ? activityStatus : undefined,
        search: activitySearch.trim() || undefined,
        action: activityAction.trim() || undefined,
        limit: 50,
      });
      setActivities(res.data);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setActivityLoading(false);
    }
  }, [activityStatus, activitySearch, activityAction]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadOverview();
    }
  }, [isSuperAdmin, loadOverview]);

  useEffect(() => {
    if (isSuperAdmin) {
      if (activeTab === 'ADMINS') loadAdmins();
      if (activeTab === 'ROLES') loadRoles();
      if (activeTab === 'PERMISSIONS') loadPermissions();
      if (activeTab === 'ACTIVITIES') loadActivities();
      if (activeTab === 'REPORTS') loadOverview();
    }
  }, [isSuperAdmin, activeTab, loadAdmins, loadRoles, loadPermissions, loadActivities, loadOverview]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await securityService.downloadActivitiesCsv();
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Restricted Root Governance Area</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          The Super Admin Control Center provides root sovereignty and audit inspection over the entire platform. Your current role does not possess Super Admin credentials.
        </p>
        <div className="mt-6">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            SUCCESS
          </span>
        );
      case 'FAILED':
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const filteredAdmins = adminsList.filter(
    (a) =>
      a.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
      a.email.toLowerCase().includes(adminSearch.toLowerCase()) ||
      (a.role && a.role.toLowerCase().includes(adminSearch.toLowerCase()))
  );

  const filteredRoles = rolesList.filter(
    (r) =>
      r.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
      r.slug.toLowerCase().includes(roleSearch.toLowerCase())
  );

  const permCategories = Array.from(new Set(permsList.map((p) => p.category))).sort();
  const filteredPerms = permsList.filter((p) => {
    const matchesCat = permCategoryFilter === 'ALL' || p.category === permCategoryFilter;
    const matchesSearch =
      p.key.toLowerCase().includes(permSearch.toLowerCase()) ||
      (p.displayName && p.displayName.toLowerCase().includes(permSearch.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(permSearch.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Root Governance & Control
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Super Admin Control Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Centralized administrative security, typed confirmation enforcement, granular 51-permission management matrix, and private administrative activity tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/roles"
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 backdrop-blur-xs"
            >
              <KeyRound className="w-4 h-4 text-amber-300" />
              <span>Permission Matrix</span>
            </Link>
            <Link
              href="/admin/admins"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              <Users className="w-4 h-4" />
              <span>Admin Accounts</span>
            </Link>
          </div>
        </div>

        {/* 7 Section Navigation Tabs */}
        <div className="flex items-center gap-2 mt-8 border-t border-white/10 pt-4 overflow-x-auto">
          {[
            { id: 'OVERVIEW', label: '1. Security Overview' },
            { id: 'ADMINS', label: '2. Administrator Management' },
            { id: 'ROLES', label: '3. Role Management' },
            { id: 'PERMISSIONS', label: '4. Permission Management' },
            { id: 'ACTIVITIES', label: '5. Admin Activity Logs' },
            { id: 'REPORTS', label: '6. Audit Reports' },
            { id: 'SETTINGS', label: '7. Security Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SuperAdminTab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: SECURITY OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Admins
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900">
                  {overviewLoading ? '...' : adminCount}
                </span>
                <span className="text-xs text-slate-400 block mt-1">Active platform accounts</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  System Roles
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900">
                  {overviewLoading ? '...' : roleCount}
                </span>
                <span className="text-xs text-slate-400 block mt-1">Configured dynamic roles</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Authoritative Perms
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900">{permCount}</span>
                <span className="text-xs text-emerald-600 font-bold block mt-1">Across 11 system modules</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Activity Audit Trail
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900">
                  {overviewLoading ? '...' : activityCount}
                </span>
                <span className="text-xs text-slate-400 block mt-1">Recorded administrative mutations</span>
              </div>
            </div>
          </div>

          {/* Quick Module Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Administrator Management</h3>
                  <p className="text-xs text-slate-500">Manage accounts, profile details, and role assignments</p>
                </div>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('ADMINS')}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Quick View
                </button>
                <Link
                  href="/admin/admins"
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                >
                  <span>Full Console</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Role & Permission Matrix</h3>
                  <p className="text-xs text-slate-500">Manage roles and 51 system permissions with typed confirmation</p>
                </div>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('PERMISSIONS')}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Quick View
                </button>
                <Link
                  href="/admin/roles"
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                >
                  <span>Matrix Page</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Typed Confirmation Rules</h3>
                  <p className="text-xs text-slate-500">GitHub-style exact typed phrases protecting destructive operations</p>
                </div>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('SETTINGS')}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  View Policies
                </button>
                <button
                  onClick={handleExportCsv}
                  disabled={isExporting}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>{isExporting ? 'Exporting...' : 'Export Audit CSV'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADMINISTRATOR MANAGEMENT */}
      {activeTab === 'ADMINS' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">Administrator Accounts Overview</h3>
                <p className="text-xs text-slate-500">
                  Inspect administrators, active roles, and security statuses
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search administrators..."
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:bg-white"
                  />
                </div>
                <Link
                  href="/admin/admins"
                  className="px-4 py-2 bg-[#08275E] text-white rounded-xl text-xs font-bold hover:bg-[#0c3785] transition flex items-center gap-1.5"
                >
                  <span>Open Full Admin Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Administrator</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Joined Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminsLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        <span>Loading administrators...</span>
                      </td>
                    </tr>
                  ) : filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No administrators found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAdmins.map((admin) => (
                      <tr key={admin.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{admin.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{admin.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            {admin.assignedRole?.name || admin.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {admin.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3" />
                              Deactivated
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(admin.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href="/admin/admins"
                            className="text-[#0066CC] font-bold hover:underline"
                          >
                            Manage Account
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ROLE MANAGEMENT */}
      {activeTab === 'ROLES' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">Configured System & Custom Roles</h3>
                <p className="text-xs text-slate-500">
                  Inspect assigned permission counts and user memberships per role
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search roles..."
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:bg-white"
                  />
                </div>
                <Link
                  href="/admin/roles"
                  className="px-4 py-2 bg-[#08275E] text-white rounded-xl text-xs font-bold hover:bg-[#0c3785] transition flex items-center gap-1.5"
                >
                  <span>Open Full Roles Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rolesLoading ? (
                <div className="col-span-full py-12 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                  <span>Loading dynamic roles...</span>
                </div>
              ) : filteredRoles.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400">
                  No roles match the filter.
                </div>
              ) : (
                filteredRoles.map((role) => (
                  <div
                    key={role.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-slate-900">{role.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          role.isSystem
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {role.isSystem ? 'System' : 'Custom'}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">{role.slug}</div>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {role.description || 'No description provided.'}
                    </p>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold">
                        {role.permissions?.length ?? 0} Permissions
                      </span>
                      <Link
                        href="/admin/roles"
                        className="text-[#0066CC] font-bold hover:underline flex items-center gap-1"
                      >
                        <span>Edit Matrix</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PERMISSION MANAGEMENT */}
      {activeTab === 'PERMISSIONS' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  Authoritative Permission Catalog (51 Authoritative Permissions)
                </h3>
                <p className="text-xs text-slate-500">
                  Inspect all system permissions across 11 architectural modules
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={permCategoryFilter}
                  onChange={(e) => setPermCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                >
                  <option value="ALL">All Modules</option>
                  {permCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.toUpperCase()}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                  />
                </div>
                <Link
                  href="/admin/roles"
                  className="px-4 py-2 bg-[#08275E] text-white rounded-xl text-xs font-bold hover:bg-[#0c3785] transition flex items-center gap-1.5"
                >
                  <span>Open Interactive Matrix</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Permission Key</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Display Name</th>
                    <th className="py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {permsLoading ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        <span>Loading authoritative permissions...</span>
                      </td>
                    </tr>
                  ) : filteredPerms.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No permissions match the filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPerms.map((p) => {
                      const isFinancial =
                        p.key.startsWith('orders.fulfill') ||
                        p.key.startsWith('orders.cancel') ||
                        p.key.startsWith('payments.verify') ||
                        p.key.startsWith('orders.refund') ||
                        p.key.startsWith('settings.financial');
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {p.key}
                            </span>
                            {isFinancial && (
                              <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                Financial
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 uppercase font-bold text-[10px] text-slate-600">
                            {p.category}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {p.displayName || p.key}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {p.description || '—'}
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

      {/* TAB 5: ADMIN ACTIVITY LOGS */}
      {activeTab === 'ACTIVITIES' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">Private Administrator Activity Trail</h3>
                <p className="text-xs text-slate-500">
                  Immutable records of administrative mutations with before/after state diffs
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCsv}
                  disabled={isExporting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Exporting...' : 'Export Audit CSV'}</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by admin email, action, description..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none"
                />
              </div>

              <select
                value={activityStatus}
                onChange={(e) => setActivityStatus(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILED">Failed / Blocked</option>
              </select>

              <button
                onClick={loadActivities}
                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="Refresh logs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Activities Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Administrator</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">State Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activityLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        <span>Loading activity logs...</span>
                      </td>
                    </tr>
                  ) : activities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No administrator activity logs found.
                      </td>
                    </tr>
                  ) : (
                    activities.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {item.action}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.userName || 'Admin'}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{item.userEmail || '—'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-700">{item.entityType}</span>
                          {item.entityId && (
                            <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[120px]">
                              {item.entityId}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                        <td className="py-3 px-4 text-right">
                          {item.beforeState || item.afterState ? (
                            <button
                              onClick={() => setSelectedActivity(item)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              <Code className="w-3 h-3" />
                              <span>Inspect Diff</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT REPORTS */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">Comprehensive Audit Reports & Analytics</h3>
                <p className="text-xs text-slate-500">
                  Statistical metrics and compliance exports across all platform audit stores
                </p>
              </div>
              <button
                onClick={handleExportCsv}
                disabled={isExporting}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Exporting...' : 'Export RFC 4180 CSV'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                  Total Platform Events
                </span>
                <span className="text-2xl font-black text-slate-900 block mt-2">
                  {auditSummary?.totalEvents ?? '...'}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                  General System Events
                </span>
                <span className="text-2xl font-black text-slate-900 block mt-2">
                  {auditSummary?.generalAuditEvents ?? '...'}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                  Order Lifecycle Events
                </span>
                <span className="text-2xl font-black text-slate-900 block mt-2">
                  {auditSummary?.orderAuditEvents ?? '...'}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                  Events Today (SL Time)
                </span>
                <span className="text-2xl font-black text-indigo-600 block mt-2">
                  {auditSummary?.todayEvents ?? '...'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Compliance reports are compiled directly from PostgreSQL using immutable append-only logs.
              </p>
              <Link
                href="/admin/audit-logs"
                className="text-xs font-bold text-[#0066CC] hover:underline flex items-center gap-1"
              >
                <span>Open Full Audit Log Search</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SECURITY SETTINGS & POLICIES */}
      {activeTab === 'SETTINGS' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
            <div>
              <h3 className="font-black text-slate-900 text-base">Platform Security Policies & Enforcement</h3>
              <p className="text-xs text-slate-500">
                Active security guardrails, typed confirmation rules, and authorization boundaries
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-black text-sm text-slate-900">GitHub-Style Typed Confirmation</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Before a destructive or high-impact administrative action is executed, the administrator must type an exact confirmation phrase into the confirmation dialog. The backend validates the phrase and rejects any empty, generic, or mismatched values.
                </p>
                <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Update Role Permissions</span>
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      UPDATE ROLE PERMISSIONS
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Change Admin Role</span>
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      CHANGE ADMIN ROLE
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Deactivate Administrator</span>
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      admin.email@dsl.lk
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Modify Financial Settings</span>
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      CONFIRM FINANCIAL SETTINGS
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Approve Bank Slip</span>
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      APPROVE BANK DEPOSIT
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-black text-sm text-slate-900">Sensitive Data Privacy & Masking</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Confidential corporate banking details and payout account numbers are bullet-masked (<span className="font-mono font-bold">••••••••8239</span>) on all administrative endpoints unless the authenticated user holds the <span className="font-mono font-bold text-indigo-700">settings.financial</span> permission or is the verified <span className="font-mono font-bold text-indigo-700">super_admin</span>.
                </p>
                <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Masking Format</span>
                    <span className="font-mono font-bold text-slate-800">•••••••• + Last 4 Digits</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Enforcement Point</span>
                    <span className="font-bold text-emerald-700">PostgreSQL Service Layer</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Audit Redaction</span>
                    <span className="font-bold text-emerald-700">Passwords, Hashes, Cards</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Confirmation Logging</span>
                    <span className="font-bold text-emerald-700">Never Persisted</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE DIFF INSPECTION MODAL */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  Activity State Diff — {selectedActivity.action}
                </h3>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Administrator:</span>
                  <span className="text-slate-900 font-bold">{selectedActivity.userName || 'Admin'}</span>
                  <span className="text-slate-500 font-mono block text-[11px]">{selectedActivity.userEmail}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Target Entity:</span>
                  <span className="text-slate-900 font-bold">{selectedActivity.entityType}</span>
                  <span className="text-slate-500 font-mono block text-[11px] truncate">{selectedActivity.entityId || 'N/A'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Prior State (Before)
                  </span>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 leading-relaxed">
                    {selectedActivity.beforeState
                      ? JSON.stringify(selectedActivity.beforeState, null, 2)
                      : '// No prior state recorded'}
                  </pre>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Updated State (After)
                  </span>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 leading-relaxed">
                    {selectedActivity.afterState
                      ? JSON.stringify(selectedActivity.afterState, null, 2)
                      : '// No updated state recorded'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedActivity(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
