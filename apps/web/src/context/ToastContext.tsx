import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
}

interface ToastContextValue {
  toast: (options: { type?: ToastType; message: string; description?: string }) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = 'info', message, description }: { type?: ToastType; message: string; description?: string }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, type, message, description };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const success = useCallback((message: string, description?: string) => addToast({ type: 'success', message, description }), [addToast]);
  const error = useCallback((message: string, description?: string) => addToast({ type: 'error', message, description }), [addToast]);
  const warning = useCallback((message: string, description?: string) => addToast({ type: 'warning', message, description }), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, warning }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-up ${
              t.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800/60 text-emerald-100'
                : t.type === 'error'
                ? 'bg-red-950/80 border-red-800/60 text-red-100'
                : t.type === 'warning'
                ? 'bg-amber-950/80 border-amber-800/60 text-amber-100'
                : 'bg-surface border-surface-border text-slate-100'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {t.type === 'error' && <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
            {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />}

            <div className="flex-1 text-sm">
              <div className="font-semibold">{t.message}</div>
              {t.description && <div className="text-xs opacity-90 mt-0.5">{t.description}</div>}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
