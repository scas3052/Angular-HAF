import { Component, inject } from '@angular/core';

import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { PrayerForm, PrayerState, PrayerToast } from '../../features/prayer-form';
import { copy } from './prayer-te.data';

@Component({
  selector: 'haf-prayer-request-te',
  imports: [SiteHeader, SiteFooter, PrayerForm, PrayerToast],
  providers: [PrayerState],
  templateUrl: './prayer-request-te.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class PrayerRequestTeluguPage {


  readonly prayer = inject(PrayerState);
  readonly copy = copy;
}
