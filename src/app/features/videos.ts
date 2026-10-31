import { Component, Directive, DestroyRef, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { PageContext } from '../core/page-context';

export interface VideoCardData { key: string; id: string | null; category: string; title: string; info: string; }
export interface VideoSectionData { id: string; cards: VideoCardData[]; }

@Directive({ selector: '[hafVideoCatalog]' })
export class VideoCatalog {
  readonly activeSection = signal<string | null>(null);
  readonly playingKey = signal<string | null>(null);
}

@Directive({ selector: '[hafVideoSection]', exportAs: 'hafVideoSection', host: { '[class.collapsed]': '!expanded()' } })
export class VideoSection {
  readonly section = input.required<VideoSectionData>();
  readonly catalog = inject(VideoCatalog);
  readonly search = signal('');
  readonly category = signal('all');
  readonly filtered = signal(false);
  private readonly order = signal<VideoCardData[] | null>(null);
  readonly cards = computed(() => this.order() ?? this.section().cards);
  readonly expanded = computed(() => this.catalog.activeSection() === this.section().id);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private scrollTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const playing = this.cards().find(card => card.key === this.catalog.playingKey());
      if (playing && !this.matches(playing)) this.catalog.playingKey.set(null);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.scrollTimer));
  }

  matches(card: VideoCardData): boolean {
    return card.title.toLowerCase().includes(this.search().toLowerCase())
      && (this.category().includes('all') || card.category.split(' ').includes(this.category()));
  }

  toggle(): void {
    this.catalog.playingKey.set(null);
    const open = !this.expanded();
    this.catalog.activeSection.set(open ? this.section().id : null);
    clearTimeout(this.scrollTimer);
    if (open) this.scrollTimer = setTimeout(() => {
      if (!this.expanded()) return;
      const headerHeight = document.querySelector('header')?.offsetHeight ?? 80;
      window.scrollTo({ top: this.element.nativeElement.getBoundingClientRect().top + window.scrollY - headerHeight - 15, behavior: 'smooth' });
    }, 350);
  }

  shuffle(): void {
    this.catalog.playingKey.set(null);
    const cards = [...this.cards()];
    for (let index = cards.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [cards[index], cards[randomIndex]] = [cards[randomIndex], cards[index]];
    }
    this.order.set(cards);
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

@Directive({ selector: 'input[hafVideoSearch]', host: { '(input)': 'search($event)' } })
export class VideoSearch {
  private readonly section = inject(VideoSection);
  search(event: Event): void {
    this.section.filtered.set(true);
    this.section.search.set((event.target as HTMLInputElement).value);
  }
}

@Directive({ selector: '[hafVideoCategory]', host: { '(click)': 'select()', '[class.active]': 'active()', '[attr.aria-pressed]': 'active()' } })
export class VideoCategory {
  readonly hafVideoCategory = input.required<string>();
  private readonly section = inject(VideoSection);
  readonly active = computed(() => this.section.category() === this.hafVideoCategory()
    || (this.section.category() === 'all' && this.hafVideoCategory().includes('all')));
  select(): void { this.section.filtered.set(true); this.section.category.set(this.hafVideoCategory()); }
}

@Component({
  selector: '[hafVideoCard]',
  preserveWhitespaces: true,
  template: `<div class="video-thumbnail" [attr.data-video-url]="videoUrl()">
    @if (playing() && embedUrl()) {
      <iframe [src]="embedUrl()" [title]="card().title" width="100%" height="100%" style="border:0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    } @else {
      <div class="thumbnail-container" (click)="play()">
        <img [src]="thumbnail()" class="video-thumbnail-img" [alt]="card().title" loading="lazy"
          style="width:100%; height:100%; object-fit:cover; display:block;" (error)="fallbackThumbnail()">
        <button class="play-button" type="button" [attr.aria-label]="playLabel() + card().title"><i class="fas fa-play"></i></button>
      </div>
    }
  </div>
  <div class="video-info" [innerHTML]="card().info"></div>`
})
export class VideoCard {
  readonly card = input.required<VideoCardData>();
  private readonly catalog = inject(VideoCatalog);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly context = inject(PageContext);
  private readonly quality = signal(0);
  readonly playLabel = computed(() => this.context.language() === 'te' ? 'ప్లే చేయండి: ' : 'Play ');
  readonly playing = computed(() => this.catalog.playingKey() === this.card().key);
  readonly videoUrl = computed(() => this.card().id && /^[\w-]{11}$/.test(this.card().id!)
    ? `https://www.youtube.com/embed/${this.card().id}?autoplay=1&rel=0&enablejsapi=1` : null);
  readonly embedUrl = computed(() => this.videoUrl() ? this.sanitizer.bypassSecurityTrustResourceUrl(this.videoUrl()!) : null);
  readonly thumbnail = computed(() => this.quality() > 1 || !this.card().id ? '/src/images/bg/Logo%20Png.png'
    : `https://img.youtube.com/vi/${this.card().id}/${this.quality() === 0 ? 'hqdefault' : 'mqdefault'}.jpg`);
  play(): void { if (this.videoUrl()) this.catalog.playingKey.set(this.card().key); }
  fallbackThumbnail(): void { if (this.quality() < 2) this.quality.update(quality => quality + 1); }
}