import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoteItemComponent } from './note-item.component';
import { Note } from '../../../../core/models/note.model';

describe('NoteItemComponent', () => {
  let component: NoteItemComponent;
  let fixture: ComponentFixture<NoteItemComponent>;

  const mockNote: Note = {
    id: 'note-1',
    title: 'Test Note',
    content: 'Sample content',
    folderId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoteItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NoteItemComponent);
    component = fixture.componentInstance;
    component.note = mockNote;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display note title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.note-title-label')?.textContent).toContain('Test Note');
  });

  it('should emit select event when clicked', () => {
    let selectedId = '';
    component.select.subscribe((id) => (selectedId = id));
    const li = fixture.nativeElement.querySelector('.custom-note-item') as HTMLElement;
    li.click();
    expect(selectedId).toBe('note-1');
  });
});

