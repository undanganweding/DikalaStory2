import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { FloatingWindowInstance, FloatingWindowType, WindowManagerContextType } from '../types/window';

const WindowManagerContext = createContext<WindowManagerContextType | null>(null);

const DEFAULT_WINDOW_SIZE: Record<FloatingWindowType, { width: number; height: number }> = {
  scene_detail: { width: 880, height: 640 },
  shot_detail: { width: 820, height: 600 },
  character_detail: { width: 760, height: 580 },
  location_detail: { width: 760, height: 580 },
  asset_detail: { width: 720, height: 540 },
  ai_copilot: { width: 480, height: 620 },
  continuity_matrix: { width: 920, height: 600 },
  keyboard_shortcuts: { width: 680, height: 500 },
  telemetry_graph: { width: 840, height: 580 },
  command_palette: { width: 640, height: 420 },
  ai_infrastructure: { width: 900, height: 600 },
  custom: { width: 700, height: 500 },
};

let baseZIndex = 100;

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<FloatingWindowInstance[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const nextZIndexRef = useRef(baseZIndex);

  const focusWindow = useCallback((id: string) => {
    nextZIndexRef.current += 1;
    const newZ = nextZIndexRef.current;
    setActiveWindowId(id);
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: newZ, isMinimized: false } : w))
    );
  }, []);

  const openWindow = useCallback(
    (config: {
      id: string;
      type: FloatingWindowType;
      title: string;
      subtitle?: string;
      icon?: React.ReactNode;
      data?: any;
      initialPosition?: { x: number; y: number };
      initialSize?: { width: number; height: number };
    }) => {
      setWindows((prev) => {
        const existing = prev.find((w) => w.id === config.id);
        nextZIndexRef.current += 1;
        const newZ = nextZIndexRef.current;
        setActiveWindowId(config.id);

        if (existing) {
          // If existing, focus and restore if minimized, update title/data if provided
          return prev.map((w) =>
            w.id === config.id
              ? {
                  ...w,
                  title: config.title || w.title,
                  subtitle: config.subtitle !== undefined ? config.subtitle : w.subtitle,
                  icon: config.icon !== undefined ? config.icon : w.icon,
                  data: config.data !== undefined ? config.data : w.data,
                  isMinimized: false,
                  zIndex: newZ,
                }
              : w
          );
        }

        // Calculate smart staggered position
        const defaultSize = DEFAULT_WINDOW_SIZE[config.type] || { width: 700, height: 500 };
        const size = config.initialSize || defaultSize;

        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;

        // Position near center with slight offset based on open window count
        const offset = (prev.length % 6) * 32;
        const posX = Math.max(20, Math.min(screenW - size.width - 20, Math.floor((screenW - size.width) / 2) + offset));
        const posY = Math.max(60, Math.min(screenH - size.height - 40, Math.floor((screenH - size.height) / 2) + (offset / 2)));

        const newWindow: FloatingWindowInstance = {
          id: config.id,
          type: config.type,
          title: config.title,
          subtitle: config.subtitle,
          icon: config.icon,
          data: config.data,
          position: config.initialPosition || { x: posX, y: posY },
          size: {
            width: Math.min(size.width, screenW - 40),
            height: Math.min(size.height, screenH - 80),
          },
          isMinimized: false,
          isMaximized: false,
          zIndex: newZ,
        };

        return [...prev, newWindow];
      });
    },
    []
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const remaining = prev.filter((w) => w.id !== id);
      if (remaining.length > 0) {
        // Set active window to topmost remaining
        const top = [...remaining].sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveWindowId(top?.id || null);
      } else {
        setActiveWindowId(null);
      }
      return remaining;
    });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w));
      const activeRemains = next.filter((w) => !w.isMinimized);
      if (activeRemains.length > 0) {
        const top = [...activeRemains].sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveWindowId(top?.id || null);
      } else {
        setActiveWindowId(null);
      }
      return next;
    });
  }, []);

  const restoreWindow = useCallback(
    (id: string) => {
      focusWindow(id);
    },
    [focusWindow]
  );

  const maximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w))
    );
  }, []);

  const updatePosition = useCallback((id: string, position: { x: number; y: number }) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, position } : w))
    );
  }, []);

  const updateSize = useCallback((id: string, size: { width: number; height: number }) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, size } : w))
    );
  }, []);

  const closeTopWindow = useCallback(() => {
    let closed = false;
    setWindows((prev) => {
      const open = prev.filter((w) => !w.isMinimized);
      if (open.length === 0) return prev;
      const top = [...open].sort((a, b) => b.zIndex - a.zIndex)[0];
      if (top) {
        closed = true;
        const remaining = prev.filter((w) => w.id !== top.id);
        const nextActive = [...remaining].sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveWindowId(nextActive?.id || null);
        return remaining;
      }
      return prev;
    });
    return closed;
  }, []);

  const minimizeAll = useCallback(() => {
    setWindows((prev) => prev.map((w) => ({ ...w, isMinimized: true })));
    setActiveWindowId(null);
  }, []);

  const contextValue = React.useMemo(
    () => ({
      windows,
      activeWindowId,
      openWindow,
      closeWindow,
      minimizeWindow,
      restoreWindow,
      maximizeWindow,
      focusWindow,
      updatePosition,
      updateSize,
      closeTopWindow,
      minimizeAll,
    }),
    [
      windows,
      activeWindowId,
      openWindow,
      closeWindow,
      minimizeWindow,
      restoreWindow,
      maximizeWindow,
      focusWindow,
      updatePosition,
      updateSize,
      closeTopWindow,
      minimizeAll,
    ]
  );

  return (
    <WindowManagerContext.Provider value={contextValue}>
      {children}
    </WindowManagerContext.Provider>
  );
};

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within a WindowManagerProvider');
  }
  return context;
};
