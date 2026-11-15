import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VIDEO_KEYS, formatLibrary, isDate, isVideoId, validateConfig, validateLibrary, validateOverrides } from './schema.mjs';

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const config = JSON.parse(read('content/videos/config.json'));
const overrides = JSON.parse(read('content/videos/overrides.json'));
const libraryText = read('src/app/pages/videos/video-library.json');
const library = JSON.parse(libraryText);
const categoryKeys = config.sections.flatMap((section) => section.categories.map((category) => category.key));

/** The problems listed in the error thrown by run(). */
function problems(run) {
  try {
    run();
  } catch (error) {
    return error.message.split('\n  - ').slice(1);
  }
  assert.fail('expected the check to fail');
}

test('the committed settings and library pass their checks', () => {
  assert.equal(validateConfig(config), config);
  assert.equal(validateOverrides(overrides, config), overrides);
  assert.equal(validateLibrary(library), library);
});

test('the committed library is saved in the format the sync writes', () => {
  const expected = formatLibrary(library);
  assert.ok(libraryText.replace(/\r\n/g, '\n') === expected, 'video-library.json was edited by hand; run "npm run videos:sync -- --offline" to tidy it');
});

test('config mistakes are all listed with where they are', () => {
  const broken = structuredClone(config);
  const at = broken.sections.findIndex((section) => section.key === 'messages');
  const messages = broken.sections[at];
  const again = messages.categories.push({ key: 'sunday', label: { en: 'Sunday again', te: 'ఆదివారం' } }) - 1;
  messages.fallbackCategory = 'others';
  messages.$note = 'Fields starting with $ are notes';
  const rule = broken.rules.findIndex((item) => item.category === 'sunday');
  broken.rules[rule].keywrods = broken.rules[rule].keywords;
  delete broken.rules[rule].keywords;
  broken.timeZone = 'India';
  const found = problems(() => validateConfig(broken));
  assert.deepEqual(found, [
    `sections[${at}].categories[${again}].key "sunday" is used twice`,
    `sections[${at}].fallbackCategory must be one of this section's category keys`,
    `rules[${rule}].keywrods is not a known setting (check the spelling)`,
    `rules[${rule}] needs "keywords" or "playlists"`,
    'timeZone must be a time zone name such as "Asia/Kolkata"',
  ]);
  assert.throws(() => validateConfig(broken), { message: /^content\/videos\/config\.json has 5 problems:\n {2}- / });
});

test('override mistakes name the video and the field', () => {
  const broken = {
    $comment: 'Notes are allowed',
    videos: {
      $example: { category: 'nowhere' },
      QehjvTtkVPU: { category: 'sunday', date: '2026-10-25', pin: true },
      'G0Z41LxD-nA': { category: 'abrahm', hidden: true },
      UDQbq4u2hBw: { date: '25-10-2026', pin: 'yes' },
      'not-an-id': { hide: true },
    },
  };
  assert.deepEqual(problems(() => validateOverrides(broken, config)), [
    'videos.G0Z41LxD-nA.hidden is not a known setting (check the spelling)',
    `videos.G0Z41LxD-nA.category must be one of: ${categoryKeys.join(', ')}`,
    'videos.UDQbq4u2hBw.date must look like "2026-04-11", "2026-04", "2026" or ""',
    'videos.UDQbq4u2hBw.pin must be true or false',
    'videos.not-an-id is not an 11-character YouTube video ID',
  ]);
  assert.throws(() => validateOverrides({ videos: { QehjvTtkVPU: { title: ' ' } } }, config), {
    message: 'content/videos/overrides.json has a problem:\n  - videos.QehjvTtkVPU.title must be non-empty text',
  });
  assert.throws(() => validateOverrides({ video: {} }, config), { message: /"videos" must be an object keyed by YouTube video ID$/ });
});

test('library mistakes are caught before anything is written', () => {
  const broken = structuredClone(library);
  broken.version = 2;
  const at = broken.sections.findIndex((section) => section.key === 'messages');
  const { videos } = broken.sections[at];
  videos[1].category = 'songs';
  videos[2].source = 'guess';
  videos[3].views = 120;
  videos[4].published = '2026-11-08';
  const copy = videos.push({ ...videos[0] }) - 1;
  assert.deepEqual(problems(() => validateLibrary(broken)), [
    'version must be 1',
    `sections[${at}].videos[1].category "songs" is not a category of this section`,
    `sections[${at}].videos[2].source must be one of: seed, manual, rule, learned, ai, fallback`,
    `sections[${at}].videos[3] must have exactly these fields: ${VIDEO_KEYS.join(', ')}`,
    `sections[${at}].videos[4].published must be "" or a UTC time such as "2026-04-11T13:30:00Z"`,
    `sections[${at}].videos[${copy}].id ${videos[0].id} appears more than once`,
  ]);
});

test('isDate and isVideoId accept only real values', () => {
  for (const good of ['', '2026', '2026-02', '2024-02-29', '1900-01-01', '2100-12-31']) assert.equal(isDate(good), true, good);
  for (const bad of ['2026-02-30', '2023-02-29', '2026-13', '2026-00', '2026-1-5', '1899', '2101-01-01', '25-10-2026', '2026-10-25T00:00:00Z', 2026, null]) {
    assert.equal(isDate(bad), false, String(bad));
  }
  assert.equal(isVideoId('G0Z41LxD-nA'), true);
  for (const bad of ['G0Z41LxD-n', 'G0Z41LxD-nAB', 'G0Z41LxD nA', 42]) assert.equal(isVideoId(bad), false, String(bad));
});

test('formatLibrary puts each video on one line in a fixed field order', () => {
  const video = {
    channel: 'UC3GpmL_SvIIMygJErxq_XcA',
    short: false,
    embeddable: true,
    source: 'rule',
    category: 'sunday',
    duration: 5400,
    published: '2026-11-08T19:56:15Z',
    date: '2026-11-08',
    speaker: '',
    title: 'SUNDAY SERVICE 08 NOV 2026| Holy Army Fellowship Mandavalli',
    id: '3padIvO57Zk',
  };
  const small = { version: 1, settings: { pageSize: 24, newBadgeDays: 14 }, sections: [{ key: 'messages', videos: [video, { ...video, id: 'QehjvTtkVPU' }] }, { key: 'songs', videos: [] }] };
  const text = formatLibrary(small);
  assert.ok(text.endsWith('}\n'));
  assert.deepEqual(JSON.parse(text), small);
  const lines = text.split('\n').filter((line) => line.includes('"id":'));
  const ordered = JSON.stringify(Object.fromEntries(VIDEO_KEYS.map((key) => [key, video[key]])));
  assert.deepEqual(lines.map((line) => line.trim()), [`${ordered},`, ordered.replace('3padIvO57Zk', 'QehjvTtkVPU')]);
  assert.match(text, /"videos": \[\]/);
});
