import JSZip from 'jszip';
import { Note } from '../../core/models/note.model';
import { Folder } from '../../core/models/folder.model';
import { StoredAttachment } from '../../core/services/storage.service';

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportMarkdownFile(title: string, content: string): void {
  const safeTitle = (title || 'Untitled Note').replace(/[\\/:*?"<>|]/g, '');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${safeTitle}.md`);
}

export async function exportFolderAsZip(folderName: string, notes: Note[]): Promise<void> {
  if (notes.length === 0) return;

  const zip = new JSZip();
  notes.forEach((note) => {
    const safeTitle = (note.title || 'Untitled Note').replace(/[\\/:*?"<>|]/g, '');
    zip.file(`${safeTitle}.md`, note.content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const safeFolderName = (folderName || 'Folder').replace(/[\\/:*?"<>|]/g, '');
  downloadBlob(blob, `${safeFolderName}.zip`);
}

export function exportHtmlFile(title: string, htmlContent: string): void {
  const safeTitle = (title || 'Untitled Note').replace(/[\\/:*?"<>|]/g, '');
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.10/dist/katex.min.css">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif;
      line-height: 1.8;
      max-width: 820px;
      margin: 40px auto;
      padding: 0 24px;
      color: #2b2b2b;
      background-color: #fbfaf8;
    }
    h1, h2, h3, h4 { color: #18191b; margin-top: 1.8em; margin-bottom: 0.6em; }
    h1 { border-bottom: 1px solid #e2ddd5; padding-bottom: 0.3em; }
    h2 { border-left: 3px solid #2e5b88; padding-left: 10px; }
    code { background: #f0ebe1; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
    pre { background: #f5f0e6; padding: 16px; border-radius: 6px; overflow-x: auto; border: 1px solid #e2ddd5; }
    blockquote { border-left: 3px solid #d5cfc5; margin: 1.5em 0; padding: 6px 16px; color: #666; background: rgba(0,0,0,0.02); }
    table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
    th, td { border: 1px solid #e2ddd5; padding: 8px 12px; text-align: left; }
    th { background: #f5f0e6; font-weight: 600; }
    img { max-width: 100%; border-radius: 6px; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${safeTitle}.html`);
}

export async function copyHtmlToClipboard(htmlContent: string): Promise<boolean> {
  try {
    const div = document.createElement('div');
    div.innerHTML = htmlContent;
    const textPlain = div.innerText || div.textContent || '';

    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const textBlob = new Blob([textPlain], { type: 'text/plain' });

    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/* --- FULL WORKSPACE BACKUP & RESTORE (.JSON) --- */

export interface SerializedAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataBase64: string;
  createdAt: number;
}

export interface InkNoteBackup {
  version: number;
  appName: string;
  exportedAt: number;
  folders: Folder[];
  notes: Note[];
  attachments?: SerializedAttachment[];
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const parts = base64.split(',');
  const rawBase64 = parts.length > 1 ? parts[1] : parts[0];
  const binaryStr = atob(rawBase64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function exportWorkspaceBackup(
  folders: Folder[],
  notes: Note[],
  attachments: StoredAttachment[] = []
): Promise<void> {
  const serializedAttachments: SerializedAttachment[] = [];
  for (const att of attachments) {
    const dataBase64 = await blobToBase64(att.data);
    serializedAttachments.push({
      id: att.id,
      name: att.name,
      mimeType: att.mimeType,
      dataBase64,
      createdAt: att.createdAt,
    });
  }

  const backupData: InkNoteBackup = {
    version: 1,
    appName: 'InkNote',
    exportedAt: Date.now(),
    folders,
    notes,
    attachments: serializedAttachments,
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const dateStr = new Date().toISOString().split('T')[0];
  downloadBlob(blob, `inknote-backup-${dateStr}.json`);
}

export async function parseWorkspaceBackup(file: File): Promise<InkNoteBackup> {
  const text = await file.text();
  const data = JSON.parse(text) as InkNoteBackup;
  if (!data || !Array.isArray(data.notes) || !Array.isArray(data.folders)) {
    throw new Error('Invalid backup file format: missing notes or folders');
  }
  return data;
}


