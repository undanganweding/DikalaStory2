import React, { useState } from 'react';
import {
  Users,
  MapPin,
  Package,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Search,
} from 'lucide-react';
import { CharacterBible, LocationBible, ObjectBible } from '../../types';

interface AssetBibleWorkspaceProps {
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
}

export function isReveredHolyFigureClient(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower.includes('sunan') ||
    lower.includes('wali') ||
    lower.includes('waliyullah') ||
    lower.includes('kyai') ||
    lower.includes('kiai') ||
    lower.includes('habib') ||
    lower.includes('ulama') ||
    lower.includes('syekh') ||
    lower.includes('sheikh') ||
    lower.includes('ustadz') ||
    lower.includes('ustad') ||
    lower.includes('nabi') ||
    lower.includes('rasul') ||
    lower.includes('prophet') ||
    lower.includes('imam') ||
    lower.includes('buya') ||
    lower.includes('gus')
  );
}

export function getDynamicNegativePrompt(name: string, physical: string, type: 'character' | 'location' | 'object'): string {
  const nameLower = name.toLowerCase();
  const descLower = physical.toLowerCase();
  const combined = `${nameLower} ${descLower}`;

  const isProphet = nameLower.includes('rasulullah') || nameLower.includes('muhammad') || nameLower.includes('prophetic') || descLower.includes('prophet');
  const isJavanese = combined.includes('java') || combined.includes('jawa') || combined.includes('sunan') || combined.includes('wali') || combined.includes('demak') || combined.includes('mataram') || combined.includes('majapahit') || combined.includes('cirebon') || combined.includes('giri');
  const isMiddleEastern = combined.includes('makkah') || combined.includes('prophetic') || combined.includes('arab') || combined.includes('desert') || combined.includes('tsur') || combined.includes('hijrah');

  const baseAnatomy = 'extra fingers, missing fingers, malformed hands, extra limbs, distorted anatomy, quality loss, low-res, blurry, watermark, copyright logo';
  const modernTech = 'cars, automobiles, motorcycles, traffic lights, neon signs, electricity poles, power lines, cell phones, smartphones, wristwatches, sunglasses, plastic water bottles, soda cans';

  if (type === 'character') {
    const isHoly = isJavanese && (nameLower.includes('sunan') || nameLower.includes('wali') || nameLower.includes('kyai') || nameLower.includes('habib') || nameLower.includes('ulama') || nameLower.includes('syekh') || nameLower.includes('ustadz'));
    
    let identity = 'inconsistent facial features, cartoon look, 3D render, anime';
    if (isProphet) {
      identity = 'face visible, face depicted, face shown, eyes visible, mouth visible, frontal face portrait, facial features depicted, direct eye contact';
    } else if (isHoly) {
      identity = 'undignified facial expression, silly face, disheveled hair, casual daily look, shabby appearance, angry scowling face';
    }

    const clothes = `modern clothing, t-shirt, jeans, zippers, sneakers, plastic buttons, modern sportswear, jacket, ${isJavanese ? 'modern Javanese printed batik shirt, modern bridal kebaya' : ''}`;

    return `${baseAnatomy}, ${modernTech}, ${identity}, ${clothes}`;
  } else if (type === 'location') {
    const isIndoors = combined.includes('mosque') || combined.includes('masjid') || combined.includes('pendopo') || combined.includes('palace') || combined.includes('keraton') || combined.includes('room') || combined.includes('interior') || combined.includes('house') || combined.includes('inside');
    const indoorExclusion = isIndoors ? 'air conditioning, ceiling fans, electrical wiring, modern light fixtures, fluorescent tubes, fire extinguishers, plastic chairs, office desks' : 'interior walls, ceiling fans, furniture, floor tiles';

    return `${baseAnatomy}, ${modernTech}, modern skyscrapers, paved asphalt roads, concrete highways, ${indoorExclusion}`;
  } else {
    // object
    return `${baseAnatomy}, ${modernTech}, modern plastic containers, glossy synthetic materials, modern logos, barcodes, mass-produced machine parts`;
  }
}

export function getDetailedHolyFigurePromptAndNegative(char: CharacterBible): { prompt: string; negativePrompt: string; aiControl: string; ending: string; fullBundle: string } {
  const ageStr = char.age ? `around ${char.age}` : 'around 50-60';
  const nameClean = char.name;
  
  // Decide Sultanate / Era
  let sultanateEra = 'Demak Sultanate';
  let craftStyle = 'Demak';
  let backgroundSetting = 'Demak-Cirebon';
  const lowerName = char.name.toLowerCase();
  
  if (lowerName.includes('gunung jati') || lowerName.includes('cirebon') || lowerName.includes('hidayatullah')) {
    sultanateEra = 'Cirebon Sultanate';
    craftStyle = 'Cirebon';
    backgroundSetting = 'Cirebon';
  } else if (lowerName.includes('giri')) {
    sultanateEra = 'Giri Kedaton';
    craftStyle = 'Giri';
    backgroundSetting = 'Giri Kedaton';
  } else if (lowerName.includes('ampel') || lowerName.includes('rahmat')) {
    sultanateEra = 'Demak-Ampeldenta';
    craftStyle = 'Ampeldenta';
    backgroundSetting = 'Ampeldenta';
  } else if (lowerName.includes('kalijaga') || lowerName.includes('said')) {
    sultanateEra = 'Demak Sultanate';
    craftStyle = 'Demak/Mataram';
    backgroundSetting = 'Demak-Mataram';
  }

  // Customize clothing based on characters
  let headwearDesc = '';
  let robeDesc = '';
  let innerDesc = '';

  if (lowerName.includes('kalijaga') || lowerName.includes('said')) {
    headwearDesc = 'His head is adorned with a traditional Javanese Blangkon headgear (Mondokan Jawi Jati) or a finely wrapped Javanese noble iket, made from custom handwoven batik cotton, looking naturally aged and historical.';
    robeDesc = 'Underneath he wears an authentic Javanese noble Surjan Lurik or Baju Taqwa Wali in dark earthy brown or black tones, with wide flowing sleeves, handmade stitching, rough Javanese woven texture, natural fabric imperfections, and historical simplicity.';
    innerDesc = 'His inner clothing consists of a dark traditional Javanese long shirt with subtle woven patterns. Around his waist is a traditional ancient Javanese jarik cloth with authentic 16th century Javanese batik Parang Barong or Sidomukti motifs, dark earthy colors, handmade wax-resist patterns, wrapped naturally around the body.';
  } else {
    headwearDesc = 'His head is wrapped with a traditional white Javanese turban (iket/turban style), made from handwoven cotton cloth, carefully layered with visible fabric folds, natural creases, slightly uneven handmade texture. The turban looks aged naturally, not modern, with soft cotton fibers visible.';
    robeDesc = 'Underneath he wears a loose long traditional robe (jubah) in light ivory and pale gray tones, inspired by early Islamic scholars in Java. The robe has wide flowing sleeves, handmade stitching, rough woven texture, natural fabric imperfections, and historical simplicity. It is not Middle Eastern desert clothing but a fusion of Javanese and Islamic culture from coastal Java.';
    innerDesc = `His inner clothing consists of a dark traditional Javanese long shirt with subtle woven patterns. Around his waist is a traditional ancient Javanese jarik cloth with authentic 16th century coastal Javanese batik motifs, dark earthy colors, handmade wax-resist patterns, wrapped naturally around the body.`;
  }

  const aiControl = `MASTERPIECE, SOLO CHARACTER, SINGLE SUBJECT, ONE HISTORICAL PERSON ONLY, CHARACTER FOCUS, FULL BODY HISTORICAL PORTRAIT`;
  const ending = `historical reconstruction photography, authentic 1500s Java, ${sultanateEra} era, museum quality realism`;

  const prompt = `Ultra realistic historical portrait of a single Javanese Islamic scholar and Wali figure from the early 16th century, inspired by ${nameClean} during the ${sultanateEra} era. One person only, the main character standing alone, no other humans.

The figure is an elderly yet dignified Javanese spiritual leader ${ageStr} years old, with a calm and wise expression, deep thoughtful eyes, gentle face, subtle wrinkles showing age and wisdom, natural Southeast Asian facial features, realistic skin pores, authentic human anatomy. He has a neatly maintained short beard and mustache, natural black hair partially covered by traditional headwear.

He wears historically accurate early Islamic Javanese royal religious clothing from the 1500s ${sultanateEra} period.

${headwearDesc}

Around his shoulders is a long traditional white shawl (selendang) made from fine handwoven Javanese cotton, draped naturally over both shoulders and chest. The fabric has realistic weight, wrinkles, folds, and subtle shadows.

${robeDesc}

${innerDesc}

At his waist he wears a simple traditional leather belt combined with a small cloth sash. A historically accurate Javanese keris is tucked into his waist, featuring an old wooden warangka sheath, aged carved wood texture, traditional ${craftStyle} craftsmanship, and a simple antique appearance suitable for a spiritual leader, not a warrior.

In his right hand he holds an old wooden walking staff made from aged teak wood, with visible natural wood grain, scratches, and handmade craftsmanship. In his other hand he holds a string of traditional wooden tasbih prayer beads made from dark natural seeds or wood, each bead individually crafted.

Additional accessories:
- simple silver ring with traditional Javanese craftsmanship
- small cloth pouch attached to waist for personal items
- traditional woven sandals made from natural fibers
- no luxury jewelry, showing humility and spirituality

The character stands with a peaceful humble posture, representing a respected Islamic teacher, scholar, and spiritual leader of 16th century Java.

Environment:
An authentic 16th century ${backgroundSetting} coastal Java setting, historically accurate to the era of ${nameClean}. Background shows an old wooden Javanese pendopo pavilion made from teak wood, traditional carved wooden pillars, ancient stone floor, tropical coastal vegetation, palm trees, old village atmosphere, soft morning mist, warm natural sunlight.

The architecture must resemble early Demak-Cirebon Sultanate period Java:
traditional wooden structures, carved teak details, clay roof tiles, natural earth textures, no modern buildings.

Lighting:
cinematic natural sunlight, soft golden hour lighting, realistic shadows, atmospheric depth, documentary historical photography style.

Camera:
full body portrait, 85mm DSLR lens, shallow depth of field, realistic perspective, ultra detailed skin texture, realistic fabric simulation, National Geographic historical documentary photography style.

8K resolution, photorealistic, hyper realistic, physically accurate materials, realistic human proportions.`;

  const negativePrompt = `multiple people, crowd, group of people, other characters, background people, assistants, soldiers, followers, children, animals near character, duplicate character, two faces, extra body parts, extra hands,

modern clothing, modern turban, modern mosque, modern city, skyscraper, cars, electricity poles, modern houses, modern furniture, contemporary architecture, modern objects,

fantasy costume, Arabian desert clothing, Ottoman clothing, Middle Eastern warrior outfit, medieval European clothing, armor, fantasy robe,

incorrect historical period, futuristic elements, sci-fi, magical effects, glowing aura, fantasy atmosphere,

plastic skin, CGI, 3D render, cartoon, anime, illustration, painting style, artificial face, unrealistic beauty, fake beard,

incorrect accessories, modern jewelry, luxury gold accessories, modern weapons,

bright studio background, white photography studio, artificial background,

busy background, crowded scene, multiple subjects, portrait with other people,

modern Indonesia, modern village, modern mosque, urban environment,

wrong era, 21st century objects, technology, camera visible, microphone, vehicles,

low detail, blurry face, distorted anatomy, bad hands, unrealistic fabric, fake texture`;

  const fullBundle = `AI Control Prompt:
${aiControl}

Prompt:
${prompt}

Negative Prompt:
${negativePrompt}

At the end of prompt:
${ending}`;

  return { prompt, negativePrompt, aiControl, ending, fullBundle };
}

export const AssetBibleWorkspace: React.FC<AssetBibleWorkspaceProps> = ({
  characters,
  locations,
  objects,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'characters' | 'locations' | 'objects'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpandAll = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    characters.forEach((c, idx) => {
      nextState[`char-${c.id || idx}`] = expand;
    });
    locations.forEach((l, idx) => {
      nextState[`loc-${l.id || idx}`] = expand;
    });
    objects.forEach((o, idx) => {
      nextState[`obj-${o.id || idx}`] = expand;
    });
    setExpandedIds(nextState);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper Prompt Accessors
  const formatGarments = (clothing?: string[] | string | null): string => {
    if (!clothing) return '';
    if (Array.isArray(clothing)) return clothing.filter(Boolean).join(', ');
    if (typeof clothing === 'string') return clothing.trim();
    return String(clothing);
  };

  const getCharacterPrompt = (char: CharacterBible) => {
    if (char.master_portrait_prompt && char.master_portrait_prompt.trim().length > 0) return char.master_portrait_prompt;
    const desc = char.physical_description || char.physical_appearance || 'authentic historical facial features';
    const clothingStr = formatGarments(char.clothing);
    let costume = char.costume || char.wardrobe || (clothingStr.length > 0 ? clothingStr : 'traditional clothing');
    const isHoly = isReveredHolyFigureClient(char.name);

    if (isHoly && (costume.length < 15 || costume.toLowerCase().includes('t-shirt') || costume.toLowerCase().includes('kaos') || costume.toLowerCase().includes('casual') || costume.toLowerCase().includes('sederhana'))) {
      const nameLower = char.name.toLowerCase();
      if (nameLower.includes('ampel') || nameLower.includes('raden rahmat')) {
        costume = 'Pristine layered white/ivory fine linen Sufi Imamah (Sorban Putih), noble flowing white/ivory Sufi Jubah (Gamis) outer robe of hand-woven linen cloth, draped emerald-green or white Rida\' shoulder shawl, wooden tasbih prayer beads';
      } else if (nameLower.includes('kalijaga') || nameLower.includes('raden said') || nameLower.includes('jawa')) {
        costume = 'Authentic Javanese noble Wali attire (Surjan Lurik Demak/Mataram or Baju Taqwa Wali in dark brown/black), traditional Blangkon Jawi headgear (Mondokan), fine Jarik Batik Parang Barong sarong skirt, stagen sash';
      } else if (nameLower.includes('giri') || nameLower.includes('raden paku')) {
        costume = 'Regal ruler-scholar Turban (Sorban Putih/Krem dengan hiasan emas), majestic deep green or white Jubah outer robe, Jarik Batik sarong skirt, golden stagen belt';
      } else if (nameLower.includes('gunung jati') || nameLower.includes('cirebon')) {
        costume = 'Magnificent Cirebon Sultanate royal Wali costume (green/white layered Turban with gold emblem), opulent Bisht/Jubah cloak with gold thread embroidery, Cirebon Batik Megamendung sarong';
      } else {
        costume = 'Majestic layered Islamic Sufi Turban (Imamah / Sorban Putih, Hijau, atau Krem), noble flowing outer Robe (Jubah / Abaya / Bisht / Gamis Sufi), draped shoulder sash (Rida\')';
      }
    }

    const holyBonus = isHoly
      ? ', dignified charismatic facial expression, serene radiant aura of spiritual wisdom and sacred wibawa, well-groomed honorable beard'
      : '';
    const holyNeg = isHoly ? ', no t-shirt, no undershirt, no casual villager clothes' : '';

    return `Photorealistic cinematic master portrait of ${char.name}, ${char.age || 'adult'}, ${desc}${holyBonus}, wearing ${costume}, 8k resolution, cinematic golden hour lighting, 85mm portrait lens, ultra-detailed skin texture --no modern clothes${holyNeg}, no noise, no anatomical distortion`;
  };

  const getLocationPrompt = (loc: LocationBible) => {
    if (loc.master_environment_prompt && loc.master_environment_prompt.trim().length > 0) return loc.master_environment_prompt;
    const arch = loc.architectural_style || loc.architecture || 'ancient architecture';
    const env = loc.environment || loc.landscape || loc.description || 'historical landscape';
    const light = loc.lighting_atmosphere || loc.lighting_style || 'natural volumetric lighting';
    return `Cinematic wide master landscape shot of ${loc.name}, featuring ${arch}, ${env}, ${light}, 8k ultra-detailed, photorealistic, 35mm anamorphic lens --no modern buildings, no asphalt, no vehicles`;
  };

  const getObjectPrompt = (obj: ObjectBible) => {
    const mat = obj.material || 'authentic material';
    const desc = obj.description || 'narrative hero prop';
    return `Cinematic close-up hero shot of ${obj.name}, ${desc}, crafted from ${mat}, historical craftsmanship, studio volumetric lighting, 8k resolution, macro lens --no plastic, no modern logos, no AI artifacts`;
  };

  // Filter items based on search & tab
  const query = (searchQuery || '').toLowerCase();

  const filteredCharacters = characters.filter((c) =>
    (activeTab === 'all' || activeTab === 'characters') &&
    ((c?.name || '').toLowerCase().includes(query) ||
      (c?.physical_description || c?.physical_appearance || '').toLowerCase().includes(query))
  );

  const filteredLocations = locations.filter((l) =>
    (activeTab === 'all' || activeTab === 'locations') &&
    ((l?.name || '').toLowerCase().includes(query) ||
      (l?.description || l?.environment || '').toLowerCase().includes(query))
  );

  const filteredObjects = objects.filter((o) =>
    (activeTab === 'all' || activeTab === 'objects') &&
    ((o?.name || '').toLowerCase().includes(query) ||
      (o?.description || '').toLowerCase().includes(query))
  );

  const totalAssets = characters.length + locations.length + objects.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#181926] border border-[#2B2D44] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-amber-400 font-bold">
            <Layers className="w-4 h-4" />
            <span>Stage 2 &amp; 3 • Visual Asset Bibles</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Visual Asset &amp; Bible Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
            Daftar ringkas Character Bible, Location Bible, dan Object Bible. Default collapsed untuk tampilan ringkas dengan tombol salin prompt 1-klik.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => toggleExpandAll(true)}
            className="px-3 py-2 bg-[#212335] hover:bg-[#282B42] text-slate-300 rounded-xl text-xs font-semibold border border-[#2F324D] transition"
          >
            Buka Semua
          </button>
          <button
            onClick={() => toggleExpandAll(false)}
            className="px-3 py-2 bg-[#212335] hover:bg-[#282B42] text-slate-300 rounded-xl text-xs font-semibold border border-[#2F324D] transition"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <span>Semua Asset</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20">
              {totalAssets}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('characters')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'characters'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Karakter / Tokoh</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-amber-300">
              {characters.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('locations')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'locations'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Lokasi &amp; Latar</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-cyan-300">
              {locations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('objects')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'objects'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Objek &amp; Pusaka</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-emerald-300">
              {objects.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari asset, nama tokoh, atau material..."
            className="w-full bg-[#1B1C2E] border border-[#2B2D44] focus:border-indigo-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition"
          />
        </div>
      </div>

      {/* 1. SECTION: CHARACTERS */}
      {(activeTab === 'all' || activeTab === 'characters') && filteredCharacters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
            <Users className="w-4 h-4" />
            <span>1. Character Bibles &amp; Prompts ({filteredCharacters.length})</span>
          </div>

          <div className="space-y-3">
            {filteredCharacters.map((char, idx) => {
              const cardId = `char-${char.id || idx}`;
              const isExpanded = expandedIds[cardId] ?? false; // DEFAULT IS COLLAPSED (false)
              const isHoly = isReveredHolyFigureClient(char.name);
              const holyData = isHoly ? getDetailedHolyFigurePromptAndNegative(char) : null;
              const promptStr = getCharacterPrompt(char);

              return (
                <div
                  key={cardId}
                  className={`bg-[#1B1C2E] border rounded-2xl p-4 space-y-3 shadow-xl transition ${
                    isHoly ? 'border-amber-500/40 hover:border-amber-500/80 bg-[#1D1B28]' : 'border-[#2B2D44] hover:border-amber-500/40'
                  }`}
                >
                  {/* Card Header Bar */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                        {char.role || (isHoly ? 'Waliyullah / Ulama' : 'Tokoh Utama')}
                      </span>
                      <h3 className="text-base font-extrabold text-white">{char.name}</h3>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/20 hidden sm:inline-block">
                        Identity Lock v{char.identity_version || 1} 🔒
                      </span>
                      {isHoly && (
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 hidden lg:inline-block">
                          Historical Reconstruction Mode ✨
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isHoly && holyData ? (
                        <button
                          onClick={() => handleCopy(holyData.fullBundle, `${cardId}-full`)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
                          title="Salin Seluruh Paket Prompt & Negative Prompt"
                        >
                          {copiedId === `${cardId}-full` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === `${cardId}-full` ? 'Tersalin!' : 'Salin Paket Lengkap'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCopy(promptStr, cardId)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
                          title="Salin Prompt Visual Karakter 1-Klik"
                        >
                          {copiedId === cardId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === cardId ? 'Tersalin!' : 'Salin Prompt Karakter'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => toggleExpand(cardId)}
                        className="p-1.5 rounded-xl bg-[#212335] hover:bg-[#282B42] text-slate-400 hover:text-white transition border border-[#2F324D]"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Copyable Prompt Box */}
                  {isHoly && holyData ? (
                    <div className="space-y-3">
                      {/* Control & Positive Prompt Box */}
                      <div className="p-3 rounded-xl bg-[#121320] border border-amber-500/20 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Historical Positive Prompt
                          </span>
                          <button
                            onClick={() => handleCopy(holyData.prompt, `${cardId}-pos`)}
                            className="text-amber-300 hover:text-white flex items-center gap-1 transition font-bold"
                          >
                            {copiedId === `${cardId}-pos` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Salin Positif</span>
                          </button>
                        </div>
                        <p className="font-mono text-xs text-slate-300 leading-relaxed select-all max-h-40 overflow-y-auto pr-1">
                          {holyData.prompt}
                        </p>
                      </div>

                      {/* Negative Prompt Box */}
                      <div className="p-3 rounded-xl bg-[#121320] border border-red-500/15 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            ⚠️ Negative Prompt
                          </span>
                          <button
                            onClick={() => handleCopy(holyData.negativePrompt, `${cardId}-neg`)}
                            className="text-red-300 hover:text-white flex items-center gap-1 transition font-bold"
                          >
                            {copiedId === `${cardId}-neg` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Salin Negatif</span>
                          </button>
                        </div>
                        <p className="font-mono text-xs text-slate-400 leading-relaxed select-all max-h-24 overflow-y-auto pr-1">
                          {holyData.negativePrompt}
                        </p>
                      </div>

                      {/* AI Control Prefix & Suffix info */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                        <div className="p-2 rounded-lg bg-[#121320] border border-[#26283D] space-y-1">
                          <span className="text-slate-500 font-bold block uppercase text-[8px]">AI Control Prefix:</span>
                          <span className="text-slate-300 block truncate">{holyData.aiControl}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-[#121320] border border-[#26283D] space-y-1">
                          <span className="text-slate-500 font-bold block uppercase text-[8px]">Suffix:</span>
                          <span className="text-slate-300 block truncate">{holyData.ending}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Positive Prompt */}
                      <div className="p-3 rounded-xl bg-[#121320] border border-amber-500/10 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Positive Prompt
                          </span>
                          <button
                            onClick={() => handleCopy(promptStr, `${cardId}-pos`)}
                            className="text-amber-300 hover:text-white flex items-center gap-1 transition font-bold"
                          >
                            {copiedId === `${cardId}-pos` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Salin Positif</span>
                          </button>
                        </div>
                        <p className="font-mono text-xs text-slate-300 leading-relaxed select-all">
                          {promptStr}
                        </p>
                      </div>

                      {/* Negative Prompt */}
                      <div className="p-3 rounded-xl bg-[#121320] border border-red-500/10 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            ⚠️ Negative Prompt
                          </span>
                          <button
                            onClick={() => handleCopy(getDynamicNegativePrompt(char.name, char.physical_description || '', 'character'), `${cardId}-neg`)}
                            className="text-red-300 hover:text-white flex items-center gap-1 transition font-bold"
                          >
                            {copiedId === `${cardId}-neg` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Salin Negatif</span>
                          </button>
                        </div>
                        <p className="font-mono text-xs text-slate-400 leading-relaxed select-all">
                          {getDynamicNegativePrompt(char.name, char.physical_description || '', 'character')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t border-[#292B42] text-xs animate-in fade-in">
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div className="p-2.5 rounded-xl bg-[#212335] border border-[#2F324D]">
                          <span className="text-slate-400 block text-[10px] uppercase">Usia</span>
                          <span className="font-bold text-white">{char.age || 'Dewasa'}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#212335] border border-[#2F324D]">
                          <span className="text-slate-400 block text-[10px] uppercase">Gender</span>
                          <span className="font-bold text-white">{char.gender || 'Laki-Laki'}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Deskripsi Fisik</span>
                        <p className="text-slate-200 leading-relaxed">
                          {char.physical_description || char.physical_appearance || 'Penampilan fisik khas era sejarah.'}
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-amber-400">Wardrobe &amp; Kostum Lock</span>
                        <p className="text-slate-200 leading-relaxed">
                          {char.costume || char.wardrobe || formatGarments(char.clothing) || 'Pakaian autentik.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. SECTION: LOCATIONS */}
      {(activeTab === 'all' || activeTab === 'locations') && filteredLocations.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
            <MapPin className="w-4 h-4" />
            <span>2. Location Bibles &amp; Prompts ({filteredLocations.length})</span>
          </div>

          <div className="space-y-3">
            {filteredLocations.map((loc, idx) => {
              const cardId = `loc-${loc.id || idx}`;
              const isExpanded = expandedIds[cardId] ?? false; // DEFAULT IS COLLAPSED (false)
              const promptStr = getLocationPrompt(loc);

              return (
                <div
                  key={cardId}
                  className="bg-[#1B1C2E] border border-[#2B2D44] hover:border-cyan-500/40 rounded-2xl p-4 space-y-3 shadow-xl transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-md border border-cyan-500/30">
                        {loc.architectural_style || loc.architecture || 'Arsitektur Kuno'}
                      </span>
                      <h3 className="text-base font-extrabold text-white">{loc.name}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(promptStr, cardId)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition"
                        title="Salin Prompt Visual Lokasi 1-Klik"
                      >
                        {copiedId === cardId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === cardId ? 'Tersalin!' : 'Salin Prompt Lokasi'}</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(cardId)}
                        className="p-1.5 rounded-xl bg-[#212335] hover:bg-[#282B42] text-slate-400 hover:text-white transition border border-[#2F324D]"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Copyable Prompt Box */}
                  <div className="space-y-3">
                    {/* Positive Prompt */}
                    <div className="p-3 rounded-xl bg-[#121320] border border-cyan-500/15 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-cyan-400 font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Location Positive Prompt
                        </span>
                        <button
                          onClick={() => handleCopy(promptStr, `${cardId}-pos`)}
                          className="text-cyan-300 hover:text-white flex items-center gap-1 transition font-bold"
                        >
                          {copiedId === `${cardId}-pos` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>Salin Positif</span>
                        </button>
                      </div>
                      <p className="font-mono text-xs text-slate-300 leading-relaxed select-all">
                        {promptStr}
                      </p>
                    </div>

                    {/* Negative Prompt */}
                    <div className="p-3 rounded-xl bg-[#121320] border border-red-500/10 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          ⚠️ Location Negative Prompt
                        </span>
                        <button
                          onClick={() => handleCopy(getDynamicNegativePrompt(loc.name, loc.description || loc.environment || '', 'location'), `${cardId}-neg`)}
                          className="text-red-300 hover:text-white flex items-center gap-1 transition font-bold"
                        >
                          {copiedId === `${cardId}-neg` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>Salin Negatif</span>
                        </button>
                      </div>
                      <p className="font-mono text-xs text-slate-400 leading-relaxed select-all">
                        {getDynamicNegativePrompt(loc.name, loc.description || loc.environment || '', 'location')}
                      </p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t border-[#292B42] text-xs animate-in fade-in">
                      <div className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Deskripsi Latar</span>
                        <p className="text-slate-200 leading-relaxed">
                          {loc.description || loc.environment || 'Latar tempat autentik sinematik.'}
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-cyan-400">Pencahayaan &amp; Atmosfer</span>
                        <p className="text-slate-200 leading-relaxed">
                          {loc.lighting_atmosphere || loc.lighting_style || 'Cahaya alami atmosferik.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. SECTION: OBJECTS */}
      {(activeTab === 'all' || activeTab === 'objects') && filteredObjects.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
            <Package className="w-4 h-4" />
            <span>3. Object Inventory &amp; Prompts ({filteredObjects.length})</span>
          </div>

          <div className="space-y-3">
            {filteredObjects.map((obj, idx) => {
              const cardId = `obj-${obj.id || idx}`;
              const isExpanded = expandedIds[cardId] ?? false; // DEFAULT IS COLLAPSED (false)
              const promptStr = getObjectPrompt(obj);

              return (
                <div
                  key={cardId}
                  className="bg-[#1B1C2E] border border-[#2B2D44] hover:border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-xl transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-md border border-emerald-500/30">
                        Material: {obj.material || 'Kuno'}
                      </span>
                      <h3 className="text-base font-extrabold text-white">{obj.name}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(promptStr, cardId)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition"
                        title="Salin Prompt Visual Objek 1-Klik"
                      >
                        {copiedId === cardId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === cardId ? 'Tersalin!' : 'Salin Prompt Objek'}</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(cardId)}
                        className="p-1.5 rounded-xl bg-[#212335] hover:bg-[#282B42] text-slate-400 hover:text-white transition border border-[#2F324D]"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Copyable Prompt Box */}
                  <div className="space-y-3">
                    {/* Positive Prompt */}
                    <div className="p-3 rounded-xl bg-[#121320] border border-emerald-500/15 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Object Positive Prompt
                        </span>
                        <button
                          onClick={() => handleCopy(promptStr, `${cardId}-pos`)}
                          className="text-emerald-300 hover:text-white flex items-center gap-1 transition font-bold"
                        >
                          {copiedId === `${cardId}-pos` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>Salin Positif</span>
                        </button>
                      </div>
                      <p className="font-mono text-xs text-slate-300 leading-relaxed select-all">
                        {promptStr}
                      </p>
                    </div>

                    {/* Negative Prompt */}
                    <div className="p-3 rounded-xl bg-[#121320] border border-red-500/10 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          ⚠️ Object Negative Prompt
                        </span>
                        <button
                          onClick={() => handleCopy(getDynamicNegativePrompt(obj.name, obj.description || '', 'object'), `${cardId}-neg`)}
                          className="text-red-300 hover:text-white flex items-center gap-1 transition font-bold"
                        >
                          {copiedId === `${cardId}-neg` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>Salin Negatif</span>
                        </button>
                      </div>
                      <p className="font-mono text-xs text-slate-400 leading-relaxed select-all">
                        {getDynamicNegativePrompt(obj.name, obj.description || '', 'object')}
                      </p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1 text-xs animate-in fade-in">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Deskripsi &amp; Detail Pusaka</span>
                      <p className="text-slate-200 leading-relaxed">
                        {obj.description || 'Pusaka atau artefak penting dalam alur cerita.'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
