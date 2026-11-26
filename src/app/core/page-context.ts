import { DOCUMENT } from '@angular/common';
import { ApplicationRef, Injectable, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, ActivationEnd, ResolveFn, Route, Router } from '@angular/router';
import { filter } from 'rxjs';

interface PreparedPage {
  route: ActivatedRouteSnapshot;
  links: HTMLLinkElement[];
}

@Injectable({ providedIn: 'root' })
export class PageContext {
  private readonly document = inject(DOCUMENT);
  private readonly appRef = inject(ApplicationRef);
  private readonly prepared = new Map<Route | null, PreparedPage>();
  readonly language = signal<'en' | 'te'>('en');
  readonly kind = signal('loading');
  readonly layout = signal<{ header?: string; navigation?: string; footer?: string }>({});

  constructor() {
    // ActivationEnd fires in the same task that swaps components, so the outgoing page never renders with the incoming page's styles or layout.
    inject(Router).events
      .pipe(filter((event): event is ActivationEnd => event instanceof ActivationEnd))
      .subscribe(event => {
        const page = this.prepared.get(event.snapshot.routeConfig);
        if (page) this.apply(page);
      });
  }

  async prepare(route: ActivatedRouteSnapshot): Promise<boolean> {
    const urls = (route.data['styles'] as string[] | undefined ?? []).filter(url => url.startsWith('/'));
    const existing = this.pageLinks();
    const links: HTMLLinkElement[] = [];
    let lastIndex = -1;
    let reusable = true;
    for (const url of urls) {
      const index = existing.findIndex(link => link.getAttribute('href') === url);
      if (reusable && index > lastIndex) {
        links.push(existing[index]);
        lastIndex = index;
      } else {
        // A stylesheet that is already applied is never moved or re-inserted: that would strip its styles from the visible page until it reloads.
        // Once one link is new, later ones are recreated too so the cascade keeps the order declared in the route.
        reusable = false;
        links.push(this.createLink(url));
      }
    }
    await Promise.all(links.map(link => this.loaded(link)));
    this.prepared.set(route.routeConfig, { route, links });
    return true;
  }

  private apply({ route, links }: PreparedPage): void {
    this.prepared.clear();
    for (const link of this.pageLinks()) {
      if (links.includes(link)) this.enable(link);
      else link.remove();
    }
    this.language.set(route.data['language'] ?? 'en');
    this.kind.set(route.data['kind'] ?? 'loading');
    this.layout.set(route.data['layout'] ?? {});
    this.document.documentElement.lang = this.language();
    this.document.body.style.overflow = '';
    // Zoneless change detection is scheduled asynchronously, so without this the browser can paint the new page before its header and navigation render.
    this.appRef.tick();
  }

  private enable(link: HTMLLinkElement): void {
    const sheet = link.sheet;
    if (!sheet) {
      link.removeAttribute('media');
      return;
    }
    // Changing the media attribute makes older Chromium-based browsers (such as many Android phones) download the stylesheet again and
    // show the page unstyled until it arrives, so the loaded sheet's own media list is cleared instead. The attribute keeps saying "print".
    if (sheet.media.length) sheet.media.mediaText = '';
  }

  private pageLinks(): HTMLLinkElement[] {
    return Array.from(this.document.querySelectorAll<HTMLLinkElement>('link[data-page-style]'));
  }

  private createLink(url: string): HTMLLinkElement {
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    // A non-matching media type downloads the stylesheet without applying it; enable() switches it on when the page swaps in.
    // Such downloads default to the lowest priority, which would delay navigation, so it is raised explicitly.
    link.media = 'print';
    link.fetchPriority = 'high';
    link.dataset['pageStyle'] = '';
    this.document.head.append(link);
    return link;
  }

  private loaded(link: HTMLLinkElement): Promise<void> {
    if (link.sheet) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      link.addEventListener('load', () => resolve(), { once: true });
      link.addEventListener('error', () => {
        link.remove();
        reject(new Error(`Unable to load stylesheet: ${link.getAttribute('href')}`));
      }, { once: true });
    });
  }
}

export const preparePage: ResolveFn<boolean> = route => inject(PageContext).prepare(route);