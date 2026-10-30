import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type StatusType =
  | 'SCHEDULED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED'
  | 'RETRYING'
  | 'DELIVERY_UNKNOWN';

export const Badge: React.FC<{
  status?: StatusType | string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children?: React.ReactNode;
  className?: string;
}> = ({ status, variant, children, className }) => {
  let style = 'bg-surface border-surface-border text-slate-300';

  if (status) {
    switch (status) {
      case 'SENT':
        style = 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300';
        break;
      case 'SCHEDULED':
        style = 'bg-cyan-950/70 border-cyan-800/60 text-cyan-300';
        break;
      case 'QUEUED':
        style = 'bg-indigo-950/70 border-indigo-800/60 text-indigo-300';
        break;
      case 'PROCESSING':
        style = 'bg-amber-950/70 border-amber-800/60 text-amber-300 animate-pulse';
        break;
      case 'FAILED':
        style = 'bg-red-950/70 border-red-800/60 text-red-300';
        break;
      case 'CANCELLED':
        style = 'bg-slate-900 border-slate-700 text-slate-400 line-through';
        break;
      case 'RETRYING':
        style = 'bg-purple-950/70 border-purple-800/60 text-purple-300';
        break;
      case 'DELIVERY_UNKNOWN':
        style = 'bg-orange-950/70 border-orange-800/60 text-orange-300';
        break;
    }
  } else if (variant) {
    switch (variant) {
      case 'success':
        style = 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300';
        break;
      case 'warning':
        style = 'bg-amber-950/70 border-amber-800/60 text-amber-300';
        break;
      case 'danger':
        style = 'bg-red-950/70 border-red-800/60 text-red-300';
        break;
      case 'info':
        style = 'bg-cyan-950/70 border-cyan-800/60 text-cyan-300';
        break;
    }
  }

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider',
          style,
          className
        )
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {children || status}
    </span>
  );
};
