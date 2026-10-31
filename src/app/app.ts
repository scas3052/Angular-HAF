import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { PageContext } from './core/page-context';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />
    @if (pending()) {
      <div class="navigation-progress" role="status"><span class="sr-only">{{ copy().loading }}</span></div>
    }
    @if (failed()) {
      <div class="navigation-error" role="alert">
        <p>{{ copy().error }}</p>
        <button type="button" (click)="retry()">{{ copy().retry }}</button>
        <button type="button" (click)="failed.set(false)">{{ copy().dismiss }}</button>
      </div>
    }`
})
export class App {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly context = inject(PageContext);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private navigationId = 0;
  private failedUrl = '';
  readonly pending = signal(false);
  readonly failed = signal(false);
  readonly copy = computed(() => this.context.language() === 'te' ? {
    loading: 'పేజీ లోడ్ అవుతోంది...', error: 'ఈ పేజీ లోడ్ కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.',
    retry: 'మళ్లీ ప్రయత్నించండి', dismiss: 'మూసివేయండి'
  } : {
    loading: 'Loading page...', error: 'This page could not be loaded. Please try again.',
    retry: 'Try again', dismiss: 'Dismiss'
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) {
        clearTimeout(this.timer);
        this.navigationId = event.id;
        this.pending.set(false);
        this.failed.set(false);
        this.timer = setTimeout(() => this.pending.set(true), 350);
      } else if ((event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError)
        && event.id === this.navigationId) {
        clearTimeout(this.timer);
        this.pending.set(false);
        if (event instanceof NavigationError) {
          this.failedUrl = event.url;
          this.failed.set(true);
        } else if (event instanceof NavigationEnd && !event.urlAfterRedirects.includes('#')) {
          this.document.getElementById('main-content')?.focus({ preventScroll: true });
        }
      }
    });
  }

  retry(): void {
    if (!this.failedUrl) throw new Error('There is no failed navigation to retry.');
    void this.router.navigateByUrl(this.failedUrl);
  }
}
