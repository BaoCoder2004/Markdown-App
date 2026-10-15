import { Compartment, Extension } from '@codemirror/state';
import { vim } from '@replit/codemirror-vim';
import {
  Decoration,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  lineNumbers,
  keymap,
  EditorView,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { search, searchKeymap } from '@codemirror/search';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { foldGutter, syntaxHighlighting } from '@codemirror/language';
import { customTheme, inkdropHighlightStyle } from './codemirror-theme';
import { EditorCommands } from '../editor/editor-commands';

const dollarDecorator = new MatchDecorator({
  regexp: /\$/g,
  decoration: Decoration.mark({ class: 'cm-math-dollar' }),
});

export const dollarPlugin = ViewPlugin.fromClass(
  class {
    decorations: any;
    constructor(view: EditorView) {
      this.decorations = dollarDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = dollarDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

const hashDecorator = new MatchDecorator({
  regexp: /(^|\s)(#+)(?=\s)/g,
  decoration: Decoration.mark({ class: 'cm-md-hash' }),
});

export const hashPlugin = ViewPlugin.fromClass(
  class {
    decorations: any;
    constructor(view: EditorView) {
      this.decorations = hashDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = hashDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

const checkboxDecorator = new MatchDecorator({
  regexp: /\[[ \t]*[xX]?[ \t]*\]/g,
  decoration: Decoration.mark({ class: 'cm-md-checkbox' }),
});

export const checkboxPlugin = ViewPlugin.fromClass(
  class {
    decorations: any;
    constructor(view: EditorView) {
      this.decorations = checkboxDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = checkboxDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

const codeMetaDecorator = new MatchDecorator({
  regexp: /(filename|title)="([^"]+)"/g,
  decoration: Decoration.mark({ class: 'cm-code-meta' }),
});

export const codeMetaPlugin = ViewPlugin.fromClass(
  class {
    decorations: any;
    constructor(view: EditorView) {
      this.decorations = codeMetaDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = codeMetaDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

export const sublistPlugin = ViewPlugin.fromClass(
  class {
    decorations: any;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    private buildDecorations(view: EditorView) {
      const ranges = [];
      const nestedListMarker = /^([ \t]{2,}|\t+)([-*+])(?=\s|$)/;

      for (const visibleRange of view.visibleRanges) {
        let line = view.state.doc.lineAt(visibleRange.from);
        while (line.from <= visibleRange.to) {
          const match = nestedListMarker.exec(line.text);
          if (match) {
            const markerFrom = line.from + match[1].length;
            ranges.push(Decoration.mark({ class: 'cm-md-sublist' }).range(markerFrom, markerFrom + 1));
          }

          if (line.to >= visibleRange.to || line.number === view.state.doc.lines) break;
          line = view.state.doc.line(line.number + 1);
        }
      }

      return Decoration.set(ranges, true);
    }
  },
  { decorations: (v) => v.decorations }
);

const headingDecorator = new MatchDecorator({
  regexp: /^(#{1,6})(?:\s+.*)?$/gm,
  decoration: (match) => {
    const level = match[1].length;
    return Decoration.mark({ class: `cm-heading cm-heading-${level}` });
  },
});

export const headingPlugin = ViewPlugin.fromClass(
  class {
    decorations: any;
    constructor(view: EditorView) {
      this.decorations = headingDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = headingDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

export const vimCompartment = new Compartment();

export interface CodeMirrorOptions {
  onDocChange: (newDoc: string) => void;
  onImageDropOrPaste?: (file: File) => void;
  isVimMode?: boolean;
}

export function buildCodeMirrorExtensions(options: CodeMirrorOptions): Extension[] {
  const customKeymaps = keymap.of([
    {
      key: 'Mod-b',
      run: (view) => {
        EditorCommands.bold(view);
        return true;
      },
    },
    {
      key: 'Mod-i',
      run: (view) => {
        EditorCommands.italic(view);
        return true;
      },
    },
    {
      key: 'Mod-k',
      run: (view) => {
        EditorCommands.link(view);
        return true;
      },
    },
  ]);

  const domEventHandlers = EditorView.domEventHandlers({
    paste(event, view) {
      const files = event.clipboardData?.files;
      if (files && files.length > 0 && options.onImageDropOrPaste) {
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith('image/')) {
            event.preventDefault();
            options.onImageDropOrPaste(files[i]);
            return true;
          }
        }
      }
      return false;
    },
    drop(event, view) {
      const files = event.dataTransfer?.files;
      if (files && files.length > 0 && options.onImageDropOrPaste) {
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith('image/')) {
            event.preventDefault();
            options.onImageDropOrPaste(files[i]);
            return true;
          }
        }
      }
      return false;
    },
  });

  return [
    vimCompartment.of(options.isVimMode ? vim({ status: true }) : []),
    lineNumbers(),
    foldGutter(),
    EditorView.lineWrapping,
    history(),
    customKeymaps,
    keymap.of([...searchKeymap, ...defaultKeymap, ...historyKeymap]),
    search({ top: true }),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    customTheme,
    syntaxHighlighting(inkdropHighlightStyle),
    dollarPlugin,
    hashPlugin,
    checkboxPlugin,
    codeMetaPlugin,
    sublistPlugin,
    headingPlugin,
    domEventHandlers,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        options.onDocChange(update.state.doc.toString());
      }
    }),
  ];
}
