import { PromptTarget, AudioPurityContract } from '../src/types';

export const CANONICAL_AUDIO_PURITY_CONTRACT: AudioPurityContract = {
  mode: 'DIEGETIC_ONLY',
  musicAllowed: false,
  nonDiegeticAudioAllowed: false,
  generatedNarratorAllowed: false,
  naturalDialogueAllowed: true,
  naturalEnvironmentAllowed: true,
  physicalActionSoundAllowed: true,
  allowedAudio: [
    'authentic character dialogue',
    'natural speech',
    'breathing',
    'footsteps',
    'clothing and fabric movement',
    'wind',
    'rain',
    'water',
    'fire',
    'animals',
    'doors',
    'physical object interactions',
    'natural environmental ambience',
  ],
  forbiddenAudio: [
    'background music',
    'BGM',
    'soundtrack',
    'musical score',
    'orchestral score',
    'cinematic music',
    'emotional music',
    'trailer music',
    'non-diegetic audio',
    'cinematic whooshes',
    'transition sound effects',
    'artificial sound-design layers',
    'generated narrator voice',
    'music-like ambience',
  ],
};

export const AUDIO_PURITY_CONSTRAINT_BLOCK = `[AUDIO PURITY CONSTRAINT]

AUDIO MODE: DIEGETIC ONLY.

Use only sound that naturally originates from the visible scene and physical actions.

ALLOWED:
- authentic character dialogue
- natural speech
- breathing
- footsteps
- clothing and fabric movement
- wind
- rain
- water
- fire
- animals
- doors
- physical object interactions
- natural environmental ambience

FORBIDDEN:
- background music
- BGM
- soundtrack
- musical score
- orchestral score
- cinematic music
- emotional music
- trailer music
- non-diegetic audio
- cinematic whooshes
- transition sound effects
- artificial sound-design layers
- generated narrator voice
- music-like ambience

Do not add any non-diegetic audio.
Do not add music under any circumstance.`;

/**
 * Serializes the Audio Purity Constraint block for prompt integration.
 * Video targets get the full DIEGETIC ONLY constraint block.
 * Image targets return an empty string to prevent contaminating visual prompts.
 */
export function serializeAudioPurityConstraintBlock(target: PromptTarget): string {
  if (target === 'banana_master_frame' || target === 'banana_image') {
    return '';
  }
  return AUDIO_PURITY_CONSTRAINT_BLOCK;
}

/**
 * Validates whether a prompt complies with the Audio Purity Contract.
 */
export function validateAudioPurityContract(
  promptText: string,
  target: PromptTarget
): { valid: boolean; failedRules: string[] } {
  const failedRules: string[] = [];

  const isVideoTarget =
    target === ('veo' as any) ||
    target === ('omni' as any) ||
    target === ('gemini_omni' as any) ||
    target === ('seedance_10' as any) ||
    target === ('seedance_30' as any) ||
    target === ('seedance' as any);

  const isImageTarget =
    target === 'banana_master_frame' || target === 'banana_image';

  if (isVideoTarget) {
    if (!promptText.includes('[AUDIO PURITY CONSTRAINT]')) {
      failedRules.push('AUDIO_PURITY_BLOCK_MISSING');
    }
    if (!promptText.includes('AUDIO MODE: DIEGETIC ONLY')) {
      failedRules.push('AUDIO_PURITY_MODE_MISSING');
    }

    // Split prompt text to inspect positive prompt section (before NEGATIVE PROMPT:)
    const positivePart = promptText.split('NEGATIVE PROMPT:')[0] || promptText;
    // Strip the Audio Purity Constraint instructions block itself before inspecting positive prompt
    const cleanPositivePart = positivePart.replace(/\[AUDIO PURITY CONSTRAINT\][\s\S]*?(?=(\[|$))/gi, positivePart.includes('[AUDIO PURITY CONSTRAINT]') ? '' : positivePart);

    const forbiddenInPositive = [
      'background music',
      'bgm',
      'dramatic underscore',
      'musical score',
      'orchestral score',
      'cinematic music',
      'trailer music',
    ];

    for (const term of forbiddenInPositive) {
      if (cleanPositivePart.toLowerCase().includes(term.toLowerCase())) {
        failedRules.push(`NON_DIEGETIC_AUDIO_DETECTED_IN_POSITIVE_PROMPT: ${term}`);
      }
    }
  }

  if (isImageTarget) {
    if (promptText.includes('[AUDIO PURITY CONSTRAINT]')) {
      failedRules.push('AUDIO_PURITY_BLOCK_FORBIDDEN_IN_IMAGE_TARGET');
    }
  }

  return {
    valid: failedRules.length === 0,
    failedRules,
  };
}
