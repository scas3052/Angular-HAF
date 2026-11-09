import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Content blocks that rise into place the first time they scroll into view. */
const revealSelector = [
  '.section-title', '.section-subtitle', '.card', '.book-card', '.gallery-item', '.testimony-card',
  '.video-section', '.belief-item', '.belief-spotlight', '.verse', '.chapter'
].join(', ');
/** The header, menu and dialogs must appear at once, and the timeline animates itself. */
const staticSelector = 'header, nav, .lightbox, .reader-modal, .timeline';
const tiltSelector = '.card, .book-card';
const revealFrames: Keyframe[] = [{ opacity: 0, transform: 'translateY(36px)' }, { opacity: 1, transform: 'none' }];
const revealTiming: KeyframeAnimationOptions = { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' };

/**
 * Scroll reveals and pointer tilt for every page. Pages need no markup for it: content is found by class
 * as Angular renders it. Nothing runs for visitors who ask for reduced motion.
 */
@Injectable({ providedIn: 'root' })
export class Motion {
  private readonly document = inject(DOCUMENT);
  private readonly seen = new WeakSet<Element>();
  private readonly waiting = new Map<Element, Animation>();
  private readonly stops: (() => void)[] = [];
  private reducedMotion?: MediaQueryList;
  private reveals?: IntersectionObserver;
  private tilted: HTMLElement | null = null;
  private pointer: PointerEvent | null = null;
  private frame = 0;

  start(): void {
    const view = this.document.defaultView;
    if (this.reducedMotion || !view || !('IntersectionObserver' in view) || !('MutationObserver' in view)
      || typeof view.Element.prototype.animate !== 'function') return;
    const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = reducedMotion;
    reducedMotion.addEventListener('change', () => reducedMotion.matches ? this.stop() : this.begin(view));
    if (!reducedMotion.matches) this.begin(view);
  }

  private begin(view: Window & typeof globalThis): void {
    if (this.reveals) return;
    const reveals = new IntersectionObserver(entries => this.reveal(entries), { rootMargin: '0px 0px -8% 0px' });
    this.reveals = reveals;
    const mutations = new MutationObserver(records => {
      let removed = false;
      for (const record of records) {
        removed ||= record.removedNodes.length > 0;
        for (const node of record.addedNodes) if (node instanceof view.Element) this.scan(node);
      }
      if (removed) this.forgetDetached();
    });
    mutations.observe(this.document.body, { childList: true, subtree: true });
    this.scan(this.document.body);

    const showAll = () => this.showAll();
    view.addEventListener('beforeprint', showAll);
    this.stops.push(() => view.removeEventListener('beforeprint', showAll), () => mutations.disconnect());

    const finePointer = view.matchMedia('(hover: hover) and (pointer: fine)');
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !finePointer.matches) return;
      this.pointer = event;
      this.frame ||= view.requestAnimationFrame(() => this.tilt());
    };
    const leave = (event: PointerEvent) => {
      const card = (event.target as Element).closest?.(tiltSelector);
      if (!card || card.contains(event.relatedTarget as Node | null)) return;
      // A move that is still waiting for its frame must not tilt the card again once the pointer has left.
      if (this.pointer && card.contains(this.pointer.target as Node | null)) this.pointer = null;
      if (card === this.tilted) this.untilt();
    };
    this.document.addEventListener('pointermove', move, { passive: true });
    this.document.addEventListener('pointerout', leave, { passive: true });
    this.stops.push(() => {
      this.document.removeEventListener('pointermove', move);
      this.document.removeEventListener('pointerout', leave);
      view.cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.pointer = null;
      this.untilt();
    });
  }

  private stop(): void {
    this.showAll();
    this.reveals?.disconnect();
    this.reveals = undefined;
    for (const stop of this.stops.splice(0)) stop();
  }

  /** Holds new content just below its place until it is scrolled to. */
  private scan(root: Element): void {
    const found = root.matches(revealSelector) ? [root] : [];
    found.push(...root.querySelectorAll(revealSelector));
    for (const element of found) {
      if (this.seen.has(element)) continue;
      this.seen.add(element);
      // Only the outermost block moves, so nested content does not slide twice.
      if (element.closest(staticSelector) || element.parentElement?.closest(revealSelector)) continue;
      const animation = element.animate(revealFrames, revealTiming);
      animation.pause();
      this.waiting.set(element, animation);
      this.reveals?.observe(element);
    }
  }

  private reveal(entries: IntersectionObserverEntry[]): void {
    let order = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const animation = this.waiting.get(entry.target);
      this.reveals?.unobserve(entry.target);
      this.waiting.delete(entry.target);
      if (!animation) continue;
      // Blocks arriving together follow one another in a short cascade.
      animation.effect?.updateTiming({ delay: Math.min(order++ * 90, 450) });
      animation.play();
    }
  }

  private forgetDetached(): void {
    for (const [element, animation] of this.waiting) {
      if (element.isConnected) continue;
      this.reveals?.unobserve(element);
      animation.cancel();
      this.waiting.delete(element);
    }
  }

  /** Shows everything still waiting, for printing or when motion is switched off. */
  private showAll(): void {
    for (const [element, animation] of this.waiting) {
      this.reveals?.unobserve(element);
      animation.cancel();
    }
    this.waiting.clear();
  }

  private tilt(): void {
    this.frame = 0;
    const event = this.pointer;
    const card = (event?.target as Element | null)?.closest?.<HTMLElement>(tiltSelector) ?? null;
    if (card !== this.tilted) this.untilt();
    if (!event || !card) return;
    this.tilted = card;
    const bounds = card.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    card.style.setProperty('--rx', `${((y - 0.5) * 10).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${((0.5 - x) * 10).toFixed(2)}deg`);
  }

  private untilt(): void {
    const card = this.tilted;
    this.tilted = null;
    for (const property of ['--mx', '--my', '--rx', '--ry']) card?.style.removeProperty(property);
  }
}
