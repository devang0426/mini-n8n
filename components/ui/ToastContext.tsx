'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Render Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-md w-full pointer-events-none px-4">
        {toasts.map((toast) => {
          let bgClass = 'bg-white text-[#111] border-[#111]';
          let icon = 'ℹ️';

          if (toast.type === 'success') {
            bgClass = 'bg-[#B6F5C8] text-[#0A6630] border-[#111]';
            icon = '✓';
          } else if (toast.type === 'error') {
            bgClass = 'bg-[#FF6B6B] text-white border-[#111]';
            icon = '❌';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-xl border-[2.5px] shadow-[4px_4px_0_#111] flex items-center justify-between gap-3 text-xs font-black uppercase tracking-wider animate-in slide-in-from-bottom-5 transition-all ${bgClass}`}
            >
              <div className="flex items-center space-x-2.5">
                <span className="text-sm">{icon}</span>
                <span className="font-bold normal-case text-xs">{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-sm font-black hover:opacity-75 focus:outline-none"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if context isn't wrapped
    return {
      showToast: (message: string) => console.log('[Toast Notice]:', message),
    };
  }
  return context;
}
