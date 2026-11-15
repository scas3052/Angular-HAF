import {
  Component, Directive, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, input, linkedSignal, signal
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { glide, layoutOf } from '../core/flip';
import { PageContext } from '../core/page-context';

/** The shape of video-library.json, which scripts/sync-videos.mjs keeps up to date. */
export interface LocalizedText { en: string; te: string; }

export interface LibraryVideo {
  id: string;
  title: string;
  speaker: string;
  /** YYYY, YYYY-MM or YYYY-MM-DD; empty when unknown. */
  date: string;
  /** When YouTube published it (ISO 8601); empty for videos carried over from the hand-written page. */
  published: string;
  /** Length in seconds; 0 when unknown. */
  duration: number;
  category: string;
  source: string;
  embeddable: boolean;
  short: boolean;
  channel: string;
}

export interface LibraryCategory { key: string; label: LocalizedText; includeInAll: boolean; }

export interface LibrarySection {
  key: string;
  title: LocalizedText;
  icon: string;
  search: LocalizedText;
  all: { key: string; label: LocalizedText };
  categories: LibraryCategory[];
  videos: LibraryVideo[];
}

export interface VideoLibrary {
  version: number;
  settings: { pageSize: number; newBadgeDays: number };
  sections: LibrarySection[];
}

type Language = 'en' | 'te';

const VIDEO_ID = /^[\w-]{11}$/;
const DAY = 86_400_000;

const LABELS: Record<Language, { play: string; watch: string; new: string }> = {
  en: { play: 'Play ', watch: 'Watch on YouTube', new: 'New' },
  te: { play: 'ప్లే చేయండి: ', watch: 'YouTubeలో చూడండి', new: 'కొత్తది' }
};

const normalize = (text: string) => text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(language: Language, withDay: boolean): Intl.DateTimeFormat {
  const key = `${language}-${withDay}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(language === 'te' ? 'te-IN' : 'en-IN', withDay
      ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { month: 'long', year: 'numeric', timeZone: 'UTC' });
    formatters.set(key, format);
  }
  return format;
}

/** Writes a YYYY, YYYY-MM or YYYY-MM-DD date in the page language: "30 January 2022" or "30 జనవరి, 2022". */
export function formatVideoDate(value: string, language: Language): string {
  const parts = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!parts?.[2]) return value;
  const [, year, month, day] = parts;
  const date = new Date(Date.UTC(+year, +month - 1, day ? +day : 1));
  // A date that does not exist (such as 30 February) would roll into the next month, so it is shown as written.
  if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || (day && date.getUTCDate() !== +day)) return value;
  return formatter(language, !!day).format(date);
}

/** 754 seconds becomes "12:34"; 4,354 becomes "1:12:34". */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}:${pad(minutes)}:${pad(total % 60)}` : `${minutes}:${pad(total % 60)}`;
}

@Directive({ selector: '[hafVideoCatalog]' })
export class VideoCatalog {
  readonly library = input.required<VideoLibrary>({ alias: 'hafVideoCatalog' });
  readonly activeSection = signal<string | null>(null);
  readonly playingId = signal<string | null>(null);
}

@Directive({
  selector: '[hafVideoSection]',
  exportAs: 'hafVideoSection',
  host: { '[class.collapsed]': '!expanded()', '[attr.data-section]': 'section().key' }
})
export class VideoSection {
  readonly section = input.required<LibrarySection>({ alias: 'hafVideoSection' });
  readonly catalog = inject(VideoCatalog);
  readonly search = signal('');
  readonly category = linkedSignal(() => this.section().all.key);
  private readonly order = linkedSignal<LibrarySection, LibraryVideo[] | null>({ source: this.section, computation: () => null });
  readonly videos = computed(() => this.order() ?? this.section().videos);
  readonly expanded = computed(() => this.catalog.activeSection() === this.section().key);

  readonly counts = computed(() => {
    const counts = new Map<string, number>();
    for (const video of this.section().videos) counts.set(video.category, (counts.get(video.category) ?? 0) + 1);
    return counts;
  });
  private readonly inAll = computed(() => new Set(this.section().categories.filter(category => category.includeInAll).map(category => category.key)));
  readonly allCount = computed(() => this.section().videos.filter(video => this.inAll().has(video.category)).length);
  /** Only categories that have videos get a button; a section with a single category needs no buttons at all. */
  readonly categories = computed(() => this.section().categories.filter(category => this.counts().get(category.key)));
  readonly showCategories = computed(() => this.categories().length > 1);

  private readonly searchText = computed(() => new Map(this.section().videos.map(video => [video.id, normalize(`${video.title} ${video.speaker}`)])));
  private readonly query = computed(() => normalize(this.search()));
  readonly matching = computed(() => {
    const category = this.category();
    const everything = category === this.section().all.key;
    const query = this.query();
    const text = this.searchText();
    return this.videos().filter(video => (everything ? this.inAll().has(video.category) : video.category === category)
      && (!query || (text.get(video.id) ?? '').includes(query)));
  });
  // A new search or category starts again from the first page; shuffling keeps however many are shown.
  private readonly limit = linkedSignal({
    source: () => [this.query(), this.category()],
    computation: () => this.catalog.library().settings.pageSize
  });
  readonly visible = computed(() => this.matching().slice(0, this.limit()));
  readonly remaining = computed(() => this.matching().length - this.visible().length);
  readonly allShorts = computed(() => this.visible().length > 0 && this.visible().every(video => video.short));

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private scrollTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const playing = this.catalog.playingId();
      if (playing && this.section().videos.some(video => video.id === playing) && !this.visible().some(video => video.id === playing)) {
        this.catalog.playingId.set(null);
      }
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.scrollTimer));
  }

  toggle(): void {
    this.catalog.playingId.set(null);
    const open = !this.expanded();
    this.catalog.activeSection.set(open ? this.section().key : null);
    clearTimeout(this.scrollTimer);
    if (open) this.scrollTimer = setTimeout(() => {
      if (!this.expanded()) return;
      const headerHeight = document.querySelector('header')?.offsetHeight ?? 80;
      window.scrollTo({ top: this.element.nativeElement.getBoundingClientRect().top + window.scrollY - headerHeight - 15, behavior: 'smooth' });
    }, 350);
  }

  shuffle(): void {
    this.catalog.playingId.set(null);
    // The videos on screen glide to their new places rather than jumping there.
    const before = layoutOf(this.element.nativeElement.querySelectorAll<HTMLElement>('.video-card'));
    const videos = [...this.videos()];
    for (let index = videos.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [videos[index], videos[randomIndex]] = [videos[randomIndex], videos[index]];
    }
    this.order.set(videos);
    afterNextRender(() => glide(before), { injector: this.injector });
  }

  showMore(): void {
    const first = this.visible().length;
    this.limit.update(limit => limit + this.catalog.library().settings.pageSize);
    // Keyboard users carry on from the first new video instead of going back to the top of the list.
    afterNextRender(() => {
      const card = this.element.nativeElement.querySelectorAll<HTMLElement>('.video-card')[first];
      card?.querySelector<HTMLElement>('.play-button, .watch-link')?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }
}

@Directive({ selector: '[hafVideoSectionToggle]', host: {
  role: 'button', tabindex: '0', '[attr.aria-expanded]': 'section.expanded()',
  '(click)': 'toggle($event)', '(keydown.enter)': 'toggle($event)', '(keydown.space)': 'toggle($event)'
} })
export class VideoSectionToggle {
  readonly section = inject(VideoSection);
  toggle(event: Event): void { event.preventDefault(); this.section.toggle(); }
}

@Directive({ selector: 'input[hafVideoSearch]', host: { '(input)': 'search($event)', '(keydown.escape)': 'clear($event)' } })
export class VideoSearch {
  private readonly section = inject(VideoSection);
  search(event: Event): void { this.section.search.set((event.target as HTMLInputElement).value); }
  clear(event: Event): void {
    const field = event.target as HTMLInputElement;
    if (!field.value) return;
    event.preventDefault();
    field.value = '';
    this.section.search.set('');
  }
}

@Directive({ selector: '[hafVideoCategory]', host: { '(click)': 'select()', '[class.active]': 'active()', '[attr.aria-pressed]': 'active()' } })
export class VideoCategory {
  readonly key = input.required<string>({ alias: 'hafVideoCategory' });
  private readonly section = inject(VideoSection);
  readonly active = computed(() => this.section.category() === this.key());
  select(): void { this.section.category.set(this.key()); }
}

@Component({
  selector: '[hafVideoCard]',
  host: {
    '[class.is-short]': 'video().short',
    '[class.is-new]': 'isNew()',
    '[class.is-external]': '!playable()',
    '[attr.data-category]': 'video().category',
    '[attr.data-video-id]': 'video().id'
  },
  template: `<div class="video-thumbnail">
    @if (embedUrl(); as url) {
      <iframe [src]="url" [title]="video().title" width="100%" height="100%" style="border:0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    } @else {
      <div class="thumbnail-container" (click)="play()">
        <img [src]="thumbnail()" class="video-thumbnail-img" [alt]="video().title" loading="lazy"
          style="width:100%; height:100%; object-fit:cover; display:block;" (error)="fallbackThumbnail()">
        @if (isNew()) {
          <span class="video-badge">{{ labels().new }}</span>
        }
        @if (duration()) {
          <span class="video-duration">{{ duration() }}</span>
        }
        @if (playable()) {
          <button class="play-button" type="button" [attr.aria-label]="labels().play + video().title"><i class="fas fa-play" aria-hidden="true"></i></button>
        } @else {
          <!-- The owner turned off playing on other sites, so the whole thumbnail opens it on YouTube. -->
          <a class="watch-link" [href]="watchUrl()" target="_blank" rel="noopener" [attr.aria-label]="labels().watch + ': ' + video().title">
            <span><i class="fab fa-youtube" aria-hidden="true"></i>{{ labels().watch }}</span>
          </a>
        }
      </div>
    }
  </div>
  <div class="video-info">
    <h3>{{ video().title }}</h3>
    @if (video().speaker) {
      <p class="singer">{{ video().speaker }}</p>
    }
    @if (date()) {
      <p class="message-date"><time [attr.datetime]="video().date">{{ date() }}</time></p>
    }
  </div>`
})
export class VideoCard {
  readonly video = input.required<LibraryVideo>({ alias: 'hafVideoCard' });
  private readonly catalog = inject(VideoCatalog);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly language = inject(PageContext).language;
  private readonly quality = linkedSignal({ source: () => this.video().id, computation: () => 0 });
  readonly labels = computed(() => LABELS[this.language()]);
  readonly playable = computed(() => this.video().embeddable && VIDEO_ID.test(this.video().id));
  readonly embedUrl = computed(() => this.playable() && this.catalog.playingId() === this.video().id
    ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${this.video().id}?autoplay=1&rel=0&enablejsapi=1`) : null);
  readonly watchUrl = computed(() => `https://www.youtube.com/watch?v=${encodeURIComponent(this.video().id)}`);
  readonly thumbnail = computed(() => this.quality() > 1 || !VIDEO_ID.test(this.video().id) ? '/src/images/bg/Logo%20Png.png'
    : `https://img.youtube.com/vi/${this.video().id}/${this.quality() === 0 ? 'hqdefault' : 'mqdefault'}.jpg`);
  readonly isNew = computed(() => Date.parse(this.video().published) > Date.now() - this.catalog.library().settings.newBadgeDays * DAY);
  readonly date = computed(() => formatVideoDate(this.video().date, this.language()));
  readonly duration = computed(() => this.video().duration > 0 ? formatDuration(this.video().duration) : '');
  play(): void { if (this.playable()) this.catalog.playingId.set(this.video().id); }
  fallbackThumbnail(): void { if (this.quality() < 2) this.quality.update(quality => quality + 1); }
}
