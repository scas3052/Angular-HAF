import { DOCUMENT } from '@angular/common';
import { Component, Directive, DestroyRef, ElementRef, OnInit, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { PageContext } from '../core/page-context';

@Directive({ selector: '[hafChapterGroup]' })
export class ChapterGroup {
  readonly active = signal<string | null>(null);
  readonly players = new Set<AudioPlayer>();

  toggle(chapter: string): void {
    for (const player of this.players) player.stop(true);
    this.active.update(current => current === chapter ? null : chapter);
  }

  stopOthers(current: AudioPlayer): void {
    for (const player of this.players) if (player !== current) player.stop(false);
  }
}

@Directive({ selector: '[hafChapter]', host: { '[class.active]': 'active()' } })
export class Chapter {
  readonly hafChapter = input.required<string>();
  readonly group = inject(ChapterGroup);
  readonly active = computed(() => this.group.active() === this.hafChapter());
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  toggle(): void {
    this.group.toggle(this.hafChapter());
    if (this.active() && Number(this.hafChapter()) >= 1) {
      const headerHeight = document.querySelector('header')?.offsetHeight ?? 120;
      const top = this.element.nativeElement.getBoundingClientRect().top;
      if (top < headerHeight) window.scrollTo({ top: window.scrollY + top - headerHeight - 20, behavior: 'smooth' });
    }
  }
}

@Directive({
  selector: '[hafChapterToggle]',
  host: { role: 'button', tabindex: '0', '[attr.aria-expanded]': 'chapter.active()',
    '(click)': 'toggle($event)', '(keydown.enter)': 'toggle($event)', '(keydown.space)': 'toggle($event)' }
})
export class ChapterToggle {
  readonly chapter = inject(Chapter);
  toggle(event: Event): void { event.preventDefault(); this.chapter.toggle(); }
}

/** How long a tapped recording may take to start before the player offers a retry. */
export const AUDIO_START_TIMEOUT_MS = 20000;

@Component({
  selector: '[hafAudio]',
  template: `<div class="audio-player">
    <button class="audio-play-btn" type="button" (click)="toggle()" [attr.aria-label]="buttonLabel()"
      [attr.aria-busy]="loading()" [title]="failed() ? copy().failed : ''">
      <i [class]="icon()" aria-hidden="true"></i>
    </button>
    <div class="audio-progress" (click)="seek($event)" role="slider" tabindex="0" [attr.aria-label]="copy().position"
      aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="progress()"
      (keydown.arrowright)="skip(5, $event)" (keydown.arrowleft)="skip(-5, $event)">
      <div class="audio-progress-bar" [style.width.%]="progress()"></div>
    </div>
    @if (status()) { <span class="audio-status" aria-hidden="true">{{ status() }}</span> }
    <span class="sr-only" role="status">{{ status() }}</span>
    <audio #audio preload="none" (play)="playing.set(true)" (playing)="finishLoading()" (waiting)="onWaiting()"
      (pause)="onPause()" (timeupdate)="updateProgress()" (loadedmetadata)="updateProgress()" (ended)="stop(true)"
      (error)="onError()"></audio>
  </div>`,
  host: { '[class.playing]': 'playing()', '[class.loading]': 'loading()', '[class.failed]': 'failed()' }
})
export class AudioPlayer implements OnInit {
  readonly audioSource = input.required<string>();
  readonly playing = signal(false);
  readonly loading = signal(false);
  readonly progress = signal(0);
  readonly failed = signal(false);
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audio');
  private readonly group = inject(ChapterGroup);
  private readonly chapter = inject(Chapter, { optional: true });
  private readonly context = inject(PageContext);
  private readonly document = inject(DOCUMENT);
  private requested = false;
  private startTimer?: ReturnType<typeof setTimeout>;
  readonly copy = computed(() => this.context.language() === 'te' ? {
    play: 'ఆడియో ప్లే చేయండి', pause: 'ఆడియో ఆపండి', position: 'ఆడియో స్థానం',
    loading: 'ఆడియో లోడ్ అవుతోంది…', retry: 'ఆడియోను మళ్లీ ప్రయత్నించండి',
    failed: 'ఆడియో లోడ్ కాలేదు. మళ్లీ ప్రయత్నించడానికి ప్లే నొక్కండి.'
  } : {
    play: 'Play audio', pause: 'Pause audio', position: 'Audio position',
    loading: 'Loading audio…', retry: 'Retry audio',
    failed: 'Audio could not be loaded. Press play to try again.'
  });
  readonly status = computed(() => this.loading() ? this.copy().loading : this.failed() ? this.copy().failed : '');
  readonly icon = computed(() => this.loading() ? 'fas fa-spinner fa-spin'
    : this.failed() ? 'fas fa-rotate-right' : this.playing() ? 'fas fa-pause' : 'fas fa-play');
  readonly buttonLabel = computed(() => this.loading() ? this.copy().loading
    : this.failed() ? this.copy().retry : this.playing() ? this.copy().pause : this.copy().play);

  constructor() {
    this.group.players.add(this);
    // Opening a chapter fetches just the headers of its recordings, so the first tap does not wait for the host's redirect.
    effect(() => { if (this.chapter?.active()) this.prepare('metadata'); });
    inject(DestroyRef).onDestroy(() => {
      this.stop(false);
      this.group.players.delete(this);
    });
  }

  ngOnInit(): void { this.preconnect(); }

  async toggle(): Promise<void> {
    const audio = this.audio()?.nativeElement;
    if (!audio || this.loading()) return;
    if (!audio.paused) { audio.pause(); return; }
    this.group.stopOthers(this);
    this.requested = true;
    this.failed.set(false);
    this.prepare('auto');
    if (audio.error) audio.load();
    if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) this.startLoading();
    try { await audio.play(); } catch (error) {
      if ((error as DOMException | undefined)?.name !== 'AbortError') this.onError();
    }
  }

  stop(reset: boolean): void {
    const audio = this.audio()?.nativeElement;
    audio?.pause();
    this.playing.set(false);
    this.finishLoading();
    if (reset && audio) { audio.currentTime = 0; this.progress.set(0); }
  }

  onPause(): void { this.playing.set(false); this.finishLoading(); }

  onWaiting(): void { if (this.playing()) this.startLoading(); }

  finishLoading(): void {
    clearTimeout(this.startTimer);
    this.loading.set(false);
  }

  onError(): void {
    this.finishLoading();
    this.playing.set(false);
    // A failed background fetch stays silent; the next tap reloads the recording.
    if (this.requested) this.failed.set(true);
  }

  updateProgress(): void {
    const audio = this.audio()?.nativeElement;
    this.progress.set(audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0);
  }

  seek(event: MouseEvent): void {
    const audio = this.audio()?.nativeElement;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * audio.duration;
    this.updateProgress();
  }

  skip(seconds: number, event: Event): void {
    event.preventDefault();
    const audio = this.audio()?.nativeElement;
    if (audio && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
  }

  private startLoading(): void {
    this.loading.set(true);
    clearTimeout(this.startTimer);
    this.startTimer = setTimeout(() => {
      this.audio()?.nativeElement.pause();
      this.onError();
    }, AUDIO_START_TIMEOUT_MS);
  }

  private prepare(preload: 'metadata' | 'auto'): void {
    const audio = this.audio()?.nativeElement;
    if (!audio) return;
    if (audio.preload !== 'auto') audio.preload = preload;
    if (!audio.getAttribute('src')) audio.src = this.audioSource();
  }

  private preconnect(): void {
    let origin: string;
    try { origin = new URL(this.audioSource(), this.document.baseURI).origin; } catch { return; }
    if (origin === this.document.location?.origin || this.document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const link = this.document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    this.document.head.appendChild(link);
  }
}
