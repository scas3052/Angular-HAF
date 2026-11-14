import { DOCUMENT } from '@angular/common';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  ActivatedRouteSnapshot, ViewTransitionInfo, provideRouter, withInMemoryScrolling, withViewTransitions
} from '@angular/router';

import { routes } from './app.routes';
import { Effects } from './core/effects';
import { Seo } from './core/seo';

/** The route of the page being shown: the deepest route in the snapshot. */
function shownRoute(route: ActivatedRouteSnapshot) {
  while (route.firstChild) route = route.firstChild;
  return route.routeConfig;
}

/**
 * Moving within one page (such as to #contact) must not fade the page out. A new page opens as a widening circle of
 * light from the link that was pressed; without a press to start from (Back and Forward), pages cross-fade.
 */
function onViewTransitionCreated({ transition, from, to }: ViewTransitionInfo): void {
  const root = inject(DOCUMENT).documentElement;
  let done: () => void;
  if (shownRoute(from) === shownRoute(to)) {
    root.classList.add('vt-instant');
    done = () => root.classList.remove('vt-instant');
  } else {
    const origin = inject(Effects).transitionOrigin();
    if (!origin) return;
    root.style.setProperty('--vt-x', `${Math.round(origin.x)}px`);
    root.style.setProperty('--vt-y', `${Math.round(origin.y)}px`);
    root.classList.add('vt-reveal');
    done = () => {
      root.classList.remove('vt-reveal');
      root.style.removeProperty('--vt-x');
      root.style.removeProperty('--vt-y');
      if (!root.getAttribute('style')) root.removeAttribute('style');
    };
  }
  transition.finished.then(done, done);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => { inject(Seo).init(); }),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated })
    )
  ]
};
