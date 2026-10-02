/**
 * Shared prompt block: the visual study-guide structure every generated note follows.
 * It stays plain Markdown, so the notes also render in Obsidian.
 * The callout types listed here are styled in `globals.css`.
 */
export const NOTE_VISUAL_STYLE = `
VISUAL STUDY-GUIDE STYLE (mandatory). Output stays plain Markdown that also renders in Obsidian.
Write callout titles and all labels in the target language of the note.

1. Numbered sections: "## 1. Title", then "### 1.1 Subtitle", "### 1.2 Subtitle". Never skip the numbers.
2. Right after every "##" heading, a summary callout of 2 to 4 lines:
   > [!SUMMARY] Em resumo
   > ...
3. Short paragraphs, 4 lines at most. Open a definition with the term in bold and a colon, for example "**Organização:** grupo estruturado de pessoas que ...".
4. Put key terms in bold on first use. Never bold a whole sentence.
5. Whenever 2 or more concepts, types, options or criteria are compared or classified, use a Markdown table with a header row and short cells. Do not describe a comparison in prose.
6. Use a bullet list for any enumeration of 3 or more items.
7. Use callouts with exactly these types, each with a short title:
   > [!TIP] Analogia          an intuition or analogy from engineering or everyday life
   > [!WARNING] Armadilha     a common mistake or exam trap
   > [!EXAMPLE] Exemplo       a worked example with concrete numbers or a real case
   > [!IMPORTANT] Para o exame what the teacher stressed or what is likely to be examined
   > [!NOTE] Nota             a side remark
8. Formulas go in a $$ block, followed by a bullet list that defines each symbol.
9. A process, architecture, flow or hierarchy gets an ASCII diagram (boxes and arrows) inside a \`\`\`text fenced block, at most 70 characters wide.
10. End every "##" section with 2 or 3 self-test questions:
   > [!QUESTION] Perguntas rápidas
   > 1. ...
11. Every "##" section has at least one table, diagram or callout besides the summary.
12. Use only material from the provided sources. Do not invent facts, examples or numbers to fill a table or callout.
`;
