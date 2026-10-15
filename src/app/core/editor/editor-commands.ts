import { EditorView } from '@codemirror/view';
import { ChangeSpec } from '@codemirror/state';
import { openSearchPanel } from '@codemirror/search';

/**
 * Wraps or unwraps current selection with prefix and suffix.
 */
export function wrapSelection(view: EditorView, prefix: string, suffix = prefix, placeholder = 'text'): void {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const newSelectionRanges: { anchor: number; head: number }[] = [];

  for (const range of state.selection.ranges) {
    const selectedText = state.sliceDoc(range.from, range.to);

    // If already wrapped, unwrap it
    if (
      selectedText.startsWith(prefix) &&
      selectedText.endsWith(suffix) &&
      selectedText.length >= prefix.length + suffix.length
    ) {
      const unwrapped = selectedText.slice(prefix.length, selectedText.length - suffix.length);
      changes.push({ from: range.from, to: range.to, insert: unwrapped });
      newSelectionRanges.push({ anchor: range.from, head: range.from + unwrapped.length });
    } else {
      const content = selectedText || placeholder;
      const wrapped = `${prefix}${content}${suffix}`;
      changes.push({ from: range.from, to: range.to, insert: wrapped });
      newSelectionRanges.push({
        anchor: range.from + prefix.length,
        head: range.from + prefix.length + content.length,
      });
    }
  }

  view.dispatch({
    changes,
    selection: { anchor: newSelectionRanges[0].anchor, head: newSelectionRanges[0].head },
  });
  view.focus();
}

/**
 * Prefixes current lines with a token like `# `, `- `, `> `, etc.
 */
export function prefixLines(view: EditorView, prefix: string): void {
  const { state } = view;
  const changes: ChangeSpec[] = [];

  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.from);
    if (line.text.startsWith(prefix)) {
      // Toggle off
      changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
    } else {
      // Toggle on
      changes.push({ from: line.from, to: line.from, insert: prefix });
    }
  }

  view.dispatch({ changes });
  view.focus();
}

export function insertSnippet(view: EditorView, template: string): void {
  const range = view.state.selection.main;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: template },
    selection: { anchor: range.from + template.length },
  });
  view.focus();
}

export const EditorCommands = {
  bold: (view?: EditorView) => view && wrapSelection(view, '**', '**', 'bold text'),
  italic: (view?: EditorView) => view && wrapSelection(view, '*', '*', 'italic text'),
  strikethrough: (view?: EditorView) => view && wrapSelection(view, '~~', '~~', 'strikethrough'),
  inlineCode: (view?: EditorView) => view && wrapSelection(view, '`', '`', 'code'),
  math: (view?: EditorView) => view && wrapSelection(view, '$', '$', 'E = mc^2'),
  mathBlock: (view?: EditorView) =>
    view &&
    insertSnippet(
      view,
      '\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$\n'
    ),
  mathMatrix: (view?: EditorView) =>
    view &&
    insertSnippet(
      view,
      '\n$$\n\\begin{pmatrix}\na & b \\\\\nc & d\n\\end{pmatrix}\n$$\n'
    ),

  heading1: (view?: EditorView) => view && prefixLines(view, '# '),
  heading2: (view?: EditorView) => view && prefixLines(view, '## '),
  heading3: (view?: EditorView) => view && prefixLines(view, '### '),

  bulletList: (view?: EditorView) => view && prefixLines(view, '- '),
  numberedList: (view?: EditorView) => view && prefixLines(view, '1. '),
  taskList: (view?: EditorView) => view && prefixLines(view, '- [ ] '),
  quote: (view?: EditorView) => view && prefixLines(view, '> '),

  codeBlock: (view?: EditorView) => {
    if (!view) return;
    const { state } = view;
    const range = state.selection.main;
    const selected = state.sliceDoc(range.from, range.to);
    const content = selected || '// Code here';
    const insert = `\n\`\`\`javascript\n${content}\n\`\`\`\n`;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      selection: { anchor: range.from + 15, head: range.from + 15 + content.length },
    });
    view.focus();
  },

  link: (view?: EditorView) => {
    if (!view) return;
    const { state } = view;
    const range = state.selection.main;
    const selected = state.sliceDoc(range.from, range.to);
    const text = selected || 'link title';
    const insert = `[${text}](https://example.com)`;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      selection: { anchor: range.from + text.length + 3, head: range.from + insert.length - 1 },
    });
    view.focus();
  },

  table: (view?: EditorView) => {
    if (!view) return;
    const tableTemplate =
      '\n| Header 1 | Header 2 | Header 3 |\n| :--- | :---: | ---: |\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |\n\n';
    insertSnippet(view, tableTemplate);
  },

  mermaid: (view?: EditorView) => {
    if (!view) return;
    const diagram =
      '\n```mermaid\nflowchart TD\n  Start([Start]) --> Process[Process Task]\n  Process --> Decision{Is it Done?}\n  Decision -- Yes --> Finish([Finish])\n  Decision -- No --> Process\n```\n';
    insertSnippet(view, diagram);
  },

  mermaidFlowchart: (view?: EditorView) => {
    if (!view) return;
    insertSnippet(
      view,
      '\n```mermaid\nflowchart TD\n  Start([Start]) --> Process[Process Task]\n  Process --> Decision{Is it Done?}\n  Decision -- Yes --> Finish([Finish])\n  Decision -- No --> Process\n```\n'
    );
  },

  mermaidSequence: (view?: EditorView) => {
    if (!view) return;
    insertSnippet(
      view,
      '\n```mermaid\nsequenceDiagram\n  autonumber\n  actor User\n  participant App\n  participant Server\n  User->>App: Click Action\n  App->>Server: Request\n  Server-->>App: 200 OK\n  App-->>User: Show Result\n```\n'
    );
  },

  mermaidClass: (view?: EditorView) => {
    if (!view) return;
    insertSnippet(
      view,
      '\n```mermaid\nclassDiagram\n  class Note {\n    +String id\n    +String title\n    +String content\n    +save(): void\n  }\n  class Notebook {\n    +String id\n    +String name\n    +Note[] notes\n  }\n  Notebook "1" *-- "many" Note\n```\n'
    );
  },

  mermaidState: (view?: EditorView) => {
    if (!view) return;
    insertSnippet(
      view,
      '\n```mermaid\nstateDiagram-v2\n  [*] --> Draft\n  Draft --> Active: Publish\n  Active --> Archived: Archive\n  Archived --> [*]\n```\n'
    );
  },

  mermaidEr: (view?: EditorView) => {
    if (!view) return;
    insertSnippet(
      view,
      '\n```mermaid\nerDiagram\n  NOTEBOOK ||--o{ NOTE : contains\n  NOTE ||--o{ TAG : labeled\n```\n'
    );
  },

  mermaidGit: (view?: EditorView) => {
    if (!view) return;
    insertSnippet(
      view,
      '\n```mermaid\ngitGraph\n  commit\n  branch feature\n  checkout feature\n  commit\n  checkout main\n  merge feature\n```\n'
    );
  },

  search: (view?: EditorView) => view && openSearchPanel(view),
};

