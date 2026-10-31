import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { VideoCatalog, VideoSection, VideoSectionToggle, VideoSearch, VideoCategory, VideoCard } from '../../features/videos';
import { sections } from './videos-te.data';

@Component({
  selector: 'haf-videos-te',
  imports: [SiteHeader, SiteFooter, VideoCatalog, VideoSection, VideoSectionToggle, VideoSearch, VideoCategory, VideoCard],
  
  templateUrl: './videos-te.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class VideosTeluguPage {

  readonly sections = sections;

}
