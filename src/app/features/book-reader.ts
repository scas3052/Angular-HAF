import { DOCUMENT } from '@angular/common';
import { Component, Directive, DestroyRef, ElementRef, Injectable, Injector, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { PageContext } from '../core/page-context';
import { trapFocus } from '../shared/dialog-focus';
import { Book, books } from './books.data';

@Injectable()
export class BookReaderState {
  private readonly document = inject(DOCUMENT);
  private previousOverflow = '';
  private previousFocus: HTMLElement | null = null;
  readonly bookId = signal<string | null>(null);
  readonly chapterIndex = signal(0);
  readonly book = computed<Book | null>(() => books[this.bookId() ?? ''] ?? null);
  readonly chapter = computed<Book['chapters'][number] | null>(() => this.book()?.chapters[this.chapterIndex()] ?? null);

  constructor() { inject(DestroyRef).onDestroy(() => this.close()); }

  open(bookId: string): void {
    if (!books[bookId]) return;
    this.previousFocus = this.document.activeElement as HTMLElement | null;
    this.previousOverflow = this.document.body.style.overflow;
    this.chapterIndex.set(0);
    this.bookId.set(bookId);
    this.document.body.style.overflow = 'hidden';
  }

  close(): void {
    if (!this.book()) return;
    this.bookId.set(null);
    this.document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus();
  }

  select(index: number): void {
    if (index >= 0 && index < (this.book()?.chapters.length ?? 0)) this.chapterIndex.set(index);
  }

  navigate(direction: number): void { this.select(this.chapterIndex() + direction); }
}

@Directive({ selector: '[hafReadBook]', host: { '(click)': 'open()' } })
export class ReadBook {
  readonly hafReadBook = input.required<string>();
  private readonly reader = inject(BookReaderState);
  open(): void { this.reader.open(this.hafReadBook()); }
}

@Component({
  selector: 'haf-book-reader',
  preserveWhitespaces: true,
  template: `<div id="readerModal" #modal class="reader-modal" role="dialog" aria-modal="true"
      [attr.aria-hidden]="!reader.book()" aria-labelledby="readerTitle"
      [style.display]="reader.book() ? 'flex' : 'none'" (click)="closeOnBackdrop($event)">
      <div class="reader-content">
        <div class="reader-header">
          <h2 id="readerTitle">{{ reader.book()?.title }}</h2>
          <button class="close-reader" #closeButton (click)="reader.close()" [attr.aria-label]="copy().close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="reader-body" id="readerContent" #content [innerHTML]="reader.chapter()?.content ?? ''"></div>
        <div class="reader-navigation">
          <button class="nav-btn" (click)="reader.navigate(-1)">
            <i class="fas fa-chevron-left"></i>
            {{ copy().previous }}
          </button>
          <select id="chapterSelect" class="chapter-select" [attr.aria-label]="copy().chapter" [value]="reader.chapterIndex()" (change)="selectChapter($event)">
            @for (chapter of reader.book()?.chapters ?? []; track $index) {
              <option [value]="$index">{{ chapter.title }}</option>
            }
          </select>
          <button class="nav-btn" (click)="reader.navigate(1)">
            {{ copy().next }}
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>`,
  styles: ':host { display: contents; }',
  host: { '(document:keydown.escape)': 'reader.close()', '(document:keydown)': 'keepFocusInside($event)' }
})
export class BookReader {
  readonly reader = inject(BookReaderState);
  private readonly context = inject(PageContext);
  private readonly injector = inject(Injector);
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  private readonly modal = viewChild.required<ElementRef<HTMLElement>>('modal');
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');
  private shown: { book: string | null; chapter: number } = { book: null, chapter: 0 };
  readonly copy = computed(() => this.context.language() === 'te' ? {
    close: 'పుస్తకాన్ని మూసివేయండి', chapter: 'అధ్యాయం', previous: 'మునుపటి అధ్యాయం', next: 'తదుపరి అధ్యాయం'
  } : {
    close: 'Close reader', chapter: 'Chapter', previous: 'Previous Chapter', next: 'Next Chapter'
  });

  constructor() {
    effect(() => {
      this.reader.chapterIndex();
      this.reader.bookId();
      this.content()?.nativeElement.scrollTo(0, 0);
    });
    effect(() => {
      // The dialog only becomes visible once this render finishes, so focus is moved after it.
      if (this.reader.bookId()) afterNextRender(() => this.closeButton().nativeElement.focus(), { injector: this.injector });
    });
    effect(() => {
      const book = this.reader.bookId();
      const chapter = this.reader.chapterIndex();
      const previous = this.shown;
      this.shown = { book, chapter };
      // Moving between chapters of the open book turns the page in the direction of travel.
      if (book && book === previous.book && chapter !== previous.chapter) {
        const direction = chapter > previous.chapter ? 1 : -1;
        afterNextRender(() => this.turnPage(direction), { injector: this.injector });
      }
    });
  }

  private turnPage(direction: number): void {
    const content = this.content()?.nativeElement;
    const view = content?.ownerDocument.defaultView;
    if (!content || !view || view.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hinge = direction > 0 ? '0% 50%' : '100% 50%';
    content.animate([
      { opacity: 0, transform: `perspective(1600px) translateX(${direction * 56}px) rotateY(${direction * -14}deg)`, transformOrigin: hinge },
      { opacity: 1, transform: 'perspective(1600px) translateX(0) rotateY(0deg)', transformOrigin: hinge }
    ], { duration: 580, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  }

  keepFocusInside(event: KeyboardEvent): void {
    if (this.reader.book()) trapFocus(event, this.modal().nativeElement);
  }

  selectChapter(event: Event): void { this.reader.select(Number((event.target as HTMLSelectElement).value)); }
  closeOnBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).id === 'readerModal') this.reader.close();
  }
}