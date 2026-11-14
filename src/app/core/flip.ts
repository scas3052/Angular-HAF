/**
 * Lets items glide to the places a re-render gives them, instead of jumping (the "FLIP" technique):
 * note where they are with `layoutOf` before changing the list, then call `glide` once Angular has rendered it.
 */
export function layoutOf(elements: Iterable<HTMLElement>): Map<HTMLElement, DOMRect> {
  const places = new Map<HTMLElement, DOMRect>();
  for (const element of elements) places.set(element, element.getBoundingClientRect());
  return places;
}

export function glide(before: Map<HTMLElement, DOMRect>): void {
  const first = before.keys().next().value;
  const view = first?.ownerDocument.defaultView;
  if (!view || view.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Only what can be seen is animated, so reshuffling hundreds of videos stays smooth; the rest simply moves.
  const onScreen = (place: DOMRect) => place.width > 0 && place.bottom > -120 && place.top < view.innerHeight + 120;
  let order = 0;
  for (const [element, was] of before) {
    if (!element.isConnected) continue;
    // Items still waiting for their first entrance (core/motion.ts) make it when they come into view instead.
    if (element.getAnimations().some(animation => animation.playState === 'paused')) continue;
    const now = element.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if ((Math.abs(dx) < 1 && Math.abs(dy) < 1) || now.width === 0 || (!onScreen(was) && !onScreen(now))) continue;
    const timing: KeyframeAnimationOptions = { duration: 720, delay: Math.min(order++ * 22, 330), easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' };
    if (!onScreen(was)) {
      // Arriving from far down (or up) the list: it rises into its new place rather than crossing the whole page.
      const rise = Math.sign(dy) * Math.min(Math.abs(dy), 70);
      element.animate([{ opacity: 0, transform: `translateY(${rise.toFixed(1)}px) scale(0.94)` }, { opacity: 1, transform: 'none' }], timing);
      continue;
    }
    element.animate([{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.96)` }, { transform: 'none' }], timing);
  }
}
