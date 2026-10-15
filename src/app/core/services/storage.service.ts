import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { openDB, IDBPDatabase } from 'idb';
import { Note } from '../models/note.model';
import { Folder } from '../models/folder.model';

export interface StoredAttachment {
  id: string;
  name: string;
  mimeType: string;
  data: Blob;
  createdAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private platformId = inject(PLATFORM_ID);
  private dbPromise: Promise<IDBPDatabase | null>;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.dbPromise = openDB('MarkdownAppDB', 3, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            db.createObjectStore('notes', { keyPath: 'id' });
          }
          if (oldVersion < 2) {
            if (!db.objectStoreNames.contains('folders')) {
              db.createObjectStore('folders', { keyPath: 'id' });
            }
          }
          if (oldVersion < 3) {
            if (!db.objectStoreNames.contains('attachments')) {
              db.createObjectStore('attachments', { keyPath: 'id' });
            }
          }
        },
      });
    } else {
      this.dbPromise = Promise.resolve(null);
    }
  }

  /* --- NOTES --- */
  async getAllNotes(): Promise<Note[]> {
    const db = await this.dbPromise;
    if (!db) return [];
    const notes = await db.getAll('notes');
    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async saveNote(note: Note): Promise<void> {
    const db = await this.dbPromise;
    if (db) await db.put('notes', note);
  }

  async deleteNote(id: string): Promise<void> {
    const db = await this.dbPromise;
    if (db) await db.delete('notes', id);
  }

  /* --- FOLDERS --- */
  async getAllFolders(): Promise<Folder[]> {
    const db = await this.dbPromise;
    if (!db) return [];
    const folders = await db.getAll('folders');
    return folders.sort((a, b) => b.createdAt - a.createdAt);
  }

  async saveFolder(folder: Folder): Promise<void> {
    const db = await this.dbPromise;
    if (db) await db.put('folders', folder);
  }

  async deleteFolder(id: string): Promise<void> {
    const db = await this.dbPromise;
    if (db) await db.delete('folders', id);
  }

  async getAllAttachments(): Promise<StoredAttachment[]> {
    const db = await this.dbPromise;
    if (!db) return [];
    return db.getAll('attachments');
  }

  async saveAttachment(attachment: StoredAttachment): Promise<void> {
    const db = await this.dbPromise;
    if (db) await db.put('attachments', attachment);
  }

  async getAttachment(id: string): Promise<StoredAttachment | undefined> {
    const db = await this.dbPromise;
    if (!db) return undefined;
    return db.get('attachments', id);
  }

  async deleteAttachment(id: string): Promise<void> {
    const db = await this.dbPromise;
    if (db) await db.delete('attachments', id);
  }

  /* --- FULL BACKUP / RESTORE SUPPORT --- */
  async clearAll(): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    const tx = db.transaction(['notes', 'folders', 'attachments'], 'readwrite');
    await Promise.all([
      tx.objectStore('notes').clear(),
      tx.objectStore('folders').clear(),
      tx.objectStore('attachments').clear(),
      tx.done,
    ]);
  }

  async importData(folders: Folder[], notes: Note[], attachments?: StoredAttachment[], overwrite = false): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;

    if (overwrite) {
      await this.clearAll();
    }

    const tx = db.transaction(['notes', 'folders', 'attachments'], 'readwrite');
    const noteStore = tx.objectStore('notes');
    const folderStore = tx.objectStore('folders');
    const attachmentStore = tx.objectStore('attachments');

    for (const folder of folders) {
      await folderStore.put(folder);
    }
    for (const note of notes) {
      await noteStore.put(note);
    }
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        await attachmentStore.put(att);
      }
    }

    await tx.done;
  }
}
