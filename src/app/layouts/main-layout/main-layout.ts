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

// CodeMirror
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting, foldGutter } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// JSZip
import JSZip from 'jszip';

// Markdown Parsers
import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import mermaid from 'mermaid'

import { NoteStore } from '../../core/stores/note.store';
import { Note, NoteStatus } from '../../core/models/note.model';
import { Folder } from '../../core/models/folder.model';

const customTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff !important', color: '#333333 !important' },
  '.cm-content': { fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", fontSize: '15px' },
  '.cm-gutters': { backgroundColor: '#ffffff !important', color: '#a0a0a0', borderRight: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#1890ff' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#b3d8ff !important' },
});

const inkdropHighlightStyle = HighlightStyle.define([
  { tag: t.heading,      color: '#e83e8c', fontWeight: 'bold' },
  { tag: t.strong,       fontWeight: 'bold', color: '#222' },
  { tag: t.emphasis,     fontStyle: 'italic', color: '#222' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#999' },
  { tag: t.link,         color: '#8a2be2', textDecoration: 'underline' },
  { tag: t.url,          color: '#8a2be2' },
  { tag: t.monospace,    color: '#d14', backgroundColor: '#f5f5f5', borderRadius: '3px', padding: '1px 3px' },
  { tag: t.comment,      color: '#999', fontStyle: 'italic' },
  { tag: t.meta,         color: '#1890ff', fontWeight: '500' },
  { tag: t.punctuation,  color: '#1890ff', fontWeight: '500' },
  { tag: t.angleBracket, color: '#1890ff' },
  { tag: t.squareBracket,color: '#1890ff' }
]);

const markedInstance = new Marked({ gfm: true });
markedInstance.use(markedKatex({ throwOnError: false }));

markedInstance.use({
  renderer: {
    code(token: any) {
      if (token.lang === 'mermaid') {
        return `<div class="mermaid">${token.text}</div>`;
      }
      return false;
    }
  }
});

mermaid.initialize({ startOnLoad: false, theme: 'default' });

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NzLayoutModule, NzMenuModule, NzIconModule,
    NzTooltipModule, NzButtonModule, NzDropdownModule, NzTagModule, NzInputModule 
  ],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnDestroy {
  protected readonly store = inject(NoteStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);

  parsedContent = signal<SafeHtml>('');
  viewMode = signal<'edit' | 'split' | 'preview'>('split');

  editingTitleId = signal<string | null>(null);
  editTitleText = signal<string>('');

  expandedFolders = signal<Set<string>>(new Set());
  editingFolderId = signal<string | null>(null);
  editFolderText = signal<string>('');

  inputTagVisible = signal(false);
  inputTagValue = signal('');
  
  searchQuery = signal('');

  foldersWithNotes = computed(() => {
    const query = this.searchQuery().toLowerCase();
    
    return this.store.folders().map(folder => {
      const notes = this.store.notes().filter(n => 
        n.folderId === folder.id && 
        (!query || n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query))
      );
      return { ...folder, notes };
    })
    .filter(folder => !query || folder.notes.length > 0); 
  });

  rootNotes = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.store.notes().filter(n => 
      n.folderId === null && 
      (!query || n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query))
    );
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
        mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      } catch (error) {
      }
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

  updateStatus(status: NoteStatus): void {
    const note = this.store.activeNote();
    if (note) this.store.updateNoteMeta(note.id, { status });
  }

  removeTag(tagToRemove: string): void {
    const note = this.store.activeNote();
    if (note) {
      const currentTags = note.tags || [];
      this.store.updateNoteMeta(note.id, { tags: currentTags.filter(t => t !== tagToRemove) });
    }
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

      const regex = /(```[\s\S]*?```)|(^([ \t]*(?:[-*+]|\d+\.)\s+)\[([ xX])\])/gm;

      const newContent = content.replace(regex, (match, codeBlock, _, prefix, checkState) => {
        if (codeBlock) return match;

        if (matchCount === index) {
          matchCount++;
          const newState = (checkState === ' ' ? 'x' : ' ');
          return `${prefix}[${newState}]`;
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
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name: 'New Folder',
      createdAt: now
    };
    this.store.addFolder(newFolder);

    this.expandedFolders.update(set => {
      const newSet = new Set(set);
      newSet.add(newFolder.id);
      return newSet;
    });

    setTimeout(() => this.startEditFolder(new Event('click'), newFolder), 100);
  }

  toggleFolder(folderId: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.store.setActiveFolderId(folderId);

    this.expandedFolders.update(set => {
      const newSet = new Set(set);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
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
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  saveFolder(folder: Folder, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (this.editingFolderId() !== folder.id) return;

    const newName = this.editFolderText().trim() || 'New Folder';
    this.editingFolderId.set(null);
    if (newName === folder.name) return;
    this.store.renameFolder(folder.id, newName);
  }

  deleteFolder(id: string, event: Event): void {
    event.stopPropagation();
    if (confirm('Bạn có chắc chắn muốn xóa thư mục này? Mọi ghi chú bên trong cũng sẽ bị xóa vĩnh viễn!')) {
      this.store.deleteFolder(id);
    }
  }

  createNewNote(targetFolderId?: string | null): void {
    const now = Date.now();
    const folderId = targetFolderId !== undefined ? targetFolderId : this.store.activeFolderId();

    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '',
      folderId: folderId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.addNote(newNote);

    if (folderId) {
      this.expandedFolders.update(set => {
        const newSet = new Set(set);
        newSet.add(folderId);
        return newSet;
      });
    }
  }

  startEditTitle(event: Event, note: Note): void {
    event.stopPropagation();
    if (this.store.activeNoteId() !== note.id) {
      this.store.setActiveNoteId(note.id);
    }
    this.editingTitleId.set(note.id);
    this.editTitleText.set(note.title === 'Untitled Note' ? '' : note.title);
    setTimeout(() => {
      const input = document.querySelector('.edit-title-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  saveTitle(note: Note, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
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
    this.store.deleteNote(id);
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
        id: crypto.randomUUID(),
        title: title || 'Untitled Note',
        content: content,
        folderId: this.store.activeFolderId(),
        createdAt: now,
        updatedAt: now,
      };
      this.store.addNote(newNote);
    };
    input.click();
  }

  exportFile(): void {
    const currentNote = this.store.activeNote();
    if (!currentNote) {
      alert('Vui lòng mở một ghi chú để xuất file!');
      return;
    }

    const blob = new Blob([currentNote.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentNote.title || 'Untitled Note'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async openFolder(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;

    input.onchange = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const rootPath = files[0].webkitRelativePath;
      const folderName = rootPath.split('/')[0] || 'Imported Folder';

      const newFolder: Folder = {
        id: crypto.randomUUID(),
        name: folderName,
        createdAt: Date.now()
      };
      this.store.addFolder(newFolder);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          const content = await file.text();
          const title = file.name.replace(/\.[^/.]+$/, "");

          const newNote: Note = {
            id: crypto.randomUUID(),
            title: title || 'Untitled Note',
            content: content,
            folderId: newFolder.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          this.store.addNote(newNote);
        }
      }

      this.expandedFolders.update(set => {
        const newSet = new Set(set);
        newSet.add(newFolder.id);
        return newSet;
      });
      this.store.setActiveFolderId(newFolder.id);
    };

    input.click();
  }

  async exportFolder(folder: Folder, event: Event): Promise<void> {
    event.stopPropagation();

    const notesInFolder = this.store.notes().filter(n => n.folderId === folder.id);
    if (notesInFolder.length === 0) {
      alert('Thư mục này đang trống, không có gì để xuất!');
      return;
    }

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
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}