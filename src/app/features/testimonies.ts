import { DOCUMENT } from '@angular/common';
import { Component, Directive, ElementRef, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { glide, layoutOf } from '../core/flip';
import { PageContext } from '../core/page-context';

export interface TestimonyStory { id: number; name: string; role: string; button: string; content: string; }

@Directive()
export class TestimoniesState {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  readonly search = signal('');
  readonly stories = signal<TestimonyStory[]>([]);
  readonly hasResults = computed(() => this.stories().some(story => this.matches(story)));
  matches(story: TestimonyStory): boolean { return story.name.toLowerCase().includes(this.search().toLowerCase()); }

  shuffle(): void {
    // The cards glide to their new places rather than jumping there.
    const before = layoutOf(this.document.querySelectorAll<HTMLElement>('.testimony-card'));
    const stories = [...this.stories()];
    for (let index = stories.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [stories[index], stories[randomIndex]] = [stories[randomIndex], stories[index]];
    }
    this.stories.set(stories);
    afterNextRender(() => glide(before), { injector: this.injector });
  }
}

@Component({
  selector: '[hafTestimonyCard]',
  preserveWhitespaces: true,
  template: `<div class="testimony-content">
    <div class="testimony-header">
      <i class="fas fa-user-circle"></i>
      <div class="header-text">
        <h3 aria-level="2">{{ story().name }}</h3>
        <span class="role">{{ story().role }}</span>
      </div>
    </div>
    <button class="read-more-btn" (click)="toggle()" [attr.aria-expanded]="expanded()">
      {{ expanded() ? readLess() : story().button }}
      <i [class]="expanded() ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
    </button>
    <div class="testimony-full" #content [style.max-height]="expanded() ? height() + 'px' : '0'" [innerHTML]="story().content"></div>
  </div>`,
  host: { '[class.expanded]': 'expanded()', '(window:resize)': 'measure()' }
})
export class TestimonyCard {
  readonly story = input.required<TestimonyStory>();
  readonly expanded = signal(false);
  readonly height = signal(0);
  private readonly context = inject(PageContext);
  readonly readLess = computed(() => this.context.language() === 'te' ? 'తక్కువ చూపించు' : 'Read Less');
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  measure(): void { this.height.set(this.content()?.nativeElement.scrollHeight ?? 0); }
  toggle(): void { this.measure(); this.expanded.update(expanded => !expanded); }
}