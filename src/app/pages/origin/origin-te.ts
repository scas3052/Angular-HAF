import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { Timeline } from '../../features/timeline';

@Component({
  selector: 'haf-origin-te',
  imports: [SiteHeader, SiteFooter, Timeline],
  
  templateUrl: './origin-te.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class OriginTeluguPage {



}
