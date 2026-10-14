import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// NG-ZORRO
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';

// CodeMirror
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, ViewPlugin, ViewUpdate, MatchDecorator, Decoration } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting, foldGutter } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// JSZip
import JSZip from 'jszip';
import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import mermaid from 'mermaid';
import hljs from 'highlight.js/lib/common';

import { NoteStore } from '../../core/stores/note.store';
import { Note, NoteStatus } from '../../core/models/note.model';
import { Folder } from '../../core/models/folder.model';

const customTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent !important', color: 'var(--text-main) !important' },
  '.cm-content': { fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", fontSize: '15px' },
  '.cm-gutters': { backgroundColor: 'transparent !important', color: 'var(--text-muted)', borderRight: 'none' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'var(--selection-bg) !important' },
  '.cm-code-meta': { color: 'var(--hl-keyword) !important' },
  '.cm-math-dollar': { color: 'var(--hl-dollar) !important', fontWeight: 'bold' },
  '.cm-md-hash': { color: 'var(--hl-hash) !important', fontWeight: 'bold' },
  '.cm-md-checkbox': { color: 'var(--hl-checkbox) !important', fontWeight: 'bold' },
  '.cm-heading': { fontWeight: '700', lineHeight: '1.2', display: 'block' },
  '.cm-heading-1': { fontSize: '2em' },
  '.cm-heading-2': { fontSize: '1.7em' },
  '.cm-heading-3': { fontSize: '1.4em' },
  '.cm-heading-4': { fontSize: '1.2em' },
  '.cm-heading-5': { fontSize: '1.08em' },
  '.cm-heading-6': { fontSize: '1em' },
});

const inkdropHighlightStyle = HighlightStyle.define([
  { tag: t.heading,      color: 'var(--hl-heading)', fontWeight: 'bold' },
  { tag: t.strong,       fontWeight: 'bold', color: 'var(--hl-strong)' },
  { tag: t.emphasis,     fontStyle: 'italic', color: 'var(--hl-em)' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--hl-del)' },
  { tag: t.link,         color: 'var(--hl-link)', textDecoration: 'underline' },
  { tag: t.url,          color: 'var(--hl-link)' },
  { tag: t.monospace,    color: 'var(--hl-code)', backgroundColor: 'var(--bg-code)', borderRadius: '3px', padding: '1px 3px' },
  { tag: t.comment,      color: 'var(--hl-comment)', fontStyle: 'italic' },
  { tag: t.meta,         color: 'var(--hl-meta)', fontWeight: '500' },
  { tag: t.punctuation,  color: 'var(--hl-punct)', fontWeight: '500' },
  { tag: t.angleBracket, color: 'var(--hl-punct)' },
  { tag: t.squareBracket,color: 'var(--hl-punct)' },
  { tag: t.tagName,      color: 'var(--hl-heading)', fontWeight: '600' },
  { tag: t.attributeName,color: 'var(--hl-property)' },
  { tag: t.attributeValue,color: 'var(--hl-string)' },
  { tag: t.documentMeta, color: 'var(--hl-meta)' },
  { tag: t.string, color: 'var(--hl-string)' },
  { tag: t.propertyName, color: 'var(--hl-property)' },
  { tag: t.keyword, color: 'var(--hl-keyword)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--hl-number)' },
  { tag: t.operator, color: 'var(--hl-operator)' },
  { tag: t.variableName, color: 'var(--text-main)' },
  { tag: t.definition(t.variableName), color: 'var(--hl-meta)' },
  { tag: t.function(t.variableName), color: 'var(--hl-function)' },
  { tag: t.definition(t.function(t.variableName)), color: 'var(--hl-function)', fontWeight: '600' },
  { tag: t.className, color: 'var(--hl-function)' },
  { tag: t.definition(t.typeName), color: 'var(--hl-keyword)' },
  { tag: t.typeName, color: 'var(--hl-keyword)' },
  { tag: [t.regexp, t.special(t.string)], color: 'var(--hl-code)' },
  { tag: t.escape, color: 'var(--hl-meta)' },
  { tag: t.invalid, color: 'var(--hl-del)', textDecoration: 'underline wavy' }
]);

const dollarDecorator = new MatchDecorator({
  regexp: /\$/g, decoration: Decoration.mark({ class: 'cm-math-dollar' })
});
const dollarPlugin = ViewPlugin.fromClass(class {
  decorations: any; constructor(view: EditorView) { this.decorations = dollarDecorator.createDeco(view); }
  update(update: ViewUpdate) { this.decorations = dollarDecorator.updateDeco(update, this.decorations); }
}, { decorations: v => v.decorations });

const hashDecorator = new MatchDecorator({
  regexp: /(^|\s)(#+)(?=\s)/g, decoration: Decoration.mark({ class: 'cm-md-hash' })
});
const hashPlugin = ViewPlugin.fromClass(class {
  decorations: any; constructor(view: EditorView) { this.decorations = hashDecorator.createDeco(view); }
  update(update: ViewUpdate) { this.decorations = hashDecorator.updateDeco(update, this.decorations); }
}, { decorations: v => v.decorations });

const checkboxDecorator = new MatchDecorator({
  regexp: /\[[ \t]*[xX]?[ \t]*\]/g, decoration: Decoration.mark({ class: 'cm-md-checkbox' })
});
const checkboxPlugin = ViewPlugin.fromClass(class {
  decorations: any; constructor(view: EditorView) { this.decorations = checkboxDecorator.createDeco(view); }
  update(update: ViewUpdate) { this.decorations = checkboxDecorator.updateDeco(update, this.decorations); }
}, { decorations: v => v.decorations });

const codeMetaDecorator = new MatchDecorator({
  regexp: /(filename|title)="([^"]+)"/g, decoration: Decoration.mark({ class: 'cm-code-meta' })
});
const codeMetaPlugin = ViewPlugin.fromClass(class {
  decorations: any; constructor(view: EditorView) { this.decorations = codeMetaDecorator.createDeco(view); }
  update(update: ViewUpdate) { this.decorations = codeMetaDecorator.updateDeco(update, this.decorations); }
}, { decorations: v => v.decorations });

const sublistPlugin = ViewPlugin.fromClass(class {
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
}, { decorations: v => v.decorations });

const headingDecorator = new MatchDecorator({
  regexp: /^(#{1,6})(?:\s+.*)?$/gm,
  decoration: (match) => {
    const level = match[1].length;
    return Decoration.mark({ class: `cm-heading cm-heading-${level}` });
  }
});
const headingPlugin = ViewPlugin.fromClass(class {
  decorations: any; constructor(view: EditorView) { this.decorations = headingDecorator.createDeco(view); }
  update(update: ViewUpdate) { this.decorations = headingDecorator.updateDeco(update, this.decorations); }
}, { decorations: v => v.decorations });

const markedInstance = new Marked({ gfm: true });
markedInstance.use(markedKatex({ throwOnError: false }));

type ItemContextMenu = {
  kind: 'folder' | 'note';
  id: string;
  pinned: boolean;
  x: number;
  y: number;
};

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
        const svgIcon = `<svg viewBox="64 64 896 896" focusable="false" fill="currentColor" width="1em" height="1em"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"></path><path d="M464 336a48 48 0 1096 0 48 48 0 10-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"></path></svg>`;
        headerHtml = `
          <div class="code-block-header">
            ${title ? `<div class="code-title"><span class="anticon">${svgIcon}</span>${title}</div>` : ''}
            ${filename ? `<div class="code-filename">${filename}</div>` : ''}
          </div>
        `;
      }

      const escapeHtml = (code: string) => code.replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[character]!);
      const highlightedCode = safeLanguage && hljs.getLanguage(safeLanguage)
        ? hljs.highlight(token.text, { language: safeLanguage, ignoreIllegals: true }).value
        : escapeHtml(token.text);
      const languageClass = safeLanguage ? ` language-${safeLanguage}` : '';

      return `<div class="custom-code-block">${headerHtml}<pre><code class="hljs${languageClass}">${highlightedCode}</code></pre></div>`;
    }
  }
});

mermaid.initialize({ startOnLoad: false, theme: 'default' });

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NzLayoutModule, NzMenuModule, NzIconModule,
    NzTooltipModule, NzButtonModule, NzDropdownModule, NzTagModule, NzInputModule,
    NzSelectModule, NzModalModule
  ],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnDestroy {
  protected readonly store = inject(NoteStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly modal = inject(NzModalService);
  private readonly tagPalette = [
    { background: '#E6F7FF', borderColor: '#91D5FF', color: '#0050B3' },
    { background: '#F6FFED', borderColor: '#B7EB8F', color: '#389E0D' },
    { background: '#FFF7E6', borderColor: '#FFC069', color: '#D46B08' },
    { background: '#F9F0FF', borderColor: '#D3ADF7', color: '#722ED1' },
    { background: '#FFF1F0', borderColor: '#FFCCC7', color: '#CF1322' },
    { background: '#E6FFFB', borderColor: '#87E8DE', color: '#08979C' },
  ];

  parsedContent = signal<SafeHtml>('');
  viewMode = signal<'edit' | 'split' | 'preview'>('split');
  currentTheme = signal<'theme-default' | 'theme-dark' | 'theme-cream'>('theme-default');

  editingTitleId = signal<string | null>(null);
  editTitleText = signal<string>('');

  expandedFolders = signal<Set<string>>(new Set());
  editingFolderId = signal<string | null>(null);
  editFolderText = signal<string>('');

  inputTagVisible = signal(false);
  inputTagValue = signal('');

  searchQuery = signal('');
  selectedTag = signal<string | null>(null);
  contextMenu = signal<ItemContextMenu | null>(null);

  allTags = computed(() => {
    const tags = new Set<string>();
    this.store.notes().forEach(n => {
      if (n.tags) n.tags.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  });

  foldersWithNotes = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const tagFilter = this.selectedTag();

    return this.store.folders().map(folder => {
      const notes = this.store.notes().filter(n => {
        const matchFolder = n.folderId === folder.id;
        const matchQuery = !query || n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query);
        const matchTag = !tagFilter || (n.tags && n.tags.includes(tagFilter));
        return matchFolder && matchQuery && matchTag;
      }).sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)));
      return { ...folder, notes };
    })
    .sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)))
    .filter(folder => (!query && !tagFilter) || folder.notes.length > 0);
  });

  rootNotes = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const tagFilter = this.selectedTag();
    return this.store.notes().filter(n => {
      const matchFolder = n.folderId === null;
      const matchQuery = !query || n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query);
      const matchTag = !tagFilter || (n.tags && n.tags.includes(tagFilter));
      return matchFolder && matchQuery && matchTag;
    }).sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)));
  });

  private editorView?: EditorView;
  private _editorContainer?: ElementRef;

  @ViewChild('editorContainer') set editorContainerRef(ref: ElementRef | undefined) {
    if (ref && !this.editorView) {
      this._editorContainer = ref;
      if (isPlatformBrowser(this.platformId)) {
        this.initCodeMirror();
      }
    } else if (!ref && this.editorView) {
      this.editorView.destroy();
      this.editorView = undefined;
    }
  }

  @ViewChild('tagInput') tagInputElement?: ElementRef;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('app-theme') as any;
      const initialTheme = savedTheme || 'theme-default';
      this.currentTheme.set(initialTheme);
      // Gán class Theme ra tận document.body để Modal có thể nhận diện được
      document.body.classList.add(initialTheme);
    }

    effect(() => {
      const activeNote = this.store.activeNote();
      if (activeNote) {
        this.updatePreview(activeNote.content);
        if (this.editorView) {
          const currentDoc = this.editorView.state.doc.toString();
          if (currentDoc !== activeNote.content) {
            this.editorView.dispatch({
              changes: { from: 0, to: currentDoc.length, insert: activeNote.content },
            });
          }
        }
      } else {
        this.parsedContent.set('');
      }
    });
  }

  ngOnDestroy(): void {
    this.editorView?.destroy();
  }

  setTheme(theme: 'theme-default' | 'theme-dark' | 'theme-cream'): void {
    const oldTheme = this.currentTheme();
    this.currentTheme.set(theme);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('app-theme', theme);
      // Thay đổi class Theme trên body
      document.body.classList.remove(oldTheme);
      document.body.classList.add(theme);

      const note = this.store.activeNote();
      if (note) this.updatePreview(note.content);
    }
  }

  getRelativeTime(timestamp?: number): string {
    if (!timestamp) return '';
    const diffMs = timestamp - Date.now();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (Math.abs(diffMins) < 1) return 'Just now';
    if (Math.abs(diffMins) < 60) return rtf.format(diffMins, 'minute');
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
    return rtf.format(diffDays, 'day');
  }

  private initCodeMirror(): void {
    if (!this._editorContainer) return;
    const activeNote = this.store.activeNote();
    const startContent = activeNote?.content ?? '';

    const state = EditorState.create({
      doc: startContent,
      extensions: [
        lineNumbers(),
        foldGutter(),
        EditorView.lineWrapping,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        customTheme,
        syntaxHighlighting(inkdropHighlightStyle),
        dollarPlugin,
        hashPlugin,
        checkboxPlugin,
        codeMetaPlugin,
        sublistPlugin,
        headingPlugin,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.handleEditorChange(update.state.doc.toString());
          }
        }),
      ],
    });

    this.editorView = new EditorView({
      state,
      parent: this._editorContainer.nativeElement,
    });
  }

  private async updatePreview(rawMarkdown: string): Promise<void> {
    const html = await markedInstance.parse(rawMarkdown);
    const clickableHtml = html.replace(/<input([^>]*?)disabled(?:="")?([^>]*?)>/g, '<input$1$2>');
    this.parsedContent.set(this.sanitizer.bypassSecurityTrustHtml(clickableHtml));

    setTimeout(() => {
      try {
        const mTheme = this.currentTheme() === 'theme-dark' ? 'dark' : 'default';
        mermaid.initialize({ startOnLoad: false, theme: mTheme });
        mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      } catch (error) {}
    }, 50);
  }

  handleEditorChange(newContent: string): void {
    const currentNote = this.store.activeNote();
    if (!currentNote) return;
    this.store.updateNoteContent(currentNote.id, newContent, currentNote.title);
  }

  setViewMode(mode: 'edit' | 'split' | 'preview'): void {
    this.viewMode.set(mode);
  }

  openItemContextMenu(event: MouseEvent, kind: ItemContextMenu['kind'], id: string, pinned = false): void {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 190;
    const menuHeight = 44;
    this.contextMenu.set({
      kind,
      id,
      pinned,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  toggleContextItemPinned(): void {
    const target = this.contextMenu();
    if (!target) return;

    if (target.kind === 'folder') {
      this.store.setFolderPinned(target.id, !target.pinned);
    } else {
      this.store.updateNoteMeta(target.id, { pinned: !target.pinned });
    }
    this.closeContextMenu();
  }

  getStatusLabel(status?: NoteStatus): string {
    const labels: Record<string, string> = {
      'none': 'None',
      'active': 'Active',
      'on-hold': 'On Hold',
      'completed': 'Completed',
      'dropped': 'Dropped'
    };
    return labels[status || 'none'];
  }

  getTagStyle(tag: string): { background: string; borderColor: string; color: string } {
    const hash = Array.from(tag).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const index = hash % this.tagPalette.length;
    const selected = this.tagPalette[index];

    return {
      background: selected.background,
      borderColor: selected.borderColor,
      color: selected.color,
    };
  }

  updateStatus(status: NoteStatus): void {
    const note = this.store.activeNote();
    if (note) this.store.updateNoteMeta(note.id, { status });
  }

  removeTag(tagToRemove: string): void {
    this.modal.confirm({
      nzTitle: 'Remove Tag?',
      nzContent: `Are you sure you want to remove the tag "${tagToRemove}"?`,
      nzOkText: 'Remove',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => {
        const note = this.store.activeNote();
        if (note) {
          const currentTags = note.tags || [];
          this.store.updateNoteMeta(note.id, { tags: currentTags.filter(t => t !== tagToRemove) });
        }
      }
    });
  }

  showTagInput(): void {
    this.inputTagVisible.set(true);
    setTimeout(() => {
      this.tagInputElement?.nativeElement.focus();
    }, 10);
  }

  handleInputTagConfirm(): void {
    const inputValue = this.inputTagValue().trim();
    const note = this.store.activeNote();
    if (inputValue && note) {
      const currentTags = note.tags || [];
      if (!currentTags.includes(inputValue)) {
        this.store.updateNoteMeta(note.id, { tags: [...currentTags, inputValue] });
      }
    }
    this.inputTagValue.set('');
    this.inputTagVisible.set(false);
  }

  onPreviewClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'input' && (target as HTMLInputElement).type === 'checkbox') {
      event.preventDefault();
      const checkboxes = Array.from(document.querySelectorAll('.preview-content input[type="checkbox"]'));
      const index = checkboxes.indexOf(target as HTMLInputElement);
      if (index === -1) return;
      const currentNote = this.store.activeNote();
      if (!currentNote) return;
      const content = currentNote.content;
      let matchCount = 0;
      const regex = /(```[\s\S]*?```)|^([ \t]*(?:[-*+]|\d+\.)[ \t]+\[)([ xX])(\][ \t]*)(.*)$/gm;
      const newContent = content.replace(regex, (match, codeBlock, prefix, checkState, checkboxEnd, taskText) => {
        if (codeBlock) return match;
        if (matchCount === index) {
          matchCount++;
          const newState = checkState === ' ' ? 'x' : ' ';
          const leadingSpace = taskText.match(/^\s*/)?.[0] ?? '';
          const trailingSpace = taskText.match(/\s*$/)?.[0] ?? '';
          let taskBody = taskText.slice(leadingSpace.length, taskText.length - trailingSpace.length);

          if (taskBody) {
            if (newState === 'x' && !/^~~[\s\S]+~~$/.test(taskBody)) {
              taskBody = `~~${taskBody}~~`;
            } else if (newState === ' ' && /^~~[\s\S]+~~$/.test(taskBody)) {
              taskBody = taskBody.slice(2, -2);
            }
          }

          return `${prefix}${newState}${checkboxEnd}${leadingSpace}${taskBody}${trailingSpace}`;
        }
        matchCount++;
        return match;
      });
      if (newContent !== content) {
        this.store.updateNoteContent(currentNote.id, newContent, currentNote.title);
      }
    }
  }

  createNewFolder(): void {
    const now = Date.now();
    const newFolder: Folder = { id: crypto.randomUUID(), name: 'New Folder', createdAt: now };
    this.store.addFolder(newFolder);
    this.expandedFolders.update(set => { const newSet = new Set(set); newSet.add(newFolder.id); return newSet; });
    setTimeout(() => this.startEditFolder(new Event('click'), newFolder), 100);
  }

  toggleFolder(folderId: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.store.setActiveFolderId(folderId);
    this.expandedFolders.update(set => {
      const newSet = new Set(set);
      if (newSet.has(folderId)) newSet.delete(folderId);
      else newSet.add(folderId);
      return newSet;
    });
  }

  isExpanded(folderId: string): boolean {
    return this.expandedFolders().has(folderId);
  }

  startEditFolder(event: Event, folder: Folder): void {
    event.stopPropagation();
    this.editingFolderId.set(folder.id);
    this.editFolderText.set(folder.name === 'New Folder' ? '' : folder.name);
    setTimeout(() => {
      const input = document.querySelector('.edit-folder-input') as HTMLInputElement;
      if (input) { input.focus(); input.select(); }
    }, 0);
  }

  saveFolder(folder: Folder, event?: Event): void {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    if (this.editingFolderId() !== folder.id) return;
    const newName = this.editFolderText().trim() || 'New Folder';
    this.editingFolderId.set(null);
    if (newName === folder.name) return;
    this.store.renameFolder(folder.id, newName);
  }

  deleteFolder(id: string, event: Event): void {
    event.stopPropagation();
    this.modal.confirm({
      nzTitle: 'Delete Folder?',
      nzContent: 'Are you sure you want to delete this folder? All notes inside will be permanently deleted!',
      nzOkText: 'Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => this.store.deleteFolder(id)
    });
  }

  createNewNote(targetFolderId?: string | null): void {
    const now = Date.now();
    const folderId = targetFolderId !== undefined ? targetFolderId : this.store.activeFolderId();
    const newNote: Note = {
      id: crypto.randomUUID(), title: 'Untitled Note', content: '',
      folderId: folderId, createdAt: now, updatedAt: now,
    };
    this.store.addNote(newNote);
    if (folderId) {
      this.expandedFolders.update(set => { const newSet = new Set(set); newSet.add(folderId); return newSet; });
    }
  }

  startEditTitle(event: Event, note: Note): void {
    event.stopPropagation();
    if (this.store.activeNoteId() !== note.id) { this.store.setActiveNoteId(note.id); }
    this.editingTitleId.set(note.id);
    this.editTitleText.set(note.title === 'Untitled Note' ? '' : note.title);
    setTimeout(() => {
      const input = document.querySelector('.edit-title-input') as HTMLInputElement;
      if (input) { input.focus(); input.select(); }
    }, 0);
  }

  saveTitle(note: Note, event?: Event): void {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    if (this.editingTitleId() !== note.id) return;
    const newTitle = this.editTitleText().trim() || 'Untitled Note';
    this.editingTitleId.set(null);
    if (newTitle === note.title) return;
    this.store.updateNoteContent(note.id, note.content, newTitle);
  }

  selectNote(id: string): void {
    this.store.setActiveNoteId(id);
  }

  deleteNote(id: string, event: Event): void {
    event.stopPropagation();
    this.modal.confirm({
      nzTitle: 'Delete Note?',
      nzContent: 'Are you sure you want to delete this note?',
      nzOkText: 'Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => this.store.deleteNote(id)
    });
  }

  getSnippet(content: string): string {
    if (!content) return 'No content';
    const plainText = content.replace(/[#*`_>[\]]/g, '').trim();
    return plainText.length > 40 ? `${plainText.substring(0, 40)}...` : plainText;
  }

  async openFile(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md, text/markdown, text/plain';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const content = await file.text();
      const title = file.name.replace(/\.[^/.]+$/, "");
      const now = Date.now();
      const newNote: Note = {
        id: crypto.randomUUID(), title: title || 'Untitled Note', content: content,
        folderId: this.store.activeFolderId(), createdAt: now, updatedAt: now,
      };
      this.store.addNote(newNote);
    };
    input.click();
  }

  exportFile(): void {
    const currentNote = this.store.activeNote();
    if (!currentNote) return;
    const blob = new Blob([currentNote.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentNote.title || 'Untitled Note'}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  async openFolder(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      const folderName = files[0].webkitRelativePath.split('/')[0] || 'Imported Folder';
      const newFolder: Folder = { id: crypto.randomUUID(), name: folderName, createdAt: Date.now() };
      this.store.addFolder(newFolder);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          const content = await file.text();
          const title = file.name.replace(/\.[^/.]+$/, "");
          const newNote: Note = {
            id: crypto.randomUUID(), title: title || 'Untitled Note', content: content,
            folderId: newFolder.id, createdAt: Date.now(), updatedAt: Date.now(),
          };
          this.store.addNote(newNote);
        }
      }
      this.expandedFolders.update(set => { const newSet = new Set(set); newSet.add(newFolder.id); return newSet; });
      this.store.setActiveFolderId(newFolder.id);
    };
    input.click();
  }

  async exportFolder(folder: Folder, event: Event): Promise<void> {
    event.stopPropagation();
    const notesInFolder = this.store.notes().filter(n => n.folderId === folder.id);
    if (notesInFolder.length === 0) return;

    const zip = new JSZip();
    notesInFolder.forEach(note => {
      const safeTitle = (note.title || 'Untitled Note').replace(/[\\/:*?"<>|]/g, '');
      zip.file(`${safeTitle}.md`, note.content);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folder.name}.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }
}
