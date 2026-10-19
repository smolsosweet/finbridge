// Encoded JSON limits leave headroom below Vercel's 4.5 MB function boundary.
export const AI_JSON_BYTES = 600_000;
export const AI_IMAGE_DATA_URL_LENGTH = 1_800_000;
export const AI_RECEIPT_JSON_BYTES = 2_000_000;
export const AI_AUDIO_BYTES = 2_000_000;
export const AI_AUDIO_BASE64_LENGTH = 4 * Math.ceil(AI_AUDIO_BYTES / 3);
export const AI_AUDIO_JSON_BYTES = 2_800_000;
export const AI_TRANSCRIPT_CHARACTERS = 2_000;
export const AI_RECORDING_SECONDS = 45;
