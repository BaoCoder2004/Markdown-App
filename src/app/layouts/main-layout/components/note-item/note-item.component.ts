import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Note } from '../../../../core/models/note.model';
import { formatRelativeTime } from '../../../../shared/utils/date.util';
import { getSnippet } from '../../../../shared/utils/text.util';

@Component({
  selector: 'app-note-item',
  standalone: true,
  imports: [CommonModule, FormsModule, NzIconModule, NzButtonModule, NzTooltipModule],
  templateUrl: './note-item.component.html',
  styleUrls: ['./note-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteItemComponent {
  @Input({ required: true }) note!: Note;
  @Input() isSelected = false;
  @Input() indented = false;
  @Input() isEditing = false;
  @Input() editText = '';

  @Output() readonly select = new EventEmitter<string>();
  @Output() readonly edit = new EventEmitter<{ event: Event; note: Note }>();
  @Output() readonly save = new EventEmitter<{ note: Note; event?: Event }>();
  @Output() readonly changeText = new EventEmitter<string>();
  @Output() readonly delete = new EventEmitter<{ id: string; event: Event }>();
  @Output() readonly contextMenu = new EventEmitter<MouseEvent>();

  get formattedTime(): string {
    return formatRelativeTime(this.note.updatedAt || this.note.createdAt);
  }

  get snippet(): string {
    return getSnippet(this.note.content);
  }
}

