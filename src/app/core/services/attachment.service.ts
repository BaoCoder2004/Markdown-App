import { Injectable, inject } from '@angular/core';
import { StorageService, StoredAttachment } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class AttachmentService {
  private readonly storage = inject(StorageService);
  private readonly urlCache = new Map<string, string>();

  /**
   * Saves an image blob to IndexedDB and returns a local attachment URL and markdown link.
   */
  async saveImage(
    blob: Blob,
    filename = 'image.png'
  ): Promise<{ id: string; url: string; markdown: string }> {
    const id = crypto.randomUUID();
    const mimeType = blob.type || 'image/png';

    await this.storage.saveAttachment({
      id,
      name: filename,
      mimeType,
      data: blob,
      createdAt: Date.now(),
    });

    const objectUrl = URL.createObjectURL(blob);
    this.urlCache.set(id, objectUrl);

    const safeName = filename.replace(/[[\]]/g, '');
    const markdown = `![${safeName}](attachment://${id})\n`;

    return { id, url: objectUrl, markdown };
  }

  /**
   * Retrieves an attachment's local Object URL, creating one from IndexedDB if not cached.
   */
  async getAttachmentUrl(id: string): Promise<string | null> {
    if (this.urlCache.has(id)) {
      return this.urlCache.get(id)!;
    }

    const attachment = await this.storage.getAttachment(id);
    if (!attachment) return null;

    const objectUrl = URL.createObjectURL(attachment.data);
    this.urlCache.set(id, objectUrl);
    return objectUrl;
  }

  /**
   * Replaces any `attachment://<id>` src references in HTML with valid blob: URLs.
   */
  async resolveAttachmentUrlsInHtml(html: string): Promise<string> {
    const regex = /src=["']attachment:\/\/([a-zA-Z0-9_-]+)["']/g;
    const matches = Array.from(html.matchAll(regex));

    if (matches.length === 0) return html;

    let result = html;
    for (const match of matches) {
      const id = match[1];
      const url = await this.getAttachmentUrl(id);
      if (url) {
        result = result.split(match[0]).join(`src="${url}"`);
      }
    }
    return result;
  }

  async getAllStoredAttachments(): Promise<StoredAttachment[]> {
    return this.storage.getAllAttachments();
  }
}

