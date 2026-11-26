import { Component, DestroyRef, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'haf-loading',
  template: `<div id="loading-screen" class="loading-screen">
    <div class="loading-emblem" aria-hidden="true"><img src="/src/images/bg/logo-emblem.webp" alt="" width="160" height="160"></div>
    <div class="loading-text">Welcome to HOLY ARMY FELLOWSHIP</div>
    <div class="loading-bar" aria-hidden="true"></div>
  </div>`,
  // Host style instead of an identical inline `styles` in both components of this file:
  // duplicate inline styles in one file make `ng build` leak an esbuild context and never exit.
  host: { style: 'display: contents' }
})
export class LoadingPage {
  constructor() {
    const router = inject(Router);
    const timer = setTimeout(() => void router.navigateByUrl('/language', { replaceUrl: true }), 1200);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}

@Component({
  selector: 'haf-language',
  imports: [RouterLink],
  preserveWhitespaces: true,
  template: `<div class="entry-sky" aria-hidden="true">
        <div class="entry-stars"></div>
        <div class="entry-stars"></div>
        <div class="entry-sparks"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
    </div>
    <main id="main-content" tabindex="-1" class="language-container">
        <div class="entry-emblem" aria-hidden="true"><img src="/src/images/bg/logo-emblem.webp" alt="" width="160" height="160"></div>
        <h1 class="logo">Holy Army Fellowship</h1>
        <p class="subtitle">Select your preferred language</p>
        <div class="language-grid">
            <a routerLink="/english/home" class="language-option">
                <i class="fas fa-globe-americas" aria-hidden="true"></i>
                <span class="language-name">English</span>
                <span class="native-name">English</span>
            </a>
            <a routerLink="/telugu/home" class="language-option">
                <i class="fas fa-globe-asia" aria-hidden="true"></i>
                <span class="language-name">Telugu</span>
                <span class="native-name" lang="te">&#3108;&#3142;&#3122;&#3137;&#3095;&#3137;</span>
            </a>
        </div>
    </main>`,
  host: { style: 'display: contents' }
})
export class LanguagePage {}