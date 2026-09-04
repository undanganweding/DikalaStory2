import React from 'react';

export type FloatingWindowType =
  | 'scene_detail'
  | 'shot_detail'
  | 'character_detail'
  | 'location_detail'
  | 'asset_detail'
  | 'ai_copilot'
  | 'continuity_matrix'
  | 'keyboard_shortcuts'
  | 'telemetry_graph'
  | 'command_palette'
  | 'ai_infrastructure'
  | 'custom';

export interface FloatingWindowInstance {
  id: string;
  type: FloatingWindowType;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  data?: any;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}

export interface WindowManagerContextType {
  windows: FloatingWindowInstance[];
  activeWindowId: string | null;
  openWindow: (config: {
    id: string;
    type: FloatingWindowType;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    data?: any;
    initialPosition?: { x: number; y: number };
    initialSize?: { width: number; height: number };
  }) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updatePosition: (id: string, position: { x: number; y: number }) => void;
  updateSize: (id: string, size: { width: number; height: number }) => void;
  closeTopWindow: () => boolean;
  minimizeAll: () => void;
}
