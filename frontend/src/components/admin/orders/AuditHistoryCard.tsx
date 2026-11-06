'use client';

import React, { useState, useEffect } from 'react';
import { History, Shield, Clock, Loader2, Info } from 'lucide-react';
import { OrderAuditEntry } from '@/types/order';
import { orderService } from '@/services/orderService';

interface AuditHistoryCardProps {
  orderId: string;
  orderCreatedAt: string;
}

export const AuditHistoryCard: React.FC<AuditHistoryCardProps> = ({
  orderId,
  orderCreatedAt,
}) => {
  const [logs, setLogs] = useState<OrderAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchLogs = async () => {
      setIsLoading(true);
      const res = await orderService.fetchOrderAuditHistory(orderId);
      if (mounted) {
        setLogs(res);
        setIsLoading(false);
      }
    };
    fetchLogs();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Administrative Audit Trail</h3>
            <p className="text-[11px] text-slate-400">
              Immutable log of administrative status changes and interventions
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {logs.length + 1} Recorded Events
        </span>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#08275E]" />
          <span>Loading audit log entries...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Default Order Creation Entry */}
          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#08275E]/10 text-[#08275E] flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900">Order Placed &amp; Initialized</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(orderCreatedAt).toLocaleString()}
                </span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Customer completed checkout process. Stock reservations confirmed and converted to authoritative order record.
              </p>
              <div className="text-[10px] text-slate-400">Actor: System Automated Service</div>
            </div>
          </div>

          {/* Additional administrative audit records */}
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-3"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#08275E] flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{entry.action}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                {entry.fieldChanged && (
                  <div className="text-[11px] text-slate-700">
                    <span className="text-slate-400">Field modified:</span>{' '}
                    <strong className="font-semibold">{entry.fieldChanged}</strong>
                    {entry.previousValue && entry.newValue && (
                      <span className="text-slate-500 ml-1">
                        (&ldquo;{entry.previousValue}&rdquo; &rarr; &ldquo;{entry.newValue}&rdquo;)
                      </span>
                    )}
                  </div>
                )}
                {entry.reason && (
                  <div className="text-[11px] text-slate-600 italic">
                    &ldquo;{entry.reason}&rdquo;
                  </div>
                )}
                <div className="text-[10px] text-slate-400">
                  Admin: <strong className="text-slate-700">{entry.adminName}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
