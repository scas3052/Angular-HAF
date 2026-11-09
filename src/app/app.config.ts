import { DOCUMENT } from '@angular/common';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  ActivatedRouteSnapshot, ViewTransitionInfo, provideRouter, withInMemoryScrolling, withViewTransitions
} from '@angular/router';

import { routes } from './app.routes';
import { Seo } from './core/seo';

/** The route of the page being shown: the deepest route in the snapshot. */
function shownRoute(route: ActivatedRouteSnapshot) {
  while (route.firstChild) route = route.firstChild;
  return route.routeConfig;
}

/** Pages cross-fade into each other, but moving within one page (such as to #contact) must not fade the page out. */
function onViewTransitionCreated({ transition, from, to }: ViewTransitionInfo): void {
  if (shownRoute(from) !== shownRoute(to)) return;
  const root = inject(DOCUMENT).documentElement;
  root.classList.add('vt-instant');
  const done = () => root.classList.remove('vt-instant');
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
