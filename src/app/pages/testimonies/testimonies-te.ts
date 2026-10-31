import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { TestimoniesState, TestimonyCard } from '../../features/testimonies';
import { stories } from './stories-te';

@Component({
  selector: 'haf-testimonies-te',
  imports: [SiteHeader, SiteFooter, TestimonyCard],
  
  templateUrl: './testimonies-te.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class TestimoniesTeluguPage extends TestimoniesState {
  constructor() { super(); this.stories.set(stories); }


}
