import React, { useEffect, useRef } from 'react';
import {
  Maximize2,
  Eye,
  Sparkles,
  Copy,
  Trash2,
  PlaySquare,
  Shield,
  Activity,
  Layers,
} from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'warning' | 'primary';
  disabled?: boolean;
}

export interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  title?: string;
  items: ContextMenuItem[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  title,
  items,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('pointerdown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('pointerdown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Clamp menu to screen bounds
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const menuW = 200;
  const menuH = items.length * 36 + (title ? 30 : 0);

  const posX = Math.min(position.x, screenW - menuW - 10);
  const posY = Math.min(position.y, screenH - menuH - 10);

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-[999] w-52 bg-[#141628] border border-[#2B2F4E] rounded-xl shadow-2xl p-1.5 text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {title && (
        <div className="px-2.5 py-1 text-[10px] font-mono uppercase font-bold text-slate-400 border-b border-[#22253E] mb-1 truncate">
          {title}
        </div>
      )}
      <div className="space-y-0.5">
        {items.map((item, idx) => (
          <button
            key={idx}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left transition font-medium ${
              item.disabled
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : item.variant === 'danger'
                ? 'hover:bg-rose-950/60 text-rose-300'
                : item.variant === 'primary'
                ? 'hover:bg-indigo-600 text-white font-semibold'
                : 'hover:bg-[#20233E] text-slate-200'
            }`}
          >
            {item.icon && <span className="shrink-0 text-slate-400">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
