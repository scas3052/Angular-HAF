import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router, RouterOutlet
} from '@angular/router';
import { Motion } from './core/motion';
import { PageContext } from './core/page-context';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #progress class="scroll-progress" aria-hidden="true"></div>
    <router-outlet />
    <button type="button" class="back-to-top" [class.show]="showTop()" [attr.aria-label]="copy().top" (click)="toTop()">
      <i class="fas fa-arrow-up" aria-hidden="true"></i>
    </button>
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
  private readonly motion = inject(Motion);
  private readonly destroyRef = inject(DestroyRef);
  private readonly progress = viewChild.required<ElementRef<HTMLElement>>('progress');
  private timer: ReturnType<typeof setTimeout> | undefined;
  private smoothTimer: ReturnType<typeof setTimeout> | undefined;
  private navigationId = 0;
  private trigger: NavigationStart['navigationTrigger'];
  private shownPage: string | undefined;
  private failedUrl = '';
  private readonly scrolled = signal(false);
  readonly pending = signal(false);
  readonly failed = signal(false);
  readonly showTop = computed(() => this.scrolled() && !['loading', 'language'].includes(this.context.kind()));
  readonly copy = computed(() => this.context.language() === 'te' ? {
    loading: 'పేజీ లోడ్ అవుతోంది...', error: 'ఈ పేజీ లోడ్ కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.',
    retry: 'మళ్లీ ప్రయత్నించండి', dismiss: 'మూసివేయండి', top: 'పేజీ పైకి వెళ్ళండి'
  } : {
    loading: 'Loading page...', error: 'This page could not be loaded. Please try again.',
    retry: 'Try again', dismiss: 'Dismiss', top: 'Back to top'
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.timer);
      clearTimeout(this.smoothTimer);
    });
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) {
        clearTimeout(this.timer);
        this.endSmoothScroll();
        this.navigationId = event.id;
        this.trigger = event.navigationTrigger;
        this.pending.set(false);
        this.failed.set(false);
        this.timer = setTimeout(() => this.pending.set(true), 350);
      } else if (event instanceof NavigationSkipped) {
        // Following the same section link again scrolls back to that section.
        if (event.url.includes('#')) this.smoothScroll();
      } else if ((event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError)
        && event.id === this.navigationId) {
        clearTimeout(this.timer);
        this.pending.set(false);
        if (event instanceof NavigationError) {
          this.failedUrl = event.url;
          this.failed.set(true);
        } else if (event instanceof NavigationEnd) {
          const [page, section] = event.urlAfterRedirects.split('#');
          if (section === undefined) {
            this.document.getElementById('main-content')?.focus({ preventScroll: true });
          } else if (page === this.shownPage && this.trigger !== 'popstate') {
            // A section link within the page glides there; arriving from another page or history jumps straight to it.
            this.smoothScroll();
          }
          this.shownPage = page;
        }
      }
    });
    afterNextRender(() => {
      this.motion.start();
      this.trackScroll();
    });
  }

  retry(): void {
    if (!this.failedUrl) throw new Error('There is no failed navigation to retry.');
    void this.router.navigateByUrl(this.failedUrl);
  }

  toTop(): void {
    this.document.defaultView?.scrollTo({ top: 0, behavior: this.reducedMotion() ? 'auto' : 'smooth' });
    // The button hides once the page is at the top, so focus moves to the start of the content rather than being lost.
    this.document.getElementById('main-content')?.focus({ preventScroll: true });
  }

  /** Keeps the reading-progress bar and the back-to-top button in step with the scroll position. */
  private trackScroll(): void {
    const view = this.document.defaultView;
    if (!view) return;
    const root = this.document.documentElement;
    const bar = this.progress().nativeElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const range = root.scrollHeight - view.innerHeight;
      const ratio = range > 0 ? Math.min(1, Math.max(0, view.scrollY / range)) : 0;
      bar.style.setProperty('--progress', ratio.toFixed(4));
      this.scrolled.set(view.scrollY > 600);
    };
    const schedule = () => {
      frame ||= view.requestAnimationFrame(update);
    };
    view.addEventListener('scroll', schedule, { passive: true });
    view.addEventListener('resize', schedule, { passive: true });
    // Pages grow as lazy content and images arrive, which changes how far through the page the reader is.
    const resizes = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    resizes?.observe(this.document.body);
    update();
    this.destroyRef.onDestroy(() => {
      view.removeEventListener('scroll', schedule);
      view.removeEventListener('resize', schedule);
      resizes?.disconnect();
      view.cancelAnimationFrame(frame);
    });
  }

  /** Lets the router's next scroll to a section glide instead of jump. */
  private smoothScroll(): void {
    if (this.reducedMotion()) return;
    this.endSmoothScroll();
    this.document.documentElement.classList.add('smooth-scroll');
    this.smoothTimer = setTimeout(() => this.endSmoothScroll(), 1500);
  }

  private endSmoothScroll(): void {
    clearTimeout(this.smoothTimer);
    this.document.documentElement.classList.remove('smooth-scroll');
  }

  private reducedMotion(): boolean {
    return this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? true;
  }
}
