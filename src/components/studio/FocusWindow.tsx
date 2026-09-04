import React, { useEffect, useState } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

export interface FocusWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const FocusWindow: React.FC<FocusWindowProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  children,
  footerActions,
  size = 'lg',
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
    full: 'max-w-[95vw]',
  }[size];

  return (
    <div
      id="studio-focus-window-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="studio-focus-window-container"
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#121424] border border-[#2B2F4E] rounded-2xl shadow-2xl flex flex-col w-full transition-all duration-200 overflow-hidden ${
          isMaximized ? 'w-[96vw] h-[92vh] max-w-none' : `${sizeClasses} max-h-[88vh]`
        }`}
      >
        {/* Focus Window Header */}
        <div className="px-4 py-3 bg-[#17192C] border-b border-[#252844] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <div className="text-amber-400 shrink-0">{icon}</div>}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">{title}</h3>
                {badge}
              </div>
              {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#22253E] transition"
              title={isMaximized ? 'Restore window size' : 'Maximize window'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-950/50 hover:text-rose-300 transition"
              title="Close focus window (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Focus Window Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-slate-200 text-xs sm:text-sm leading-relaxed space-y-4">
          {children}
        </div>

        {/* Focus Window Footer */}
        {footerActions && (
          <div className="px-4 py-3 bg-[#17192C] border-t border-[#252844] flex items-center justify-end gap-2.5 shrink-0">
            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
};
