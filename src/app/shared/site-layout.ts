import { Component, computed, effect, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PageContext } from '../core/page-context';

@Component({
  selector: 'haf-site-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }',
  host: {
    '(window:scroll)': 'updateScroll()',
    '(document:click)': 'handleClick($event)',
    '(document:keydown.escape)': 'closeMenu()'
  }
})
export class SiteHeader {
  readonly context = inject(PageContext);
  readonly menuOpen = signal(false);
  readonly dropdownOpen = signal(false);
  readonly transparent = signal(window.scrollY > 100);
  readonly navigationBackground = computed(() => this.transparent()
    ? 'rgba(255, 255, 255, 0.95)'
    : 'linear-gradient(135deg, #1a1f3c 0%, #2c4a7c 50%, #1a1f3c 100%)');

  constructor() {
    effect(() => {
      this.dropdownOpen.set(['origin', 'faith', 'chosen'].includes(this.context.kind()));
      this.menuOpen.set(false);
    });
  }

  updateScroll(): void { this.transparent.set(window.scrollY > 100); }
  toggleMenu(): void { this.menuOpen.update(open => !open); }
  closeMenu(): void { this.menuOpen.set(false); }

  toggleDropdown(event: Event): void {
    event.preventDefault();
    this.dropdownOpen.update(open => !open);
  }

  handleClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.main-nav, .menu-toggle') || target.closest('.main-nav a:not(.dropdown-toggle)')) {
      this.closeMenu();
    }
  }
}

@Component({
  selector: 'haf-site-footer',
  templateUrl: './footer.html',
  preserveWhitespaces: true,
  styleUrl: './footer.css'
})
export class SiteFooter {
  readonly context = inject(PageContext);
  readonly copy = computed(() => this.context.language() === 'te' ? {
    contact: 'సంప్రదించండి',
    email: 'ఇమెయిల్',
    connect: 'మమ్మల్ని అనుసరించండి',
    youtube: 'YouTubeలో పరిశుద్ధ సైనిక సహవాసం',
    location: 'మా స్థానం',
    mapTitle: 'మా చర్చి స్థానం: హెచ్.ఏ.ఎఫ్. చర్చి, మండవల్లి',
    directions: 'Google Mapsలో దారి చూడండి'
  } : {
    contact: 'Contact Us',
    email: 'Email',
    connect: 'Connect With Us',
    youtube: 'Holy Army Fellowship on YouTube',
    location: 'Our Location',
    mapTitle: 'Map showing our location: H.A.F Church Mandavalli',
    directions: 'Get directions on Google Maps'
  });
}