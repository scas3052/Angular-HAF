import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';


@Component({
  selector: 'haf-faith-en',
  imports: [SiteHeader, SiteFooter],
  
  templateUrl: './faith-en.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class FaithEnglishPage {



}
