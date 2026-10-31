import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { legacyPageUrls } from '../page-urls';

const pagePaths = new Set(Object.values(legacyPageUrls));
const languageCodes: Record<string, string> = { english: 'en', telugu: 'te' };
const shareImagePath = '/src/images/bg/Logo%20Png.png';

/** Keeps the description, sharing tags, canonical URL and language alternates in step with the current page. */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly defaultDescription = this.meta.getTag('name="description"')?.content ?? '';

  init(): void {
    this.addStructuredData();
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => this.update());
  }

  private addStructuredData(): void {
    if (this.document.head.querySelector('script[type="application/ld+json"]')) return;
    const origin = this.document.location.origin;
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Church',
      name: 'Holy Army Fellowship',
      alternateName: ['H.A.F Church Mandavalli', 'పరిశుద్ధ సైనిక సహవాసం'],
      url: origin + '/',
      logo: origin + shareImagePath,
      image: origin + shareImagePath,
      email: 'Haf@holyarmyfellowship.org',
      sameAs: ['https://www.youtube.com/@holyarmyfellowship4726'],
      address: { '@type': 'PostalAddress', addressLocality: 'Mandavalli', addressRegion: 'Andhra Pradesh', addressCountry: 'IN' },
      geo: { '@type': 'GeoCoordinates', latitude: 16.511435, longitude: 81.156065 }
    });
    this.document.head.append(script);
  }

  private update(): void {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const description: string = route.data['description'] ?? this.defaultDescription;
    const title = route.title ?? this.document.title;
    const path = this.router.url.split(/[?#]/)[0].replace(/(.)\/$/, '$1');
    const origin = this.document.location.origin;

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: origin + path });
    this.meta.updateTag({ property: 'og:image', content: origin + shareImagePath });
    this.meta.updateTag({ name: 'twitter:image', content: origin + shareImagePath });
    this.meta.updateTag({ property: 'og:locale', content: route.data['language'] === 'te' ? 'te_IN' : 'en_IN' });
    this.setCanonical(origin + path);
    this.setAlternates(path, origin);
  }

  private setCanonical(href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.append(link);
    }
    link.href = href;
  }

  private setAlternates(path: string, origin: string): void {
    for (const link of Array.from(this.document.head.querySelectorAll('link[rel="alternate"][hreflang]'))) link.remove();
    const [, language, page] = path.split('/');
    const other = language === 'english' ? 'telugu' : language === 'telugu' ? 'english' : null;
    if (!other || !pagePaths.has(`${other}/${page}`)) return;
    for (const [hreflang, href] of [[languageCodes[language], origin + path], [languageCodes[other], `${origin}/${other}/${page}`], ['x-default', `${origin}/language`]]) {
      const link = this.document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hreflang;
      link.href = href;
      this.document.head.append(link);
    }
  }
}
