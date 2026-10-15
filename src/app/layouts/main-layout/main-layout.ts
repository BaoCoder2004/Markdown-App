import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  HostListener,
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
import { NzMessageService } from 'ng-zorro-antd/message';

// CodeMirror & Vim
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { vim } from '@replit/codemirror-vim';

// Core Services & Models
import { NoteStore } from '../../core/stores/note.store';
import { Note, NoteStatus } from '../../core/models/note.model';
import { Folder } from '../../core/models/folder.model';
import { StoredAttachment } from '../../core/services/storage.service';
import { AppTheme, ThemeService } from '../../core/services/theme.service';
import { AttachmentService } from '../../core/services/attachment.service';
import { buildCodeMirrorExtensions, vimCompartment } from '../../core/codemirror/codemirror-plugins';
import { EditorCommands } from '../../core/editor/editor-commands';
import { parseMarkdownToHtml, renderMermaidDiagrams } from '../../core/markdown/markdown-parser';
import { toggleMarkdownTaskCheckbox } from '../../core/markdown/markdown-task.util';
import { extractTableOfContents, TocItem } from '../../core/markdown/toc.util';

// Shared Utilities & Components
import { getTagStyle, TagStyle } from '../../shared/utils/tag.util';
import {
  exportMarkdownFile,
  exportFolderAsZip,
  exportHtmlFile,
  copyHtmlToClipboard,
  exportWorkspaceBackup,
  parseWorkspaceBackup,
  base64ToBlob,
  InkNoteBackup,
} from '../../shared/utils/file.util';
import { formatRelativeTime } from '../../shared/utils/date.util';
import { NoteItemComponent } from './components/note-item/note-item.component';
import { FormatAction, FormatToolbarComponent } from './components/format-toolbar/format-toolbar.component';
import { TocPanelComponent } from './components/toc-panel/toc-panel.component';
import { TrashViewComponent } from './components/trash-view/trash-view.component';

type ItemContextMenu = {
  kind: 'folder' | 'note';
  id: string;
  pinned: boolean;
  x: number;
  y: number;
};

const STATUS_LABELS: Record<string, string> = {
  none: 'None',
  active: 'Active',
  'on-hold': 'On Hold',
  completed: 'Completed',
  dropped: 'Dropped',
};

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzLayoutModule,
    NzMenuModule,
    NzIconModule,
    NzTooltipModule,
    NzButtonModule,
    NzDropdownModule,
    NzTagModule,
    NzInputModule,
    NzSelectModule,
    NzModalModule,
    NoteItemComponent,
    FormatToolbarComponent,
    TocPanelComponent,
    TrashViewComponent,
  ],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnDestroy {
  protected readonly store = inject(NoteStore);
  readonly themeService = inject(ThemeService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);

  parsedContent = signal<SafeHtml>('');
  viewMode = signal<'edit' | 'split' | 'preview'>('split');
  splitRatio = signal<number>(50);
  isResizing = signal<boolean>(false);
  isTocOpen = signal(false);
  isSidebarCollapsed = signal<boolean>(false);
  noteSortBy = signal<'updated' | 'created' | 'title'>('updated');
  readonly isVimMode = signal<boolean>(false);

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

  private editorView?: EditorView;
  private _editorContainer?: ElementRef;
  private mermaidTimer?: ReturnType<typeof setTimeout>;

  tocItems = computed(() =>
    extractTableOfContents(this.store.activeNote()?.content || '')
  );

  allTags = computed(() => {
    const tags = new Set<string>();
    this.store.notes().forEach((n) => {
      n.tags?.forEach((t) => tags.add(t));
    });
    return Array.from(tags).sort();
  });

  private sortNotes(notes: Note[]): Note[] {
    const sortBy = this.noteSortBy();
    return [...notes].sort((left, right) => {
      const pinDiff = Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
      if (pinDiff !== 0) return pinDiff;

      if (sortBy === 'created') {
        return right.createdAt - left.createdAt;
      }
      if (sortBy === 'title') {
        return left.title.localeCompare(right.title);
      }
      return (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt);
    });
  }

  foldersWithNotes = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const tagFilter = this.selectedTag();

    return this.store
      .folders()
      .map((folder) => {
        const matchingNotes = this.store
          .notes()
          .filter((n) => {
            if (n.isTrash) return false;
            const matchFolder = n.folderId === folder.id;
            const matchQuery =
              !query || n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query);
            const matchTag = !tagFilter || (n.tags && n.tags.includes(tagFilter));
            return matchFolder && matchQuery && matchTag;
          });
        const notes = this.sortNotes(matchingNotes);
        return { ...folder, notes };
      })
      .sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)))
      .filter((folder) => (!query && !tagFilter) || folder.notes.length > 0);
  });

  rootNotes = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const tagFilter = this.selectedTag();
    const matchingNotes = this.store
      .notes()
      .filter((n) => {
        if (n.isTrash) return false;
        const matchFolder = n.folderId === null;
        const matchQuery =
          !query || n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query);
        const matchTag = !tagFilter || (n.tags && n.tags.includes(tagFilter));
        return matchFolder && matchQuery && matchTag;
      });
    return this.sortNotes(matchingNotes);
  });

  activeNoteWordCount = computed(() => {
    const note = this.store.activeNote();
    if (!note?.content) return 0;
    const words = note.content.trim().split(/\s+/).filter(Boolean);
    return words.length;
  });

  activeNoteCharCount = computed(() => {
    const note = this.store.activeNote();
    return note ? note.content.length : 0;
  });

  activeNoteReadingTime = computed(() => {
    const words = this.activeNoteWordCount();
    if (words === 0) return '0 min read';
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `~${minutes} min read`;
  });

  activeNoteLastUpdated = computed(() => {
    const note = this.store.activeNote();
    return note ? formatRelativeTime(note.updatedAt || note.createdAt) : '';
  });

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
      const savedRatio = localStorage.getItem('inknote_split_ratio');
      if (savedRatio) {
        const parsed = parseFloat(savedRatio);
        if (!isNaN(parsed) && parsed >= 15 && parsed <= 85) {
          this.splitRatio.set(parsed);
        }
      }
      const savedVim = localStorage.getItem('inknote_vim_mode');
      if (savedVim === 'true') {
        this.isVimMode.set(true);
      }
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
    if (this.mermaidTimer) {
      clearTimeout(this.mermaidTimer);
    }
    this.editorView?.destroy();
  }

  setTheme(theme: AppTheme): void {
    this.themeService.setTheme(theme);
    const note = this.store.activeNote();
    if (note) this.updatePreview(note.content);
  }

  private initCodeMirror(): void {
    if (!this._editorContainer) return;
    const activeNote = this.store.activeNote();
    const startContent = activeNote?.content ?? '';

    const state = EditorState.create({
      doc: startContent,
      extensions: buildCodeMirrorExtensions({
        onDocChange: (newDoc: string) => this.handleEditorChange(newDoc),
        onImageDropOrPaste: (file: File) => this.handleImageUpload(file),
        isVimMode: this.isVimMode(),
      }),
    });

    this.editorView = new EditorView({
      state,
      parent: this._editorContainer.nativeElement,
    });
  }

  private async updatePreview(rawMarkdown: string): Promise<void> {
    const clickableHtml = await parseMarkdownToHtml(rawMarkdown);
    const resolvedHtml = await this.attachmentService.resolveAttachmentUrlsInHtml(clickableHtml);
    this.parsedContent.set(this.sanitizer.bypassSecurityTrustHtml(resolvedHtml));

    if (this.mermaidTimer) {
      clearTimeout(this.mermaidTimer);
    }
    this.mermaidTimer = setTimeout(() => {
      const mTheme = this.themeService.currentTheme() === 'theme-dark' ? 'dark' : 'default';
      renderMermaidDiagrams(mTheme);
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

  startResizing(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing.set(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const container = document.querySelector('.split-pane') as HTMLElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const offsetX = moveEvent.clientX - rect.left;
      const newRatio = Math.max(15, Math.min(85, (offsetX / rect.width) * 100));
      this.splitRatio.set(Math.round(newRatio * 10) / 10);
    };

    const onMouseUp = () => {
      this.isResizing.set(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('inknote_split_ratio', this.splitRatio().toString());
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  resetSplitRatio(): void {
    this.splitRatio.set(50);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('inknote_split_ratio', '50');
    }
  }

  openItemContextMenu(event: MouseEvent, kind: ItemContextMenu['kind'], id: string, pinned = false): void {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 170;
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
    return STATUS_LABELS[status || 'none'] || 'None';
  }

  getTagStyle(tag: string): TagStyle {
    return getTagStyle(tag);
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
          this.store.updateNoteMeta(note.id, { tags: currentTags.filter((t) => t !== tagToRemove) });
        }
      },
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

      const updated = toggleMarkdownTaskCheckbox(currentNote.content, index);
      if (updated !== null) {
        this.store.updateNoteContent(currentNote.id, updated, currentNote.title);
      }
    }
  }

  createNewFolder(): void {
    const now = Date.now();
    const newFolder: Folder = { id: crypto.randomUUID(), name: 'New Folder', createdAt: now };
    this.store.addFolder(newFolder);
    this.expandedFolders.update((set) => new Set(set).add(newFolder.id));
    setTimeout(() => this.startEditFolder(new Event('click'), newFolder), 100);
  }

  toggleFolder(folderId: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.store.setActiveFolderId(folderId);
    this.expandedFolders.update((set) => {
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
    this.modal.confirm({
      nzTitle: 'Delete Folder?',
      nzContent: 'Are you sure you want to delete this folder? All notes inside will be permanently deleted.',
      nzOkText: 'Delete',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => this.store.deleteFolder(id),
    });
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
      this.expandedFolders.update((set) => new Set(set).add(folderId));
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
      const input = document.querySelector('.header-edit-title-input') as HTMLInputElement;
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

  handleFormatAction(action: FormatAction): void {
    if (!this.editorView) return;
    switch (action) {
      case 'bold':
        EditorCommands.bold(this.editorView);
        break;
      case 'italic':
        EditorCommands.italic(this.editorView);
        break;
      case 'strikethrough':
        EditorCommands.strikethrough(this.editorView);
        break;
      case 'h1':
        EditorCommands.heading1(this.editorView);
        break;
      case 'h2':
        EditorCommands.heading2(this.editorView);
        break;
      case 'h3':
        EditorCommands.heading3(this.editorView);
        break;
      case 'bulletList':
        EditorCommands.bulletList(this.editorView);
        break;
      case 'numberedList':
        EditorCommands.numberedList(this.editorView);
        break;
      case 'taskList':
        EditorCommands.taskList(this.editorView);
        break;
      case 'quote':
        EditorCommands.quote(this.editorView);
        break;
      case 'inlineCode':
        EditorCommands.inlineCode(this.editorView);
        break;
      case 'codeBlock':
        EditorCommands.codeBlock(this.editorView);
        break;
      case 'link':
        EditorCommands.link(this.editorView);
        break;
      case 'image':
        this.handleImageFilePicker();
        break;
      case 'table':
        EditorCommands.table(this.editorView);
        break;
      case 'math':
        EditorCommands.math(this.editorView);
        break;
      case 'mathBlock':
        EditorCommands.mathBlock(this.editorView);
        break;
      case 'mathMatrix':
        EditorCommands.mathMatrix(this.editorView);
        break;
      case 'mermaid':
        EditorCommands.mermaid(this.editorView);
        break;
      case 'mermaidFlowchart':
        EditorCommands.mermaidFlowchart(this.editorView);
        break;
      case 'mermaidSequence':
        EditorCommands.mermaidSequence(this.editorView);
        break;
      case 'mermaidClass':
        EditorCommands.mermaidClass(this.editorView);
        break;
      case 'mermaidState':
        EditorCommands.mermaidState(this.editorView);
        break;
      case 'mermaidEr':
        EditorCommands.mermaidEr(this.editorView);
        break;
      case 'mermaidGit':
        EditorCommands.mermaidGit(this.editorView);
        break;
      case 'search':
        EditorCommands.search(this.editorView);
        break;
    }
  }

  async handleImageUpload(file: File): Promise<void> {
    const currentNote = this.store.activeNote();
    if (!currentNote) return;

    const result = await this.attachmentService.saveImage(file, file.name);
    if (this.editorView) {
      const range = this.editorView.state.selection.main;
      this.editorView.dispatch({
        changes: { from: range.from, to: range.to, insert: result.markdown },
        selection: { anchor: range.from + result.markdown.length },
      });
      this.editorView.focus();
    }
  }

  handleImageFilePicker(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.handleImageUpload(file);
      }
    };
    input.click();
  }

  toggleToc(): void {
    this.isTocOpen.update((open) => !open);
  }

  handleTocSelect(item: TocItem): void {
    if (this.editorView && item.line <= this.editorView.state.doc.lines) {
      const line = this.editorView.state.doc.line(item.line);
      this.editorView.dispatch({
        selection: { anchor: line.from },
        scrollIntoView: true,
      });
      this.editorView.focus();
    }
  }

  selectTrash(): void {
    this.store.setIsTrashSelected(true);
  }

  deleteNote(id: string, event: Event): void {
    event.stopPropagation();
    this.modal.confirm({
      nzTitle: 'Move to Trash?',
      nzContent: 'Are you sure you want to move this note to Trash? You can restore it anytime.',
      nzOkText: 'Move to Trash',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => this.store.moveToTrash(id),
    });
  }

  restoreTrashedNote(id: string): void {
    this.store.restoreNote(id);
  }

  deletePermanently(id: string): void {
    this.store.deletePermanently(id);
  }

  emptyTrash(): void {
    this.store.emptyTrash();
  }

  async openFile(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md, text/markdown, text/plain';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const content = await file.text();
      const title = file.name.replace(/\.[^/.]+$/, '');
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

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
      event.preventDefault();
      this.toggleSidebar();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.printNote();
    }
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed.update((c) => !c);
  }

  setNoteSortBy(sortBy: 'updated' | 'created' | 'title'): void {
    this.noteSortBy.set(sortBy);
  }

  exportFile(): void {
    const currentNote = this.store.activeNote();
    if (!currentNote) return;
    exportMarkdownFile(currentNote.title, currentNote.content);
  }

  async exportHtml(): Promise<void> {
    const currentNote = this.store.activeNote();
    if (!currentNote) return;
    const rawHtml = await parseMarkdownToHtml(currentNote.content);
    const resolvedHtml = await this.attachmentService.resolveAttachmentUrlsInHtml(rawHtml);
    exportHtmlFile(currentNote.title, resolvedHtml);
    this.message.success('HTML file exported successfully!');
  }

  async copyFormattedHtml(): Promise<void> {
    const currentNote = this.store.activeNote();
    if (!currentNote) return;
    const rawHtml = await parseMarkdownToHtml(currentNote.content);
    const resolvedHtml = await this.attachmentService.resolveAttachmentUrlsInHtml(rawHtml);
    const success = await copyHtmlToClipboard(resolvedHtml);
    if (success) {
      this.message.success('Formatted HTML copied to clipboard!');
    } else {
      this.message.error('Failed to copy to clipboard.');
    }
  }

  printNote(): void {
    window.print();
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
          const title = file.name.replace(/\.[^/.]+$/, '');
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
      this.expandedFolders.update((set) => new Set(set).add(newFolder.id));
      this.store.setActiveFolderId(newFolder.id);
    };
    input.click();
  }

  async exportFolder(folder: Folder, event: Event): Promise<void> {
    event.stopPropagation();
    const notesInFolder = this.store.notes().filter((n) => n.folderId === folder.id);
    await exportFolderAsZip(folder.name, notesInFolder);
  }

  /* --- VIM KEYBINDINGS MODE --- */
  toggleVimMode(): void {
    const next = !this.isVimMode();
    this.isVimMode.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('inknote_vim_mode', String(next));
    }
    if (this.editorView) {
      this.editorView.dispatch({
        effects: vimCompartment.reconfigure(next ? vim({ status: true }) : []),
      });
    }
    this.message.info(next ? 'Vim Mode: Enabled' : 'Vim Mode: Disabled');
  }

  /* --- FULL WORKSPACE BACKUP & RESTORE --- */
  async exportBackup(): Promise<void> {
    try {
      const attachments = await this.attachmentService.getAllStoredAttachments();
      await exportWorkspaceBackup(this.store.folders(), this.store.notes(), attachments);
      this.message.success('Workspace backup exported successfully');
    } catch (err) {
      this.message.error('Failed to export backup: ' + (err as Error).message);
    }
  }

  triggerRestoreBackup(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json, application/json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const backup = await parseWorkspaceBackup(file);
        const folderCount = backup.folders.length;
        const noteCount = backup.notes.length;

        this.modal.confirm({
          nzTitle: 'Restore Workspace Backup',
          nzContent: `Found ${noteCount} note(s) and ${folderCount} notebook(s) in backup.\nDo you want to overwrite your current notes or merge them?`,
          nzOkText: 'Replace / Overwrite',
          nzOkDanger: true,
          nzCancelText: 'Merge Notes',
          nzOnOk: async () => {
            await this.processRestore(backup, true);
          },
          nzOnCancel: async () => {
            await this.processRestore(backup, false);
          },
        });
      } catch (err) {
        this.modal.error({
          nzTitle: 'Invalid Backup File',
          nzContent: 'The selected file is not a valid InkNote JSON backup: ' + (err as Error).message,
        });
      }
    };
    input.click();
  }

  private async processRestore(backup: InkNoteBackup, overwrite: boolean): Promise<void> {
    try {
      const attachments: StoredAttachment[] = [];
      if (backup.attachments && backup.attachments.length > 0) {
        for (const att of backup.attachments) {
          attachments.push({
            id: att.id,
            name: att.name,
            mimeType: att.mimeType,
            data: base64ToBlob(att.dataBase64, att.mimeType),
            createdAt: att.createdAt,
          });
        }
      }

      await this.store.importBackup(backup.folders, backup.notes, attachments, overwrite);
      this.message.success(`Restored ${backup.notes.length} note(s) successfully!`);
    } catch (err) {
      this.message.error('Restore failed: ' + (err as Error).message);
    }
  }
}
