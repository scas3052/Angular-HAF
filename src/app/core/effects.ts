import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Links, buttons and everything that acts like one answer a press with a small burst of gold sparks. */
const pressSelector = 'a[href], button, select, summary, label[for], [role="button"], [role="slider"], .gallery-item';
/** The main calls to action lean towards a mouse pointer, as if drawn to it. */
const magneticSelector = '.cta-button, .language-option, .read-btn, .download-btn, #submitButton, .method-btn, .control-btn, .back-to-top';
/** Over these the cursor halo opens up, showing they can be pressed. */
const controlSelector = 'a[href], button, select, summary, label, [role="button"], [role="slider"], .gallery-item';
/** Over text fields the halo shrinks out of the way of the caret. */
const textSelector = 'input:not([type="button"], [type="submit"], [type="checkbox"], [type="radio"]), textarea';
/** Dark scenes whose layers drift apart with the pointer, for a sense of depth. */
const sceneSelector = '.hero, .books-hero, .faith-hero, .gallery-hero, .origin-hero, .testimonies-hero, .videos-hero, .about, .entry-sky';
const confettiColours = ['#f5c451', '#fff4cf', '#e4b04a', '#ffffff', '#b8862b', '#8f73c9'];
/** Sparks still flying are capped, so a burst of rapid taps cannot pile up elements. */
const maxParticles = 220;

interface Point { x: number; y: number; }

/** Removes one inline property, and the then-empty style attribute, so the markup is left exactly as it was. */
function clearInline(element: HTMLElement, property: string): void {
  element.style.removeProperty(property);
  if (!element.getAttribute('style')) element.removeAttribute('style');
}

/**
 * Pointer delight shared by every page: a gold halo that trails the mouse, calls to action that lean towards it,
 * hero scenes with depth, sparks on every press and a celebration when a request is sent. Everything is decorative
 * (aria-hidden, never focusable, never in the way of a click), and nothing runs for visitors who ask for reduced motion.
 */
@Injectable({ providedIn: 'root' })
export class Effects {
  private readonly document = inject(DOCUMENT);
  private readonly stops: (() => void)[] = [];
  private reducedMotion?: MediaQueryList;
  private running = false;
  private layer: HTMLElement | null = null;
  private aura: HTMLElement | null = null;
  private auraAt: Point = { x: 0, y: 0 };
  private pointer: Point | null = null;
  private pointerTarget: Element | null = null;
  private lastPress: (Point & { time: number }) | null = null;
  private magnet: HTMLElement | null = null;
  private readonly pulls = new Map<HTMLElement, Point>();
  private scenes: HTMLElement[] = [];
  private scenesFound = 0;
  private readonly sceneValues = new WeakMap<HTMLElement, string>();
  private frame = 0;

  start(): void {
    const view = this.document.defaultView;
    if (this.reducedMotion || !view || typeof view.Element.prototype.animate !== 'function') return;
    const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = reducedMotion;
    reducedMotion.addEventListener('change', () => reducedMotion.matches ? this.stop() : this.begin(view));
    if (!reducedMotion.matches) this.begin(view);
  }

  /** Where a page change should open from: the point just pressed, or the focused control for keyboard users. */
  transitionOrigin(): Point | null {
    if (!this.running) return null;
    const view = this.document.defaultView;
    if (this.lastPress && view && view.performance.now() - this.lastPress.time < 1500) return { x: this.lastPress.x, y: this.lastPress.y };
    const active = this.document.activeElement;
    if (active instanceof HTMLElement && active.matches('a[href], button')) {
      const bounds = active.getBoundingClientRect();
      if (bounds.width || bounds.height) return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    }
    return null;
  }

  /** A burst of gold sparks around a point on the screen. */
  burst(x: number, y: number, strength = 1): void {
    const layer = this.sparkLayer();
    if (!layer || layer.childElementCount > maxParticles) return;
    const ring = this.spawn(layer, 'spark-ring', x, y);
    const reach = 0.5 + 0.6 * strength;
    this.fly(ring, [
      { transform: 'scale(0.2)', opacity: 1 },
      { transform: `scale(${(reach * 0.7).toFixed(2)})`, opacity: 0.85, offset: 0.4 },
      { transform: `scale(${reach.toFixed(2)})`, opacity: 0 }
    ], { duration: 560 + 200 * strength, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
    const count = Math.round(9 + 6 * strength);
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.7;
      const distance = (30 + Math.random() * 42) * (0.65 + 0.55 * strength);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const spark = this.spawn(layer, 'spark', x, y);
      spark.style.setProperty('--size', `${(4.5 + Math.random() * 5).toFixed(1)}px`);
      // Bright while they burst out, then they drift a little lower and fade like embers.
      this.fly(spark, [
        { transform: 'translate(0, 0) scale(0.5)', opacity: 1 },
        { transform: `translate(${(dx * 0.62).toFixed(1)}px, ${(dy * 0.62).toFixed(1)}px) scale(1.15)`, opacity: 1, offset: 0.38 },
        { transform: `translate(${dx.toFixed(1)}px, ${(dy + 16).toFixed(1)}px) scale(0.3)`, opacity: 0 }
      ], { duration: 650 + Math.random() * 450, easing: 'cubic-bezier(0.15, 0.7, 0.3, 1)' });
    }
  }

  /** Gold sparks and confetti rising from an element, for a prayer request that has just been sent. */
  celebrate(element: Element | null | undefined): void {
    const layer = this.sparkLayer();
    if (!element || !layer) return;
    const bounds = element.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    this.burst(x, y, 2.4);
    for (let index = 0; index < 42 && layer.childElementCount <= maxParticles; index++) {
      const piece = this.spawn(layer, 'confetti', x, y);
      piece.style.setProperty('--colour', confettiColours[index % confettiColours.length]);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
      const speed = 150 + Math.random() * 230;
      const across = Math.cos(angle) * speed;
      const rise = Math.sin(angle) * speed;
      const spin = (Math.random() - 0.5) * 1100;
      this.fly(piece, [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(0.15, 0.6, 0.35, 1)' },
        { transform: `translate(${(across * 0.7).toFixed(1)}px, ${rise.toFixed(1)}px) rotate(${(spin / 2).toFixed(0)}deg)`, opacity: 1, offset: 0.38,
          easing: 'cubic-bezier(0.5, 0, 0.85, 0.45)' },
        { transform: `translate(${across.toFixed(1)}px, ${(rise + 240 + Math.random() * 260).toFixed(1)}px) rotate(${spin.toFixed(0)}deg)`, opacity: 0 }
      ], { duration: 1500 + Math.random() * 900 });
    }
  }

  private begin(view: Window & typeof globalThis): void {
    if (this.running) return;
    this.running = true;
    const finePointer = view.matchMedia('(hover: hover) and (pointer: fine)');

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !finePointer.matches) return;
      this.pointer = { x: event.clientX, y: event.clientY };
      this.pointerTarget = event.target as Element | null;
      const aura = this.cursorAura();
      if (!aura.classList.contains('visible')) {
        this.auraAt = { ...this.pointer };
        aura.classList.add('visible');
      }
      this.schedule();
    };
    const over = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !this.aura) return;
      const target = event.target instanceof Element ? event.target : null;
      const text = !!target?.closest(textSelector);
      this.aura.classList.toggle('over-text', text);
      this.aura.classList.toggle('over-control', !text && !!target?.closest(controlSelector));
    };
    const leave = (event: PointerEvent) => {
      // Leaving the window (or entering an embedded map or video) parks everything until the pointer returns.
      if (event.pointerType !== 'mouse' || (event.relatedTarget && !(event.relatedTarget instanceof HTMLIFrameElement))) return;
      this.pointer = null;
      this.pointerTarget = null;
      this.aura?.classList.remove('visible', 'pressed');
      this.schedule();
    };
    const down = (event: PointerEvent) => {
      this.lastPress = { x: event.clientX, y: event.clientY, time: view.performance.now() };
      if (event.pointerType === 'mouse') this.aura?.classList.add('pressed');
      if (event.button === 0 && (event.target as Element | null)?.closest?.(pressSelector)) this.burst(event.clientX, event.clientY);
    };
    const up = () => this.aura?.classList.remove('pressed');
    // Keyboard presses (Enter or Space) arrive as clicks without a pointer, so they sparkle from the control itself.
    const click = (event: MouseEvent) => {
      if (event.detail !== 0) return;
      const control = (event.target as Element | null)?.closest?.(pressSelector);
      // Form fields also receive the clicks their labels pass on, which have no pointer either.
      if (!control || control.matches('select, label')) return;
      const bounds = control.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2;
      const y = bounds.top + bounds.height / 2;
      this.lastPress = { x, y, time: view.performance.now() };
      this.burst(x, y, 0.8);
    };

    const options = { passive: true, capture: true };
    this.document.addEventListener('pointermove', move, options);
    this.document.addEventListener('pointerover', over, options);
    this.document.addEventListener('pointerout', leave, options);
    this.document.addEventListener('pointerdown', down, options);
    this.document.addEventListener('pointerup', up, options);
    this.document.addEventListener('pointercancel', up, options);
    this.document.addEventListener('click', click, options);
    this.stops.push(() => {
      this.document.removeEventListener('pointermove', move, options);
      this.document.removeEventListener('pointerover', over, options);
      this.document.removeEventListener('pointerout', leave, options);
      this.document.removeEventListener('pointerdown', down, options);
      this.document.removeEventListener('pointerup', up, options);
      this.document.removeEventListener('pointercancel', up, options);
      this.document.removeEventListener('click', click, options);
    });
  }

  private stop(): void {
    this.running = false;
    for (const stop of this.stops.splice(0)) stop();
    this.document.defaultView?.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pointer = null;
    this.pointerTarget = null;
    this.lastPress = null;
    this.magnet = null;
    for (const element of this.pulls.keys()) clearInline(element, 'translate');
    this.pulls.clear();
    for (const scene of this.scenes) {
      clearInline(scene, '--hx');
      clearInline(scene, '--hy');
    }
    this.scenes = [];
    this.aura?.remove();
    this.aura = null;
    this.layer?.remove();
    this.layer = null;
  }

  private schedule(): void {
    const view = this.document.defaultView;
    if (view && !this.frame) this.frame = view.requestAnimationFrame(() => this.tick());
  }

  /** One frame of the halo, the magnetic pull and the scene depth; it keeps going only while something is still settling. */
  private tick(): void {
    this.frame = 0;
    let settling = false;
    if (this.aura && this.pointer) {
      const dx = this.pointer.x - this.auraAt.x;
      const dy = this.pointer.y - this.auraAt.y;
      const done = Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15;
      this.auraAt = done ? { ...this.pointer } : { x: this.auraAt.x + dx * 0.24, y: this.auraAt.y + dy * 0.24 };
      this.aura.style.transform = `translate3d(${this.auraAt.x.toFixed(1)}px, ${this.auraAt.y.toFixed(1)}px, 0)`;
      settling ||= !done;
    }
    settling = this.pull() || settling;
    this.depth();
    if (settling) this.schedule();
  }

  /** Eases the control under the pointer towards it, and every control it has left back to rest. */
  private pull(): boolean {
    const target = this.pointer ? this.pointerTarget?.closest?.<HTMLElement>(magneticSelector) ?? null : null;
    this.magnet = target;
    let moving = false;
    if (target && !this.pulls.has(target)) this.pulls.set(target, { x: 0, y: 0 });
    for (const [element, offset] of this.pulls) {
      let goal: Point = { x: 0, y: 0 };
      if (element === target && this.pointer && element.isConnected) {
        const bounds = element.getBoundingClientRect();
        // The box already includes the current pull, so it is taken out to find where the control rests.
        const restX = bounds.left + bounds.width / 2 - offset.x;
        const restY = bounds.top + bounds.height / 2 - offset.y;
        const reachX = Math.min(12, bounds.width * 0.1);
        const reachY = Math.min(8, bounds.height * 0.18);
        goal = {
          x: Math.max(-reachX, Math.min(reachX, (this.pointer.x - restX) * 0.3)),
          y: Math.max(-reachY, Math.min(reachY, (this.pointer.y - restY) * 0.3))
        };
      }
      const next = { x: offset.x + (goal.x - offset.x) * 0.2, y: offset.y + (goal.y - offset.y) * 0.2 };
      const resting = element !== target && Math.abs(next.x) < 0.1 && Math.abs(next.y) < 0.1;
      if (resting || !element.isConnected) {
        clearInline(element, 'translate');
        this.pulls.delete(element);
        continue;
      }
      this.pulls.set(element, next);
      element.style.setProperty('translate', `${next.x.toFixed(2)}px ${next.y.toFixed(2)}px`);
      moving ||= Math.abs(goal.x - next.x) > 0.1 || Math.abs(goal.y - next.y) > 0.1;
    }
    return moving;
  }

  /** Hands the pointer position (-1 to 1 across the window) to the scenes on screen; their stylesheets turn it into depth. */
  private depth(): void {
    const view = this.document.defaultView;
    if (!view) return;
    const now = view.performance.now();
    if (now - this.scenesFound > 1000 || this.scenes.some(scene => !scene.isConnected)) {
      this.scenes = Array.from(this.document.querySelectorAll<HTMLElement>(sceneSelector));
      this.scenesFound = now;
    }
    const x = this.pointer ? (this.pointer.x / view.innerWidth) * 2 - 1 : 0;
    const y = this.pointer ? (this.pointer.y / view.innerHeight) * 2 - 1 : 0;
    const value = `${x.toFixed(3)} ${y.toFixed(3)}`;
    for (const scene of this.scenes) {
      if (this.sceneValues.get(scene) === value) continue;
      const bounds = scene.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > view.innerHeight) continue;
      this.sceneValues.set(scene, value);
      scene.style.setProperty('--hx', x.toFixed(3));
      scene.style.setProperty('--hy', y.toFixed(3));
    }
  }

  private cursorAura(): HTMLElement {
    if (!this.aura) {
      const aura = this.document.createElement('div');
      aura.className = 'cursor-aura';
      aura.setAttribute('aria-hidden', 'true');
      aura.append(this.document.createElement('span'));
      aura.firstElementChild!.className = 'cursor-aura-ring';
      this.document.body.append(aura);
      this.aura = aura;
    }
    return this.aura;
  }

  private sparkLayer(): HTMLElement | null {
    if (!this.running) return null;
    if (!this.layer) {
      const layer = this.document.createElement('div');
      layer.className = 'spark-layer';
      layer.setAttribute('aria-hidden', 'true');
      this.document.body.append(layer);
      this.layer = layer;
    }
    return this.layer;
  }

  private spawn(layer: HTMLElement, className: string, x: number, y: number): HTMLElement {
    const element = this.document.createElement('span');
    element.className = className;
    element.style.left = `${x.toFixed(1)}px`;
    element.style.top = `${y.toFixed(1)}px`;
    layer.append(element);
    return element;
  }

  private fly(element: HTMLElement, keyframes: Keyframe[], timing: KeyframeAnimationOptions): void {
    const animation = element.animate(keyframes, timing);
    const done = () => element.remove();
    animation.addEventListener('finish', done);
    animation.addEventListener('cancel', done);
  }
}
