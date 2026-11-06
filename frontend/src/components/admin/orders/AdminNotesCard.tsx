'use client';

import React, { useState } from 'react';
import { FileText, Send, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { orderService } from '@/services/orderService';
import { OrderAdminNote } from '@/types/order';

interface AdminNotesCardProps {
  orderId: string;
  customerNotes?: string | null;
  adminNotes?: OrderAdminNote[];
  onNoteAdded?: (note: OrderAdminNote) => void;
}

export const AdminNotesCard: React.FC<AdminNotesCardProps> = ({
  orderId,
  customerNotes,
  adminNotes = [],
  onNoteAdded,
}) => {
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<OrderAdminNote[]>(adminNotes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmitting(true);
    setNotice(null);

    const res = await orderService.addAdminNote(orderId, newNote.trim(), true);
    setIsSubmitting(false);

    const created: OrderAdminNote = res.data || {
      id: `local-note-${Date.now()}`,
      orderId,
      authorName: 'Admin User',
      note: newNote.trim(),
      isInternal: true,
      createdAt: new Date().toISOString(),
    };

    setLocalNotes((prev) => [created, ...prev]);
    onNoteAdded?.(created);
    setNewNote('');

    if (res.isBackendPending) {
      setNotice(
        'Admin notes endpoint [POST /api/v1/admin/orders/:id/notes] is pending backend integration. Note recorded in local session.'
      );
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-[#08275E]">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Communication &amp; Notes</h3>
            <p className="text-[11px] text-slate-400">
              Customer instructions and internal staff annotations
            </p>
          </div>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">API Coordination Notice:</strong>
            <span>{notice}</span>
          </div>
        </div>
      )}

      {/* Customer-facing Instructions */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
        <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
          <User className="w-3.5 h-3.5 text-blue-600" />
          <span>Customer Delivery Note / Instructions</span>
        </div>
        {customerNotes ? (
          <p className="text-slate-800 text-xs leading-relaxed italic bg-white p-3 rounded-xl border border-slate-200">
            &ldquo;{customerNotes}&rdquo;
          </p>
        ) : (
          <div className="text-slate-400 text-xs italic">
            No special customer instructions accompanied this order.
          </div>
        )}
      </div>

      {/* Staff Internal Notes Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Internal Staff Notes (Private)</span>
          </div>
          <span className="text-[10px] text-slate-400">Not visible to customer</span>
        </div>

        {/* Add Note Form */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            rows={2}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add an internal note or update about this order..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !newNote.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs disabled:opacity-40 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Post Internal Note</span>
            </button>
          </div>
        </form>

        {/* Notes List */}
        {localNotes.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {localNotes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/70 text-slate-800 space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="font-bold text-slate-700">{note.authorName}</span>
                  <span>{new Date(note.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-xs">{note.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
