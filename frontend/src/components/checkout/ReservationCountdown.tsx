'use client';

import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

interface ReservationCountdownProps {
  expiresAt: string; // ISO string from authoritative server
  onExpired?: () => void;
  onRenew?: () => void;
  isRenewing?: boolean;
}

export default function ReservationCountdown({
  expiresAt,
  onExpired,
  onRenew,
  isRenewing = false,
}: ReservationCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });

  useEffect(() => {
    const updateCountdown = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      const sec = Math.max(0, Math.floor(ms / 1000));
      setRemainingSeconds(sec);
      if (sec === 0 && onExpired) {
        onExpired();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // 10 minutes = 600 seconds
  const totalWindowSeconds = 600;
  const progressPercent = Math.min(100, Math.max(0, (remainingSeconds / totalWindowSeconds) * 100));

  const isLowTime = remainingSeconds <= 120 && remainingSeconds > 0;
  const isExpired = remainingSeconds === 0;

  if (isExpired) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl p-3.5 border transition-all ${
        isLowTime
          ? 'bg-amber-50/90 border-amber-300 shadow-xs'
          : 'bg-[#FFFDF0] border-[#C6E7FF] shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              isLowTime ? 'bg-amber-200/80 text-amber-800' : 'bg-[#C6E7FF] text-[#0066CC]'
            }`}
          >
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4
              className={`text-xs font-bold ${
                isLowTime ? 'text-amber-900' : 'text-[#292525]'
              }`}
            >
              Your selected items are reserved for {formattedTime} minutes.
            </h4>
            <p className="text-[10px] text-[#292525]/60">
              Warehouse stock is temporarily held for your checkout session
            </p>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`text-sm sm:text-base font-extrabold font-mono tracking-wider ${
              isLowTime ? 'text-rose-600 animate-pulse' : 'text-[#0066CC]'
            }`}
          >
            {formattedTime}
          </span>
          <span className="block text-[9px] text-[#292525]/50 font-medium">REMAINING</span>
        </div>
      </div>

      {/* Visual countdown progress track */}
      <div className="w-full bg-stone-200/70 h-1.5 rounded-full overflow-hidden mt-2.5">
        <div
          className={`h-full transition-all duration-1000 ${
            isLowTime ? 'bg-amber-500' : 'bg-[#0066CC]'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

