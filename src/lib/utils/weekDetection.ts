/**
 * Pure client-safe utility for detecting week identifiers from titles, filenames, or text.
 * e.g., "Semana 1 - Slides", "aula_semana_2.pdf", "Week 3", "S04", "Aula 5"
 */
export function detectWeekFromTitle(title: string): string | null {
  if (!title) return null;

  // Match "semana 1", "semana_02", "week 3", "sem 4"
  const weekMatch = title.match(/(?:semana|week|sem)\s*[-_.]?\s*0*(\d+)/i);
  if (weekMatch) {
    return `Semana ${parseInt(weekMatch[1], 10)}`;
  }

  // Match "s1", "s02", "w1" with boundary
  const shortMatch = title.match(/\b(?:s|w)0*(\d+)\b/i);
  if (shortMatch) {
    return `Semana ${parseInt(shortMatch[1], 10)}`;
  }

  // Match "aula 1", "aula 02", "lecture 3", "teorica 4"
  const lectureMatch = title.match(/(?:aula|lecture|teorica)\s*[-_.]?\s*0*(\d+)/i);
  if (lectureMatch) {
    return `Semana ${parseInt(lectureMatch[1], 10)}`;
  }

  return null;
}
