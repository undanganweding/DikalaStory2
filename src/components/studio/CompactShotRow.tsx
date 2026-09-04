import React from 'react';
import { Shot } from '../../types';

interface CompactShotRowProps {
  shot: Shot;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}

export const CompactShotRow: React.FC<CompactShotRowProps> = React.memo(({ shot, index, isSelected, onSelect, onDoubleClick }) => {
  const isReady =
    ((shot as any).status || shot.generation_status) === 'approved' ||
    ((shot as any).status || shot.generation_status) === 'prompt_ready' ||
    ((shot as any).status || shot.generation_status) === 'READY';

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      className={`min-h-[44px] px-3 py-2 text-[11px] font-mono border-b border-[#1E2034] cursor-pointer transition flex items-center justify-between gap-2 md:grid md:grid-cols-5 md:gap-2 ${
        isSelected
          ? 'bg-[#1C1E34] text-white border-l-2 border-l-indigo-500 shadow-inner'
          : 'text-slate-400 hover:bg-[#16182C] hover:text-slate-200'
      }`}
    >
      {/* Mobile flex left / Desktop col 1 & 2 */}
      <div className="flex items-center gap-2 min-w-0 md:contents">
        <div className="font-extrabold text-amber-300 shrink-0 bg-[#121422] px-1.5 py-0.5 rounded border border-[#232644]">
          SH-{String(shot.shot_number || index + 1).padStart(2, '0')}
        </div>
        <div className="truncate font-semibold text-slate-200 text-xs md:text-[11px]">
          {shot.shot_type || shot.camera?.framing || 'Medium Shot'}
          <span className="md:hidden text-slate-500 font-normal ml-1.5 text-[10px]">
            • {shot.camera_movement || 'Static'}
          </span>
        </div>
      </div>

      {/* Desktop Col 3: Duration */}
      <div className="hidden md:block text-slate-300 font-bold">{shot.duration_sec || 0}s</div>

      {/* Desktop Col 4 / Mobile flex right */}
      <div className="flex items-center gap-1.5 shrink-0 md:contents">
        <div className="md:hidden text-slate-400 text-[10px] font-bold bg-[#141626] px-1.5 py-0.5 rounded">
          {shot.duration_sec || 0}s
        </div>
        <div
          className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
            isReady
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
          }`}
        >
          {isReady ? 'READY' : (shot as any).status || shot.generation_status || 'DRAFT'}
        </div>
      </div>

      {/* Desktop Col 5: Camera */}
      <div className="hidden md:block truncate text-slate-400">{shot.camera_movement || 'Static'}</div>
    </div>
  );
});
