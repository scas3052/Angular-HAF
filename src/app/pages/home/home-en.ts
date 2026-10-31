import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteHeader, SiteFooter } from '../../shared/site-layout';
import { CalendarAction } from '../../features/calendar-action';

@Component({
  selector: 'haf-home-en',
  imports: [RouterLink, SiteHeader, SiteFooter, CalendarAction],
  
  templateUrl: './home-en.html',
  preserveWhitespaces: true,
  styles: ':host { display: contents; }'
})
export class HomeEnglishPage {



}
