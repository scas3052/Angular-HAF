import { DOCUMENT } from '@angular/common';
import { Directive, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { trapFocus } from '../shared/dialog-focus';
import { galleryImages } from './gallery.data';

type GalleryImage = (typeof galleryImages)[number];

/** Smaller copies made by `npm run optimize:images`, e.g. /src/images/Gallery/w480/1.webp. */
const sized = (image: GalleryImage, width: number) => image.src.replace(/\/([^/]+)\.\w+$/, `/w${width}/$1.webp`);
const srcset = (image: GalleryImage, widths: number[]) => widths.map(width => `${sized(image, width)} ${width}w`).join(', ');

/** Column widths from gallery.css: 1 column under 480px, 2 under 1024px, 3 under 1400px, then 4. */
export const gallerySizes = '(max-width: 480px) 100vw, (max-width: 1024px) 50vw, (max-width: 1400px) 33vw, 400px';
export const lightboxSizes = '90vw';

@Directive({ host: { '(document:keydown)': 'onKeydown($event)', '(touchstart)': 'onTouchStart($event)', '(touchend)': 'onTouchEnd($event)' } })
export class GalleryState {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private previousOverflow = '';
  private previousFocus: HTMLElement | null = null;
  private touchStartX: number | null = null;
  readonly filter = signal('all');
  readonly selectedIndex = signal<number | null>(null);
  readonly gallerySizes = gallerySizes;
  readonly lightboxSizes = lightboxSizes;
  readonly filteredImages = computed(() => galleryImages
    .filter(image => this.filter() === 'all' || image.category === this.filter())
    .map(image => ({
      ...image,
      thumb: sized(image, 480),
      thumbSrcset: srcset(image, [480, 960]),
      large: sized(image, 1920),
      largeSrcset: srcset(image, [960, 1920])
    })));
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
    this.preloadNeighbours();
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
      this.preloadNeighbours();
    }
  }

  /** Fetches the photos either side of the open one so next/previous shows instantly. */
  private preloadNeighbours(): void {
    const images = this.filteredImages();
    const index = this.selectedIndex();
    const view = this.document.defaultView;
    if (index === null || !view || images.length < 2) return;
    for (const offset of [1, -1]) {
      const image = images[(index + offset + images.length) % images.length];
      const preload = new view.Image();
      preload.sizes = lightboxSizes;
      preload.srcset = image.largeSrcset;
      preload.src = image.large;
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