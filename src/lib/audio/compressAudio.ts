import { Mp3Encoder } from '@breezystack/lamejs';

export interface CompressionOptions {
  targetSampleRate?: number;
  targetBitrate?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Downsamples and encodes an arbitrary audio file into a lightweight Mono MP3 stream.
 * Default profile: 16,000 Hz, 32 kbps mono (optimized for speech recognition and Whisper input).
 */
export async function compressAudio(
  file: File,
  options?: CompressionOptions
): Promise<File> {
  const targetSampleRate = options?.targetSampleRate ?? 16000;
  const targetBitrate = options?.targetBitrate ?? 32;
  const onProgress = options?.onProgress;

  if (typeof window === 'undefined') {
    throw new Error('Audio compression is restricted to browser execution contexts.');
  }

  // 1. Ingest raw file buffer
  const arrayBuffer = await file.arrayBuffer();

  // 2. Decode raw stream into PCM audio buffer
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this runtime environment.');
  }

  const audioContext = new AudioContextClass();
  let decodedBuffer: AudioBuffer;

  try {
    decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    await audioContext.close();
  }

  // 3. Downsample to target sample rate and mix to single mono channel
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(decodedBuffer.duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const pcmFloat32 = renderedBuffer.getChannelData(0);

  // 4. Quantize Float32Array (-1.0 to 1.0) to 16-bit signed PCM (Int16Array)
  const sampleCount = pcmFloat32.length;
  const pcmInt16 = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const s = Math.max(-1, Math.min(1, pcmFloat32[i]));
    pcmInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // 5. Stream through LameJS MP3 encoder in non-blocking chunks
  const encoder = new Mp3Encoder(1, targetSampleRate, targetBitrate);
  const chunkSize = 1152; // Standard MPEG-1/2 Layer 3 frame size
  const mp3DataBlocks: Uint8Array[] = [];

  const totalFrames = Math.ceil(sampleCount / chunkSize);
  const yieldInterval = 100; // Yield thread execution every 100 frames

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const offset = frameIndex * chunkSize;
    const chunk = pcmInt16.subarray(offset, Math.min(offset + chunkSize, sampleCount));

    const encodedChunk = encoder.encodeBuffer(chunk);
    if (encodedChunk.length > 0) {
      mp3DataBlocks.push(encodedChunk);
    }

    if (onProgress && frameIndex % 20 === 0) {
      const currentPercent = Math.min(99, Math.round((frameIndex / totalFrames) * 100));
      onProgress(currentPercent);
    }

    if (frameIndex % yieldInterval === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const flushedBuffer = encoder.flush();
  if (flushedBuffer.length > 0) {
    mp3DataBlocks.push(flushedBuffer);
  }

  if (onProgress) {
    onProgress(100);
  }

  // 6. Assemble compressed MP3 File payload
  const blob = new Blob(mp3DataBlocks as unknown as BlobPart[], { type: 'audio/mp3' });
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const compressedFileName = `${baseName}_16k_mono.mp3`;

  return new File([blob], compressedFileName, {
    type: 'audio/mp3',
    lastModified: Date.now(),
  });
}
