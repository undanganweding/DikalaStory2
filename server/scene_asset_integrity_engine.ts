import {
  AssetCoverageRecord,
  AssetReference,
  AssetCoverageStatus,
  CharacterBible,
  ContextPackage,
  ContinuityState,
  LocationBible,
  ObjectBible,
  Scene,
  Shot,
  VideoPrompt,
  SceneVisualAnchor,
  AssetGraph,
  AssetGraphNode,
  AssetGraphEdge,
  AssetGraphNodeType,
  AssetImpactAnalysisReport,
  SceneAssetCoverageReport,
  SceneAssetRequirement,
  SceneAssetRequirementLevel,
} from '../src/types';

function normalize(value: string | any): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanAssetName(val: string | any): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[ﷺ\(\)\[\]\{\}''""`]/g, ' ')
    .replace(/\b(?:bayi|infant|dewasa|adult|tua|old|muda|young|kakek|ibu|ayah|anak|child|toddler)\b/gi, ' ')
    .replace(/^(?:al-|as-|an-|ar-|at-|az-|ad-)\s*/i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function extractTokens(val: string | any): string[] {
  return cleanAssetName(val)
    .split(/[\s\-_]+/)
    .filter((t) => t.length >= 3 && !/^(?:bin|binti|ibn|bint|dan|and|the|dari|di|ke|of|in|at)$/i.test(t));
}

function matches(candidate: string | any, target: string | any, aliases: string[] = []): boolean {
  if (!candidate) return false;
  const normCandidate = normalize(candidate);
  const cleanCandidate = cleanAssetName(candidate);

  const list = [target, ...(Array.isArray(aliases) ? aliases : [])];
  return list.some((item) => {
    if (!item || typeof item !== 'string') return false;
    const normItem = normalize(item);
    if (normItem === normCandidate) return true;

    const cleanItem = cleanAssetName(item);
    if (cleanItem && cleanCandidate && cleanItem === cleanCandidate) return true;

    // Lineage & prefix checks
    const variant = normItem.length > normCandidate.length ? normItem : normCandidate;
    const shorter = normItem.length > normCandidate.length ? normCandidate : normItem;
    if (variant.startsWith(`${shorter} `) && /\b(?:bin|binti|ibn|bint)\b/.test(variant.slice(shorter.length))) {
      return true;
    }

    return false;
  });
}

function canonicalId(prefix: string, id: string | undefined, name: string): string {
  return `${prefix}:${id || normalize(name).replace(/[^a-z0-9]+/g, '-')}`;
}

function isUnknownCanonicalId(value: string | undefined): boolean {
  return !value || value.startsWith('unknown:');
}

function requirement(name: string, assetType: SceneAssetRequirement['assetType'], level: SceneAssetRequirementLevel, canonicalId?: string): SceneAssetRequirement {
  return { name, assetType, level, canonicalId };
}

export function deriveSceneAssetRequirements(scene: Pick<Scene, 'id' | 'character_names' | 'characters_present' | 'location_name' | 'event'>, context?: ContextPackage | null): SceneAssetRequirement[] {
  const characterNames = scene.character_names?.length ? scene.character_names : scene.characters_present || [];
  const requirements = characterNames.map((name) => {
    const entity = context && Array.isArray(context.entities) ? context.entities.find((candidate) => matches(name, candidate.name, candidate.aliases || [])) : undefined;
    return requirement(name, 'CHARACTER', 'REQUIRED', entity ? canonicalId('character', entity.entityId, entity.name) : undefined);
  });
  if (scene.location_name) {
    const location = context && Array.isArray(context.locations) ? context.locations.find((candidate) => matches(scene.location_name, candidate.name)) : undefined;
    requirements.push(requirement(scene.location_name, 'LOCATION', 'REQUIRED', location ? canonicalId('location', location.locationId, location.name) : undefined));
  }
  const objectNames = context && Array.isArray(context.objects) ? context.objects.filter((object) => normalize(scene.event || '').includes(normalize(object.name))).map((object) => object.name) : [];
  requirements.push(...objectNames.map((name) => {
    const object = context && Array.isArray(context.objects) ? context.objects.find((candidate) => normalize(candidate.name) === normalize(name)) : undefined;
    return requirement(name, 'OBJECT', 'REQUIRED', object ? canonicalId('object', object.objectId, object.name) : undefined);
  }));
  return requirements;
}

function findCharacter(name: string, characters: CharacterBible[] = [], continuity?: ContinuityState | null, context?: ContextPackage | null): AssetReference | undefined {
  const continuityCharacter = continuity && Array.isArray(continuity.characters) ? continuity.characters.find((character) => matches(name, character.displayName, character.aliases)) : undefined;
  const bibleCharacter = Array.isArray(characters) ? characters.find((character) => matches(name, character.name)) : undefined;
  const groundedEntity = context && Array.isArray(context.entities) ? context.entities.find((entity) => matches(name, entity.name, entity.aliases || [])) : undefined;
  if (!continuityCharacter && !bibleCharacter && !groundedEntity) return undefined;
  return {
    canonicalAssetId: groundedEntity ? canonicalId('character', groundedEntity.entityId, groundedEntity.name) : (continuityCharacter && !isUnknownCanonicalId(continuityCharacter.canonicalIdentity)) ? continuityCharacter.canonicalIdentity : canonicalId('character', bibleCharacter?.id, bibleCharacter?.name || continuityCharacter?.displayName || name),
    assetType: 'CHARACTER',
    name: groundedEntity?.name || continuityCharacter?.displayName || bibleCharacter?.name || name,
    source: 'CHARACTER_BIBLE',
  };
}

function findLocation(name: string, locations: LocationBible[] = [], continuity?: ContinuityState | null, context?: ContextPackage | null): AssetReference | undefined {
  const continuityLocation = continuity && continuity.locations && typeof continuity.locations === 'object' ? Object.values(continuity.locations).find((location) => matches(name, location.canonicalLocation, location.aliases)) : undefined;
  const bibleLocation = Array.isArray(locations) ? locations.find((location) => matches(name, location.name)) : undefined;
  const groundedLocation = context && Array.isArray(context.locations) ? context.locations.find((location) => matches(name, location.name)) : undefined;
  if (!continuityLocation && !bibleLocation && !groundedLocation) return undefined;
  return {
    canonicalAssetId: canonicalId('location', bibleLocation?.id || groundedLocation?.locationId, groundedLocation?.name || continuityLocation?.canonicalLocation || bibleLocation?.name || name),
    assetType: 'LOCATION',
    name: groundedLocation?.name || continuityLocation?.canonicalLocation || bibleLocation?.name || name,
    source: 'LOCATION_BIBLE',
  };
}

function findObject(name: string, objects: ObjectBible[] = [], continuity?: ContinuityState | null, context?: ContextPackage | null): AssetReference | undefined {
  const continuityObject = continuity && continuity.objects && typeof continuity.objects === 'object' ? Object.values(continuity.objects).find((object) => matches(name, object.canonicalObject)) : undefined;
  const bibleObject = Array.isArray(objects) ? objects.find((object) => matches(name, object.name)) : undefined;
  const groundedObject = context && Array.isArray(context.objects) ? context.objects.find((object) => matches(name, object.name)) : undefined;
  if (!continuityObject && !bibleObject && !groundedObject) return undefined;
  return {
    canonicalAssetId: canonicalId('object', bibleObject?.id || groundedObject?.objectId, groundedObject?.name || continuityObject?.canonicalObject || bibleObject?.name || name),
    assetType: 'OBJECT',
    name: groundedObject?.name || continuityObject?.canonicalObject || bibleObject?.name || name,
    source: 'OBJECT_BIBLE',
  };
}

export function buildAssetCoverage(
  requirements: SceneAssetRequirement[],
  characters: CharacterBible[],
  locations: LocationBible[],
  objects: ObjectBible[],
  continuity?: ContinuityState | null,
  context?: ContextPackage | null,
  sceneId?: string,
): AssetCoverageRecord[] {
  return requirements.map((item) => {
    let asset: AssetReference | undefined;
    if (item.assetType === 'CHARACTER') asset = findCharacter(item.name, characters, continuity, context);
    if (item.assetType === 'LOCATION') asset = findLocation(item.name, locations, continuity, context);
    if (item.assetType === 'OBJECT') asset = findObject(item.name, objects, continuity, context);
    if (!asset) {
      return { requirement: item, status: item.level === 'REQUIRED' ? 'BLOCKED' : item.level === 'UNKNOWN' ? 'UNKNOWN' : 'WARNING' as AssetCoverageStatus, message: `Missing ${item.assetType.toLowerCase()} asset: ${item.name}.`, reason: item.level === 'REQUIRED' ? 'MISSING_REQUIRED_ASSET' : undefined, assetName: item.name, assetType: item.assetType, sceneId };
    }
    if (item.canonicalId && asset.canonicalAssetId !== item.canonicalId) {
      return { requirement: item, asset, status: 'MISMATCH', message: `Canonical asset mismatch for ${item.name}.`, reason: 'CANONICAL_MISMATCH', assetName: item.name, assetType: item.assetType, sceneId };
    }
    return { requirement: item, asset: { ...asset, sceneId }, status: isUnknownCanonicalId(asset.canonicalAssetId) ? 'MISMATCH' : 'PASS', message: `${item.name} is covered by ${asset.canonicalAssetId}.`, reason: isUnknownCanonicalId(asset.canonicalAssetId) ? 'CANONICAL_MISMATCH' : undefined, assetName: item.name, assetType: item.assetType, sceneId };
  });
}

function coverageStatus(records: AssetCoverageRecord[]): AssetCoverageStatus {
  if (records.some((record) => record.status === 'BLOCKED' || record.status === 'MISMATCH')) return 'BLOCKED';
  if (records.some((record) => record.status === 'UNKNOWN')) return 'UNKNOWN';
  if (records.some((record) => record.status === 'WARNING')) return 'WARNING';
  return 'PASS';
}

function isAssetCoveredInPrompt(prompt: string, record: AssetCoverageRecord): boolean {
  if (!record.asset) return false;
  const normalizedPrompt = normalize(prompt);
  const cleanPrompt = cleanAssetName(prompt);

  const assetName = record.asset.name || '';
  const reqName = record.requirement.name || '';

  // 1. Direct normalized contains
  if (normalizedPrompt.includes(normalize(assetName)) || normalizedPrompt.includes(normalize(reqName))) {
    return true;
  }

  // 2. Clean name contains
  const cleanAsset = cleanAssetName(assetName);
  const cleanReq = cleanAssetName(reqName);
  if ((cleanAsset && cleanPrompt.includes(cleanAsset)) || (cleanReq && cleanPrompt.includes(cleanReq))) {
    return true;
  }

  // 3. Significant token matching (e.g. "Aminah" from "Aminah binti Wahb", "Muhammad" from "Muhammad ﷺ (Bayi)")
  const tokens = [...extractTokens(assetName), ...extractTokens(reqName)];
  for (const token of tokens) {
    if (token.length >= 4 && (normalizedPrompt.includes(token) || cleanPrompt.includes(token))) {
      return true;
    }
  }

  // 4. Special cases for common words
  if (tokens.some((t) => (t === 'bayi' || t === 'baby' || t === 'infant') && (normalizedPrompt.includes('bayi') || normalizedPrompt.includes('baby') || normalizedPrompt.includes('infant')))) {
    return true;
  }

  return false;
}

function promptCoverage(records: AssetCoverageRecord[], prompt: string, phase: 'PROMPT' | 'MASTER_FRAME' | 'VIDEO_PROMPT'): AssetCoverageRecord[] {
  return records.map((record) => {
    if (record.status !== 'PASS' || !record.asset) return record;
    if (isAssetCoveredInPrompt(prompt, record)) {
      return { ...record, status: 'PASS', message: `${phase} includes ${record.asset.name}.` };
    }
    return { ...record, status: 'BLOCKED', reason: 'PROMPT_OMISSION', message: `${phase} is missing required asset: ${record.asset.name}.` };
  });
}

export function validateAssetCoverage(report: SceneAssetCoverageReport): SceneAssetCoverageReport {
  const records = [...report.characters, ...report.locations, ...report.objects];
  return { ...report, status: coverageStatus(records) };
}

export function validatePromptCoverage(report: SceneAssetCoverageReport, prompt: string): SceneAssetCoverageReport {
  const records = promptCoverage([...report.characters, ...report.locations, ...report.objects], prompt, 'PROMPT');
  return { ...report, promptCoverage: records, status: coverageStatus(records) };
}

export function validateMasterFrameCoverage(report: SceneAssetCoverageReport, prompt: string): SceneAssetCoverageReport {
  const records = promptCoverage([...report.characters, ...report.locations, ...report.objects], prompt, 'MASTER_FRAME');
  return { ...report, masterFrameCoverage: records, status: coverageStatus(records) };
}

export function validateVideoPromptCoverage(report: SceneAssetCoverageReport, prompt: string, shotScoped = false): SceneAssetCoverageReport {
  const rawRecords = promptCoverage([...report.characters, ...report.locations, ...report.objects], prompt, 'VIDEO_PROMPT');
  const allowedNames = rawRecords.filter((record) => record.asset).flatMap((record) => [record.requirement.name, record.asset!.name]);
  const explicitIntroductions = Array.from(prompt.matchAll(/\b(?:a|an|one)\s+(?:merchant|character|man|woman|person)\s+(?:named|called)\s+([A-Z][A-Za-z'’-]*(?:\s+[A-Z][A-Za-z'’-]*)*)\b|\b(?:merchant|character|person)\s+(?:named|called|bernama)\s+([A-Z][A-Za-z'’-]*(?:\s+[A-Z][A-Za-z'’-]*)*)\b/g)).map((match) => match[1] || match[2]);
  const phantomAssets = Array.from(new Set(explicitIntroductions.filter((candidate) => !allowedNames.some((allowed) => matches(candidate, allowed)))));
  const phantomRecords: AssetCoverageRecord[] = phantomAssets.map((name) => ({
    requirement: { name, assetType: 'CHARACTER', level: 'REQUIRED' },
    status: 'BLOCKED',
    reason: 'UNDECLARED_ASSET',
    assetName: name,
    assetType: 'CHARACTER',
    sceneId: report.sceneId,
    message: `VIDEO_PROMPT introduces undeclared asset: ${name}.`,
  }));

  const records = shotScoped
    ? rawRecords.map((rec) => {
        // In shot-scoped validation, if an asset is not in this specific shot, it retains its existing report status
        if (rec.status === 'BLOCKED' && rec.reason === 'PROMPT_OMISSION') {
          const original = [...report.characters, ...report.locations, ...report.objects].find((o) => o.requirement.name === rec.requirement.name);
          if (original && original.status === 'PASS') {
            return original;
          }
        }
        return rec;
      })
    : rawRecords;

  return { ...report, videoPromptCoverage: [...records, ...phantomRecords], phantomAssets, status: phantomAssets.length > 0 ? 'BLOCKED' : coverageStatus(records) };
}

export function createSceneAssetCoverageReport(
  scene: Pick<Scene, 'id' | 'scene_number' | 'character_names' | 'characters_present' | 'location_name' | 'event'>,
  characters: CharacterBible[],
  locations: LocationBible[],
  objects: ObjectBible[],
  context?: ContextPackage | null,
  continuity?: ContinuityState | null,
): SceneAssetCoverageReport {
  const requirements = deriveSceneAssetRequirements(scene, context);
  const records = buildAssetCoverage(requirements, characters, locations, objects, continuity, context, scene.id);
  return validateAssetCoverage({
    sceneId: scene.id,
    sceneNumber: scene.scene_number,
    status: 'PASS',
    characters: records.filter((record) => record.requirement.assetType === 'CHARACTER'),
    locations: records.filter((record) => record.requirement.assetType === 'LOCATION'),
    objects: records.filter((record) => record.requirement.assetType === 'OBJECT'),
    phantomAssets: [],
  });
}

export function assertSceneAssetCoverage(report: SceneAssetCoverageReport): void {
  if (report.status === 'BLOCKED' || report.promptCoverage?.some((record) => record.status === 'BLOCKED') || report.masterFrameCoverage?.some((record) => record.status === 'BLOCKED') || report.videoPromptCoverage?.some((record) => record.status === 'BLOCKED')) {
    throw new Error(`ASSET_INTEGRITY_BLOCKED ${JSON.stringify(report)}`);
  }
}

// ============================================================================
// PHASE 3: ASSET GRAPH INDEXING, DEPENDENCY TRAVERSAL & IMPACT ANALYSIS
// ============================================================================

/**
 * Deterministically generates stable, namespaced IDs for Asset Graph nodes.
 * Examples:
 * - Character: CHAR_ABDUL_MUTHALIB or CHAR_c123
 * - Location: LOC_MAKKAH or LOC_l123
 * - Object: OBJ_PEDANG or OBJ_o123
 * - Visual Anchor: ANCHOR_SCENE_001
 * - Costume: COSTUME_ALI_ARMOR
 * - Style: STYLE_CINEMATIC_DESERT
 */
export function generateStableAssetId(
  type: AssetGraphNodeType,
  sourceId: string | undefined,
  nameOrLabel: string
): string {
  const cleanLabel = cleanAssetName(nameOrLabel).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const prefixMap: Record<AssetGraphNodeType, string> = {
    character: 'CHAR',
    location: 'LOC',
    object: 'OBJ',
    visual_anchor: 'ANCHOR',
    costume: 'COSTUME',
    style: 'STYLE',
  };
  const prefix = prefixMap[type] || 'ASSET';
  
  if (sourceId && sourceId.trim().length > 0) {
    const cleanSourceId = sourceId.replace(/[^a-zA-Z0-9_]/g, '_');
    return `${prefix}_${cleanSourceId}`;
  }
  return `${prefix}_${cleanLabel || 'UNNAMED'}`;
}

/**
 * Builds the complete AssetGraph deterministically from existing project data.
 * 0 AI calls.
 */
export function indexAssetGraph(
  characters: CharacterBible[],
  locations: LocationBible[],
  objects: ObjectBible[],
  scenes: Scene[],
  shotsMap: Record<string, Shot[]> = {},
  visualAnchors: Record<string, SceneVisualAnchor> = {}
): AssetGraph {
  const nodes: Record<string, AssetGraphNode> = {};
  const edges: AssetGraphEdge[] = [];

  // Helper to add or retrieve node
  function registerNode(node: AssetGraphNode) {
    if (!nodes[node.id]) {
      nodes[node.id] = node;
    }
  }

  // 1. Index Character Nodes
  const charNodeMap = new Map<string, string>(); // character.id or normalized name -> asset_id
  for (const char of characters) {
    const assetId = generateStableAssetId('character', char.id, char.name);
    charNodeMap.set(char.id, assetId);
    charNodeMap.set(normalize(char.name), assetId);
    registerNode({
      id: assetId,
      type: 'character',
      label: char.name,
      source_table: 'characters',
      source_id: char.id,
      metadata: {
        physical_appearance: char.physical_appearance,
        clothing: char.clothing,
        face_identity_locked: char.face_identity_locked,
      },
      connected_scene_ids: [],
      connected_shot_ids: [],
    });
  }

  // 2. Index Location Nodes
  const locNodeMap = new Map<string, string>(); // location.id or normalized name -> asset_id
  for (const loc of locations) {
    const assetId = generateStableAssetId('location', loc.id, loc.name);
    locNodeMap.set(loc.id, assetId);
    locNodeMap.set(normalize(loc.name), assetId);
    registerNode({
      id: assetId,
      type: 'location',
      label: loc.name,
      source_table: 'locations',
      source_id: loc.id,
      metadata: {
        era: loc.era,
        architecture: loc.architecture,
        lighting_style: loc.lighting_style,
      },
      connected_scene_ids: [],
      connected_shot_ids: [],
    });
  }

  // 3. Index Object Nodes
  const objNodeMap = new Map<string, string>(); // object.id or normalized name -> asset_id
  for (const obj of objects) {
    const assetId = generateStableAssetId('object', obj.id, obj.name);
    objNodeMap.set(obj.id, assetId);
    objNodeMap.set(normalize(obj.name), assetId);
    registerNode({
      id: assetId,
      type: 'object',
      label: obj.name,
      source_table: 'objects',
      source_id: obj.id,
      metadata: {
        description: obj.description,
        material: obj.material,
      },
      connected_scene_ids: [],
      connected_shot_ids: [],
    });
  }

  // 4. Index Visual Anchors (if present)
  for (const [sceneId, anchor] of Object.entries(visualAnchors)) {
    const assetId = generateStableAssetId('visual_anchor', anchor.anchor_id || `anchor_${sceneId}`, `Anchor Scene ${anchor.scene_number || sceneId}`);
    registerNode({
      id: assetId,
      type: 'visual_anchor',
      label: `Visual Anchor Scene ${anchor.scene_number || sceneId}`,
      source_table: 'scenes',
      source_id: sceneId,
      metadata: {
        environment: anchor.environment,
        lighting: anchor.lighting,
        wardrobe: anchor.wardrobe,
      },
      connected_scene_ids: [sceneId],
      connected_shot_ids: [],
    });
  }

  // 5. Connect Scenes & Shots to Nodes via Edges
  for (const scene of scenes) {
    const sceneShots = shotsMap[scene.id] || [];

    // Location connections
    if (scene.location_name) {
      let locAssetId = locNodeMap.get(normalize(scene.location_name));
      if (!locAssetId) {
        // Fallback match using matches()
        const matchedLoc = locations.find((l) => matches(scene.location_name!, l.name));
        if (matchedLoc) {
          locAssetId = locNodeMap.get(matchedLoc.id);
        }
      }
      if (locAssetId && nodes[locAssetId]) {
        if (!nodes[locAssetId].connected_scene_ids.includes(scene.id)) {
          nodes[locAssetId].connected_scene_ids.push(scene.id);
        }
        edges.push({
          from_id: locAssetId,
          to_id: scene.id,
          relationship: 'LOCATED_AT',
        });
        for (const shot of sceneShots) {
          if (!nodes[locAssetId].connected_shot_ids.includes(shot.id)) {
            nodes[locAssetId].connected_shot_ids.push(shot.id);
          }
          edges.push({
            from_id: locAssetId,
            to_id: shot.id,
            relationship: 'FEATURED_IN_SHOT',
          });
        }
      }
    }

    // Character connections
    const sceneCharNames = scene.character_names?.length ? scene.character_names : scene.characters_present || [];
    for (const cName of sceneCharNames) {
      let charAssetId = charNodeMap.get(normalize(cName));
      if (!charAssetId) {
        const matchedChar = characters.find((c) => matches(cName, c.name));
        if (matchedChar) {
          charAssetId = charNodeMap.get(matchedChar.id);
        }
      }
      if (charAssetId && nodes[charAssetId]) {
        if (!nodes[charAssetId].connected_scene_ids.includes(scene.id)) {
          nodes[charAssetId].connected_scene_ids.push(scene.id);
        }
        edges.push({
          from_id: charAssetId,
          to_id: scene.id,
          relationship: 'APPEARS_IN_SCENE',
        });
      }
    }

    // Shot-specific connections
    for (const shot of sceneShots) {
      const shotChars = shot.character_refs || (shot as any).characters_present || [];
      for (const scName of shotChars) {
        let charAssetId = charNodeMap.get(normalize(scName));
        if (!charAssetId) {
          const matchedChar = characters.find((c) => matches(scName, c.name));
          if (matchedChar) {
            charAssetId = charNodeMap.get(matchedChar.id);
          }
        }
        if (charAssetId && nodes[charAssetId]) {
          if (!nodes[charAssetId].connected_shot_ids.includes(shot.id)) {
            nodes[charAssetId].connected_shot_ids.push(shot.id);
          }
          edges.push({
            from_id: charAssetId,
            to_id: shot.id,
            relationship: 'FEATURED_IN_SHOT',
          });
        }
      }

      // Visual anchor inheritance for shot
      const anchorNodeId = generateStableAssetId('visual_anchor', visualAnchors[scene.id]?.anchor_id || `anchor_${scene.id}`, `Anchor Scene ${scene.scene_number || scene.id}`);
      if (nodes[anchorNodeId]) {
        if (!nodes[anchorNodeId].connected_shot_ids.includes(shot.id)) {
          nodes[anchorNodeId].connected_shot_ids.push(shot.id);
        }
        edges.push({
          from_id: anchorNodeId,
          to_id: shot.id,
          relationship: 'INHERITS_ANCHOR',
        });
      }
    }

    // Objects connections (from scene event or context)
    for (const obj of objects) {
      if (normalize(scene.event || '').includes(normalize(obj.name))) {
        const objAssetId = objNodeMap.get(obj.id);
        if (objAssetId && nodes[objAssetId]) {
          if (!nodes[objAssetId].connected_scene_ids.includes(scene.id)) {
            nodes[objAssetId].connected_scene_ids.push(scene.id);
          }
          edges.push({
            from_id: objAssetId,
            to_id: scene.id,
            relationship: 'USES_OBJECT',
          });
          for (const shot of sceneShots) {
            if (normalize(shot.character_action || shot.event_detail || (shot as any).action_description || '').includes(normalize(obj.name))) {
              if (!nodes[objAssetId].connected_shot_ids.includes(shot.id)) {
                nodes[objAssetId].connected_shot_ids.push(shot.id);
              }
              edges.push({
                from_id: objAssetId,
                to_id: shot.id,
                relationship: 'FEATURED_IN_SHOT',
              });
            }
          }
        }
      }
    }
  }

  return {
    nodes,
    edges,
    last_indexed_at: new Date().toISOString(),
  };
}

/**
 * Deterministically traverses the AssetGraph to answer:
 * "Where is this asset used?"
 * Returns direct affected scenes, shots, and prompts.
 */
export function traverseAssetDependencies(
  graph: AssetGraph,
  targetAssetId: string,
  shotsMap: Record<string, Shot[]> = {},
  promptsMap: Record<string, VideoPrompt[]> = {}
): {
  assetNode: AssetGraphNode | null;
  affectedSceneIds: string[];
  affectedShotIds: string[];
  affectedImagePromptIds: string[];
  affectedVideoPromptIds: string[];
  allAffectedPromptIds: string[];
} {
  const node = graph.nodes[targetAssetId] || null;
  if (!node) {
    return {
      assetNode: null,
      affectedSceneIds: [],
      affectedShotIds: [],
      affectedImagePromptIds: [],
      affectedVideoPromptIds: [],
      allAffectedPromptIds: [],
    };
  }

  const affectedSceneIds = Array.from(new Set(node.connected_scene_ids));
  const affectedShotIds = Array.from(new Set(node.connected_shot_ids));

  // If node connected to scene but shots not explicitly linked, resolve scene shots
  for (const sId of affectedSceneIds) {
    const sShots = shotsMap[sId] || [];
    for (const sh of sShots) {
      if (!affectedShotIds.includes(sh.id)) {
        // If it's a location or visual anchor, all scene shots inherit it
        if (node.type === 'location' || node.type === 'visual_anchor') {
          affectedShotIds.push(sh.id);
        }
      }
    }
  }

  const affectedImagePromptIds: string[] = [];
  const affectedVideoPromptIds: string[] = [];

  // Traverse to Prompts
  for (const shotId of affectedShotIds) {
    // Check VideoPrompt map
    const vPrompts = promptsMap[shotId] || [];
    for (const vp of vPrompts) {
      if (vp.prompt_target === 'banana_image' || vp.prompt_target === 'banana_master_frame') {
        affectedImagePromptIds.push(vp.id);
      } else {
        affectedVideoPromptIds.push(vp.id);
      }
    }
  }

  const allAffectedPromptIds = Array.from(new Set([...affectedImagePromptIds, ...affectedVideoPromptIds]));

  return {
    assetNode: node,
    affectedSceneIds,
    affectedShotIds,
    affectedImagePromptIds,
    affectedVideoPromptIds,
    allAffectedPromptIds,
  };
}

/**
 * Generates an Asset Impact Analysis Report deterministically.
 * Gives precise, non-destructive regeneration recommendations.
 * 0 AI calls.
 */
export function generateAssetImpactAnalysis(
  graph: AssetGraph,
  targetAssetId: string,
  shotsMap: Record<string, Shot[]> = {},
  promptsMap: Record<string, VideoPrompt[]> = {}
): AssetImpactAnalysisReport {
  const traversal = traverseAssetDependencies(graph, targetAssetId, shotsMap, promptsMap);

  if (!traversal.assetNode) {
    return {
      target_asset_id: targetAssetId,
      target_asset_name: 'Unknown Asset',
      target_asset_type: 'character',
      affected_scenes_count: 0,
      affected_scene_ids: [],
      affected_shots_count: 0,
      affected_shot_ids: [],
      affected_image_prompt_ids: [],
      affected_video_prompt_ids: [],
      affected_prompts_count: 0,
      affected_sequence_ids: [],
      recommended_regeneration_scope: {
        scene_ids: [],
        shot_ids: [],
        prompt_ids: [],
      },
      reason: `Asset ID ${targetAssetId} not found in current Asset Graph index.`,
    };
  }

  const node = traversal.assetNode;
  const promptCount = traversal.allAffectedPromptIds.length;

  return {
    target_asset_id: node.id,
    target_asset_name: node.label,
    target_asset_type: node.type,
    affected_scenes_count: traversal.affectedSceneIds.length,
    affected_scene_ids: traversal.affectedSceneIds,
    affected_shots_count: traversal.affectedShotIds.length,
    affected_shot_ids: traversal.affectedShotIds,
    affected_image_prompt_ids: traversal.affectedImagePromptIds,
    affected_video_prompt_ids: traversal.affectedVideoPromptIds,
    affected_prompts_count: promptCount,
    affected_sequence_ids: [],
    recommended_regeneration_scope: {
      scene_ids: traversal.affectedSceneIds,
      shot_ids: traversal.affectedShotIds,
      prompt_ids: traversal.allAffectedPromptIds,
    },
    reason: `Modifying ${node.type} "${node.label}" affects ${traversal.affectedSceneIds.length} scene(s), ${traversal.affectedShotIds.length} shot(s), and ${promptCount} prompt(s). Only these specific entities require targeted regeneration.`,
  };
}

// ============================================================================
// PHASE 3 REGRESSION TESTS: TEST-P3-01 THROUGH TEST-P3-12
// ============================================================================

export function runAssetGraphRegressionTests(): { testId: string; name: string; passed: boolean; details: string }[] {
  const results: { testId: string; name: string; passed: boolean; details: string }[] = [];

  // Setup Mock Data
  const characters: CharacterBible[] = [
    { id: 'c_abdul', project_id: 'p1', name: 'Abdul Muthalib', age: 'Elderly', gender: 'Male', physical_appearance: 'Noble grey beard, dignified stature', face_identity_locked: true, hair: 'White', beard: 'Full grey', clothing: ['Thobe', 'Bisht'], accessories: [], personality: 'Leader', voice_character: 'Deep', movement_style: 'Calm', version: 1, updated_at: '' },
    { id: 'c_aminah', project_id: 'p1', name: 'Aminah', age: 'Young Adult', gender: 'Female', physical_appearance: 'Serene graceful countenance', face_identity_locked: true, hair: 'Black covered', beard: 'None', clothing: ['Abaya', 'Hijab'], accessories: [], personality: 'Gentle', voice_character: 'Soft', movement_style: 'Graceful', version: 1, updated_at: '' },
    { id: 'c_unused', project_id: 'p1', name: 'Unused Extra', age: 'Adult', gender: 'Male', physical_appearance: 'Background character', face_identity_locked: false, hair: 'Brown', beard: 'None', clothing: ['Rags'], accessories: [], personality: '', voice_character: '', movement_style: '', version: 1, updated_at: '' },
  ];

  const locations: LocationBible[] = [
    { id: 'loc_makkah', project_id: 'p1', name: 'Makkah', era: 'Pre-Islamic 6th Century', architecture: 'Stone and clay dwellings', environment: 'Desert valley surrounded by mountains', landscape: 'Arid rocky hills', climate: 'Hot and dry', culture: 'Quraysh tribe', lighting_style: 'Harsh daylight, deep shadows', color_palette: ['#C2B280', '#E5D3B3'], material: 'Stone and adobe', version: 1, updated_at: '' },
  ];

  const objects: ObjectBible[] = [
    { id: 'obj_scroll', project_id: 'p1', name: 'Parchment Scroll', description: 'Ancient leather document', category: 'Treaty', material: 'Leather', continuity_notes: 'Must not show tears', version: 1, updated_at: '' },
  ];

  const scenes: Scene[] = [
    { id: 'sc_01', project_id: 'p1', scene_number: 1, title: 'Council at Kaaba', duration_sec: 10, location_name: 'Makkah', character_names: ['Abdul Muthalib'], event: 'Abdul Muthalib holds the Parchment Scroll before council', story_purpose: 'Establish leadership', time_of_day: 'Morning', emotional_objective: 'Solemnity', narrative_function: 'Introduction', version: 1, created_at: '', updated_at: '' },
    { id: 'sc_02', project_id: 'p1', scene_number: 2, title: 'Aminah House', duration_sec: 10, location_name: 'Makkah', character_names: ['Abdul Muthalib', 'Aminah'], event: 'Abdul Muthalib visits Aminah', story_purpose: 'Family connection', time_of_day: 'Afternoon', emotional_objective: 'Warmth', narrative_function: 'Development', version: 1, created_at: '', updated_at: '' },
  ];

  const shot1: Shot = { id: 'sh_01', project_id: 'p1', scene_id: 'sc_01', shot_number: 1, start_time_sec: 0, end_time_sec: 5, duration_sec: 5, event_detail: 'Abdul Muthalib standing near Kaaba holding Parchment Scroll', character_action: 'Abdul Muthalib standing near Kaaba holding Parchment Scroll', camera_note: 'Static', dialogue: [], emotion: 'Reverence', audio_note: '', shot_type: 'WIDE', character_refs: ['Abdul Muthalib'], version: 1 };
  const shot2: Shot = { id: 'sh_02', project_id: 'p1', scene_id: 'sc_01', shot_number: 2, start_time_sec: 5, end_time_sec: 10, duration_sec: 5, event_detail: 'Close up of Parchment Scroll in Abdul Muthalib hands', character_action: 'Close up of Parchment Scroll in Abdul Muthalib hands', camera_note: 'Push in', dialogue: [], emotion: 'Focus', audio_note: '', shot_type: 'MEDIUM', character_refs: ['Abdul Muthalib'], version: 1 };
  const shot3: Shot = { id: 'sh_03', project_id: 'p1', scene_id: 'sc_02', shot_number: 1, start_time_sec: 0, end_time_sec: 10, duration_sec: 10, event_detail: 'Abdul Muthalib conversing with Aminah in serene courtyard', character_action: 'Abdul Muthalib conversing with Aminah in serene courtyard', camera_note: 'Pan', dialogue: [], emotion: 'Affection', audio_note: '', shot_type: 'TWO_SHOT', character_refs: ['Abdul Muthalib', 'Aminah'], version: 1 };

  const shotsMap: Record<string, Shot[]> = {
    'sc_01': [shot1, shot2],
    'sc_02': [shot3],
  };

  const vpImage1: VideoPrompt = { id: 'vp_img_01', shot_id: 'sh_01', scene_id: 'sc_01', project_id: 'p1', target_platform: 'veo', prompt_target: 'banana_master_frame', generation_type: 'prompt_target', timeline_json: { clip_duration_sec: 10, resolved_duration_sec: 10 }, negative_prompt: '', version: 1, created_at: '', updated_at: '' };
  const vpVideo1: VideoPrompt = { id: 'vp_vid_01', shot_id: 'sh_01', scene_id: 'sc_01', project_id: 'p1', target_platform: 'veo', prompt_target: 'veo', generation_type: 'prompt_target', timeline_json: { clip_duration_sec: 10, resolved_duration_sec: 10 }, negative_prompt: '', version: 1, created_at: '', updated_at: '' };
  const vpVideo3: VideoPrompt = { id: 'vp_vid_03', shot_id: 'sh_03', scene_id: 'sc_02', project_id: 'p1', target_platform: 'seedance', prompt_target: 'seedance_10', generation_type: 'prompt_target', timeline_json: { clip_duration_sec: 10, resolved_duration_sec: 10 }, negative_prompt: '', version: 1, created_at: '', updated_at: '' };

  const promptsMap: Record<string, VideoPrompt[]> = {
    'sh_01': [vpImage1, vpVideo1],
    'sh_03': [vpVideo3],
  };

  const visualAnchors: Record<string, SceneVisualAnchor> = {
    'sc_01': { anchor_id: 'ANCHOR_SCENE_001', scene_id: 'sc_01', scene_number: 1, environment: 'Desert valley stone architecture', character_appearance_summary: 'Abdul Muthalib in white thobe', wardrobe: 'White and gold robe', location_architecture: 'Clay and masonry', lighting: 'Morning sun', color_language: 'Warm amber and sand', visual_style: 'Cinematic historical realism', camera_language: 'Steady anamorphic 50mm', historical_constraints: [] },
  };

  const graph = indexAssetGraph(characters, locations, objects, scenes, shotsMap, visualAnchors);

  // TEST-P3-01: Character -> Scene dependency found
  {
    const aminahAssetId = generateStableAssetId('character', 'c_aminah', 'Aminah');
    const traversal = traverseAssetDependencies(graph, aminahAssetId, shotsMap, promptsMap);
    const passed = traversal.affectedSceneIds.includes('sc_02') && traversal.affectedSceneIds.length === 1;
    results.push({
      testId: 'TEST-P3-01',
      name: 'Character -> Scene dependency discovered',
      passed,
      details: `Aminah found in scenes: ${traversal.affectedSceneIds.join(', ')}`,
    });
  }

  // TEST-P3-02: Character -> Multiple scenes dependency found
  {
    const abdulAssetId = generateStableAssetId('character', 'c_abdul', 'Abdul Muthalib');
    const traversal = traverseAssetDependencies(graph, abdulAssetId, shotsMap, promptsMap);
    const passed = traversal.affectedSceneIds.includes('sc_01') && traversal.affectedSceneIds.includes('sc_02') && traversal.affectedSceneIds.length === 2;
    results.push({
      testId: 'TEST-P3-02',
      name: 'Character -> Multiple Scenes dependency discovered',
      passed,
      details: `Abdul Muthalib found in scenes: ${traversal.affectedSceneIds.join(', ')}`,
    });
  }

  // TEST-P3-03: Scene -> Shot dependency found
  {
    const abdulAssetId = generateStableAssetId('character', 'c_abdul', 'Abdul Muthalib');
    const traversal = traverseAssetDependencies(graph, abdulAssetId, shotsMap, promptsMap);
    const passed = traversal.affectedShotIds.includes('sh_01') && traversal.affectedShotIds.includes('sh_02') && traversal.affectedShotIds.includes('sh_03');
    results.push({
      testId: 'TEST-P3-03',
      name: 'Scene -> Shot dependencies discovered across scenes',
      passed,
      details: `Affected shots: ${traversal.affectedShotIds.join(', ')}`,
    });
  }

  // TEST-P3-04: Shot -> Image Prompt dependency found
  {
    const abdulAssetId = generateStableAssetId('character', 'c_abdul', 'Abdul Muthalib');
    const traversal = traverseAssetDependencies(graph, abdulAssetId, shotsMap, promptsMap);
    const passed = traversal.affectedImagePromptIds.includes('vp_img_01');
    results.push({
      testId: 'TEST-P3-04',
      name: 'Shot -> Image Prompt dependency discovered',
      passed,
      details: `Image prompts: ${traversal.affectedImagePromptIds.join(', ')}`,
    });
  }

  // TEST-P3-05: Shot -> Video Prompt dependency found
  {
    const abdulAssetId = generateStableAssetId('character', 'c_abdul', 'Abdul Muthalib');
    const traversal = traverseAssetDependencies(graph, abdulAssetId, shotsMap, promptsMap);
    const passed = traversal.affectedVideoPromptIds.includes('vp_vid_01') && traversal.affectedVideoPromptIds.includes('vp_vid_03');
    results.push({
      testId: 'TEST-P3-05',
      name: 'Shot -> Video Prompt dependency discovered',
      passed,
      details: `Video prompts: ${traversal.affectedVideoPromptIds.join(', ')}`,
    });
  }

  // TEST-P3-06: Location impact analysis finds all affected scenes/shots/prompts
  {
    const locAssetId = generateStableAssetId('location', 'loc_makkah', 'Makkah');
    const report = generateAssetImpactAnalysis(graph, locAssetId, shotsMap, promptsMap);
    const passed = report.affected_scenes_count === 2 && report.affected_shots_count === 3 && (report.affected_prompts_count || 0) === 3;
    results.push({
      testId: 'TEST-P3-06',
      name: 'Location impact analysis discovers full scope (2 scenes, 3 shots, 3 prompts)',
      passed,
      details: `Scenes: ${report.affected_scenes_count}, Shots: ${report.affected_shots_count}, Prompts: ${report.affected_prompts_count}`,
    });
  }

  // TEST-P3-07: Character impact analysis finds targeted regeneration scope
  {
    const aminahAssetId = generateStableAssetId('character', 'c_aminah', 'Aminah');
    const report = generateAssetImpactAnalysis(graph, aminahAssetId, shotsMap, promptsMap);
    const passed = report.affected_scenes_count === 1 && report.affected_shots_count === 1 && report.affected_scene_ids[0] === 'sc_02' && report.recommended_regeneration_scope?.shot_ids[0] === 'sh_03';
    results.push({
      testId: 'TEST-P3-07',
      name: 'Character impact analysis isolates targeted scope (Scene 2 only)',
      passed,
      details: `Targeted Scene: ${report.affected_scene_ids.join(', ')}, Targeted Shot: ${report.affected_shot_ids.join(', ')}`,
    });
  }

  // TEST-P3-08: Object impact analysis works
  {
    const objAssetId = generateStableAssetId('object', 'obj_scroll', 'Parchment Scroll');
    const report = generateAssetImpactAnalysis(graph, objAssetId, shotsMap, promptsMap);
    const passed = report.affected_scenes_count === 1 && report.affected_scene_ids.includes('sc_01') && report.affected_shots_count >= 1;
    results.push({
      testId: 'TEST-P3-08',
      name: 'Object impact analysis tracks parchment scroll in Scene 1',
      passed,
      details: `Object Scenes: ${report.affected_scene_ids.join(', ')}, Shots: ${report.affected_shot_ids.join(', ')}`,
    });
  }

  // TEST-P3-09: Visual Anchor dependency works
  {
    const anchorAssetId = generateStableAssetId('visual_anchor', 'ANCHOR_SCENE_001', 'Anchor Scene 1');
    const traversal = traverseAssetDependencies(graph, anchorAssetId, shotsMap, promptsMap);
    const passed = traversal.affectedSceneIds.includes('sc_01') && traversal.affectedShotIds.includes('sh_01') && traversal.affectedShotIds.includes('sh_02');
    results.push({
      testId: 'TEST-P3-09',
      name: 'Visual Anchor dependency inherits across scene shots',
      passed,
      details: `Anchor shots: ${traversal.affectedShotIds.join(', ')}`,
    });
  }

  // TEST-P3-10: Unused asset produces zero affected entities
  {
    const unusedAssetId = generateStableAssetId('character', 'c_unused', 'Unused Extra');
    const report = generateAssetImpactAnalysis(graph, unusedAssetId, shotsMap, promptsMap);
    const passed = report.affected_scenes_count === 0 && report.affected_shots_count === 0 && report.affected_prompts_count === 0;
    results.push({
      testId: 'TEST-P3-10',
      name: 'Unused asset produces zero affected entities in impact report',
      passed,
      details: `Scenes: ${report.affected_scenes_count}, Shots: ${report.affected_shots_count}, Prompts: ${report.affected_prompts_count}`,
    });
  }

  // TEST-P3-11: Graph indexing is deterministic (identical inputs -> identical graph structure)
  {
    const graph2 = indexAssetGraph(characters, locations, objects, scenes, shotsMap, visualAnchors);
    const nodeKeys1 = Object.keys(graph.nodes).sort();
    const nodeKeys2 = Object.keys(graph2.nodes).sort();
    const edges1 = graph.edges.map((e) => `${e.from_id}->${e.to_id}:${e.relationship}`).sort();
    const edges2 = graph2.edges.map((e) => `${e.from_id}->${e.to_id}:${e.relationship}`).sort();
    const passed = JSON.stringify(nodeKeys1) === JSON.stringify(nodeKeys2) && JSON.stringify(edges1) === JSON.stringify(edges2);
    results.push({
      testId: 'TEST-P3-11',
      name: 'Graph indexing is 100% deterministic with stable namespaces and edges',
      passed,
      details: `Node count match: ${nodeKeys1.length === nodeKeys2.length}, Edge count match: ${edges1.length === edges2.length}`,
    });
  }

  // TEST-P3-12: Existing scene_asset_integrity regression PASS
  {
    const reqs = deriveSceneAssetRequirements(scenes[0]);
    const coverage = buildAssetCoverage(reqs, characters, locations, objects, null, null, scenes[0].id);
    const report = validateAssetCoverage({
      sceneId: scenes[0].id,
      sceneNumber: scenes[0].scene_number,
      status: 'PASS',
      characters: coverage.filter((r) => r.requirement.assetType === 'CHARACTER'),
      locations: coverage.filter((r) => r.requirement.assetType === 'LOCATION'),
      objects: coverage.filter((r) => r.requirement.assetType === 'OBJECT'),
      phantomAssets: [],
    });
    const passed = report.status === 'PASS' && report.characters.length === 1 && report.locations.length === 1;
    results.push({
      testId: 'TEST-P3-12',
      name: 'Existing scene asset integrity logic remains fully functional and PASS',
      passed,
      details: `Report status: ${report.status}, Characters covered: ${report.characters.length}, Locations covered: ${report.locations.length}`,
    });
  }

  return results;
}
