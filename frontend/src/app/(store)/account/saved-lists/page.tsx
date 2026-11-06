'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  Package,
  ArrowRight,
} from 'lucide-react';
import { AccountNav } from '@/components/common/AccountNav';
import { useUserStore } from '@/services/userStore';
import { useSavedListStore } from '@/services/savedListStore';
import { formatLKR } from '@/lib/currency';

export default function AccountSavedListsPage() {
  const router = useRouter();
  const currentUser = useUserStore((state) => state.currentUser);
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);
  const { lists, isLoading, fetchLists, deleteList, createList } = useSavedListStore();

  const [isChecking, setIsChecking] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await fetchCurrentUser();
        await fetchLists();
      } catch {
      } finally {
        if (mounted) setIsChecking(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [fetchCurrentUser, fetchLists]);

  useEffect(() => {
    if (!isChecking && !currentUser) {
      router.push('/login?redirect=/account/saved-lists');
    }
  }, [isChecking, currentUser, router]);

  if (isChecking || !currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
        <p className="mt-3 text-xs text-[#292525]/60 font-medium">Loading saved lists...</p>
      </div>
    );
  }

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) {
      setCreateError('Please enter a list name');
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);
    const created = await createList(newListName.trim());
    setIsSubmitting(false);

    if (created) {
      setNewListName('');
      setIsCreateOpen(false);
      router.push(`/saved-lists/${created.id}`);
    } else {
      setCreateError('Could not create list. Please try again.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    await deleteList(id);
  };

  return (
    <div className="bg-[#FFFDF0] min-h-screen py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292525]">
              Saved Stationery Lists
            </h1>
            <p className="text-xs sm:text-sm text-[#292525]/60 mt-1">
              Manage custom stationery booklists for school terms, grade levels, or office replenishment.
            </p>
          </div>
          <button
            onClick={() => {
              setCreateError(null);
              setNewListName('');
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] shadow-md transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create List</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <AccountNav />
          </div>

          <div className="lg:col-span-3 space-y-5">
            {isLoading && lists.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#0066CC] mx-auto mb-2" />
                <p className="text-xs text-[#292525]/60">Loading lists...</p>
              </div>
            ) : lists.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center text-xs text-[#292525]/60 shadow-xs">
                <Bookmark className="w-10 h-10 text-[#0066CC]/30 mx-auto mb-3" />
                <h3 className="font-bold text-[#292525] text-base">No saved lists yet</h3>
                <p className="mt-1 max-w-sm mx-auto">
                  Create custom stationery lists to quickly organize and replenish supplies whenever needed.
                </p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First List</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lists.map((list) => (
                  <div
                    key={list.id}
                    className="bg-white rounded-3xl border border-[#C6E7FF]/60 hover:border-[#0066CC] p-5 space-y-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/saved-lists/${list.id}`}
                          className="font-bold text-sm text-[#292525] hover:text-[#0066CC] transition-colors"
                        >
                          {list.name}
                        </Link>
                        <button
                          onClick={() => handleDelete(list.id, list.name)}
                          className="text-[#292525]/30 hover:text-rose-600 p-1 transition-colors"
                          title="Delete list"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-semibold text-[#292525]/60 mt-1">
                        <span className="bg-[#FAF7EE] border border-[#C6E7FF]/50 px-2 py-0.5 rounded-full text-[#0066CC] font-bold">
                          {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
                        </span>
                        <span>•</span>
                        <span className="font-bold text-[#292525]">
                          {list.estimatedTotalCents > 0
                            ? `Est. ${formatLKR(list.estimatedTotalCents)}`
                            : 'Empty'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#C6E7FF]/30 flex items-center justify-between">
                      <span className="text-[10px] text-[#292525]/40 font-medium">
                        Updated {new Date(list.updatedAt).toLocaleDateString()}
                      </span>
                      <Link
                        href={`/saved-lists/${list.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#0066CC] hover:underline"
                      >
                        <span>Manage Items</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal: Create List */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#C6E7FF]/60">
              <h3 className="font-bold text-base text-[#292525] mb-2">Create New List</h3>
              <form onSubmit={handleCreateList} className="space-y-4">
                <input
                  type="text"
                  placeholder="e.g. Grade 7 Booklist 2026"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-[#C6E7FF] focus:outline-hidden focus:border-[#0066CC] bg-[#FFFDF0]"
                  autoFocus
                />
                {createError && (
                  <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                    {createError}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-[#292525]/70 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 shadow-md transition-all flex items-center gap-1.5"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Create List</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
