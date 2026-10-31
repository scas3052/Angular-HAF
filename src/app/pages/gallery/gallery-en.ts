import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { GalleryState } from '../../features/gallery';

@Component({
  selector: 'haf-gallery-en',
  imports: [SiteHeader, SiteFooter],
  
  templateUrl: './gallery-en.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class GalleryEnglishPage extends GalleryState {



}
