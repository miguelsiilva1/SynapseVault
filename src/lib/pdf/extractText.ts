import { extractText } from 'unpdf';

export interface PdfExtractionResult {
  text: string;
  totalPages: number;
}

/**
 * Extracts raw digital text streams from a PDF ArrayBuffer or Uint8Array.
 * Skips image rasterization to prevent vision token exhaustion.
 */
export async function extractPdfText(buffer: ArrayBuffer | Uint8Array): Promise<PdfExtractionResult> {
  const result = await extractText(new Uint8Array(buffer));
  const mergedText = Array.isArray(result.text) ? result.text.join('\n\n--- Page Break ---\n\n') : String(result.text || '');

  return {
    text: mergedText.trim(),
    totalPages: result.totalPages || 1,
  };
}
