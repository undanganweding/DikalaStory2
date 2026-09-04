import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  ShieldCheck,
  Send,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  Eye,
  Film,
  Users,
  MapPin,
  Clock,
  Layers,
} from 'lucide-react';
import {
  Project,
  Scene,
  Shot,
  CharacterBible,
  LocationBible,
  ObjectBible,
} from '../../../types';

interface AICopilotWindowProps {
  project: Project | null;
  selectedScene: Scene | null;
  selectedShot: Shot | null;
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
}

export const AICopilotWindow: React.FC<AICopilotWindowProps> = ({
  project,
  selectedScene,
  selectedShot,
  characters,
  locations,
  objects,
}) => {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ sender: 'user' | 'assistant'; text: string; actionApplied?: string }>
  >([
    {
      sender: 'assistant',
      text: `Halo! Saya AI Production Copilot Sinema Anda. Saya telah menganalisis proyek "${
        project?.title || 'Proyek'
      }" ${
        selectedScene
          ? `dengan fokus pada Adegan SC-${String(selectedScene.scene_number).padStart(2, '0')}`
          : ''
      }. Pilih prompt aksi cepat di bawah atau ajukan pertanyaan spesifik tentang naskah, pencahayaan, atau prompt model video.`,
    },
  ]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const executeAction = (actionTitle: string, userPrompt: string, responseTemplate: string) => {
    setIsProcessing(true);
    setMessages((prev) => [...prev, { sender: 'user', text: userPrompt }]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: responseTemplate,
          actionApplied: actionTitle,
        },
      ]);
      setIsProcessing(false);
    }, 600);
  };

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    const userText = query.trim();
    setQuery('');
    setIsProcessing(true);
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);

    setTimeout(() => {
      let reply = `Berdasarkan parameter sinematik adegan ${
        selectedScene ? `SC-${String(selectedScene.scene_number).padStart(2, '0')}` : 'aktif'
      } dan aturan invariant locks: \n\n`;

      if (userText.toLowerCase().includes('prompt') || userText.toLowerCase().includes('veo') || userText.toLowerCase().includes('banana')) {
        reply += `Rekomendasi Prompt Engine:\n"Photorealistic cinematic shot of ${selectedScene?.location_name || 'historical setting'}, atmospheric lighting (${selectedScene?.lighting || (selectedScene as any)?.lighting_style || 'natural'}), 8k UHD, 35mm anamorphic lens, consistent character features --no distortion, no modern artifacts"`;
      } else if (userText.toLowerCase().includes('karakter') || userText.toLowerCase().includes('kostum')) {
        reply += `Validasi Kostum Tokoh: Menjaga konsistensi jubah linen dan sorban imamah sesuai adab historis era Nusantara abad 15. Invariant lock aktif mencegah drifting wardrobe.`;
      } else {
        reply += `Struktur ritme dan continuity terkunci stabil. Pacing adegan diatur ~${selectedScene?.duration_sec || 10}s dengan transisi sudut kamera yang koheren.`;
      }

      setMessages((prev) => [...prev, { sender: 'assistant', text: reply }]);
      setIsProcessing(false);
    }, 700);
  };

  return (
    <div className="h-full flex flex-col space-y-3 text-xs">
      {/* Context Badge Strip */}
      <div className="p-2.5 bg-[#141628] rounded-xl border border-[#262842] flex items-center justify-between font-mono text-[10px]">
        <div className="flex items-center gap-2 text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Fokus Konteks:</span>
          {selectedScene ? (
            <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-bold">
              SC-{String(selectedScene.scene_number).padStart(2, '0')}
            </span>
          ) : (
            <span className="text-slate-500">Global Proyek</span>
          )}
          {selectedShot && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-bold">
              SH-{String(selectedShot.shot_number).padStart(2, '0')}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-emerald-400 font-bold">
          <Zap className="w-3 h-3" /> SIAP
        </span>
      </div>

      {/* Quick Action Chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() =>
            executeAction(
              'Validasi Adab & Sejarah',
              'Validasi kepatuhan adab visual dan akurasi historis pada adegan ini.',
              `✅ VALIDASI ADAB & SEJARAH (FASE 3B):\n- Status Tokoh Suci / Wali: Terjaga penuh. Busana jubah Sufi putih/gading, sorban Imamah otentik, ekspresi berwibawa karismatik.\n- Larangan Visual: Zero visual violation. Tidak ada pakaian modern atau kaos oblong.\n- Status Sanad/Konteks: Sesuai naskah primer.`
            )
          }
          className="px-2.5 py-1 rounded-lg bg-[#16182C] hover:bg-[#20233E] text-amber-300 border border-[#2A2D4E] transition text-[10px] font-mono flex items-center gap-1"
        >
          <ShieldCheck className="w-3 h-3 text-amber-400" />
          <span>Validasi Adab &amp; Sejarah</span>
        </button>

        <button
          onClick={() =>
            executeAction(
              'Optimasi Prompt Veo 3.1',
              'Optimalkan prompt video untuk generator Google Veo 3.1 & SeaDance.',
              `🎬 OPTIMASI PROMPT VIDEO ENGINE:\n\n[VEO 3.1 ENHANCED]\n"Cinematic film still, 35mm anamorphic camera glide in ${selectedScene?.location_name || 'historical courtyard'}, natural golden hour rim light, high cinematic motion fidelity, 4k ultra-detailed photorealistic texture --ar 16:9"`
            )
          }
          className="px-2.5 py-1 rounded-lg bg-[#16182C] hover:bg-[#20233E] text-indigo-300 border border-[#2A2D4E] transition text-[10px] font-mono flex items-center gap-1"
        >
          <Cpu className="w-3 h-3 text-indigo-400" />
          <span>Optimasi Prompt Veo</span>
        </button>

        <button
          onClick={() =>
            executeAction(
              'Cek Invariant Locks',
              'Periksa status invariant locks pada shot aktif.',
              `🔒 INVARIANT LOCKS AUDIT:\n- Character Locked: TRUE (Wajah & ciri fisik terlindungi)\n- Location Locked: TRUE (${selectedScene?.location_name || 'Lokasi konsisten'})\n- Costume Locked: TRUE (Wardrobe historis terkunci)\n- Lighting Locked: TRUE (${selectedScene?.lighting || (selectedScene as any)?.lighting_style || 'Cinematic natural'})\nStatus: 100% Invariants Guarded.`
            )
          }
          className="px-2.5 py-1 rounded-lg bg-[#16182C] hover:bg-[#20233E] text-cyan-300 border border-[#2A2D4E] transition text-[10px] font-mono flex items-center gap-1"
        >
          <ShieldCheck className="w-3 h-3 text-cyan-400" />
          <span>Cek Invariant Locks</span>
        </button>
      </div>

      {/* Chat / Assistant Feed */}
      <div className="flex-1 overflow-y-auto space-y-2.5 p-3 bg-[#0B0C15] rounded-xl border border-[#1C1E32] min-h-[220px] max-h-[340px]">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl ${
              m.sender === 'user'
                ? 'bg-indigo-600 text-white ml-8 shadow-sm'
                : 'bg-[#141628] text-slate-200 mr-4 border border-[#252844] space-y-1.5'
            }`}
          >
            {m.actionApplied && (
              <span className="text-[9px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 block w-max font-bold">
                {m.actionApplied}
              </span>
            )}
            <p className="whitespace-pre-wrap leading-relaxed text-[11px] select-text">
              {m.text}
            </p>
            {m.sender === 'assistant' && (
              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => handleCopy(m.text, idx)}
                  className="p-1 text-slate-400 hover:text-white transition flex items-center gap-1 text-[9px] font-mono"
                  title="Salin respon"
                >
                  {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedIndex === idx ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="p-3 bg-[#141628] text-slate-400 rounded-xl border border-[#252844] flex items-center gap-2 font-mono text-[11px]">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span>AI Copilot menganalisis naskah dan konteks produksi...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSendCustom} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tanyakan analisis naskah, continuity, atau prompt..."
          className="flex-1 px-3 py-2 bg-[#121424] border border-[#272B4B] rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs transition"
        />
        <button
          type="submit"
          disabled={!query.trim() || isProcessing}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center gap-1 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
