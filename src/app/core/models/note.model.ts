export type NoteStatus = 'none' | 'active' | 'on-hold' | 'completed' | 'dropped';

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
  status?: NoteStatus;
  tags?: string[];
}
