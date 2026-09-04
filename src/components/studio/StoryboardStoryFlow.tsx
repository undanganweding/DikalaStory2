import React, { useState, useMemo } from 'react';
import {
  ArrowRight,
  ArrowDown,
  Clock,
  Film,
  PlaySquare,
  BookOpen,
  Compass,
  Layers,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Copy,
  Printer,
  ExternalLink,
  FileText,
  LayoutGrid,
  Search,
  Download,
  X,
  ChevronDown,
  Eye,
  Type,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Project,
  ProjectFoundation,
  StoryArchitecture,
  Scene,
  Shot,
  VideoPrompt,
} from '../../types';

export interface StoryboardStoryFlowProps {
  project?: Project | null;
  foundation?: ProjectFoundation | null;
  storyArchitecture?: StoryArchitecture | null;
  scenes: Scene[];
  shots: Record<string, Shot[]>;
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
  onSwitchToSceneBreakdown?: (sceneId?: string) => void;
  videoPrompts?: Record<string, VideoPrompt[]>;
}

export const StoryboardStoryFlow: React.FC<StoryboardStoryFlowProps> = ({
  project,
  foundation,
  storyArchitecture,
  scenes,
  shots,
  selectedSceneId,
  onSelectScene,
  onSwitchToSceneBreakdown,
  videoPrompts = {},
}) => {
  // Navigation & view states
  const [activeTab, setActiveTab] = useState<'screenplay' | 'grid'>('screenplay');
  const [sceneFilter, setSceneFilter] = useState<string>('all'); // 'all' or scene.id
  const [searchQuery, setSearchQuery] = useState('');
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [readerFontFamily, setReaderFontFamily] = useState<'serif' | 'sans' | 'mono'>('serif');
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [copiedAllState, setCopiedAllState] = useState(false);

  // Compute total duration formatted
  const totalDurationSec = scenes.reduce((sum, sc) => sum + (sc.duration_sec || 0), 0);
  const totalShotsCount = (Object.values(shots) as Shot[][]).reduce(
    (sum, scShots) => sum + (scShots?.length || 0),
    0
  );

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const historicalPeriod =
    storyArchitecture?.historical_period || foundation?.era || 'Era Klasik';
  const narrativeTheme =
    foundation?.theme || storyArchitecture?.visual_language || 'Kisah Sejarah & Peradaban';

  const storySummary =
    storyArchitecture?.premise ||
    foundation?.main_conflict ||
    project?.raw_script?.slice(0, 320) ||
    'Kisah sinematik terstruktur siap diproduksi.';

  // Copy helper for clean script (no AI prompts)
  const handleCopyCleanText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAllState(true);
    setTimeout(() => setCopiedAllState(false), 2000);
  };

  // Generate full clean script text (pure screenplay: actions, dialogues, VO, audio notes)
  const cleanScriptText = useMemo(() => {
    let script = `JUDUL PROYEK: ${project?.title || 'HASAN MUNADI'}\r\n`;
    script += `Era Sejarah: ${historicalPeriod}\r\n`;
    script += `Tema Utama: ${narrativeTheme}\r\n`;
    script += `Total Durasi: ${formatDuration(totalDurationSec)} (${scenes.length} Adegan, ${totalShotsCount} Shots)\r\n`;
    script += `========================================================================\r\n\r\n`;

    scenes.forEach((sc, sIdx) => {
      script += `ADEGAN ${String(sc.scene_number || sIdx + 1).padStart(2, '0')}: ${sc.title || 'Tanpa Judul'} (${sc.duration_sec}s)\r\n`;
      script += `LOKASI: ${sc.location_name || 'Latar'} (${sc.time_of_day || 'Seharian'})\r\n`;
      script += `KARAKTER: ${sc.character_names?.join(', ') || '-'}\r\n`;
      script += `TUJUAN CERITA: ${sc.story_purpose || '-'}\r\n`;
      script += `ALUR KEJADIAN: ${sc.event || '-'}\r\n`;
      script += `------------------------------------------------------------------------\r\n`;

      const scShots = shots[sc.id] || [];
      scShots.forEach((sh) => {
        script += `  SHOT ${sh.shot_number} (${sh.start_time_sec}s - ${sh.end_time_sec}s) - [${sh.shot_type || 'Medium Shot'}]\r\n`;
        script += `  Aksi Visual: ${sh.character_action || ''} ${sh.event_detail || ''}\r\n`;
        if (sh.camera_note) script += `  Kamera: ${sh.camera_note}\r\n`;
        if (sh.dialogue && sh.dialogue.length > 0) {
          sh.dialogue.forEach((d) => {
            script += `    [DIALOG] ${d.character_name.toUpperCase()}: "${d.line}"\r\n`;
          });
        }
        if (sh.audio_narration) script += `  Narasi Voice Over: ${sh.audio_narration}\r\n`;
        if (sh.sound_effects) script += `  SFX: ${sh.sound_effects}\r\n`;
        script += `\r\n`;
      });
      script += `\r\n\r\n`;
    });

    return script;
  }, [project, scenes, shots, historicalPeriod, narrativeTheme, totalDurationSec, totalShotsCount]);

  // Download raw txt file
  const handleDownloadTxt = () => {
    const element = document.createElement('a');
    const file = new Blob([cleanScriptText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${(project?.title || 'naskah_storyboard').toLowerCase().replace(/\s+/g, '_')}_clean.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Open script in a styled separate window for printing/reading
  const handleOpenNewWindow = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Popup blocker terdeteksi. Harap izinkan popup di browser Anda.");
      return;
    }
    
    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Naskah Lengkap & Storyboard - ${project?.title || 'Cinema'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,600;0,800;1,600&display=swap');
            
            body {
              font-family: 'Courier Prime', 'Courier New', monospace;
              color: #111827;
              background: #ffffff;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              line-height: 1.6;
              font-size: 15px;
            }
            .header-info {
              font-family: 'Plus Jakarta Sans', sans-serif;
              text-align: center;
              border-bottom: 2px solid #111827;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            h1 { font-family: 'Playfair Display', serif; font-size: 26px; margin: 0 0 5px 0; color: #111827; text-transform: uppercase; font-weight: 800; }
            h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #4b5563; margin: 0; }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-top: 15px;
              text-align: left;
              font-size: 12px;
              color: #4b5563;
              background: #f9fafb;
              padding: 12px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
            }
            .scene {
              margin-top: 40px;
              border-top: 1px solid #111827;
              padding-top: 20px;
              page-break-inside: avoid;
            }
            .scene-heading {
              font-weight: bold;
              text-transform: uppercase;
              font-size: 15px;
              background: #111827;
              color: #ffffff;
              padding: 4px 10px;
              display: inline-block;
              margin-bottom: 12px;
            }
            .scene-meta {
              font-family: 'Plus Jakarta Sans', sans-serif;
              font-size: 12px;
              color: #4b5563;
              margin-bottom: 10px;
            }
            .scene-description {
              background: #fffbeb;
              border-left: 3px solid #d97706;
              padding: 10px 14px;
              margin-bottom: 20px;
              font-size: 13.5px;
              color: #1f2937;
            }
            .shot {
              margin-left: 10px;
              margin-bottom: 25px;
              padding-left: 15px;
              border-left: 2px solid #e5e7eb;
              page-break-inside: avoid;
            }
            .shot-heading {
              font-weight: bold;
              font-size: 13px;
              color: #111827;
              margin-bottom: 6px;
              text-transform: uppercase;
            }
            .shot-detail {
              margin-bottom: 10px;
              font-size: 14px;
            }
            .storyboard-img {
              max-width: 100%;
              max-height: 240px;
              object-fit: cover;
              border-radius: 4px;
              margin: 10px 0;
              border: 1px solid #d1d5db;
            }
            .dialogue-wrapper {
              margin: 15px auto;
              width: 70%;
              font-size: 14px;
            }
            .dialogue-char {
              font-weight: bold;
              text-transform: uppercase;
              text-align: center;
              margin-bottom: 2px;
            }
            .dialogue-line {
              text-align: center;
              font-style: italic;
              margin-bottom: 10px;
            }
            .audio-annotation {
              font-style: italic;
              color: #4b5563;
              font-size: 12.5px;
            }
            .btn-print {
              font-family: 'Plus Jakarta Sans', sans-serif;
              padding: 8px 20px;
              font-weight: bold;
              background: #d97706;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 13px;
            }
            @media print {
              .no-print-banner { display: none; }
              body { padding: 0; font-size: 11pt; }
            }
          </style>
        </head>
        <body>
          <div class="no-print-banner" style="text-align: center; margin-bottom: 30px;">
            <button class="btn-print" onclick="window.print()">CETAK / SIMPAN KE PDF</button>
          </div>
          <div class="header-info">
            <h1>${project?.title || 'HASAN MUNADI'}</h1>
            <h2>NASKAH ALUR CERITA &amp; STORYBOARD LENGKAP</h2>
            <div class="meta-grid">
              <div>
                <strong>ERA:</strong> ${historicalPeriod}<br/>
                <strong>TEMA:</strong> ${narrativeTheme}
              </div>
              <div>
                <strong>DURASI TOTAL:</strong> ${formatDuration(totalDurationSec)}s<br/>
                <strong>STRUKTUR:</strong> ${scenes.length} Adegan | ${totalShotsCount} Shots
              </div>
            </div>
          </div>
    `;

    scenes.forEach((sc, sIdx) => {
      const scShots = shots[sc.id] || [];
      html += `
        <div class="scene">
          <div class="scene-heading">ADEGAN ${String(sc.scene_number || sIdx + 1).padStart(2, '0')}: ${sc.title || 'TANPA JUDUL'}</div>
          <div class="scene-meta">
            <strong>Lokasi:</strong> ${sc.location_name} | <strong>Waktu:</strong> ${sc.time_of_day} | <strong>Durasi:</strong> ${sc.duration_sec} detik<br/>
            <strong>Karakter Aktif:</strong> ${sc.character_names?.join(', ') || '-'}
          </div>
          <div class="scene-description">
            <strong>ALUR CERITA:</strong> ${sc.event || ''}
          </div>
      `;

      scShots.forEach((sh) => {
        const shotImg = sh.image_url || sh.shot_image_url;
        const imgTag = shotImg ? `<img class="storyboard-img" src="${shotImg}" referrerpolicy="no-referrer" />` : '';

        const dialogSection = sh.dialogue && sh.dialogue.length > 0
          ? sh.dialogue.map(d => `
              <div class="dialogue-wrapper">
                <div class="dialogue-char">${d.character_name}</div>
                <div class="dialogue-line">"${d.line}"</div>
              </div>
            `).join('')
          : '';

        html += `
          <div class="shot">
            <div class="shot-heading">Shot ${sh.shot_number} — ${sh.shot_type || 'MEDIUM SHOT'} [${sh.camera_movement || 'STABLE'}]</div>
            ${imgTag}
            <div class="shot-detail">
              <strong>Visual &amp; Aksi:</strong> ${sh.character_action || ''} ${sh.event_detail || ''}
            </div>
            ${sh.camera_note ? `<div style="font-size:12px; color:#4b5563; margin-bottom:8px;"><em>Kamera: ${sh.camera_note}</em></div>` : ''}
            ${dialogSection}
            ${sh.audio_narration ? `<div class="audio-annotation"><strong>Narasi VO:</strong> ${sh.audio_narration}</div>` : ''}
            ${sh.sound_effects ? `<div class="audio-annotation"><strong>SFX:</strong> ${sh.sound_effects}</div>` : ''}
          </div>
        `;
      });

      html += `</div>`;
    });

    html += `
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Filter scenes based on selected scene filter and search query
  const filteredScenes = useMemo(() => {
    let list = scenes;
    if (sceneFilter !== 'all') {
      list = scenes.filter((sc) => sc.id === sceneFilter);
    }

    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((sc) => {
      const matchTitle = (sc.title || '').toLowerCase().includes(q);
      const matchEvent = (sc.event || '').toLowerCase().includes(q);
      const matchChars = (sc.character_names || []).some(name => name.toLowerCase().includes(q));
      
      const scShots = shots[sc.id] || [];
      const matchShots = scShots.some(sh => 
        (sh.character_action || '').toLowerCase().includes(q) ||
        (sh.event_detail || '').toLowerCase().includes(q) ||
        (sh.dialogue || []).some(d => d.line.toLowerCase().includes(q) || d.character_name.toLowerCase().includes(q))
      );

      return matchTitle || matchEvent || matchChars || matchShots;
    });
  }, [scenes, shots, sceneFilter, searchQuery]);

  // Reader Modal typography handlers
  const fontClass = () => {
    switch (readerFontFamily) {
      case 'serif': return 'font-serif tracking-normal leading-relaxed';
      case 'sans': return 'font-sans tracking-wide leading-relaxed';
      case 'mono': return 'font-mono tracking-tight leading-snug';
    }
  };

  const fontSizeClass = () => {
    switch (readerFontSize) {
      case 'sm': return 'text-[12px] sm:text-xs';
      case 'md': return 'text-xs sm:text-sm';
      case 'lg': return 'text-sm sm:text-base';
    }
  };

  return (
    <div id="storyboard-story-flow-view" className="space-y-4 animate-in fade-in duration-200 text-slate-100">
      
      {/* ========================================================= */}
      {/* 1. TOP CONTROL BAR: FILTERS, VIEWS, AND FULL SCREEN       */}
      {/* ========================================================= */}
      <div className="bg-[#0A0D16] border border-[#1F2338] p-3 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
        
        {/* Left Side: View Tabs */}
        <div className="flex items-center gap-1.5 bg-[#121526] p-1 rounded-xl border border-[#232742]">
          <button
            onClick={() => setActiveTab('screenplay')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeTab === 'screenplay'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>NASKAH ALUR CERITA</span>
          </button>
          <button
            onClick={() => setActiveTab('grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeTab === 'grid'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>VISUAL STORYBOARD BOARD</span>
          </button>
        </div>

        {/* Middle: Scene Selector Filter (Per Scene vs Lihat Semua) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 uppercase hidden lg:inline">Filter:</span>
          <select
            value={sceneFilter}
            onChange={(e) => setSceneFilter(e.target.value)}
            className="bg-[#121526] border border-[#232742] text-xs font-mono px-3 py-1.5 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 transition cursor-pointer"
          >
            <option value="all">Lihat Semua Adegan (Full Story)</option>
            {scenes.map((sc, sIdx) => (
              <option key={sc.id} value={sc.id}>
                Adegan {String(sc.scene_number || sIdx + 1).padStart(2, '0')}: {sc.title}
              </option>
            ))}
          </select>
        </div>

        {/* Right Side: Export, Print and Fullscreen */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenNewWindow}
            className="px-3 py-1.5 rounded-xl border border-[#232742] bg-[#121526] text-slate-300 hover:text-white text-xs font-mono transition flex items-center gap-1.5"
            title="Buka naskah di jendela terpisah untuk dicetak / ekspor PDF"
          >
            <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            <span>Open in Window</span>
          </button>

          <button
            onClick={() => setIsReaderOpen(true)}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-mono font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-amber-500/10 hover:brightness-110"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Layar Penuh</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. INSTANT SEARCH & DOWNLOAD BAR                          */}
      {/* ========================================================= */}
      <div className="bg-[#0F131E] border border-[#21253C] p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="w-4 h-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Cari dialog, aksi, kejadian..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#090A14] text-slate-100 placeholder-slate-500 text-xs rounded-xl border border-[#1E2136] focus:border-amber-500 focus:outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCopyCleanText(cleanScriptText)}
            className="px-3.5 py-2 rounded-xl bg-[#14182B] hover:bg-[#1C203B] text-slate-200 hover:text-white border border-[#232742] text-xs font-mono transition flex items-center gap-1.5"
          >
            {copiedAllState ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Naskah Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Salin Naskah</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadTxt}
            className="px-3.5 py-2 rounded-xl bg-[#14182B] hover:bg-[#1C203B] text-slate-200 hover:text-white border border-[#232742] text-xs font-mono transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Unduh TXT</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB A: DETAILED SCREENPLAY VIEW (PURA NASKAH & STORYBOARD) */}
      {/* ========================================================= */}
      {activeTab === 'screenplay' && (
        <div className="space-y-4">
          {filteredScenes.length === 0 ? (
            <div className="bg-[#0F131E] border border-[#21253C] p-8 text-center rounded-2xl text-slate-400">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs">Tidak ditemukan kecocokan untuk kata kunci atau filter "{searchQuery || sceneFilter}"</p>
            </div>
          ) : (
            filteredScenes.map((sc, sIdx) => {
              const scShots = shots[sc.id] || [];

              return (
                <div
                  key={sc.id}
                  className="bg-[#0F131E] border border-[#21253C] rounded-2xl overflow-hidden shadow-lg"
                >
                  {/* Scene header bar */}
                  <div className="bg-[#121626] border-b border-[#1E2238] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-black bg-amber-500 text-black px-2 py-0.5 rounded">
                        SCENE {String(sc.scene_number || sIdx + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide">
                          {sc.title || `Adegan ${sc.scene_number}`}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                          <span className="text-slate-300 font-bold">{sc.location_name}</span>
                          <span>•</span>
                          <span className="text-amber-300">{sc.time_of_day}</span>
                          <span>•</span>
                          <span className="text-indigo-300">{sc.duration_sec} detik</span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 self-start sm:self-center">
                      {scShots.length} Shots
                    </span>
                  </div>

                  {/* Scene Body */}
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Story purpose / overview of scene */}
                    <div className="bg-[#141829] border-l-3 border-amber-500 p-3.5 rounded-r-xl text-xs space-y-1">
                      <span className="font-mono text-[9px] text-amber-400 font-bold uppercase tracking-widest block">ALUR CERITA ADEGAN:</span>
                      <p className="text-slate-200 leading-relaxed font-sans">{sc.event || sc.story_purpose}</p>
                    </div>

                    {/* Master frame if generated */}
                    {sc.master_frame_image_url && (
                      <div className="rounded-xl overflow-hidden border border-[#1E223B] bg-[#0A0C16] p-1 max-w-xl">
                        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest px-2 py-1 block">Master Scene Frame</span>
                        <img
                          src={sc.master_frame_image_url}
                          alt="Master Scene Frame"
                          className="w-full h-48 object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    {/* Shots iteration */}
                    <div className="space-y-4 pt-2">
                      <h4 className="text-[9px] font-mono text-slate-500 uppercase tracking-widest border-b border-[#181B2E] pb-1">
                        SHOT SEQUENCE DETAILS
                      </h4>

                      {scShots.map((sh, shIdx) => {
                        const shotImg = sh.image_url || sh.shot_image_url;

                        return (
                          <div
                            key={sh.id || shIdx}
                            className="bg-[#090B12] border border-[#1B1E32] rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start"
                          >
                            {/* Left Side: Storyboard image result */}
                            <div className="w-full md:w-48 shrink-0">
                              {shotImg ? (
                                <div className="rounded-lg overflow-hidden border border-[#21243B] bg-slate-950 aspect-video relative group cursor-zoom-in">
                                  <img
                                    src={shotImg}
                                    alt={`Storyboard frame shot ${sh.shot_number}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[8px] font-mono text-center text-slate-300 opacity-0 group-hover:opacity-100 transition">
                                    Click to zoom
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-lg border-2 border-dashed border-[#1E2238] bg-[#090A14] aspect-video flex flex-col items-center justify-center text-slate-600 p-2 text-center">
                                  <ImageIcon className="w-5 h-5 mb-1 text-slate-600" />
                                  <span className="text-[8px] font-mono">No Storyboard Visual yet</span>
                                </div>
                              )}
                            </div>

                            {/* Right Side: Script detail (Aksi, Dialog, Narasi) */}
                            <div className="flex-1 space-y-2.5 w-full">
                              <div className="flex items-center gap-2 text-[10px] font-mono">
                                <span className="text-indigo-400 font-bold bg-[#141829] px-2 py-0.5 rounded border border-[#21253E]">
                                  SHOT {sh.shot_number}
                                </span>
                                <span className="text-slate-400">({sh.start_time_sec}s - {sh.end_time_sec}s)</span>
                                <span className="text-amber-500">[{sh.shot_type || 'Medium Shot'} - {sh.camera_movement || 'Subtle Push-in'}]</span>
                              </div>

                              {/* Aksi visual */}
                              <div className="text-xs text-slate-200 font-sans leading-relaxed">
                                <strong className="text-indigo-400/80 font-mono text-[9px] uppercase tracking-wider block mb-0.5">Aksi Visual &amp; Kejadian:</strong>
                                {sh.character_action || ''} {sh.event_detail || ''}
                              </div>

                              {sh.camera_note && (
                                <div className="text-[11px] text-slate-400 italic">
                                  <strong className="text-slate-500 font-mono text-[9px] uppercase block">Kamera:</strong>
                                  {sh.camera_note}
                                </div>
                              )}

                              {/* Movie dialogue */}
                              {sh.dialogue && sh.dialogue.length > 0 && (
                                <div className="bg-[#121526]/50 border-l border-purple-500/40 p-2.5 rounded-r-lg max-w-md space-y-2 my-2">
                                  {sh.dialogue.map((d, dIdx) => (
                                    <div key={dIdx} className="text-left">
                                      <span className="text-[10px] font-mono font-bold text-amber-300 uppercase mr-1.5">{d.character_name}:</span>
                                      <span className="text-xs text-slate-300 italic font-serif">"{d.line}"</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Narasi Audio & VO / SFX */}
                              {(sh.audio_narration || sh.sound_effects) && (
                                <div className="text-[11px] font-mono text-slate-400 border-t border-[#13172E] pt-2 flex flex-wrap gap-x-4 gap-y-1">
                                  {sh.audio_narration && (
                                    <span>
                                      <strong className="text-emerald-400 mr-1">🔈 Narasi VO:</strong>
                                      {sh.audio_narration}
                                    </span>
                                  )}
                                  {sh.sound_effects && (
                                    <span>
                                      <strong className="text-cyan-400 mr-1">🎵 SFX:</strong>
                                      {sh.sound_effects}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB B: VISUAL STORYBOARD BOARD GRID (FULL KISAH)           */}
      {/* ========================================================= */}
      {activeTab === 'grid' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredScenes.flatMap((sc, sIdx) => {
              const scShots = shots[sc.id] || [];
              return scShots.map((sh, shIdx) => {
                const shotImg = sh.image_url || sh.shot_image_url;

                return (
                  <div
                    key={`${sc.id}-${sh.id || shIdx}`}
                    className="bg-[#0F131E] border border-[#21253C] rounded-2xl overflow-hidden shadow-lg flex flex-col hover:border-amber-500/40 transition duration-300"
                  >
                    {/* Visual frame anchor */}
                    <div className="relative aspect-video w-full bg-slate-950">
                      {shotImg ? (
                        <img
                          src={shotImg}
                          alt={`Shot frame ${sh.shot_number}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                          <ImageIcon className="w-6 h-6 mb-1 text-slate-700" />
                          <span className="text-[10px] font-mono">No Storyboard Frame</span>
                        </div>
                      )}
                      
                      {/* Top Overlay Badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-1">
                        <span className="text-[8px] font-mono font-black bg-amber-500 text-black px-1.5 py-0.5 rounded shadow">
                          SCENE {String(sc.scene_number || sIdx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[8px] font-mono font-black bg-[#121526]/90 text-indigo-300 border border-[#232742] px-1.5 py-0.5 rounded shadow">
                          SHOT {sh.shot_number}
                        </span>
                      </div>

                      {/* Bottom duration overlay */}
                      <div className="absolute bottom-2 right-2 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-slate-300">
                        {sh.start_time_sec}s - {sh.end_time_sec}s
                      </div>
                    </div>

                    {/* Meta info & Captions */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        {/* Title location */}
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          {sc.location_name} • <span className="text-amber-400">{sh.shot_type || 'Medium Shot'}</span>
                        </div>

                        {/* Event detailedcaption */}
                        <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed">
                          {sh.character_action || ''} {sh.event_detail || ''}
                        </p>

                        {/* Dialogue */}
                        {sh.dialogue && sh.dialogue.length > 0 && (
                          <div className="border-l border-purple-500/30 pl-2 py-0.5 text-[11px] italic text-purple-200/90 line-clamp-2">
                            {sh.dialogue.map(d => `${d.character_name}: "${d.line}"`).join(' | ')}
                          </div>
                        )}
                      </div>

                      {/* Narasi Audio */}
                      {sh.audio_narration && (
                        <div className="text-[10px] font-mono text-emerald-400 truncate pt-2 border-t border-[#1C2037]">
                          🔈 {sh.audio_narration}
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. THEATER READING MODE MODAL (LAYAR PENUH)               */}
      {/* ========================================================= */}
      {isReaderOpen && (
        <div className="fixed inset-0 bg-[#06080F]/98 z-50 flex flex-col animate-in fade-in duration-200">
          
          {/* Top reader controls */}
          <div className="bg-[#0B0D16] border-b border-[#1E223A] px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-amber-500 text-black px-2 py-0.5 rounded">
                THEATER READER MODE
              </span>
              <span className="text-xs text-slate-400 truncate hidden sm:inline">
                {project?.title || 'Hasan Munadi'}
              </span>
            </div>

            {/* Typography and styling controls inside theater reader */}
            <div className="flex items-center gap-3">
              {/* Font Family selector */}
              <div className="flex items-center bg-[#131626] rounded-lg p-0.5 border border-[#232742]">
                <button
                  onClick={() => setReaderFontFamily('serif')}
                  className={`px-2 py-1 text-[10px] font-serif font-black rounded ${
                    readerFontFamily === 'serif' ? 'bg-amber-500 text-black' : 'text-slate-400'
                  }`}
                  title="Gaya Font Klasik Film"
                >
                  Classic
                </button>
                <button
                  onClick={() => setReaderFontFamily('sans')}
                  className={`px-2 py-1 text-[10px] font-sans font-bold rounded ${
                    readerFontFamily === 'sans' ? 'bg-amber-500 text-black' : 'text-slate-400'
                  }`}
                  title="Gaya Font Modern"
                >
                  Modern
                </button>
                <button
                  onClick={() => setReaderFontFamily('mono')}
                  className={`px-2 py-1 text-[10px] font-mono rounded ${
                    readerFontFamily === 'mono' ? 'bg-amber-500 text-black' : 'text-slate-400'
                  }`}
                  title="Gaya Font Screenplay"
                >
                  Courier
                </button>
              </div>

              {/* Font size control */}
              <div className="flex items-center bg-[#131626] rounded-lg p-0.5 border border-[#232742]">
                <button
                  onClick={() => setReaderFontSize('sm')}
                  className={`px-2 py-1 text-[10px] rounded ${
                    readerFontSize === 'sm' ? 'bg-[#1C2039] text-white' : 'text-slate-500'
                  }`}
                >
                  A-
                </button>
                <button
                  onClick={() => setReaderFontSize('md')}
                  className={`px-2 py-1 text-[10px] rounded font-bold ${
                    readerFontSize === 'md' ? 'bg-[#1C2039] text-white' : 'text-slate-500'
                  }`}
                >
                  A
                </button>
                <button
                  onClick={() => setReaderFontSize('lg')}
                  className={`px-2 py-1 text-[10px] rounded ${
                    readerFontSize === 'lg' ? 'bg-[#1C2039] text-white' : 'text-slate-500'
                  }`}
                >
                  A+
                </button>
              </div>

              {/* Close button */}
              <button
                onClick={() => setIsReaderOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Reader Body: Sidebar index + Content pane */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Sidebar quick index */}
            <div className="w-64 bg-[#0A0C16] border-r border-[#1C1F37] overflow-y-auto p-4 hidden md:block space-y-2">
              <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-3">
                Quick Navigation
              </h4>
              <button
                onClick={() => {
                  const el = document.getElementById('reader-scene-all');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-mono text-slate-300 hover:bg-[#131628] block"
              >
                Lihat Semua Adegan
              </button>

              <div className="space-y-1.5 pt-2 border-t border-[#13172E]">
                {scenes.map((sc, sIdx) => (
                  <button
                    key={sc.id}
                    onClick={() => {
                      const el = document.getElementById(`reader-scene-${sc.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-[#131628] truncate block"
                  >
                    Adegan {String(sc.scene_number || sIdx + 1).padStart(2, '0')}: {sc.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Content pane */}
            <div className="flex-1 overflow-y-auto bg-[#070912] p-5 sm:p-10">
              <div id="reader-scene-all" className="max-w-2xl mx-auto space-y-12 pb-32">
                
                {/* Intro script heading */}
                <div className="text-center space-y-2 pb-8 border-b border-[#1D2138]">
                  <h1 className="font-serif text-3xl font-bold tracking-tight text-white uppercase">
                    {project?.title || 'HASAN MUNADI'}
                  </h1>
                  <p className="text-xs font-mono text-slate-400">
                    Naskah Alur Cerita &amp; Storyboard Lengkap ({scenes.length} Adegan • {totalShotsCount} Shots)
                  </p>
                  <p className="text-xs text-slate-500 font-sans italic max-w-md mx-auto leading-relaxed pt-2">
                    "{storySummary}"
                  </p>
                </div>

                {/* Render screenplay sequentially */}
                {scenes.map((sc, sIdx) => {
                  const scShots = shots[sc.id] || [];

                  return (
                    <div
                      key={sc.id}
                      id={`reader-scene-${sc.id}`}
                      className="space-y-6 pt-6 border-t border-[#16192E] first:border-none"
                    >
                      {/* Scene Title */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-black">
                          Adegan {String(sc.scene_number || sIdx + 1).padStart(2, '0')}
                        </div>
                        <h2 className="text-base sm:text-lg font-black text-white uppercase font-serif">
                          {sc.title}
                        </h2>
                        <p className="text-[11px] font-mono text-slate-400">
                          LOKASI: <span className="text-slate-300">{sc.location_name}</span> | WAKTU: <span className="text-amber-300">{sc.time_of_day}</span>
                        </p>
                      </div>

                      {/* Narasi Alur adegan */}
                      <div className="bg-[#14172B]/40 border-l-2 border-amber-500/70 p-3.5 rounded-r-xl text-xs sm:text-sm">
                        <strong className="text-[9px] font-mono text-amber-400 uppercase tracking-widest block mb-1">NARASI UTAMA ADEGAN:</strong>
                        <p className="text-slate-200 leading-relaxed font-sans italic">
                          {sc.event || sc.story_purpose}
                        </p>
                      </div>

                      {/* Storyboard images & screenplay shots details */}
                      <div className="space-y-6 pl-1 sm:pl-3">
                        {scShots.map((sh, shIdx) => {
                          const shotImg = sh.image_url || sh.shot_image_url;

                          return (
                            <div key={sh.id || shIdx} className="space-y-3.5 pt-3 border-t border-[#121528]/80 first:border-none">
                              {/* Shot label */}
                              <div className="text-[10px] font-mono text-slate-500 tracking-wider uppercase flex items-center gap-2">
                                <span className="text-indigo-400 font-bold bg-[#141829] px-2 py-0.5 rounded border border-[#21253E]">
                                  Shot {sh.shot_number}
                                </span>
                                <span>({sh.start_time_sec}s - {sh.end_time_sec}s)</span>
                                <span className="text-amber-500">[{sh.shot_type || 'Medium Shot'}, {sh.camera_movement || 'Subtle'}]</span>
                              </div>

                              {/* Storyboard shot frame */}
                              {shotImg && (
                                <div className="rounded-xl overflow-hidden border border-[#1B1E34] bg-slate-950 max-w-md my-2 aspect-video">
                                  <img
                                    src={shotImg}
                                    alt={`Shot storyboard frame`}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}

                              {/* Action Visual details */}
                              <p className={`text-slate-100 ${fontClass()} ${fontSizeClass()} leading-relaxed pl-1`}>
                                <strong className="text-[9px] text-indigo-400 font-mono tracking-wider mr-1.5">[AKSI]:</strong>
                                {sh.character_action || ''} {sh.event_detail || ''}
                              </p>

                              {/* Camera directive */}
                              {sh.camera_note && (
                                <p className="text-slate-400 italic text-[11px] font-sans pl-1">
                                  Camera Note: {sh.camera_note}
                                </p>
                              )}

                              {/* Centered screenplay formatting dialogues */}
                              {sh.dialogue && sh.dialogue.length > 0 && (
                                <div className="space-y-3.5 my-3 py-2 bg-[#121526]/20 max-w-md mx-auto rounded-xl border border-[#1A1D33]">
                                  {sh.dialogue.map((d, dIdx) => (
                                    <div key={dIdx} className="text-center">
                                      <div className="text-[10px] font-mono font-black text-amber-300 uppercase tracking-widest">
                                        {d.character_name}
                                      </div>
                                      <div className={`text-slate-300 italic font-serif px-6 mt-1 leading-relaxed ${fontSizeClass()}`}>
                                        "{d.line}"
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* VO Narration or SFX */}
                              {(sh.audio_narration || sh.sound_effects) && (
                                <div className="pl-1 text-[11px] font-mono text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                                  {sh.audio_narration && (
                                    <span>
                                      <strong className="text-emerald-400 font-bold mr-1">🔈 Voice:</strong>
                                      {sh.audio_narration}
                                    </span>
                                  )}
                                  {sh.sound_effects && (
                                    <span>
                                      <strong className="text-cyan-400 font-bold mr-1">🎵 SFX:</strong>
                                      {sh.sound_effects}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
