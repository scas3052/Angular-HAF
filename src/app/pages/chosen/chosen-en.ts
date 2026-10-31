import { Component } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { Chapter, ChapterGroup, ChapterToggle, AudioPlayer } from '../../features/chapters';

@Component({
  selector: 'haf-chosen-en',
  imports: [SiteHeader, SiteFooter, ChapterGroup, Chapter, ChapterToggle, AudioPlayer],
  
  templateUrl: './chosen-en.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class ChosenEnglishPage {



}
