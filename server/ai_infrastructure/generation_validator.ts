export interface GenerationParams {
  prompt: string;
  negativePrompt: string;
  durationSec: number;
  fps: number;
  resolution: string;
}

export const generationValidator = {
  validateGenerationParams(params: GenerationParams): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.prompt || params.prompt.trim().length < 10) {
      errors.push('Generation prompt is too short or empty.');
    }

    if (params.durationSec <= 0 || params.durationSec > 60) {
      errors.push(`Duration (${params.durationSec}s) is out of bounds (allowed: 1s - 60s).`);
    }

    if (!['1080p', '4K', '720p'].includes(params.resolution)) {
      errors.push(`Invalid resolution '${params.resolution}'. Allowed: 720p, 1080p, 4K.`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};
