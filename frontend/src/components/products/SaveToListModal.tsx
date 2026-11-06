'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Plus, Check, Loader2, X, Lock } from 'lucide-react';
import { useUserStore } from '@/services/userStore';
import { useSavedListStore } from '@/services/savedListStore';
import { formatLKR } from '@/lib/currency';

interface SaveToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    images?: string[];
    priceCents: number;
  };
}

export const SaveToListModal: React.FC<SaveToListModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const router = useRouter();
  const currentUser = useUserStore((state) => state.currentUser);
  const { lists, fetchLists, createList, addItemToList } = useSavedListStore();

  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchLists();
      setQuantity(1);
      setSuccessMessage(null);
      setErrorMessage(null);
      setIsCreatingNew(false);
      setNewListName('');
    }
  }, [isOpen, currentUser, fetchLists]);

  useEffect(() => {
    if (lists.length > 0 && !selectedListId && !isCreatingNew) {
      setSelectedListId(lists[0].id);
    }
  }, [lists, selectedListId, isCreatingNew]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let targetListId = selectedListId;

      if (isCreatingNew || lists.length === 0) {
        if (!newListName.trim()) {
          setErrorMessage('Please enter a name for the new list');
          setIsSubmitting(false);
          return;
        }
        const created = await createList(newListName.trim());
        if (!created) {
          setErrorMessage('Failed to create new list');
          setIsSubmitting(false);
          return;
        }
        targetListId = created.id;
      }

      if (!targetListId) {
        setErrorMessage('Please select or create a list');
        setIsSubmitting(false);
        return;
      }

      const success = await addItemToList(targetListId, product.id, quantity);
      if (success) {
        setSuccessMessage('Product added to your saved list!');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage('Could not add item to list. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#C6E7FF]/70 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#C6E7FF]/40">
          <div className="flex items-center gap-2 text-[#0066CC]">
            <Bookmark className="w-5 h-5 fill-[#0066CC]" />
            <h3 className="font-bold text-base text-[#292525]">Save to Stationery List</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#292525]/50 hover:bg-[#F0F7FF] hover:text-[#292525] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Snippet */}
        <div className="flex items-center gap-3 py-3 mt-1">
          <div className="w-12 h-12 rounded-xl bg-[#FAF7EE] border border-[#C6E7FF]/40 flex items-center justify-center overflow-hidden shrink-0">
            {product.images && product.images[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <Bookmark className="w-5 h-5 text-[#0066CC]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-[#292525] truncate">{product.name}</h4>
            <p className="text-xs font-semibold text-[#0066CC]">
              {formatLKR(product.priceCents)}
            </p>
          </div>
        </div>

        {!currentUser ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-[#0066CC] flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-[#292525]">Sign in to Save Lists</h4>
            <p className="text-xs text-[#292525]/60 max-w-xs mx-auto">
              Create and manage multiple named stationery lists for school, home, or office supplies.
            </p>
            <button
              onClick={() => {
                onClose();
                router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
              }}
              className="mt-2 inline-flex items-center justify-center px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] shadow-md transition-all"
            >
              Sign In / Register
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Quantity Selector */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FFFDF0] border border-[#C6E7FF]/40">
              <label className="text-xs font-bold text-[#292525]">Quantity to Save:</label>
              <div className="flex items-center border border-[#C6E7FF] rounded-full bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-2.5 py-1 text-xs font-bold text-[#292525] hover:bg-slate-50 transition-colors"
                >
                  -
                </button>
                <span className="px-3 py-1 text-xs font-bold text-[#292525]">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="px-2.5 py-1 text-xs font-bold text-[#292525] hover:bg-slate-50 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* List Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#292525] block">Select Destination List:</label>

              {lists.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {lists.map((list) => {
                    const isSelected = selectedListId === list.id && !isCreatingNew;
                    return (
                      <div
                        key={list.id}
                        onClick={() => {
                          setSelectedListId(list.id);
                          setIsCreatingNew(false);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#0066CC] bg-[#F0F7FF] text-[#0066CC] font-semibold'
                            : 'border-[#C6E7FF]/50 bg-white hover:bg-slate-50 text-[#292525]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="radio"
                            name="savedListSelection"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedListId(list.id);
                              setIsCreatingNew(false);
                            }}
                            className="text-[#0066CC] focus:ring-[#0066CC]"
                          />
                          <span className="text-xs truncate">{list.name}</span>
                        </div>
                        <span className="text-[10px] text-[#292525]/50 bg-white px-2 py-0.5 rounded-full border border-[#C6E7FF]/40">
                          {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create new list option */}
              <div
                onClick={() => setIsCreatingNew(true)}
                className={`p-2.5 rounded-2xl border cursor-pointer transition-all ${
                  isCreatingNew || lists.length === 0
                    ? 'border-[#0066CC] bg-[#F0F7FF]'
                    : 'border-dashed border-[#C6E7FF] bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="savedListSelection"
                    checked={isCreatingNew || lists.length === 0}
                    onChange={() => setIsCreatingNew(true)}
                    className="text-[#0066CC] focus:ring-[#0066CC]"
                  />
                  <span className="text-xs font-bold text-[#0066CC] flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    Create a new list
                  </span>
                </div>

                {(isCreatingNew || lists.length === 0) && (
                  <div className="mt-2.5 pt-2 border-t border-[#C6E7FF]/50">
                    <input
                      type="text"
                      placeholder="e.g. Grade 5 Booklist 2026, Office Stationery..."
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#C6E7FF] focus:outline-hidden focus:border-[#0066CC] bg-white"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Error & Success Messages */}
            {errorMessage && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-1.5 font-bold">
                <Check className="w-4 h-4 text-emerald-600" />
                {successMessage}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-bold text-[#292525]/70 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !!successMessage}
                className="px-6 py-2 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 shadow-md flex items-center gap-1.5 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Save to List</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

