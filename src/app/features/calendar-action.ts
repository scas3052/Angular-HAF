import { Directive, input } from '@angular/core';
import { ServiceKind, serviceDates, serviceSchedule } from './service-schedule';

const calendarDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
const calendarText = (text: string) => text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');

@Directive({ selector: 'button[hafCalendar]', host: { '(click)': 'activate($event)' } })
export class CalendarAction {
  readonly hafCalendar = input.required<'google' | 'download'>();
  readonly calendarService = input.required<ServiceKind>();
  readonly calendarLocation = input('H.A.F Church Mandavalli');

  activate(event: Event): void {
    event.preventDefault();
    const { start, end } = serviceDates(this.calendarService());
    const { title, description } = serviceSchedule[this.calendarService()];
    if (this.hafCalendar() === 'google') {
      const url = new URL('https://calendar.google.com/calendar/render');
      url.search = new URLSearchParams({ action: 'TEMPLATE', text: title,
        details: description, location: this.calendarLocation(),
        dates: `${calendarDate(start)}/${calendarDate(end)}` }).toString();
      window.open(url.toString(), '_blank', 'noopener,noreferrer');
      return;
    }
    if (this.hafCalendar() !== 'download') throw new RangeError(`Unknown calendar action: ${this.hafCalendar()}`);
    const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HAF//Church Services//EN',
      'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${crypto.randomUUID()}@holyarmyfellowship.org`,
      `DTSTAMP:${calendarDate(new Date())}`, `DTSTART:${calendarDate(start)}`, `DTEND:${calendarDate(end)}`,
      `SUMMARY:${calendarText(title)}`, `DESCRIPTION:${calendarText(description)}`,
      `LOCATION:${calendarText(this.calendarLocation())}`, 'URL:https://holyarmyfellowship.org',
      'STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}