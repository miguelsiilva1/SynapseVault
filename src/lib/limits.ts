/**
 * Size and cost limits enforced by the API routes.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // audio and PDF; 25 MB is also the Groq Whisper limit
export const MAX_SOURCE_TEXT_CHARS = 200_000; // text sent to the AI as input
export const MAX_NOTE_MARKDOWN_CHARS = 500_000; // markdown stored as a note, summary or log
export const DAILY_AI_LIMIT = 20; // AI generations per user per 24 hours
export const ALLOWED_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash'];

export function exceedsLength(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.length > max;
}
