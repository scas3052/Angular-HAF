import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { TestimoniesState, TestimonyCard } from '../../features/testimonies';
import { stories } from './stories-en';

@Component({
  selector: 'haf-testimonies-en',
  imports: [SiteHeader, SiteFooter, TestimonyCard],
  
  templateUrl: './testimonies-en.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class TestimoniesEnglishPage extends TestimoniesState {
  constructor() { super(); this.stories.set(stories); }


}
