import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { Chapter, ChapterGroup, ChapterToggle, AudioPlayer } from '../../features/chapters';

@Component({
  selector: 'haf-chosen-te',
  imports: [SiteHeader, SiteFooter, ChapterGroup, Chapter, ChapterToggle],
  
  templateUrl: './chosen-te.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class ChosenTeluguPage {



}
