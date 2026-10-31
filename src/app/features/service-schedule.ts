export const serviceSchedule = {
  sunday: {
    title: 'Sunday Service',
    description: 'Weekly Sunday Service at Holy Army Fellowship',
    startMinutes: 10 * 60,
    endMinutes: 13 * 60,
    englishTime: '10:00 AM to 1:00 PM (IST)',
    teluguTime: 'ఉదయం 10:00 నుండి మధ్యాహ్నం 1:00 వరకు (IST)'
  },
  'second-saturday': {
    title: 'Second Saturday Service',
    description: 'Monthly Second Saturday Service at Holy Army Fellowship',
    startMinutes: 9 * 60 + 30,
    endMinutes: 14 * 60 + 30,
    englishTime: '9:30 AM to 2:30 PM (IST)',
    teluguTime: 'ఉదయం 9:30 నుండి మధ్యాహ్నం 2:30 వరకు (IST)'
  }
} as const;

export type ServiceKind = keyof typeof serviceSchedule;

// India has no daylight saving. UTC methods on the shifted date represent the church's wall clock.
const IST_OFFSET_MS = 330 * 60_000;

function secondSaturday(year: number, month: number): Date {
  const day = new Date(Date.UTC(year, month, 1));
  day.setUTCDate(8 + ((6 - day.getUTCDay() + 7) % 7));
  return day;
}

export function serviceDates(service: ServiceKind, now = new Date()): { start: Date; end: Date } {
  if (!Object.hasOwn(serviceSchedule, service)) throw new RangeError(`Unknown church service: ${service}`);
  if (!Number.isFinite(now.getTime())) throw new RangeError('A valid reference date is required.');

  const schedule = serviceSchedule[service];
  const wall = new Date(now.getTime() + IST_OFFSET_MS);
  let day = service === 'sunday'
    ? new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + ((7 - wall.getUTCDay()) % 7)))
    : secondSaturday(wall.getUTCFullYear(), wall.getUTCMonth());
  const at = (minutes: number) => new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, minutes) - IST_OFFSET_MS
  );

  if (at(schedule.startMinutes) < now) {
    if (service === 'sunday') day.setUTCDate(day.getUTCDate() + 7);
    else day = secondSaturday(day.getUTCFullYear(), day.getUTCMonth() + 1);
  }
  return { start: at(schedule.startMinutes), end: at(schedule.endMinutes) };
}
