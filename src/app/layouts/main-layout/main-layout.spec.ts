import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { BookOutline, PlusOutline, FolderOutline, FolderOpenOutline, InboxOutline, PushpinOutline, EditOutline, DeleteOutline, DownloadOutline, SearchOutline } from '@ant-design/icons-angular/icons';
import { MainLayoutComponent } from './main-layout';

describe('MainLayoutComponent', () => {
  let component: MainLayoutComponent;
  let fixture: ComponentFixture<MainLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideAnimationsAsync(),
        provideNzIcons([
          BookOutline,
          PlusOutline,
          FolderOutline,
          FolderOpenOutline,
          InboxOutline,
          PushpinOutline,
          EditOutline,
          DeleteOutline,
          DownloadOutline,
          SearchOutline,
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
