import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { openDB, IDBPDatabase } from 'idb';
import { Note } from '../models/note.model';
import { Folder } from '../models/folder.model';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private platformId = inject(PLATFORM_ID);
  private dbPromise: Promise<IDBPDatabase | null>;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // TĂNG VERSION LÊN 2
      this.dbPromise = openDB('MarkdownAppDB', 2, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            db.createObjectStore('notes', { keyPath: 'id' });
          }
          if (oldVersion < 2) {
            // Tạo thêm bảng lưu trữ thư mục
            if (!db.objectStoreNames.contains('folders')) {
              db.createObjectStore('folders', { keyPath: 'id' });
            }
          }
        },
      });
    } else {
      this.dbPromise = Promise.resolve(null);
    }
  }

  /* --- XỬ LÝ NOTES --- */
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

  /* --- XỬ LÝ FOLDERS (MỚI) --- */
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
}
