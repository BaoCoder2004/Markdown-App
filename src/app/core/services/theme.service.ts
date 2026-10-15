import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type AppTheme = 'theme-default' | 'theme-dark' | 'theme-cream';

const STORAGE_KEY = 'app-theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly currentTheme = signal<AppTheme>('theme-default');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem(STORAGE_KEY) as AppTheme | null;
      const initialTheme: AppTheme =
        savedTheme === 'theme-dark' || savedTheme === 'theme-cream' ? savedTheme : 'theme-default';
      this.currentTheme.set(initialTheme);
      document.body.classList.add(initialTheme);
    }
  }

  setTheme(theme: AppTheme): void {
    const oldTheme = this.currentTheme();
    this.currentTheme.set(theme);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, theme);
      document.body.classList.remove(oldTheme);
      document.body.classList.add(theme);
    }
  }
}

