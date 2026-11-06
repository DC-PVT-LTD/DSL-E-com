'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Loader2,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Package,
} from 'lucide-react';
import { useSavedListStore } from '@/services/savedListStore';
import { useUserStore } from '@/services/userStore';
import { formatLKR } from '@/lib/currency';

export default function SavedListsPage() {
  const router = useRouter();
  const currentUser = useUserStore((state) => state.currentUser);
  const { lists, isLoading, error, fetchLists, createList, renameList, deleteList } =
    useSavedListStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rename state
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [updatedName, setUpdatedName] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      fetchLists();
    }
  }, [currentUser, fetchLists]);

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

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !updatedName.trim()) return;

    setIsSubmitting(true);
    const success = await renameList(renameTarget.id, updatedName.trim());
    setIsSubmitting(false);

    if (success) {
      setRenameTarget(null);
      setUpdatedName('');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsSubmitting(true);
    await deleteList(deleteTarget.id);
    setIsSubmitting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="bg-[#FFFDF0] min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumbs & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-[#C6E7FF]/60">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0066CC] uppercase tracking-wider mb-1">
              <Bookmark className="w-4 h-4 fill-[#0066CC]" />
              <span>Customer Account</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292525]">
              Saved Stationery Lists
            </h1>
            <p className="text-xs sm:text-sm text-[#292525]/60 mt-1 max-w-xl">
              Create named lists for school terms, grades, or office replenishment. Add products with
              custom quantities and transfer directly to your cart anytime.
            </p>
          </div>

          {currentUser && (
            <button
              onClick={() => {
                setCreateError(null);
                setNewListName('');
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] shadow-md transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create New List</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        {!currentUser ? (
          <div className="mt-12 max-w-md mx-auto text-center bg-white p-8 rounded-3xl border border-[#C6E7FF]/60 shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#C6E7FF]/30 flex items-center justify-center text-[#0066CC] mb-4">
              <Bookmark className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-[#292525]">Sign In to View Saved Lists</h2>
            <p className="text-xs text-[#292525]/60 mt-2 leading-relaxed">
              Log in to your account to manage multiple named stationery lists, track quantities, and
              reorder supplies easily.
            </p>
            <Link
              href="/login?redirect=/saved-lists"
              className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] shadow-md transition-all"
            >
              <span>Sign In / Register</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : isLoading && lists.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
            <p className="mt-3 text-xs text-[#292525]/60 font-medium">Loading saved lists...</p>
          </div>
        ) : lists.length === 0 ? (
          <div className="mt-12 max-w-lg mx-auto text-center bg-white p-10 rounded-3xl border border-[#C6E7FF]/60 shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FAF7EE] border border-[#C6E7FF]/50 flex items-center justify-center text-[#0066CC] mb-4">
              <Package className="w-8 h-8 text-[#0066CC]" />
            </div>
            <h2 className="text-lg font-bold text-[#292525]">No Saved Lists Yet</h2>
            <p className="text-xs sm:text-sm text-[#292525]/60 mt-2 leading-relaxed">
              You haven&apos;t created any stationery lists yet. Create a list for your school grade,
              office desk, or art supplies to quickly replenish anytime.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  setCreateError(null);
                  setNewListName('');
                  setIsCreateOpen(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First List</span>
              </button>
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-[#292525] bg-white border border-[#C6E7FF] hover:bg-slate-50 transition-all"
              >
                <span>Browse Products</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lists.map((list) => (
              <div
                key={list.id}
                className="bg-white rounded-3xl border border-[#C6E7FF]/70 hover:border-[#0066CC] shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-6">
                  {/* Top row: Title and options */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Link
                      href={`/saved-lists/${list.id}`}
                      className="text-base font-extrabold text-[#292525] group-hover:text-[#0066CC] transition-colors line-clamp-1"
                    >
                      {list.name}
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setRenameTarget({ id: list.id, name: list.name });
                          setUpdatedName(list.name);
                        }}
                        className="p-1.5 rounded-full text-[#292525]/40 hover:text-[#0066CC] hover:bg-[#F0F7FF] transition-colors"
                        title="Rename List"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: list.id, name: list.name })}
                        className="p-1.5 rounded-full text-[#292525]/40 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete List"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Badges / Stats */}
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#292525]/60 mb-4">
                    <span className="bg-[#FAF7EE] border border-[#C6E7FF]/50 px-2.5 py-1 rounded-full text-[11px] font-bold text-[#0066CC]">
                      {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-[#292525]">
                      {list.estimatedTotalCents > 0
                        ? `Est. ${formatLKR(list.estimatedTotalCents)}`
                        : 'Empty List'}
                    </span>
                  </div>

                  {/* Preview Images Thumbnail Grid */}
                  <Link href={`/saved-lists/${list.id}`} className="block">
                    <div className="h-28 rounded-2xl bg-[#FAF7EE] border border-[#C6E7FF]/40 p-2 flex items-center justify-center gap-2 overflow-hidden">
                      {list.previewImages && list.previewImages.length > 0 ? (
                        list.previewImages.map((img, idx) => (
                          <div
                            key={idx}
                            className="w-16 h-16 rounded-xl bg-white border border-[#C6E7FF]/30 p-1 flex items-center justify-center shrink-0"
                          >
                            <img
                              src={img}
                              alt=""
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[#292525]/40 text-xs">
                          <Bookmark className="w-6 h-6 text-[#0066CC]/30 mb-1" />
                          <span>No items added yet</span>
                        </div>
                      )}
                    </div>
                  </Link>
                </div>

                {/* Footer action link */}
                <div className="px-6 py-4 bg-[#FAF7EE]/50 border-t border-[#C6E7FF]/40 flex items-center justify-between">
                  <span className="text-[11px] text-[#292525]/50 font-medium">
                    Updated {new Date(list.updatedAt).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/saved-lists/${list.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0066CC] hover:underline"
                  >
                    <span>View &amp; Order</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create New List */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#C6E7FF]/60">
              <h3 className="font-bold text-base text-[#292525] mb-2">Create New Stationery List</h3>
              <p className="text-xs text-[#292525]/60 mb-4">
                Give your list a descriptive name such as &quot;Grade 4 Booklist 2026&quot; or &quot;Office Supplies&quot;.
              </p>

              <form onSubmit={handleCreateList} className="space-y-4">
                <input
                  type="text"
                  placeholder="e.g. Grade 5 Booklist 2026"
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

        {/* Modal: Rename List */}
        {renameTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#C6E7FF]/60">
              <h3 className="font-bold text-base text-[#292525] mb-2">Rename List</h3>
              <form onSubmit={handleRename} className="space-y-4">
                <input
                  type="text"
                  value={updatedName}
                  onChange={(e) => setUpdatedName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-[#C6E7FF] focus:outline-hidden focus:border-[#0066CC] bg-[#FFFDF0]"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRenameTarget(null)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-[#292525]/70 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 shadow-md transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Confirm Delete */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#C6E7FF]/60">
              <h3 className="font-bold text-base text-rose-600 mb-2">Delete Saved List</h3>
              <p className="text-xs text-[#292525]/70 mb-4">
                Are you sure you want to delete &quot;{deleteTarget.name}&quot;? This will permanently
                remove the list and all items inside it.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-[#292525]/70 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-full text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 shadow-md transition-all"
                >
                  Delete List
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

