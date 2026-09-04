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
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      className={`grid grid-cols-5 gap-2 px-3 py-1.5 text-[11px] font-mono border-b border-[#1E2034] cursor-pointer transition ${
        isSelected ? 'bg-[#1C1E34] text-white' : 'text-slate-400 hover:bg-[#16182C] hover:text-slate-200'
      }`}
    >
      <div className="font-bold">{String(shot.shot_number || index + 1).padStart(2, '0')}</div>
      <div className="truncate">{shot.shot_type || shot.camera?.framing || 'Shot'}</div>
      <div>{shot.duration_sec || 0}s</div>
      <div className={`font-bold ${((shot as any).status || shot.generation_status) === 'approved' || ((shot as any).status || shot.generation_status) === 'prompt_ready' || ((shot as any).status || shot.generation_status) === 'READY' ? 'text-emerald-400' : 'text-amber-400'}`}>
        {(shot as any).status || shot.generation_status || 'DRAFT'}
      </div>
      <div className="truncate">{shot.camera_movement || 'Static'}</div>
    </div>
  );
});
