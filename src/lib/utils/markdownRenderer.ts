import { marked } from 'marked';
import katex from 'katex';

/**
 * SVG icons for callouts (Zero emojis rule compliant)
 */
const CALLOUT_ICONS: Record<string, string> = {
  NOTE: `<svg class="w-4 h-4 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  INFO: `<svg class="w-4 h-4 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  TIP: `<svg class="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="M2 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M12 22v-4"/><path d="m19.07 19.07-2.83-2.83"/><path d="M22 12h-4"/><path d="m19.07 4.93-2.83 2.83"/></svg>`,
  IMPORTANT: `<svg class="w-4 h-4 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  WARNING: `<svg class="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
  CAUTION: `<svg class="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  DANGER: `<svg class="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  EXAMPLE: `<svg class="w-4 h-4 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
};

/**
 * Preprocesses GitHub and Obsidian style callouts:
 * > [!NOTE] Optional Title
 * > Callout body content...
 */
function processCallouts(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inCallout = false;
  let calloutType = '';
  let calloutTitle = '';
  let calloutLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const calloutMatch = line.match(/^>\s*\[!([a-zA-Z]+)\]\s*(.*)$/);

    if (calloutMatch && !inCallout) {
      inCallout = true;
      calloutType = calloutMatch[1].toUpperCase();
      calloutTitle = calloutMatch[2].trim() || calloutType;
      calloutLines = [];
      continue;
    }

    if (inCallout) {
      if (line.startsWith('>')) {
        calloutLines.push(line.replace(/^>\s?/, ''));
      } else {
        result.push(renderCalloutBox(calloutType, calloutTitle, calloutLines.join('\n')));
        inCallout = false;
        calloutType = '';
        calloutTitle = '';
        calloutLines = [];
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  if (inCallout) {
    result.push(renderCalloutBox(calloutType, calloutTitle, calloutLines.join('\n')));
  }

  return result.join('\n');
}

function renderCalloutBox(type: string, title: string, body: string): string {
  const cleanType = type.toUpperCase();
  const typeClass = cleanType.toLowerCase();
  const icon = CALLOUT_ICONS[cleanType] || CALLOUT_ICONS.NOTE;

  return `\n\n<div class="callout-box callout-${typeClass}" data-callout="${cleanType}">
  <div class="callout-header">
    <span class="callout-icon">${icon}</span>
    <span class="callout-title">${title}</span>
  </div>
  <div class="callout-content">

${body.trim()}

  </div>
</div>\n\n`;
}

/**
 * Preprocesses LaTeX math formulas ($$...$$ block and $...$ inline) using KaTeX
 */
function processMath(text: string): string {
  // 1. Block math: $$ ... $$
  let res = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
    try {
      const rendered = katex.renderToString(formula.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      return `\n\n<div class="math-block">\n${rendered}\n</div>\n\n`;
    } catch {
      return match;
    }
  });

  // 2. Inline math: $ ... $ (ensuring not matched inside $$)
  res = res.replace(/(^|[^\$])\$([^\s\$](?:[^\$\n]*?[^\s\$])?)\$(?!\$)/g, (match, prefix, formula) => {
    try {
      const rendered = katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
      });
      return `${prefix}<span class="math-inline">${rendered}</span>`;
    } catch {
      return match;
    }
  });

  return res;
}

/**
 * Preprocesses wiki-links [[Target]] or [[Target|Alias]] into clean readable concepts.
 * E.g.: **[[Organizações]]** -> **Organizações**
 *       [[Gestão|Administração]] -> Administração
 */
function processWikiLinks(text: string): string {
  return text.replace(/\[\[+([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]+/g, (_match, target, alias) => {
    return (alias || target).trim();
  });
}

/**
 * Main Markdown renderer with KaTeX math, callouts, wiki-links, and clean typography
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return '';
  try {
    const withCallouts = processCallouts(markdown);
    const withWikiLinks = processWikiLinks(withCallouts);
    const withMath = processMath(withWikiLinks);
    return marked.parse(withMath, {
      gfm: true,
      breaks: true, // Preserves single newlines as line breaks for handwritten notes and questionnaires
    }) as string;
  } catch (err) {
    console.error('Error in renderMarkdown:', err);
    return marked.parse(markdown, { gfm: true, breaks: true }) as string;
  }
}
