import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Content blocks that move into place the first time they scroll into view. */
const revealSelector = [
  '.section-title', '.section-subtitle', '.card', '.book-card', '.gallery-item', '.testimony-card',
  '.video-section', '.belief-item', '.belief-spotlight', '.verse', '.chapter', '.footer-section'
].join(', ');
/** The header, menu and dialogs must appear at once, and the timeline animates itself. */
const staticSelector = 'header, nav, .lightbox, .reader-modal, .timeline';
const tiltSelector = '.card, .book-card';
/** Icons that spin into place just after the block holding them arrives. */
const iconSelector = ':scope > i, .belief-icon, .belief-spotlight-icon, .testimony-header > i';
const outExpo = 'cubic-bezier(0.16, 1, 0.3, 1)';
const settle = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
const bounce = 'cubic-bezier(0.34, 1.35, 0.64, 1)';

interface Entrance { keyframes: Keyframe[]; duration: number; easing: string; }

/** Each kind of content arrives in its own way, so a long page never repeats a single movement. */
function entranceFor(element: Element): Entrance {
  const side = Array.prototype.indexOf.call(element.parentElement?.children ?? [], element) % 2 ? 1 : -1;
  if (element.matches('.section-title, .section-subtitle')) {
    // Rises out of an unseen slot: revealed from the bottom edge up while it lifts.
    return { duration: 950, easing: outExpo, keyframes: [
      { opacity: 0, transform: 'translateY(30px)', clipPath: 'inset(100% 0 0 0)' },
      { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' }
    ] };
  }
  if (element.matches('.card, .testimony-card')) {
    // Stands up from lying back, like a card set upright on a table.
    return { duration: 1050, easing: outExpo, keyframes: [
      { opacity: 0, transform: 'perspective(1000px) translateY(60px) rotateX(24deg) scale(0.94)', transformOrigin: '50% 100%' },
      { opacity: 1, transform: 'perspective(1000px) translateY(0) rotateX(0deg) scale(1)', transformOrigin: '50% 100%' }
    ] };
  }
  if (element.matches('.book-card')) {
    // Swings open on its spine like a book cover.
    return { duration: 1150, easing: outExpo, keyframes: [
      { opacity: 0, transform: 'perspective(1200px) translateX(-30px) rotateY(32deg)', transformOrigin: '0% 50%' },
      { opacity: 1, transform: 'perspective(1200px) translateX(0) rotateY(0deg)', transformOrigin: '0% 50%' }
    ] };
  }
  if (element.matches('.gallery-item')) {
    // Photos drop onto the page like prints laid on a table and, with a mouse, develop from pale to full colour.
    // No rotation: a photo must keep its true shape on screen while it arrives.
    const develop = element.ownerDocument.defaultView?.matchMedia('(hover: hover) and (pointer: fine)').matches;
    return { duration: 950, easing: bounce, keyframes: [
      { opacity: 0, transform: 'translateY(46px) scale(0.86)', ...(develop ? { filter: 'saturate(0.15) brightness(1.3)' } : {}) },
      { opacity: 1, transform: 'none', ...(develop ? { filter: 'none' } : {}) }
    ] };
  }
  if (element.matches('.belief-item')) {
    // Beliefs glide in from alternate sides, the flow zig-zagging down the page.
    return { duration: 1000, easing: outExpo, keyframes: [
      { opacity: 0, transform: `translateX(${side * 80}px) rotate(${side * 1.5}deg)` },
      { opacity: 1, transform: 'none' }
    ] };
  }
  if (element.matches('.belief-spotlight')) {
    return { duration: 1100, easing: bounce, keyframes: [{ opacity: 0, transform: 'scale(0.86)' }, { opacity: 1, transform: 'none' }] };
  }
  if (element.matches('.verse')) {
    return { duration: 800, easing: outExpo, keyframes: [{ opacity: 0, transform: 'translateX(-44px)' }, { opacity: 1, transform: 'none' }] };
  }
  if (element.matches('.footer-section, .video-section')) {
    return { duration: 900, easing: outExpo, keyframes: [{ opacity: 0, transform: 'translateY(48px) scale(0.96)' }, { opacity: 1, transform: 'none' }] };
  }
  return { duration: 750, easing: settle, keyframes: [{ opacity: 0, transform: 'translateY(36px)' }, { opacity: 1, transform: 'none' }] };
}

/**
 * Scroll reveals and pointer tilt for every page. Pages need no markup for it: content is found by class
 * as Angular renders it. Nothing runs for visitors who ask for reduced motion.
 */
@Injectable({ providedIn: 'root' })
export class Motion {
  private readonly document = inject(DOCUMENT);
  private readonly seen = new WeakSet<Element>();
  private readonly waiting = new Map<Element, Animation>();
  /** Icon and underline flourishes that follow a reveal, cancelled with it when motion is switched off. */
  private readonly flourishes = new Set<Animation>();
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
      const { keyframes, duration, easing } = entranceFor(element);
      const animation = element.animate(keyframes, { duration, easing, fill: 'backwards' });
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
      const delay = Math.min(order++ * 110, 550);
      animation.effect?.updateTiming({ delay });
      animation.play();
      this.flourish(entry.target, delay);
    }
  }

  /** Once a block has arrived, its icons spin into place and a section title draws its gold underline. */
  private flourish(block: Element, delay: number): void {
    const add = (animation: Animation) => {
      this.flourishes.add(animation);
      const forget = () => this.flourishes.delete(animation);
      animation.addEventListener('finish', forget);
      animation.addEventListener('cancel', forget);
    };
    // A browser that ignored `pseudoElement` would squash the title itself, so the underline only draws where it is supported.
    if (block.matches('.section-title') && typeof KeyframeEffect !== 'undefined' && 'pseudoElement' in KeyframeEffect.prototype) {
      add(block.animate([{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 }],
        { pseudoElement: '::after', duration: 1000, delay: delay + 420, easing: outExpo, fill: 'backwards' }));
    }
    let index = 0;
    for (const icon of block.querySelectorAll(iconSelector)) {
      // The separate scale and rotate properties leave each icon's own transform (such as its gentle float) untouched.
      add(icon.animate([
        { scale: '0', rotate: '-150deg', opacity: 0 },
        { scale: '1.14', rotate: '10deg', opacity: 1, offset: 0.68 },
        { scale: '1', rotate: '0deg', opacity: 1 }
      ], { duration: 900, delay: delay + 260 + index++ * 80, easing: settle, fill: 'backwards' }));
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
    for (const animation of [...this.flourishes]) animation.cancel();
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
