import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Note, NoteStatus } from '../models/note.model';
import { Folder } from '../models/folder.model';
import { StorageService, StoredAttachment } from '../services/storage.service';

type NoteState = {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  activeFolderId: string | null;
  isTrashSelected: boolean;
};

const initialState: NoteState = {
  notes: [],
  folders: [],
  activeNoteId: null,
  activeFolderId: null,
  isTrashSelected: false,
};

export const NoteStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ notes, activeNoteId }) => ({
    activeNote: computed(() => notes().find((n) => n.id === activeNoteId()) || null),
    activeNotes: computed(() => notes().filter((n) => !n.isTrash)),
    trashedNotes: computed(() =>
      notes()
        .filter((n) => !!n.isTrash)
        .sort((a, b) => (b.trashedAt || 0) - (a.trashedAt || 0))
    ),
    trashedCount: computed(() => notes().filter((n) => !!n.isTrash).length),
  })),

  withMethods((store, storage = inject(StorageService)) => ({
    async loadData() {
      const [dbNotes, dbFolders] = await Promise.all([
        storage.getAllNotes(),
        storage.getAllFolders(),
      ]);

      const normalizedNotes = dbNotes.map((n) => ({
        ...n,
        folderId: n.folderId !== undefined ? n.folderId : null,
        isTrash: !!n.isTrash,
      }));

      patchState(store, { notes: normalizedNotes, folders: dbFolders });
    },

    setActiveNoteId(id: string | null) {
      patchState(store, { activeNoteId: id, isTrashSelected: false });
    },

    setActiveFolderId(id: string | null) {
      patchState(store, { activeFolderId: id, isTrashSelected: false });
    },

    setIsTrashSelected(selected: boolean) {
      patchState(store, { isTrashSelected: selected, activeFolderId: null });
    },

    /* --- FOLDER METHODS --- */
    async addFolder(folder: Folder) {
      patchState(store, (state) => ({
        folders: [folder, ...state.folders],
        activeFolderId: folder.id,
        isTrashSelected: false,
      }));
      await storage.saveFolder(folder);
    },

    async renameFolder(id: string, newName: string) {
      patchState(store, (state) => ({
        folders: state.folders.map((f) => (f.id === id ? { ...f, name: newName } : f)),
      }));
      const updatedFolder = store.folders().find((f) => f.id === id);
      if (updatedFolder) await storage.saveFolder(updatedFolder);
    },

    async setFolderPinned(id: string, pinned: boolean) {
      patchState(store, (state) => ({
        folders: state.folders.map((folder) =>
          folder.id === id ? { ...folder, pinned } : folder
        ),
      }));
      const updatedFolder = store.folders().find((folder) => folder.id === id);
      if (updatedFolder) await storage.saveFolder(updatedFolder);
    },

    async deleteFolder(id: string) {
      const now = Date.now();
      const notesToTrash = store.notes().filter((n) => n.folderId === id);

      patchState(store, (state) => ({
        folders: state.folders.filter((f) => f.id !== id),
        notes: state.notes.map((n) =>
          n.folderId === id ? { ...n, isTrash: true, trashedAt: now } : n
        ),
        activeFolderId: state.activeFolderId === id ? null : state.activeFolderId,
        activeNoteId: notesToTrash.find((n) => n.id === state.activeNoteId)
          ? null
          : state.activeNoteId,
      }));

      await storage.deleteFolder(id);
      for (const note of notesToTrash) {
        const updated = store.notes().find((n) => n.id === note.id);
        if (updated) await storage.saveNote(updated);
      }
    },

    /* --- NOTE METHODS --- */
    async addNote(note: Note) {
      patchState(store, (state) => ({
        notes: [note, ...state.notes],
        activeNoteId: note.id,
        isTrashSelected: false,
      }));
      await storage.saveNote(note);
    },

    async updateNoteContent(id: string, content: string, title: string) {
      const updatedAt = Date.now();
      patchState(store, (state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, content, title, updatedAt } : n
        ),
      }));
      const updatedNote = store.notes().find((n) => n.id === id);
      if (updatedNote) await storage.saveNote(updatedNote);
    },

    async updateNoteMeta(
      id: string,
      updates: { status?: NoteStatus; tags?: string[]; pinned?: boolean }
    ) {
      const updatedAt = Date.now();
      patchState(store, (state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, ...updates, updatedAt } : n
        ),
      }));
      const updatedNote = store.notes().find((n) => n.id === id);
      if (updatedNote) await storage.saveNote(updatedNote);
    },

    /* Soft Delete -> Move to Trash */
    async moveToTrash(id: string) {
      const now = Date.now();
      patchState(store, (state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, isTrash: true, trashedAt: now } : n
        ),
        activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
      }));
      const updatedNote = store.notes().find((n) => n.id === id);
      if (updatedNote) await storage.saveNote(updatedNote);
    },

    /* Restore from Trash */
    async restoreNote(id: string) {
      const now = Date.now();
      patchState(store, (state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, isTrash: false, trashedAt: undefined, updatedAt: now } : n
        ),
        activeNoteId: id,
      }));
      const updatedNote = store.notes().find((n) => n.id === id);
      if (updatedNote) await storage.saveNote(updatedNote);
    },

    /* Permanent Deletion */
    async deletePermanently(id: string) {
      patchState(store, (state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
      }));
      await storage.deleteNote(id);
    },

    /* Empty Trash Bin */
    async emptyTrash() {
      const trashed = store.notes().filter((n) => !!n.isTrash);
      patchState(store, (state) => ({
        notes: state.notes.filter((n) => !n.isTrash),
        activeNoteId: state.activeNoteId && trashed.some((n) => n.id === state.activeNoteId)
          ? null
          : state.activeNoteId,
      }));
      for (const note of trashed) {
        await storage.deleteNote(note.id);
      }
    },

    /* Full Backup Import */
    async importBackup(folders: Folder[], notes: Note[], attachments?: StoredAttachment[], overwrite = false) {
      await storage.importData(folders, notes, attachments, overwrite);
      await this.loadData();
    },
  })),

  withHooks({
    onInit(store) {
      store.loadData();
    },
  })
);
