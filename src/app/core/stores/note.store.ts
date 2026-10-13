import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Note, NoteStatus } from '../models/note.model';
import { Folder } from '../models/folder.model';
import { StorageService } from '../services/storage.service';

type NoteState = {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  activeFolderId: string | null;
};

const initialState: NoteState = {
  notes: [],
  folders: [],
  activeNoteId: null,
  activeFolderId: null,
};

export const NoteStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ notes, activeNoteId }) => ({
    activeNote: computed(() => notes().find((n) => n.id === activeNoteId()) || null),
  })),

  withMethods((store, storage = inject(StorageService)) => ({

    async loadData() {
      const [dbNotes, dbFolders] = await Promise.all([
        storage.getAllNotes(),
        storage.getAllFolders()
      ]);

      const normalizedNotes = dbNotes.map(n => ({
        ...n,
        folderId: n.folderId !== undefined ? n.folderId : null
      }));

      patchState(store, { notes: normalizedNotes, folders: dbFolders });
    },

    setActiveNoteId(id: string | null) {
      patchState(store, { activeNoteId: id });
    },

    setActiveFolderId(id: string | null) {
      patchState(store, { activeFolderId: id });
    },

    /* --- FOLDER METHODS --- */
    async addFolder(folder: Folder) {
      patchState(store, (state) => ({
        folders: [folder, ...state.folders],
        activeFolderId: folder.id,
      }));
      await storage.saveFolder(folder);
    },

    async renameFolder(id: string, newName: string) {
      patchState(store, (state) => ({
        folders: state.folders.map(f => f.id === id ? { ...f, name: newName } : f)
      }));
      const updatedFolder = store.folders().find(f => f.id === id);
      if (updatedFolder) await storage.saveFolder(updatedFolder);
    },

    async deleteFolder(id: string) {
      const notesToDelete = store.notes().filter(n => n.folderId === id);

      patchState(store, (state) => ({
        folders: state.folders.filter(f => f.id !== id),
        notes: state.notes.filter(n => n.folderId !== id),
        activeFolderId: state.activeFolderId === id ? null : state.activeFolderId,
        activeNoteId: notesToDelete.find(n => n.id === state.activeNoteId) ? null : state.activeNoteId
      }));

      await storage.deleteFolder(id);
      for (const note of notesToDelete) {
        await storage.deleteNote(note.id);
      }
    },

    /* --- NOTE METHODS --- */
    async addNote(note: Note) {
      patchState(store, (state) => ({
        notes: [note, ...state.notes],
        activeNoteId: note.id,
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
      const updatedNote = store.notes().find(n => n.id === id);
      if (updatedNote) await storage.saveNote(updatedNote);
    },

    async updateNoteMeta(id: string, updates: { status?: NoteStatus; tags?: string[] }) {
      const updatedAt = Date.now();
      patchState(store, (state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, ...updates, updatedAt } : n
        ),
      }));
      const updatedNote = store.notes().find(n => n.id === id);
      if (updatedNote) await storage.saveNote(updatedNote);
    },

    async deleteNote(id: string) {
      patchState(store, (state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
      }));
      await storage.deleteNote(id);
    },
  })),

  withHooks({
    onInit(store) {
      store.loadData();
    },
  })
);
