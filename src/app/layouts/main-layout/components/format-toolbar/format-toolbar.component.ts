import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bulletList'
  | 'numberedList'
  | 'taskList'
  | 'quote'
  | 'inlineCode'
  | 'codeBlock'
  | 'link'
  | 'image'
  | 'table'
  | 'math'
  | 'mathBlock'
  | 'mathMatrix'
  | 'mermaid'
  | 'mermaidFlowchart'
  | 'mermaidSequence'
  | 'mermaidClass'
  | 'mermaidState'
  | 'mermaidEr'
  | 'mermaidGit'
  | 'search';

@Component({
  selector: 'app-format-toolbar',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzTooltipModule, NzDropdownModule, NzMenuModule],
  templateUrl: './format-toolbar.component.html',
  styleUrls: ['./format-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormatToolbarComponent {
  @Output() readonly action = new EventEmitter<FormatAction>();

  trigger(type: FormatAction): void {
    this.action.emit(type);
  }
}

