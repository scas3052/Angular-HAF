import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { VideoCatalog, VideoSection, VideoSectionToggle, VideoSearch, VideoCategory, VideoCard } from '../../features/videos';
import { sections } from './videos-en.data';

@Component({
  selector: 'haf-videos-en',
  imports: [SiteHeader, SiteFooter, VideoCatalog, VideoSection, VideoSectionToggle, VideoSearch, VideoCategory, VideoCard],
  
  templateUrl: './videos-en.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class VideosEnglishPage {

  readonly sections = sections;

}
