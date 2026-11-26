// Keyword rules from content/videos/config.json that place a video in a section and a category,
// plus the English and Telugu date parsing used for video titles.

import { isDate } from './schema.mjs';

const LETTER = '[\\p{L}\\p{M}\\p{N}]';
const RULE_DESCRIPTION_CHARS = 300;
const SHORTS_TAG = /(?:^|[^\p{L}\p{M}\p{N}_])#shorts?(?![\p{L}\p{M}\p{N}_])/iu;

/** Lowercase text with punctuation and symbols turned into single spaces, for keyword matching. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern that finds any keyword at the start of a word ("retreat" also finds "retreats"), or null. */
export function keywordPattern(keywords = []) {
  const words = [...new Set(keywords.map(normalize).filter(Boolean))].sort((a, b) => b.length - a.length);
  return words.length ? new RegExp(`(?<!${LETTER})(?:${words.map(escapeRegExp).join('|')})`, 'u') : null;
}

export function createCategorizer(config) {
  const sections = new Map(config.sections.map((section) => [section.key, section]));
  const categories = new Map();
  for (const section of config.sections) {
    for (const category of section.categories) categories.set(category.key, { ...category, section: section.key });
  }
  const channelSections = new Map(config.channels.filter((channel) => channel.section).map((channel) => [channel.id, channel.section]));
  const sectionWords = config.sections.map((section) => ({
    key: section.key,
    include: keywordPattern(section.keywords),
    exclude: keywordPattern(section.exclude),
  }));
  const rules = config.rules.map((rule) => ({
    category: rule.category,
    section: categories.get(rule.category)?.section,
    include: keywordPattern(rule.keywords),
    exclude: keywordPattern(rule.exclude),
    playlists: rule.playlists ?? [],
  }));
  const speakers = config.speakers.map((speaker) => ({ name: speaker.name, pattern: keywordPattern(speaker.aliases) }));

  /** True for YouTube Shorts: short, and either vertical or tagged #shorts. */
  const isShort = (video) => {
    const short = video.duration > 0 && video.duration <= config.shorts.maxSeconds;
    return short && Boolean(video.portrait || SHORTS_TAG.test(video.title) || SHORTS_TAG.test(video.description ?? ''));
  };

  return {
    categories,
    isShort,

    /** The section a video belongs to: from its channel, then its playlists, then its title. */
    section(video) {
      const byChannel = channelSections.get(video.channel);
      if (byChannel) return byChannel;
      for (const playlist of config.playlists) {
        if (playlist.section && video.playlists?.has(playlist.key)) return playlist.section;
      }
      const title = normalize(video.title);
      for (const words of sectionWords) {
        if (words.include?.test(title) && !words.exclude?.test(title)) return words.key;
      }
      return config.defaultSection;
    },

    /**
     * The category decided by the section or the rules, or null when only the learned matcher or
     * the AI helper could decide. Title keywords win over playlists, which win over the description.
     */
    decide(video, sectionKey) {
      const section = sections.get(sectionKey);
      if (section.categories.length === 1) return { category: section.categories[0].key, via: 'section' };
      if (categories.get(config.shorts.category)?.section === sectionKey && isShort(video)) {
        return { category: config.shorts.category, via: 'shorts' };
      }
      const usable = rules.filter((rule) => rule.section === sectionKey);
      const title = normalize(video.title);
      const allowed = usable.filter((rule) => !rule.exclude?.test(title));
      for (const rule of allowed) {
        if (rule.include?.test(title)) return { category: rule.category, via: 'title' };
      }
      for (const rule of allowed) {
        if (rule.playlists.some((key) => video.playlists?.has(key))) return { category: rule.category, via: 'playlist' };
      }
      const description = normalize(String(video.description ?? '').slice(0, RULE_DESCRIPTION_CHARS));
      for (const rule of allowed) {
        if (rule.include?.test(description) && !rule.exclude?.test(description)) return { category: rule.category, via: 'description' };
      }
      return null;
    },

    /** Categories ruled out by the exclude words of their rules, so guesses can respect them too. */
    excluded(video, sectionKey) {
      const title = normalize(video.title);
      return new Set(rules.filter((rule) => rule.section === sectionKey && rule.exclude?.test(title)).map((rule) => rule.category));
    },

    /** The speaker named in the title, else the category's default speaker, else ''. */
    speaker(title, category) {
      const text = normalize(title);
      for (const speaker of speakers) {
        if (speaker.pattern?.test(text)) return speaker.name;
      }
      return categories.get(category)?.speaker ?? '';
    },
  };
}

const MONTHS = [
  ['jan', 'january', 'జనవరి'],
  ['feb', 'february', 'ఫిబ్రవరి'],
  ['mar', 'march', 'మార్చి', 'మార్చ్'],
  ['apr', 'april', 'ఏప్రిల్', 'ఏప్రియల్'],
  ['may', 'మే'],
  ['jun', 'june', 'జూన్'],
  ['jul', 'july', 'జూలై', 'జులై'],
  ['aug', 'august', 'ఆగస్టు', 'ఆగష్టు', 'ఆగస్ట్'],
  ['sep', 'sept', 'september', 'సెప్టెంబర్', 'సెప్టెంబరు'],
  ['oct', 'october', 'అక్టోబర్', 'అక్టోబరు'],
  ['nov', 'november', 'నవంబర్', 'నవంబరు'],
  ['dec', 'december', 'డిసెంబర్', 'డిసెంబరు'],
];
const MONTH_NUMBERS = new Map(MONTHS.flatMap((names, index) => names.map((name) => [name, index + 1])));
const MONTH = `(?<![\\p{L}\\p{M}])(${[...MONTH_NUMBERS.keys()].sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}\\p{M}])\\.?`;
const DAY = '(\\d{1,2})(?:st|nd|rd|th|వ)?';
const SEP = '[\\s.,/-]*';
const YEAR = '(\\d{4})(?!\\d)';
const DATE_PATTERNS = [
  // 11th April 2026, 26th - 28th Dec 2025 (the first day of a range)
  { regex: new RegExp(`(?<!\\d)${DAY}(?:\\s*(?:-|–|to|&|and)\\s*\\d{1,2}(?:st|nd|rd|th|వ)?)?${SEP}${MONTH}${SEP}${YEAR}`, 'iu'), order: 'dmy' },
  // April 11, 2026
  { regex: new RegExp(`${MONTH}${SEP}${DAY}[\\s.,/-]+${YEAR}`, 'iu'), order: 'mdy' },
  // 2026-04-11, 2026/04/11
  { regex: /(?<!\d)(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/u, order: 'ymd' },
  // 11-04-2026, 11.04.2026, 11/04/2026
  { regex: /(?<!\d)(\d{1,2})[-./](\d{1,2})[-./](\d{4})(?!\d)/u, order: 'dmy' },
  // 11 04 2026 (two-digit day and month only, so stray numbers are not mistaken for dates)
  { regex: /(?<!\d)(\d{2}) +(\d{2}) +(\d{4})(?!\d)/u, order: 'dmy' },
  // 2018 Aug 15, 2023 || August 15th
  { regex: new RegExp(`(?<!\\d)(\\d{4})[\\s.,/|-]*${MONTH}${SEP}(\\d{1,2})(?:st|nd|rd|th|వ)?(?!\\d)`, 'iu'), order: 'ymd' },
  // April 2026
  { regex: new RegExp(`${MONTH}${SEP}${YEAR}`, 'iu'), order: 'my' },
];

const pad = (value) => String(value).padStart(2, '0');
const monthOf = (value) => (/^\d+$/.test(value) ? Number(value) : MONTH_NUMBERS.get(value.normalize('NFC').toLowerCase()));

/**
 * The first date written in the text as "YYYY-MM-DD" or "YYYY-MM", or '' when there is none.
 * With allowYear, a bare four-digit year counts too ("YYYY").
 */
export function parseDate(text, { allowYear = false } = {}) {
  const value = String(text ?? '').normalize('NFC');
  for (const { regex, order } of DATE_PATTERNS) {
    const match = regex.exec(value);
    if (!match) continue;
    let [, a, b, c] = match;
    let year, month, day;
    if (order === 'dmy') [day, month, year] = [Number(a), monthOf(b), Number(c)];
    else if (order === 'mdy') [month, day, year] = [monthOf(a), Number(b), Number(c)];
    else if (order === 'ymd') [year, month, day] = [Number(a), monthOf(b), Number(c)];
    else [month, year] = [monthOf(a), Number(b)];
    // 04-25-2026 can only be month-day-year.
    if (order === 'dmy' && /^\d+$/.test(b) && month > 12 && day <= 12) [day, month] = [month, day];
    const date = day === undefined ? `${year}-${pad(month)}` : `${year}-${pad(month)}-${pad(day)}`;
    if (isDate(date)) return date;
  }
  if (allowYear) {
    const year = /(?<!\d)(\d{4})(?!\d)/u.exec(value)?.[1];
    if (year && isDate(year)) return year;
  }
  return '';
}

/** The calendar date ("YYYY-MM-DD") of a UTC time in the given time zone. */
export function localDate(time, timeZone) {
  const instant = new Date(time);
  if (!time || Number.isNaN(instant.getTime())) return '';
  const format = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(format.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
