import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { Note } from '../../../../core/models/note.model';
import { formatRelativeTime } from '../../../../shared/utils/date.util';
import { getSnippet } from '../../../../shared/utils/text.util';

@Component({
  selector: 'app-trash-view',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzTooltipModule, NzModalModule],
  templateUrl: './trash-view.component.html',
  styleUrls: ['./trash-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrashViewComponent {
  private readonly modal = inject(NzModalService);

  @Input({ required: true }) notes: Note[] = [];
  @Output() readonly restore = new EventEmitter<string>();
  @Output() readonly deletePermanently = new EventEmitter<string>();
  @Output() readonly emptyTrash = new EventEmitter<void>();

  formatTime(timestamp?: number): string {
    return formatRelativeTime(timestamp || Date.now());
  }

  getNoteSnippet(content: string): string {
    return getSnippet(content, 120);
  }

  confirmRestore(note: Note): void {
    this.restore.emit(note.id);
  }

  confirmDeletePermanently(note: Note): void {
    this.modal.confirm({
      nzTitle: 'Delete Permanently?',
      nzContent: `Are you sure you want to permanently delete "${note.title || 'Untitled Note'}"? This action cannot be undone.`,
      nzOkText: 'Delete Forever',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => this.deletePermanently.emit(note.id),
    });
  }

  confirmEmptyTrash(): void {
    this.modal.confirm({
      nzTitle: 'Empty Trash?',
      nzContent: `Are you sure you want to permanently delete all ${this.notes.length} note(s) in Trash? This cannot be undone.`,
      nzOkText: 'Empty Trash',
      nzOkDanger: true,
      nzCancelText: 'Cancel',
      nzOnOk: () => this.emptyTrash.emit(),
    });
  }
}

