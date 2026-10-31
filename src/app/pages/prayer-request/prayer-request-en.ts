import { Component, inject } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { PrayerForm, PrayerState, PrayerToast } from '../../features/prayer-form';
import { copy } from './prayer-en.data';

@Component({
  selector: 'haf-prayer-request-en',
  imports: [SiteHeader, SiteFooter, PrayerForm, PrayerToast],
  providers: [PrayerState],
  templateUrl: './prayer-request-en.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class PrayerRequestEnglishPage {


  readonly prayer = inject(PrayerState);
  readonly copy = copy;
}
