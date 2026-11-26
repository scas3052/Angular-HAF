import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCategorizer, keywordPattern, localDate, normalize, parseDate } from './categorize.mjs';

const config = JSON.parse(readFileSync(join(import.meta.dirname, '../../content/videos/config.json'), 'utf8'));
const categorizer = createCategorizer(config);
const MAIN = 'UC3GpmL_SvIIMygJErxq_XcA';
const WORSHIP = 'UCR4CXEKKcoNFxKcpshyV0Cg';

const video = (title, extra = {}) => ({ title, description: '', duration: 1800, portrait: false, channel: MAIN, playlists: new Set(), ...extra });
const decide = (title, extra) => categorizer.decide(video(title, extra), 'messages');

test('normalize drops punctuation, symbols and invisible characters', () => {
  assert.equal(normalize('Bro. M. Abraham || Short-message'), 'bro m abraham short message');
  assert.equal(normalize('ఓదార్పు\u200c  || Song'), 'ఓదార్పు song');
});

test('keywords match at the start of a word only', () => {
  const pattern = keywordPattern(['Retreat']);
  assert.ok(pattern.test(normalize('Youth Retreats 2025')));
  assert.ok(!pattern.test(normalize('Pretreat')));
  assert.equal(keywordPattern([]), null);
});

test('title keywords place English and Telugu messages', () => {
  const cases = [
    ['Testimony of Bro Joseph Raj (Amalapuram) //Holy army fellowship mandavalli', 'testimonies'],
    ['పూలగంప || Poolagampa || Episode -1 || Telugu Christian Real Story || Holy Army Fellowship', 'ai'],
    ['YOUTH MEETING DAY-3(MORNING) || 17th October 2026 || Holy Army Fellowship Mandavalli', 'retreats'],
    ['Second Saturday Fasting Prayer 10 October 2026 || Holy Army Fellowship Mandavalli', 'special'],
    ['SUNDAY SERVICE 08 NOV 2026| Holy Army Fellowship Mandavalli', 'sunday'],
    ['ఆదివారపు ఆరాధన //   10-3-2024', 'sunday'],
    ['అబ్రహం అయ్యగారి జ్ఞాపకార్ధ కూటం 2022/08/15', 'abraham'],
    ['విశ్వాసం || Bro Abraham Garu Short message || Telugu Christian Short Message', 'abraham'],
  ];
  for (const [title, category] of cases) assert.deepEqual(decide(title), { category, via: 'title' }, title);
});

test('rules are tried in config order', () => {
  assert.equal(decide('Testimony of Bro Isaiah || Sunday Service').category, 'testimonies');
});

test('exclude words rule a category out', () => {
  assert.equal(decide('బుధవారం ఉపవాస ప్రార్థన'), null);
  assert.equal(decide('Wednesday Fasting Prayer'), null);
  assert.deepEqual(categorizer.excluded(video('Wednesday Fasting Prayer'), 'messages'), new Set(['special']));
  assert.deepEqual(categorizer.excluded(video('Sunday Service'), 'messages'), new Set());
});

test('the title wins over playlists, and playlists win over the description', () => {
  const inAbrahamPlaylist = { playlists: new Set(['abraham']), description: 'Testimony of Bro Isaiah' };
  assert.deepEqual(decide('Youth Meeting Day 1', inAbrahamPlaylist), { category: 'retreats', via: 'title' });
  assert.deepEqual(decide('కలవరం', inAbrahamPlaylist), { category: 'abraham', via: 'playlist' });
  assert.deepEqual(decide('కలవరం', { description: 'Testimony of Bro Isaiah' }), { category: 'testimonies', via: 'description' });
  assert.equal(decide('కలవరం', { description: `${'x'.repeat(300)} Testimony of Bro Isaiah` }), null);
  assert.equal(decide('Old Memories'), null);
});

test('a section with one category needs no rules', () => {
  assert.deepEqual(categorizer.decide(video('anything at all'), 'songs'), { category: 'songs', via: 'section' });
});

test('the section comes from the channel, then playlists, then title words', () => {
  assert.equal(categorizer.section(video('Old Memories', { channel: WORSHIP })), 'songs');
  assert.equal(categorizer.section(video('Live worship', { playlists: new Set(['songs']) })), 'songs');
  assert.equal(categorizer.section(video('ఓదార్పు || Telugu Christian Song 2026')), 'songs');
  assert.equal(categorizer.section(video('గగన తారలే పాట')), 'songs');
  assert.equal(categorizer.section(video('దేవుని మాట పాటించుట')), 'messages');
  assert.equal(categorizer.section(video('SUNDAY SERVICE 08 NOV 2026')), 'messages');
});

test('Shorts need a short length and a vertical shape or a #shorts tag', () => {
  assert.deepEqual(decide('కలవరం', { duration: 45, portrait: true }), { category: 'shorts', via: 'shorts' });
  assert.equal(decide('Faith #shorts', { duration: 180 }).category, 'shorts');
  assert.equal(decide('Faith', { duration: 45, description: 'Watch now #Short' }).category, 'shorts');
  assert.equal(decide('Faith #shortsermon', { duration: 45 }), null);
  assert.equal(decide('Faith', { duration: 45 }), null);
  assert.equal(decide('Faith', { duration: 181, portrait: true }), null);
  assert.equal(decide('Faith', { duration: 0, portrait: true }), null);
  assert.equal(categorizer.decide(video('Song', { duration: 45, portrait: true }), 'songs').category, 'songs');
});

test('speakers come from the title first, then the category', () => {
  assert.equal(categorizer.speaker('Sis Rani Abraham || Bro Abraham Garu', 'abraham'), 'Sis. M. Rani Abraham');
  assert.equal(categorizer.speaker('విశ్వాసం || Bro Abraham Garu Short message', 'other'), 'Bro. M. Abraham');
  assert.equal(categorizer.speaker('ఉపవాస ప్రార్థన', 'rani'), 'Sis. M. Rani Abraham');
  assert.equal(categorizer.speaker('SUNDAY SERVICE 08 NOV 2026', 'sunday'), '');
});

test('parseDate reads the date formats used in the channel titles', () => {
  const cases = [
    ['SUNDAY SERVICE 08 NOV 2026| Holy Army Fellowship Mandavalli', '2026-11-08'],
    ['Second Saturday Service || 14th November 2026 || Holy Army Fellowship Mandavalli', '2026-11-14'],
    ['Retreat || 26th - 28th Dec 2025', '2025-12-26'],
    ['Prayer || April 11, 2026', '2026-04-11'],
    ['అబ్రహం అయ్యగారి జ్ఞాపకార్ధ కూటం 2022/08/15', '2022-08-15'],
    ['ఆదివారపు ఆరాధన //   10-3-2024', '2024-03-10'],
    ['Service 04-25-2026', '2026-04-25'],
    ['Prayer 09 09 2023', '2023-09-09'],
    ['దైవజనులు అబ్రహం అయ్యగారితో బ్రదర్ మోషే కి ఉన్న అనుబంధం || 2018 Aug 15', '2018-08-15'],
    ['దైవజనులైన అబ్రహం అయ్యగారి జ్ఞాపకార్ధ కూడిక 2023 || August 15th', '2023-08-15'],
    ['జ్ఞాపకార్ధ కూటం 15 ఆగస్టు 2023', '2023-08-15'],
    ['ఆరాధన || ముఖ్యకేంద్రమునందు || Oct 2020', '2020-10'],
    ['Marpu', ''],
    ['Day 1 2 2026', ''],
    ['Service 31-02-2026', ''],
  ];
  for (const [title, date] of cases) assert.equal(parseDate(title), date, title);
  assert.equal(parseDate('Day 1 2 2026', { allowYear: true }), '2026');
  assert.equal(parseDate('Room 1234', { allowYear: true }), '');
});

test('localDate gives the calendar day in the church time zone', () => {
  assert.equal(localDate('2026-11-08T19:56:15Z', 'Asia/Kolkata'), '2026-11-09');
  assert.equal(localDate('2026-11-14T05:53:24Z', 'Asia/Kolkata'), '2026-11-14');
  assert.equal(localDate('', 'Asia/Kolkata'), '');
  assert.equal(localDate('not a time', 'Asia/Kolkata'), '');
});
