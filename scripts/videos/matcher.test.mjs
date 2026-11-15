import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMatcher, evaluateMatcher, seriesKeys, titleTokens } from './matcher.mjs';

const read = (path) => JSON.parse(readFileSync(join(import.meta.dirname, '../..', path), 'utf8'));
const times = (count, make) => Array.from({ length: count }, (_, index) => make(index));

const examples = [
  ...times(4, (i) => ({ title: `Sunday Service worship mandavalli ${i}`, category: 'sunday' })),
  ...times(4, (i) => ({ title: `Second Saturday fasting prayer ${i}`, category: 'special' })),
  ...times(4, (i) => ({ title: `Wednesday prayer Rani ${i}`, category: 'rani' })),
];

test('titleTokens drops numbers and adds stems for long Telugu words', () => {
  assert.deepEqual(titleTokens('Sunday Service 08 Nov'), ['sunday', 'service', 'nov']);
  assert.deepEqual(titleTokens('ఆదివారపు ఆరాధన 2024'), ['ఆదివారపు', 'ఆదివ~', 'ఆరాధన', 'ఆరాధ~']);
});

test('seriesKeys keeps the title parts that can name a series', () => {
  assert.deepEqual(seriesKeys('విశ్వాసం || Bro Abraham Garu Short message || Telugu Christian Short Message'), [
    'bro abraham garu short message',
    'telugu christian short message',
  ]);
  assert.deepEqual(seriesKeys('Second Saturday Service || 14th November 2026 || Holy Army Fellowship Mandavalli'), [
    'second saturday service',
    'holy army fellowship mandavalli',
  ]);
});

test('a series needs two earlier videos, all in one category', () => {
  const short = (title) => ({ title: `${title} || Bro Abraham Garu Short message`, category: 'abraham' });
  const query = 'ప్రేమ || Bro Abraham Garu Short message';
  assert.equal(createMatcher([short('కలవరం')]).match(query), null);
  assert.deepEqual(createMatcher([short('కలవరం'), short('విశ్వాసం')]).match(query), { category: 'abraham', confidence: 1, via: 'series' });
  const mixed = [short('కలవరం'), short('విశ్వాసం'), { ...short('ఓదార్పు'), category: 'rani' }];
  assert.equal(createMatcher(mixed).match(query), null);
});

test('word matches answer only when confident', () => {
  const matcher = createMatcher(examples);
  const match = matcher.match('Sunday Service worship');
  assert.equal(match.category, 'sunday');
  assert.equal(match.via, 'words');
  assert.ok(match.confidence >= 0.9);
  assert.equal(matcher.match('Sunday fasting'), null, 'two categories fit equally well');
  assert.equal(matcher.match('Sunday morning'), null, 'only one known word');
  assert.equal(matcher.match('Old Memories'), null);
});

test('word matches never name a speaker category, but a series can', () => {
  const open = createMatcher(examples);
  const topics = createMatcher(examples, { wordCategories: ['sunday', 'special'] });
  assert.equal(open.match('Rani Wednesday prayer meeting').category, 'rani');
  assert.equal(topics.match('Rani Wednesday prayer meeting'), null);
  assert.deepEqual(topics.match('Wednesday prayer Rani 5'), { category: 'rani', confidence: 1, via: 'series' });
});

test('Telugu stems match other endings of the same word', () => {
  const telugu = [
    ...times(3, () => ({ title: 'ఆదివారం ఆరాధన', category: 'sunday' })),
    ...times(3, () => ({ title: 'ఉపవాస ప్రార్థన', category: 'special' })),
  ];
  const match = createMatcher(telugu).match('ఆదివారపు ఆరాధనలో');
  assert.equal(match?.category, 'sunday');
  assert.equal(match.via, 'words');
});

test('leave-one-out on the committed library stays precise', () => {
  const config = read('content/videos/config.json');
  const library = read('src/app/pages/videos/video-library.json');
  for (const section of config.sections.filter((section) => section.categories.length > 1)) {
    const skip = new Set([section.fallbackCategory, config.shorts.category]);
    const sorted = library.sections
      .find((saved) => saved.key === section.key)
      .videos.filter((video) => ['seed', 'manual', 'rule'].includes(video.source) && !skip.has(video.category))
      .map(({ title, category }) => ({ title, category }));
    const wordCategories = section.categories.filter((category) => !category.speaker && !skip.has(category.key)).map((category) => category.key);
    const result = evaluateMatcher(sorted, { ...config.matcher, wordCategories });
    assert.ok(result.precision >= 0.95, `${section.key}: precision ${result.precision.toFixed(3)}, mistakes ${JSON.stringify(result.mistakes)}`);
    assert.ok(result.coverage >= 0.5, `${section.key}: coverage ${result.coverage.toFixed(3)}`);
  }
  assert.deepEqual(evaluateMatcher([], {}), { examples: 0, answered: 0, correct: 0, precision: 1, coverage: 0, mistakes: [] });
});
