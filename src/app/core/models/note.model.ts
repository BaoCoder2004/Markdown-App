export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface NoteState {
  notes: Note[];
  activeNoteId: string | null;
  isLoading: boolean;
}
