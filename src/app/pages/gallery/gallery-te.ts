import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { GalleryState } from '../../features/gallery';

@Component({
  selector: 'haf-gallery-te',
  imports: [SiteHeader, SiteFooter],
  
  templateUrl: './gallery-te.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class GalleryTeluguPage extends GalleryState {



}
