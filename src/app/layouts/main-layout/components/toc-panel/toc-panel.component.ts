import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TocItem } from '../../../../core/markdown/toc.util';

@Component({
  selector: 'app-toc-panel',
  standalone: true,
  imports: [CommonModule, NzIconModule, NzButtonModule, NzTooltipModule],
  templateUrl: './toc-panel.component.html',
  styleUrls: ['./toc-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TocPanelComponent {
  @Input({ required: true }) items: TocItem[] = [];
  @Output() readonly selectItem = new EventEmitter<TocItem>();
  @Output() readonly close = new EventEmitter<void>();

  onSelect(item: TocItem): void {
    this.selectItem.emit(item);
  }

  onClose(): void {
    this.close.emit();
  }
}

