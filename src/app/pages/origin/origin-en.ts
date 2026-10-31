import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { Timeline } from '../../features/timeline';

@Component({
  selector: 'haf-origin-en',
  imports: [SiteHeader, SiteFooter, Timeline],
  
  templateUrl: './origin-en.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class OriginEnglishPage {



}
