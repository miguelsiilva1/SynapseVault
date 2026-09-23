import { GoogleGenAI } from '@google/genai';

export interface IncrementalMasterSynthesisParams {
  courseName: string;
  courseCode: string;
  currentMasterSummary?: string;
  newNoteTitle: string;
  newNoteContent: string;
  outputLanguage?: string;
  modelName?: string;
}

export interface FullMasterSynthesisParams {
  courseName: string;
  courseCode: string;
  notes: Array<{ title: string; contentMarkdown: string }>;
  outputLanguage?: string;
  modelName?: string;
}

export interface MasterSynthesisResult {
  markdown: string;
  modelUsed: string;
}

const PRIMARY_MODEL = 'gemini-3.6-flash';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

/**
 * Sanitizes markdown titles and internal links so they are Obsidian-compatible.
 */
function sanitizeObsidianLinks(markdown: string): string {
  return markdown.replace(/\[\[(.*?)\]\]/g, (match, linkContent: string) => {
    const parts = linkContent.split('|');
    const target = parts[0].replace(/[:\\/]/g, ' - ').replace(/\s+/g, ' ').trim();
    if (parts.length > 1) {
      return `[[${target}|${parts.slice(1).join('|')}]]`;
    }
    return `[[${target}]]`;
  });
}

/**
 * Incrementally updates an evolving Master Course Summary with a newly added lecture note.
 */
export async function updateMasterSummaryIncremental(
  params: IncrementalMasterSynthesisParams
): Promise<MasterSynthesisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in the environment.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const lang = params.outputLanguage || 'pt';
  const hasExistingSummary = Boolean(params.currentMasterSummary && params.currentMasterSummary.trim().length > 50);

  const systemInstruction = `
És o Arquiteto de Síntese Universitária do SynapseVault (Modo NotebookLM Coletivo).
A tua missão é gerir e atualizar a "Síntese Mestra" (Master Knowledge Base) da cadeira universitária "${params.courseName}" (${params.courseCode}).

Objetivo da Atualização:
${
  hasExistingSummary
    ? `Tens em mãos o "Sumário Mestre Atual" desta cadeira e uma "Nova Aula Importada" (${params.newNoteTitle}).
Deves fazer um **Merge Incremental Inteligente**:
1. Integra e expande os tópicos com os novos conceitos teóricos, fórmulas matemáticas, arquiteturas e práticas laboratoriais da nova aula.
2. Não dupliques explicações idênticas; enriquece e aprofunda o conteúdo existente.
3. Se a nova aula introduz um novo capítulo ou módulo curricular, cria a secção correspondente mantendo a ordem lógica do semestre.
4. Adiciona ou atualiza no final uma secção de "Tópicos de Exame / Questões-Chave" e "Links Cruzados entre Aulas".
5. Preserva a formatação Markdown rica (LaTeX para fórmulas com $, blocos de código com linguagem específica, tabelas comparativas e callouts [!NOTE], [!TIP], [!IMPORTANT]).`
    : `Esta é a primeira aula importada para esta cadeira. Cria a estrutura fundacional da "Síntese Mestra" desta cadeira a partir do conteúdo de "${params.newNoteTitle}".
Inclui:
- Visão Geral da Cadeira e Ementa Temática
- Módulo 1 (baseado nesta aula, exaustivo e aprofundado)
- Conceitos Chave e Fórmulas/Definições
- Questões de Exame e Casos Práticos`
}

Regras Obrigatórias de Formatação:
- Responde em ${lang === 'en' ? 'Inglês (English)' : 'Português Europeu (pt-PT)'}.
- Não incluas blocos de código com delimitadores \`\`\`markdown no início ou fim da resposta. Devolve apenas o texto Markdown puro.
- Títulos de secções e referências [[]] NUNCA podem conter dois pontos (:) ou barras (/ ou \\).
`;

  const userContent = `
Cadeira: ${params.courseName} (${params.courseCode})
Aula Adicionada: ${params.newNoteTitle}

${
  hasExistingSummary
    ? `=== SUMÁRIO MESTRE ATUAL ===\n${params.currentMasterSummary}\n=== FIM DO SUMÁRIO ATUAL ===\n\n`
    : ''
}
=== CONTEÚDO DA NOVA AULA ===
${params.newNoteContent}
=== FIM DA NOVA AULA ===

Produz a versão atualizada e consolidada do Master Summary desta cadeira.
`;

  const candidateModels = [params.modelName || PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userContent,
        config: {
          systemInstruction,
          temperature: 0.25,
        },
      });

      const raw = response.text || '';
      const cleaned = raw.replace(/^```markdown\n?/i, '').replace(/\n?```$/i, '').trim();
      return {
        markdown: sanitizeObsidianLinks(cleaned),
        modelUsed: model,
      };
    } catch (err) {
      console.warn(`[MasterSynthesis] Model ${model} failed, testing next fallback:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('Master summary synthesis failed across all fallback models.');
}

/**
 * Regenerates the entire Master Summary from all notes currently in the folder.
 */
export async function regenerateMasterSummaryFull(
  params: FullMasterSynthesisParams
): Promise<MasterSynthesisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is unconfigured.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const lang = params.outputLanguage || 'pt';

  const systemInstruction = `
És o Arquiteto de Síntese do SynapseVault.
Tens a tarefa de criar uma Síntese Mestra Global (Master Syllabus Synthesis) da cadeira "${params.courseName}" (${params.courseCode}), consolidando ${params.notes.length} aulas lecionadas no semestre.

Estrutura Obrigatória:
# Síntese Mestra: ${params.courseName} (${params.courseCode})
## 1. Índice Programático e Roteiro Curricular
## 2. Fundamentos e Teoria Essencial (Por Módulo/Tópico Consolidado)
## 3. Práticas, Algoritmos e Implementações Laboratoriais
## 4. Fórmulas, Teoremas e Definições Formais (com LaTeX $)
## 5. Guia de Preparação para Exames e Pontos Críticos

Regras:
- Não incluas delimitadores de markdown \`\`\`markdown.
- Nunca uses : ou / em títulos ou [[]].
- Responde em ${lang === 'en' ? 'Inglês' : 'Português Europeu'}.
`;

  const concatenated = params.notes
    .map((n, i) => `### Aula ${i + 1}: ${n.title}\n${n.contentMarkdown}`)
    .join('\n\n---\n\n');

  const candidateModels = [params.modelName || PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: unknown;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: concatenated,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      const raw = response.text || '';
      const cleaned = raw.replace(/^```markdown\n?/i, '').replace(/\n?```$/i, '').trim();
      return {
        markdown: sanitizeObsidianLinks(cleaned),
        modelUsed: model,
      };
    } catch (err) {
      console.warn(`[MasterSynthesisFull] Model ${model} failed:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('Full master synthesis failed.');
}
