import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ children, className, title, subtitle, action }) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-surface border border-surface-border rounded-2xl overflow-hidden shadow-xl shadow-black/20 transition-all duration-200',
          className
        )
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border/60">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};
