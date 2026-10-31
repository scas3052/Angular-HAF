import { DOCUMENT } from '@angular/common';
import { Directive, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { trapFocus } from '../shared/dialog-focus';
import { galleryImages } from './gallery.data';

@Directive({ host: { '(document:keydown)': 'onKeydown($event)', '(touchstart)': 'onTouchStart($event)', '(touchend)': 'onTouchEnd($event)' } })
export class GalleryState {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private previousOverflow = '';
  private previousFocus: HTMLElement | null = null;
  private touchStartX: number | null = null;
  readonly filter = signal('all');
  readonly selectedIndex = signal<number | null>(null);
  readonly filteredImages = computed(() => galleryImages.filter(image => this.filter() === 'all' || image.category === this.filter()));
  readonly selectedImage = computed(() => {
    const index = this.selectedIndex();
    return index === null ? null : this.filteredImages()[index];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
  }

  open(index: number): void {
    this.previousOverflow = this.document.body.style.overflow;
    this.previousFocus = this.document.activeElement as HTMLElement | null;
    this.selectedIndex.set(index);
    this.document.body.style.overflow = 'hidden';
    afterNextRender(() => this.document.querySelector<HTMLButtonElement>('.close-lightbox')?.focus(), { injector: this.injector });
  }

  close(): void {
    if (this.selectedIndex() === null) return;
    this.selectedIndex.set(null);
    this.document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus();
  }

  navigate(direction: number): void {
    const count = this.filteredImages().length;
    if (this.selectedIndex() !== null && count) {
      this.selectedIndex.update(index => ((index ?? 0) + direction + count) % count);
    }
  }

  closeOnBackdrop(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.id === 'lightbox' || target.classList.contains('lightbox-image-container')) this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.selectedIndex() === null) return;
    if (event.key === 'Escape') this.close();
    if (event.key === 'ArrowLeft') { event.preventDefault(); this.navigate(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); this.navigate(1); }
    const lightbox = this.document.getElementById('lightbox');
    if (lightbox) trapFocus(event, lightbox);
  }

  onTouchStart(event: TouchEvent): void {
    if (this.selectedIndex() !== null) this.touchStartX = event.changedTouches[0]?.screenX ?? null;
  }

  onTouchEnd(event: TouchEvent): void {
    const touchEndX = event.changedTouches[0]?.screenX;
    if (this.selectedIndex() !== null && this.touchStartX !== null && touchEndX !== undefined) {
      const distance = this.touchStartX - touchEndX;
      if (Math.abs(distance) > 50) this.navigate(distance > 0 ? 1 : -1);
    }
    this.touchStartX = null;
  }
}