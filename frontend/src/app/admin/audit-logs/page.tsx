'use client';

import React from 'react';
import { History, ShieldCheck } from 'lucide-react';
import { AuditLog } from '@/types/admin';

const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    action: 'PRODUCT_STATUS_TOGGLED',
    entityType: 'product',
    entityId: 'prod-cr-120-single',
    description: 'Toggled active visibility of Atlas CR Book 120 Pages',
    user: 'admin@dslstationery.lk',
    timestamp: '2026-01-26T08:15:00Z',
  },
  {
    id: 'log-2',
    action: 'INVENTORY_RESTOCKED',
    entityType: 'inventory',
    entityId: 'prod-atlas-chooty-pen',
    description: 'Restocked +80 units from Atlas central warehouse',
    user: 'admin@dslstationery.lk',
    timestamp: '2026-01-25T14:30:00Z',
  },
  {
    id: 'log-3',
    action: 'ORDER_FULFILLMENT_SHIPPED',
    entityType: 'order',
    entityId: 'ord-1002',
    description: 'Transitioned order DSL-2026-1002 from processing to shipped',
    user: 'admin@dslstationery.lk',
    timestamp: '2026-01-25T10:00:00Z',
  },
  {
    id: 'log-4',
    action: 'PROMO_CODE_CREATED',
    entityType: 'promotion',
    entityId: 'promo-welcome10',
    description: 'Created promotional voucher WELCOME10 with 10% discount',
    user: 'admin@dslstationery.lk',
    timestamp: '2026-01-20T09:00:00Z',
  },
];

export default function AdminAuditLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          System Audit Logs
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Historical record of administrator actions, inventory mutations, and order lifecycle changes
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="py-3 px-4 font-bold">Timestamp</th>
              <th className="py-3 px-4 font-bold">Action</th>
              <th className="py-3 px-4 font-bold">Entity</th>
              <th className="py-3 px-4 font-bold">Details</th>
              <th className="py-3 px-4 font-bold">Admin User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MOCK_AUDIT_LOGS.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="py-3 px-4 font-mono font-bold text-[#08275E]">
                  {log.action}
                </td>
                <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-600">
                  <span className="bg-slate-100 px-2 py-0.5 rounded">
                    {log.entityType}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-800 font-medium">{log.description}</td>
                <td className="py-3 px-4 text-slate-500">{log.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
