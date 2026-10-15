import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import mermaid from 'mermaid';
import hljs from 'highlight.js/lib/common';

const markedInstance = new Marked({ gfm: true });
markedInstance.use(markedKatex({ throwOnError: false }));

const SVG_CODE_ICON =
  '<svg viewBox="64 64 896 896" focusable="false" fill="currentColor" width="1em" height="1em"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"></path><path d="M464 336a48 48 0 1096 0 48 48 0 10-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"></path></svg>';

markedInstance.use({
  renderer: {
    code(token: any) {
      if (token.lang === 'mermaid') {
        return `<div class="mermaid">${token.text}</div>`;
      }

      let lang = token.lang || '';
      let filename = '';
      let title = '';

      const filenameMatch = lang.match(/filename="([^"]+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
        lang = lang.replace(filenameMatch[0], '');
      }

      const titleMatch = lang.match(/title="([^"]+)"/);
      if (titleMatch) {
        title = titleMatch[1];
        lang = lang.replace(titleMatch[0], '');
      }

      lang = lang.trim();
      const language = lang.split(/\s+/, 1)[0].toLowerCase();
      const safeLanguage = language.replace(/[^a-z0-9_+-]/g, '');
      let headerHtml = '';
      if (title || filename) {
        headerHtml = `
          <div class="code-block-header">
            ${title ? `<div class="code-title"><span class="anticon">${SVG_CODE_ICON}</span>${title}</div>` : ''}
            ${filename ? `<div class="code-filename">${filename}</div>` : ''}
          </div>
        `;
      }

      const escapeHtml = (code: string) =>
        code.replace(
          /[&<>"']/g,
          (character) =>
            ({
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;',
            })[character]!
        );

      const highlightedCode =
        safeLanguage && hljs.getLanguage(safeLanguage)
          ? hljs.highlight(token.text, { language: safeLanguage, ignoreIllegals: true }).value
          : escapeHtml(token.text);
      const languageClass = safeLanguage ? ` language-${safeLanguage}` : '';

      return `<div class="custom-code-block">${headerHtml}<pre><code class="hljs${languageClass}">${highlightedCode}</code></pre></div>`;
    },
  },
});

mermaid.initialize({ startOnLoad: false, theme: 'default' });

export async function parseMarkdownToHtml(rawMarkdown: string): Promise<string> {
  const html = await markedInstance.parse(rawMarkdown);
  // Cho phép checkbox interactive trong preview (marked mặc định render disabled)
  return html.replace(/<input([^>]*?)disabled(?:="")?([^>]*?)>/g, '<input$1$2>');
}

export function renderMermaidDiagrams(theme: 'default' | 'dark' = 'default'): void {
  try {
    mermaid.initialize({ startOnLoad: false, theme });
    mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
  } catch {
    // Ignore render error if diagram is partially typed
  }
}

