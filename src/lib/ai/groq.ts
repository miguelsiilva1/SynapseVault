import Groq from 'groq-sdk';

export interface TranscriptionResult {
  text: string;
  durationSeconds?: number;
}

/**
 * Dispatches an audio buffer to Groq Whisper (whisper-large-v3-turbo) for ultra-low latency transcription.
 */
export async function transcribeAudioStream(
  audioBuffer: ArrayBuffer,
  fileName: string = 'lecture.mp3',
  language: string = 'pt'
): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not defined.');
  }

  const groq = new Groq({ apiKey });

  // Convert ArrayBuffer to standard global File in Node runtime
  const audioFile = new File([audioBuffer], fileName, { type: 'audio/mp3' });

  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3-turbo',
    language,
    response_format: 'verbose_json',
    temperature: 0.0,
  });

  const durationSeconds = typeof (transcription as { duration?: number }).duration === 'number'
    ? (transcription as { duration?: number }).duration
    : undefined;

  return {
    text: transcription.text.trim(),
    durationSeconds,
  };
}
