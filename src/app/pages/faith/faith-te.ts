import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';


@Component({
  selector: 'haf-faith-te',
  imports: [SiteHeader, SiteFooter],
  
  templateUrl: './faith-te.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class FaithTeluguPage {



}
