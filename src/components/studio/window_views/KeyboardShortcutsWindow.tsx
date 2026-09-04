import React from 'react';
import { Command, Sparkles, Layout, Eye, Maximize, MousePointer } from 'lucide-react';

export const KeyboardShortcutsWindow: React.FC = () => {
  const shortcutGroups = [
    {
      title: 'Navigasi & Global Workspace',
      items: [
        { keys: ['⌘', 'K'], label: 'Buka Command Palette / Pencarian Universal' },
        { keys: ['F'], label: 'Toggle Focus Mode (Layar Penuh Tanpa Distraksi)' },
        { keys: ['I'], label: 'Toggle Contextual Inspector (Kanan)' },
        { keys: ['Esc'], label: 'Tutup Window Teratas / Keluar dari Focus Mode' },
        { keys: ['?'], label: 'Buka Panduan Keyboard Shortcuts ini' },
      ],
    },
    {
      title: 'Pindah Tab Workspace',
      items: [
        { keys: ['1'], label: 'Overview / Ringkasan Proyek' },
        { keys: ['2'], label: 'Story Architecture' },
        { keys: ['3'], label: 'Scene Studio & Storyboard' },
        { keys: ['4'], label: 'Shot Cockpit' },
        { keys: ['5'], label: 'Asset Bibles (Karakter / Lokasi / Objek)' },
        { keys: ['6'], label: 'Continuity Verification' },
        { keys: ['7'], label: 'Pipeline Orchestrator' },
        { keys: ['8'], label: 'Export & Google Drive' },
      ],
    },
    {
      title: 'Interaksi Entitas Sinematik',
      items: [
        { keys: ['Single Click'], label: 'Pilih & Inspeksi di Panel Kanan' },
        { keys: ['Double Click'], label: 'Buka Floating Cockpit Window' },
        { keys: ['Right Click'], label: 'Buka Context Menu Aksi Cepat' },
        { keys: ['Space'], label: 'Preview Detail / Focus Cepat' },
      ],
    },
  ];

  return (
    <div className="space-y-4 text-xs select-none">
      <div className="bg-[#151728] p-3 rounded-xl border border-[#262842] flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-sm">Keyboard Shortcuts &amp; Interaksi Desktop</h3>
          <p className="text-[11px] text-slate-400">
            Didesain untuk navigasi kilat produksi film tanpa menyentuh mouse berulang kali.
          </p>
        </div>
        <Command className="w-5 h-5 text-indigo-400" />
      </div>

      <div className="space-y-4">
        {shortcutGroups.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <h4 className="text-[10px] font-mono uppercase font-bold text-indigo-300 tracking-wider">
              {group.title}
            </h4>
            <div className="bg-[#10121F] rounded-xl border border-[#1E2034] divide-y divide-[#1A1C2E] overflow-hidden">
              {group.items.map((item, idx) => (
                <div key={idx} className="px-3 py-2 flex items-center justify-between text-slate-300">
                  <span className="text-[11px]">{item.label}</span>
                  <div className="flex items-center gap-1">
                    {item.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="px-2 py-0.5 rounded bg-[#1C1E30] text-slate-200 font-mono text-[10px] border border-[#2B2E48] font-bold shadow-sm"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
