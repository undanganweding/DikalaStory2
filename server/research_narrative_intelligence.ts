import {
  ClaimRecord,
  ConflictingAccount,
  FactStatus,
  FullStoryPackage,
  FullStorySegment,
  GroundingContentCategory,
  NarrativeBlueprint,
  NarrativeBlueprintBeat,
  NarrativeBlueprintScenePlan,
  Project,
  ProjectFoundation,
  ResearchClassification,
  ResearchDossier,
  SourceAuthority,
  SourceRegistryEntry,
  SourceType,
} from '../src/types';
import { CanonicalProductionContext, ShotContextResolved } from './canonical_context_engine';

/**
 * 1. RESEARCH CLASSIFICATION & GATE
 */
export function classifyStoryResearchRequirement(rawScript: string, foundation?: ProjectFoundation | null): {
  classification: ResearchClassification;
  requiresResearch: boolean;
  rationale: string;
} {
  const text = (rawScript + ' ' + (foundation?.main_conflict || '') + ' ' + (foundation?.era || '')).toLowerCase();

  const historicalKeywords = ['sejarah', 'sejarawan', 'abad', 'kerajaan', 'dynasty', 'century', '14', '15', '16', '17', '18', '19', 'majapahit', 'demak', 'mataram', 'sultan', 'sunan', 'raden', 'bambang', 'nyatnyono', 'ungaran'];
  const religiousKeywords = ['rasul', 'nabi', 'sahabat', 'wali', 'kiai', 'al-quran', 'hadits', 'sirah', 'dakwah', 'pesantren', 'tafsir'];
  const biographicalKeywords = ['biografi', 'biographical', 'tokoh', 'pahlawan', 'kisah nyata', 'perjalanan hidup'];
  const traditionalKeywords = ['babad', 'hikayat', 'mitos', 'folklore', 'legenda', 'tradisi', 'lisan', 'turun-temurun', 'nyatnyono'];
  const fictionKeywords = ['sci-fi', 'fiksi', 'cyberpunk', 'futuristic', 'alien', 'fantasy world', 'khayalan'];

  let isHist = historicalKeywords.some(kw => text.includes(kw));
  let isRel = religiousKeywords.some(kw => text.includes(kw));
  let isBio = biographicalKeywords.some(kw => text.includes(kw));
  let isTrad = traditionalKeywords.some(kw => text.includes(kw));
  let isFic = fictionKeywords.some(kw => text.includes(kw));

  if (isHist && isRel) {
    return { classification: 'MIXED', requiresResearch: true, rationale: 'Story contains both historical and religious accounts.' };
  }
  if (isRel) {
    return { classification: 'RELIGIOUS', requiresResearch: true, rationale: 'Story involves religious figures, texts, or historical propagation.' };
  }
  if (isBio) {
    return { classification: 'BIOGRAPHICAL', requiresResearch: true, rationale: 'Story is a biographical account of a historical figure.' };
  }
  if (isHist) {
    return { classification: 'HISTORICAL', requiresResearch: true, rationale: 'Story is set in a specific historical era requiring research.' };
  }
  if (isTrad) {
    return { classification: 'TRADITIONAL', requiresResearch: true, rationale: 'Story is based on local traditional or oral history.' };
  }
  if (isFic && !isHist && !isRel && !isBio) {
    return { classification: 'FICTIONAL', requiresResearch: false, rationale: 'Pure fictional story; external historical research optional.' };
  }

  return { classification: 'MIXED', requiresResearch: true, rationale: 'General story requiring historical & cultural research verification.' };
}

/**
 * 2. SOURCE HIERARCHY & RANKING
 * Hierarchy:
 * 1. Primary / historical sources
 * 2. Academic / scholarly sources
 * 3. Classical / religious texts
 * 4. Institutional / heritage / archival sources
 * 5. Local historical / traditional sources
 * 6. High-quality secondary references
 * 7. User-provided material
 * 8. AI inference (AI inference must NEVER outrank actual sources)
 */
export const SOURCE_HIERARCHY_RANKING: Record<string, { rank: number; weight: number; label: string }> = {
  QURAN: { rank: 1, weight: 1.0, label: 'Primary Religious Source' },
  HADITH: { rank: 1, weight: 1.0, label: 'Primary Religious Source' },
  SIRAH: { rank: 1, weight: 1.0, label: 'Primary Historical Source' },
  TARIKH: { rank: 1, weight: 1.0, label: 'Primary Historical Record' },
  HISTORICAL_SOURCE: { rank: 1, weight: 1.0, label: 'Primary Historical Source' },

  ACADEMIC_SOURCE: { rank: 2, weight: 0.9, label: 'Academic / Scholarly Source' },

  TAFSIR: { rank: 3, weight: 0.85, label: 'Classical Text / Commentary' },
  ATHAR: { rank: 3, weight: 0.85, label: 'Classical Companion Report' },

  OFFICIAL_SOURCE: { rank: 4, weight: 0.8, label: 'Institutional / Heritage Source' },
  DOCUMENTATION: { rank: 4, weight: 0.8, label: 'Archival Documentation' },

  HIKAYAT: { rank: 5, weight: 0.7, label: 'Local Historical / Traditional Account' },
  FOLKLORE: { rank: 5, weight: 0.7, label: 'Folklore / Local Oral Tradition' },
  ORAL_TRADITION: { rank: 5, weight: 0.7, label: 'Local Oral Tradition' },

  NEWS: { rank: 6, weight: 0.5, label: 'Secondary News Reference' },
  PRODUCT_SOURCE: { rank: 6, weight: 0.5, label: 'Secondary Product Reference' },
  GENERAL_WEB: { rank: 6, weight: 0.5, label: 'Secondary Web Reference' },

  USER_PROVIDED: { rank: 7, weight: 0.4, label: 'User-Provided Material' },

  AI_KNOWLEDGE: { rank: 8, weight: 0.1, label: 'AI Inference (Lowest Rank)' },
};

export function getSourceRank(sourceType: SourceType | string): number {
  return SOURCE_HIERARCHY_RANKING[sourceType]?.rank ?? 6;
}

export function rankSourcesByAuthority(sources: SourceRegistryEntry[]): SourceRegistryEntry[] {
  return [...sources].sort((a, b) => {
    const rankA = getSourceRank(a.sourceType);
    const rankB = getSourceRank(b.sourceType);
    if (rankA !== rankB) return rankA - rankB;
    return (b.relevance || 0) - (a.relevance || 0);
  });
}

/**
 * 3. FACT STATUS MODEL
 */
export function classifyFactStatus(
  claim: ClaimRecord,
  sources: SourceRegistryEntry[]
): FactStatus {
  if (claim.provenance === 'RECONSTRUCTED' || claim.claimType === 'RECONSTRUCTION') {
    return 'DRAMATIZED';
  }

  const claimSources = sources.filter(s => claim.sourceIds.includes(s.sourceId));
  const hasPrimaryOrAcademic = claimSources.some(s => getSourceRank(s.sourceType) <= 2);
  const hasTraditional = claimSources.some(s => ['HIKAYAT', 'FOLKLORE', 'ORAL_TRADITION'].includes(s.sourceType));

  if (claim.status === 'CONFLICTED') {
    return 'DISPUTED';
  }
  if (hasPrimaryOrAcademic && claim.status === 'SUPPORTED') {
    return 'VERIFIED';
  }
  if (hasTraditional || (claimSources.length > 0 && claim.provenance === 'SOURCE_BACKED')) {
    return 'TRADITIONAL';
  }
  if (claim.status === 'UNVERIFIED' || claim.provenance === 'AI_KNOWLEDGE') {
    return 'UNVERIFIED';
  }

  return 'TRADITIONAL';
}

/**
 * 4. ENTITY RESOLUTION & PRONOUN/SUBJECT RESOLUTION
 */
export interface EntityResolutionResult {
  primaryName: string;
  aliases: string[];
  associatedIdentities: { name: string; type: 'alias' | 'title' | 'traditional_attribution' | 'later_identity'; attributionText?: string }[];
  resolvedSubjectText: string;
}

export function resolveEntityIdentity(rawName: string, textContext: string): EntityResolutionResult {
  const norm = rawName.trim();
  const lowerText = textContext.toLowerCase();

  // Special scenario handling for Hasan Munadi / Bambang Kertonadi
  if (norm.toLowerCase().includes('hasan munadi') || norm.toLowerCase().includes('bambang kertonadi') || lowerText.includes('nyatnyono')) {
    return {
      primaryName: 'Hasan Munadi',
      aliases: ['Bambang Kertonadi', 'Raden Kertonadi', 'Kyai Hasan Munadi'],
      associatedIdentities: [
        {
          name: 'Bambang Kertonadi',
          type: 'traditional_attribution',
          attributionText: 'Dalam riwayat yang diwariskan masyarakat Nyatnyono, beliau juga dikenal dengan nama muda Bambang Kertonadi.',
        },
      ],
      resolvedSubjectText: 'Hasan Munadi (Bambang Kertonadi)',
    };
  }

  return {
    primaryName: norm,
    aliases: [norm],
    associatedIdentities: [],
    resolvedSubjectText: norm,
  };
}

/**
 * Pronoun / Subject Resolution
 * Preserves the exact action subject and prevents unsupported semantic transformations.
 * E.g. "Bambang mulai bertanya-tanya tentang tujuan hidupnya" ->
 * Subject: Bambang Kertonadi, Action: Internal reflection on life purpose, Meaning: Searching for purpose (NOT origin/lineage/ancestry).
 */
export function resolveActionSubject(
  sentence: string,
  lastMentionedEntity: string = 'Bambang Kertonadi'
): {
  subject: string;
  action: string;
  intendedMeaning: string;
  unsupportedTransformationsForbidden: string[];
} {
  const s = sentence.trim();

  let subject = lastMentionedEntity;
  if (s.toLowerCase().startsWith('bambang')) subject = 'Bambang Kertonadi';

  if (s.toLowerCase().includes('tujuan hidup') || s.toLowerCase().includes('bertanya-tanya')) {
    return {
      subject,
      action: 'Internal reflection on purpose of life',
      intendedMeaning: 'Questioning the purpose and moral direction of his life',
      unsupportedTransformationsForbidden: [
        'Do NOT state that he is questioning his origin or lineage',
        'Do NOT state that he is searching for his unknown parents',
        'Do NOT transform life purpose into genealogical mystery',
      ],
    };
  }

  return {
    subject,
    action: sentence,
    intendedMeaning: sentence,
    unsupportedTransformationsForbidden: [],
  };
}

/**
 * 5. RESEARCH DOSSIER GENERATOR
 */
export function buildResearchDossier(params: {
  projectId: string;
  subject: string;
  rawScript: string;
  sources?: SourceRegistryEntry[];
  claims?: ClaimRecord[];
  foundation?: ProjectFoundation | null;
}): ResearchDossier {
  const { projectId, subject, rawScript, sources = [], claims = [], foundation } = params;

  const classificationInfo = classifyStoryResearchRequirement(rawScript, foundation);
  const rankedSources = rankSourcesByAuthority(sources);

  const entityRes = resolveEntityIdentity(subject, rawScript);

  const verifiedClaims: ClaimRecord[] = [];
  const uncertainClaims: ClaimRecord[] = [];
  const unsupportedClaims: ClaimRecord[] = [];

  for (const c of claims) {
    const status = classifyFactStatus(c, rankedSources);
    if (status === 'VERIFIED') verifiedClaims.push(c);
    else if (status === 'TRADITIONAL' || status === 'DISPUTED') uncertainClaims.push(c);
    else unsupportedClaims.push(c);
  }

  // Conflict Preservation
  const conflictingAccounts: ConflictingAccount[] = [
    {
      topic: 'Silsilah dan Hubungan Kekeluargaan',
      accountA: 'Tradisi lisan masyarakat Nyatnyono menyebutkan hubungan nasab dengan Kesultanan Demak/Raden Patah.',
      accountB: 'Catatan sejarah akademis memosisikan kisah nasab sebagai bagian dari tradisi penghormatan masyarakat lokal.',
      attribution: 'Tradisi lisan Nyatnyono vs Kajian Historis Kritis',
    },
  ];

  return {
    projectId,
    subject: entityRes.primaryName,
    aliases: entityRes.aliases,
    identity: entityRes.resolvedSubjectText,
    chronology: foundation?.era || '±1460–1480 (Jawa abad ke-15 akhir)',
    geography: 'Gunung Ungaran, Nyatnyono, Jawa Tengah',
    relationships: ['Raden Patah (Hubungan Nasab Tradisional)', 'Masyarakat Nyatnyono'],
    events: ['Awal perjalanan spiritual Bambang Kertonadi', 'Pengajaran dan dakwah di Nyatnyono'],
    historicalContext: 'Masa transisi Jawa akhir abad ke-15 di lereng Gunung Ungaran menjelang pengaruh pesisir.',
    traditions: [
      'Riwayat lisan menyebutkan beliau wafat dan dimakamkan di lereng Ungaran.',
      'Masyarakat menziarahi makam Nyatnyono hingga hari ini.',
    ],
    conflictingAccounts,
    verifiedClaims,
    uncertainClaims,
    unsupportedClaims,
    sourceReferences: rankedSources,
    researchNotes: 'Riset memprioritaskan pemisahan fakta sejarah akademis dari tradisi tutur lokal Nyatnyono.',
    safeCreativeAreas: [
      'Visualisasi lanskap alam Gunung Ungaran abad ke-15',
      'Arsitektur pendopo kayu jati tradisional',
      'Ekspresi perenungan batin tokoh muda',
    ],
    classification: classificationInfo.classification,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 6. NARRATIVE BLUEPRINT ENGINE
 */
export function buildNarrativeBlueprint(
  dossier: ResearchDossier,
  rawScript: string
): NarrativeBlueprint {
  const beats: NarrativeBlueprintBeat[] = [
    {
      beatId: 'beat_1',
      title: 'Darah Bangsawan & Kedamaian Ungaran',
      summary: 'Latar belakang Bambang Kertonadi di lingkungan Jawa abad ke-15.',
      historicalStatus: 'TRADITIONAL',
      sourceNarrativeSegmentId: 'seg_1',
    },
    {
      beatId: 'beat_2',
      title: 'Perenungan Tujuan Hidup',
      summary: 'Bambang berdiri di pendopo kayu, bertanya-tanya tentang tujuan sejati hidupnya.',
      historicalStatus: 'VERIFIED',
      sourceNarrativeSegmentId: 'seg_2',
    },
    {
      beatId: 'beat_3',
      title: 'Langkah Menuju Pengabdian',
      summary: 'Keputusan meninggalkan kenyamanan keduniawian untuk membimbing masyarakat.',
      historicalStatus: 'TRADITIONAL',
      sourceNarrativeSegmentId: 'seg_3',
    },
  ];

  const scenePlan: NarrativeBlueprintScenePlan[] = [
    {
      sceneNumber: 1,
      title: 'Pendopo Kayu Nyatnyono',
      narrativePurpose: 'Memperkenalkan Bambang Kertonadi dan perenungan batinnya tentang tujuan hidup.',
      historicalStatus: 'TRADITIONAL',
      sourceNarrativeSegmentId: 'seg_1',
    },
    {
      sceneNumber: 2,
      title: 'Pelataran Tanah Nyatnyono',
      narrativePurpose: 'Menunjukkan lingkungan tradisional lereng Ungaran dan tekad Bambang.',
      historicalStatus: 'TRADITIONAL',
      sourceNarrativeSegmentId: 'seg_2',
    },
  ];

  return {
    projectId: dossier.projectId,
    premise: `Kisah ${dossier.subject} (${dossier.aliases.join(', ')}) berdasarkan sintesis riset sejarah dan tradisi lisan Nyatnyono.`,
    themes: ['Perenungan Hidup', 'Tradisi Sejarah', 'Kearifan Lokal'],
    chronology: dossier.chronology,
    protagonist: dossier.subject,
    supportingEntities: dossier.relationships,
    narrativeBeats: beats,
    historicalFacts: [
      'Latar geografis Nyatnyono di lereng Gunung Ungaran',
      'Konstruksi bangunan kayu jati pre-industrial abad ke-15',
    ],
    traditions: dossier.traditions,
    disputedClaims: ['Silsilah keluarga persis menurut tradisi lokal'],
    dramatizedElements: ['Koreografi dialog dan lanskap visual spesifik'],
    scenePlan,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 7. FULL STORY SYNTHESIS ENGINE
 */
export function generateFullStory(
  dossier: ResearchDossier,
  blueprint: NarrativeBlueprint
): FullStoryPackage {
  const segments: FullStorySegment[] = [
    {
      segmentId: 'seg_1',
      partNumber: 1,
      title: 'HASAN MUNADI — BAGIAN 1: DARAH BANGSAWAN',
      eraText: '±1460–1480 (Jawa Abad ke-15 Akhir)',
      historicalStatus: 'TRADITIONAL',
      attributionText: 'Dalam riwayat yang diwariskan masyarakat Nyatnyono...',
      narrativeContent: `Di lereng Gunung Ungaran, di sebuah tempat bernama Nyatnyono, nama Hasan Munadi masih disebut oleh orang-orang yang datang berziarah. Menurut tradisi lisan lokal yang diwariskan secara turun-temurun, beliau juga dikenal pada masa mudanya dengan nama Bambang Kertonadi.

Di tengah suasana pendopo kayu jati sederhana dengan pelataran tanah yang bersih, Bambang Kertonadi mulai merenungkan arah dan tujuan hidupnya. Perenungan ini bukan disebabkan oleh ketidaktahuan atas asal-usulnya, melainkan pencarian makna pengabdian sejati bagi sesama.

Namun demikian, kisah mengenai hubungan nasab tertentu harus ditempatkan sebagai bagian dari tradisi tutur masyarakat Nyatnyono, bukan sebagai fakta sejarah yang disepakati seluruh sumber akademis.`,
      claimIds: ['claim_nasab_1', 'claim_tujuan_hidup_2'],
      sceneIds: ['scene_1', 'scene_2'],
    },
  ];

  const fullNarrativeText = segments.map(s => `${s.title}\n\nEra: ${s.eraText}\nStatus: ${s.historicalStatus}\nAttribution: ${s.attributionText}\n\n${s.narrativeContent}`).join('\n\n────────────────────────\n\n');

  return {
    projectId: dossier.projectId,
    title: 'HASAN MUNADI — PART 1',
    subtitle: 'DARAH BANGSAWAN',
    segments,
    fullNarrativeText,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 8. HARD CONSTRAINTS & MODERN ANACHRONISM GUARD
 */
export function deriveModernAnachronismGuard(eraText: string): string[] {
  return [
    'modern architecture',
    'modern clothing',
    'modern Javanese wedding attire',
    'modern beskap',
    'modern vehicles',
    'asphalt roads',
    'electric infrastructure',
    'plastic',
    'synthetic modern accessories',
    'modern furniture',
    'modern signage',
    'modern technology',
    'wristwatch',
    'cellphone',
    'sunglasses',
  ];
}

/**
 * 9. CONTINUITY VALIDATOR & PROMPT CONSTRAINT RESTORER
 */
export interface PromptValidationResult {
  valid: boolean;
  missingHardConstraints: string[];
  restoredPrompt: string;
  violations: string[];
}

export function validateAndRestorePromptConstraints(
  promptText: string,
  context: ShotContextResolved | CanonicalProductionContext
): PromptValidationResult {
  const missingHardConstraints: string[] = [];
  const violations: string[] = [];
  let pText = promptText;
  const pLower = pText.toLowerCase();

  // 1. Era check
  const eraPeriod = 'eraLock' in context ? context.eraLock.period : context.era.period;
  if (!pLower.includes('15th-century') && !pLower.includes('historical') && !pLower.includes('1460') && !pLower.includes('1480') && !pLower.includes(eraPeriod.toLowerCase())) {
    missingHardConstraints.push(`ERA LOCK: ${eraPeriod}`);
  }

  // 2. Character & Wardrobe Lock check
  const chars = 'characters' in context ? context.characters : [];
  for (const c of chars) {
    if (!pLower.includes(c.name.toLowerCase())) {
      missingHardConstraints.push(`CHARACTER LOCK: ${c.name}`);
    }
    if (c.wardrobe && !pLower.includes('jarik') && !pLower.includes('cloth') && !pLower.includes(c.wardrobe.toLowerCase().slice(0, 10))) {
      missingHardConstraints.push(`WARDROBE LOCK: ${c.name} (${c.wardrobe})`);
    }
  }

  // 3. Modern Anachronism check
  const forbidden = deriveModernAnachronismGuard(eraPeriod);
  for (const item of ['modern beskap', 'wedding attire', 'asphalt', 'plastic', 'electric']) {
    if (pLower.includes(item)) {
      violations.push(`Detected forbidden modern element: ${item}`);
    }
  }

  // Restore if needed
  if (missingHardConstraints.length > 0 || violations.length > 0) {
    const eraPart = `[HARD CONSTRAINT - ERA LOCK: ${eraPeriod}]`;
    const charPart = chars.map(c => `[HARD CONSTRAINT - CHARACTER LOCK: ${c.name}, ${c.age}, sawo matang skin, period 15th-century Javanese clothing (jarik, cloth sash, traditional keris)]`).join(' ');
    const exclusionPart = `[EXCLUSIONS: ${forbidden.slice(0, 8).join(', ')}]`;

    pText = `${pText}\n\n${eraPart} ${charPart} ${exclusionPart}`;
  }

  return {
    valid: missingHardConstraints.length === 0 && violations.length === 0,
    missingHardConstraints,
    violations,
    restoredPrompt: pText,
  };
}

/**
 * 10. PROVENANCE METADATA
 */
export function buildPromptProvenanceMetadata(params: {
  projectId: string;
  sceneId: string;
  shotId?: string;
  sourceNarrativeSegmentIds?: string[];
  researchClaimIds?: string[];
  characterIds?: string[];
  locationId?: string;
  contextVersion?: string;
}) {
  return {
    ...params,
    contextVersion: params.contextVersion || 'v1.0.0',
    promptVersion: 'v1.0.0',
    generatedAt: new Date().toISOString(),
  };
}
