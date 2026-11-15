import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLibrary, collapse, commitMessage, describeReport, sortVideos, syncLibrary } from './sync.mjs';

const config = JSON.parse(readFileSync(new URL('../../content/videos/config.json', import.meta.url), 'utf8'));
const MAIN = 'UC3GpmL_SvIIMygJErxq_XcA';
const WORSHIP = 'UCR4CXEKKcoNFxKcpshyV0Cg';
const OTHER_CHANNEL = `UC${'x'.repeat(22)}`;
const noFixes = { videos: {} };
const uploadsOf = (channelId) => `UU${channelId.slice(2)}`;

/** A video as the YouTube client returns it. */
const yt = (id, title, fields = {}) => ({
  id,
  title,
  description: '',
  channel: MAIN,
  publishedAt: '2026-11-08T05:00:00Z',
  startedAt: '',
  live: 'none',
  duration: 2400,
  privacy: 'public',
  uploadStatus: 'processed',
  embeddable: true,
  portrait: false,
  ...fields,
});

/** A video as video-library.json stores it. */
const saved = (id, title, fields = {}) => ({
  id,
  title,
  speaker: '',
  date: '2026-11-08',
  published: '2026-11-08T05:00:00Z',
  duration: 2400,
  category: 'other',
  source: 'rule',
  embeddable: true,
  short: false,
  channel: MAIN,
  ...fields,
});

const libraryOf = (sections) => buildLibrary(config, new Map(Object.entries(sections)));
const idsOf = (library, key) => library.sections.find((section) => section.key === key).videos.map((video) => video.id);

/** A YouTube client that answers from memory. A playlist set to null is missing; one set to an Error throws it. */
function fakeYouTube({ uploads = {}, playlists = {}, videos = [], missingChannel = '' } = {}) {
  const details = new Map(videos.map((video) => [video.id, video]));
  const playlistKeys = new Map(config.playlists.map((playlist) => [playlist.id, playlist.key]));
  return {
    requests: 0,
    asked: [],
    async channels(ids) {
      this.requests++;
      return new Map(ids.filter((id) => id !== missingChannel).map((id) => [id, { uploads: uploadsOf(id) }]));
    },
    async playlistVideoIds(playlistId) {
      this.requests++;
      if (playlistId.startsWith('UU')) return uploads[`UC${playlistId.slice(2)}`] ?? [];
      const found = playlists[playlistKeys.get(playlistId)];
      if (found === null) throw Object.assign(new Error('playlist not found'), { status: 404, reason: 'playlistNotFound' });
      if (found instanceof Error) throw found;
      return found ?? [];
    },
    async videos(ids) {
      this.requests++;
      this.asked.push(...ids);
      return ids.filter((id) => details.has(id)).map((id) => details.get(id));
    },
  };
}

/** An online run where `videos` are the channels' uploads and `others` can only be found by their ID. */
async function sync(videos, { library = libraryOf({}), overrides = noFixes, others = [], playlists = {}, ai = null, allowShrink = false } = {}) {
  const uploads = {};
  for (const video of videos) (uploads[video.channel] ??= []).push(video.id);
  const youtube = fakeYouTube({ uploads, playlists, videos: [...videos, ...others] });
  const result = await syncLibrary({ config, overrides, library, youtube, ai, allowShrink });
  const entries = new Map(
    result.library.sections.flatMap((section) => section.videos.map((video) => [video.id, { ...video, section: section.key }])),
  );
  return { ...result, youtube, entries };
}

test('new uploads are sorted by the rules and dated, with speakers from the title or the category', async () => {
  const videos = [
    yt('NE1bI4qel68', 'Second Saturday Service || 14th November 2026 || Holy Army Fellowship Mandavalli', {
      publishedAt: '2026-11-14T09:30:00Z',
    }),
    yt('test0000002', 'Daily bread', { publishedAt: '2026-11-12T05:00:00Z', duration: 45, portrait: true }),
    yt('G0Z41LxD-nA', 'Walk with God', { publishedAt: '2026-11-11T05:00:00Z', duration: 300 }),
    yt('test0000001', 'Prayer is power || Bro Abraham Garu Short message', { publishedAt: '2026-11-10T05:00:00Z', duration: 600 }),
    yt('test0000003', 'Worship and Word', {
      publishedAt: '2026-11-09T05:00:00Z',
      description: 'Sunday Service at Holy Army Fellowship Mandavalli',
    }),
    yt('3padIvO57Zk', 'SUNDAY SERVICE 08 NOV 2026| Holy Army Fellowship Mandavalli', { publishedAt: '2026-11-08T19:56:15Z' }),
    yt('lLSS-mOKGrc', 'evaru nannu cheyi vidachina song', { channel: WORSHIP, publishedAt: '2026-11-01T12:00:00Z' }),
  ];
  const playlists = { short: ['G0Z41LxD-nA'] };
  const { library, report, changed, entries } = await sync(videos, { playlists });

  assert.equal(changed, true);
  assert.deepEqual(
    report.added.map((item) => `${item.id} ${item.section}/${item.category} ${item.source}: ${item.how}`),
    [
      'NE1bI4qel68 messages/special rule: title keywords',
      'test0000002 messages/shorts rule: Shorts length and shape',
      'G0Z41LxD-nA messages/abraham rule: YouTube playlist',
      'test0000001 messages/abraham rule: title keywords',
      'test0000003 messages/sunday rule: description keywords',
      '3padIvO57Zk messages/sunday rule: title keywords',
      'lLSS-mOKGrc songs/songs rule: only category in its section',
    ],
  );
  assert.deepEqual(idsOf(library, 'messages'), ['NE1bI4qel68', 'test0000002', 'G0Z41LxD-nA', 'test0000001', 'test0000003', '3padIvO57Zk']);
  assert.deepEqual(idsOf(library, 'songs'), ['lLSS-mOKGrc']);
  assert.deepEqual(Object.fromEntries([...entries].map(([id, video]) => [id, [video.date, video.speaker, video.short]])), {
    'NE1bI4qel68': ['2026-11-14', '', false],
    test0000002: ['2026-11-12', '', true],
    'G0Z41LxD-nA': ['2026-11-11', 'Bro. M. Abraham', false],
    test0000001: ['2026-11-10', 'Bro. M. Abraham', false],
    test0000003: ['2026-11-09', '', false],
    '3padIvO57Zk': ['2026-11-08', '', false],
    'lLSS-mOKGrc': ['2026-11-01', '', false],
  });
  assert.equal(entries.get('lLSS-mOKGrc').channel, WORSHIP);
  assert.deepEqual(report.warnings, []);
  // 1 channels call, 2 upload lists, 6 playlists from config.json and 1 batch of video details.
  assert.deepEqual(report.requests, { youtube: 10, ai: 0 });
  assert.equal(commitMessage(report).split('\n')[0], 'Sync YouTube videos: 7 new');

  const again = await sync(videos, { library, playlists });
  assert.equal(again.changed, false);
  assert.deepEqual([again.report.added, again.report.updated, again.report.removed], [[], [], []]);
});

test('dates come from the title when it names the day, else from when the video went live in India', async () => {
  const { entries } = await sync([
    yt('Zim4m5d2pwo', 'Second Saturday Service Invitation || 14th November 2026', { publishedAt: '2026-10-25T07:21:41Z' }),
    yt('date0000001', 'Youth Meeting November 2026', { publishedAt: '2026-12-02T05:00:00Z' }),
    yt('date0000002', 'Youth Meeting November 2026', { publishedAt: '2026-11-20T10:00:00Z' }),
    yt('date0000003', 'Sunday Service Live', { publishedAt: '2026-11-05T05:00:00Z', startedAt: '2026-11-08T04:00:00Z' }),
    yt('date0000004', 'Evening Worship', { publishedAt: '2026-11-08T19:56:15Z' }),
    yt('date0000005', 'Sunday Service 09 Nov 2026', { publishedAt: '2026-11-08T05:00:00Z' }),
  ]);
  assert.deepEqual(Object.fromEntries([...entries].map(([id, video]) => [id, video.date])), {
    Zim4m5d2pwo: '2026-10-25', // the title announces a later service, so the upload day is used
    date0000001: '2026-11', // uploaded after the month named in the title
    date0000002: '2026-11-20', // uploaded during the month named in the title
    date0000003: '2026-11-08', // the day the stream started
    date0000004: '2026-11-09', // 01:26 on 9 November in India
    date0000005: '2026-11-09', // a title date up to one day after the upload is trusted
  });
});

test('similar titles, then the AI helper, then the fallback category place what the rules cannot', async () => {
  const calls = [];
  const ai = {
    requests: 0,
    async classify(items, context) {
      this.requests++;
      calls.push({ items, context });
      const decisions = new Map([
        ['auto0000004', 'testimonies'],
        ['auto0000006', 'special'],
      ]);
      return { decisions, warnings: ['AI model x is busy'] };
    },
  };
  const faith = 'Faith || Telugu Christian Short Message || Bro Abraham Garu';
  const hope = 'Hope || Telugu Christian Short Message || Bro Abraham Garu';
  const { entries, report, youtube } = await sync(
    [
      yt('auto0000001', faith),
      yt('auto0000002', hope),
      yt('auto0000003', 'Love || Telugu Christian Short Message'),
      yt('auto0000004', 'How God healed my family', { description: 'A family shares what God has done.' }),
      yt('auto0000005', 'Evening fellowship'),
      yt('auto0000006', 'Wednesday Prayer Meeting'),
    ],
    { playlists: { fastsun: ['auto0000005'] }, ai },
  );

  assert.deepEqual(
    report.added.map((item) => `${item.id} ${item.category} ${item.source}: ${item.how}`),
    [
      'auto0000001 abraham rule: title keywords',
      'auto0000002 abraham rule: title keywords',
      'auto0000003 abraham learned: same series as earlier videos',
      'auto0000004 testimonies ai: AI helper',
      'auto0000005 other fallback: nothing matched, so the fallback category',
      // The AI helper said "special", but the title has one of that rule's exclude words.
      'auto0000006 other fallback: nothing matched, so the fallback category',
    ],
  );
  assert.equal(entries.get('auto0000003').speaker, 'Bro. M. Abraham');
  assert.deepEqual(report.requests, { youtube: 10, ai: 1 });
  assert.ok(report.warnings.includes('AI model x is busy'));
  assert.deepEqual(youtube.asked, ['auto0000001', 'auto0000002', 'auto0000003', 'auto0000004', 'auto0000005', 'auto0000006']);

  assert.equal(calls.length, 1);
  const [{ items, context }] = calls;
  assert.deepEqual(items.map((item) => item.id), ['auto0000004', 'auto0000005', 'auto0000006']);
  assert.deepEqual(items[0], {
    id: 'auto0000004',
    title: 'How God healed my family',
    description: 'A family shares what God has done.',
    duration: 2400,
    channel: 'Holy Army Fellowship',
    playlists: [],
  });
  assert.deepEqual(items[1].playlists, ['Fasting Prayers and Sunday Worship']);
  assert.equal(context.fallback, 'other');
  assert.deepEqual(
    context.categories.map((category) => category.key),
    ['abraham', 'rani', 'special', 'sunday', 'retreats', 'ai', 'testimonies', 'kids', 'other'],
  );
  const byKey = new Map(context.categories.map((category) => [category.key, category]));
  assert.ok(byKey.get('special').words.includes('Second Saturday'));
  assert.equal(byKey.get('abraham').speaker, 'Bro. M. Abraham');
  assert.deepEqual(context.examples, [
    { title: faith, category: 'abraham' },
    { title: hope, category: 'abraham' },
  ]);
});

test('a saved category that the exclude words now rule out is not kept', async () => {
  const title = 'Wednesday Fasting Prayer || బుధవారం ఉపవాస ప్రార్థన';
  const library = libraryOf({ messages: [saved('excl0000001', title, { category: 'special' })] });
  const { report } = await sync([yt('excl0000001', title)], { library });
  assert.deepEqual(report.updated, [
    {
      id: 'excl0000001',
      title,
      fields: ['category', 'source'],
      from: 'special',
      to: 'other',
      how: 'nothing matched, so the fallback category',
    },
  ]);
});

test('new videos wait until YouTube has finished with them, unless overrides.json adds them', async () => {
  const { report } = await sync(
    [
      yt('wait0000001', 'Sunday Service 1', { uploadStatus: 'uploaded' }),
      yt('wait0000002', 'Sunday Service 2', { uploadStatus: 'failed' }),
      yt('wait0000003', 'Sunday Service 3', { live: 'live' }),
      yt('wait0000004', 'Sunday Service 4', { live: 'upcoming' }),
      yt('wait0000005', 'Sunday Service 5', { privacy: 'unlisted' }),
      yt('wait0000006', 'Sunday Service || 08 Nov 2026'),
    ],
    {
      others: [yt('wait0000007', '  Testimony ', { privacy: 'unlisted' })],
      overrides: { videos: { wait0000007: { category: 'testimonies' } } },
    },
  );
  assert.deepEqual(
    report.skipped.map((item) => `${item.id}: ${item.reason}`),
    [
      'wait0000001: still processing on YouTube',
      'wait0000002: upload failed on YouTube',
      'wait0000003: live right now; it is added after the stream ends',
      'wait0000004: scheduled stream that has not started yet',
      'wait0000005: unlisted on YouTube (add it in overrides.json to show it anyway)',
    ],
  );
  assert.deepEqual(report.added, [
    { id: 'wait0000007', title: 'Testimony', section: 'messages', category: 'testimonies', source: 'manual', how: 'overrides.json' },
    { id: 'wait0000006', title: 'Sunday Service || 08 Nov 2026', section: 'messages', category: 'sunday', source: 'rule', how: 'title keywords' },
  ]);
});

test('overrides.json pins videos and replaces their details', async () => {
  const overrides = {
    videos: {
      pins0000001: { pin: true },
      pins0000002: { pin: true, category: 'testimonies', speaker: 'Sis. Mary', title: 'Testimony of Sis. Mary', date: '2026-10' },
      pins0000009: { pin: true },
    },
  };
  const { library, report, entries } = await sync(
    [
      yt('pins0000001', 'Sunday Service', { publishedAt: '2026-11-01T05:00:00Z' }),
      yt('pins0000002', 'Guest message', { publishedAt: '2026-10-25T05:00:00Z' }),
      yt('pins0000003', 'Sunday Service', { publishedAt: '2026-11-08T05:00:00Z' }),
    ],
    { overrides },
  );
  assert.deepEqual(idsOf(library, 'messages'), ['pins0000001', 'pins0000002', 'pins0000003']);
  const { title, speaker, date, category, source } = entries.get('pins0000002');
  assert.deepEqual(
    { title, speaker, date, category, source },
    { title: 'Testimony of Sis. Mary', speaker: 'Sis. Mary', date: '2026-10', category: 'testimonies', source: 'manual' },
  );
  assert.ok(report.warnings.includes('overrides.json pins pins0000009, but that video is not on the site.'));
});

test('overrides.json adds videos from other channels and hides videos', async () => {
  const library = libraryOf({ messages: [saved('adds0000003', 'Sunday Service', { category: 'sunday' })] });
  const overrides = {
    videos: {
      adds0000001: { category: 'songs' },
      adds0000002: { category: 'kids' },
      adds0000003: { hide: true },
      adds0000004: { hide: true },
      adds0000005: { hide: true, category: 'testimonies' },
    },
  };
  const { entries, report, youtube } = await sync([yt('adds0000003', 'Sunday Service'), yt('adds0000004', 'Sunday Service')], {
    library,
    overrides,
    others: [yt('adds0000001', 'Guest choir song', { channel: OTHER_CHANNEL }), yt('adds0000005', 'Testimony')],
  });
  assert.deepEqual([...entries.keys()], ['adds0000001']);
  const added = entries.get('adds0000001');
  assert.deepEqual(
    [added.section, added.category, added.source, added.channel],
    ['songs', 'songs', 'manual', OTHER_CHANNEL],
  );
  assert.deepEqual(report.removed, [{ id: 'adds0000003', title: 'Sunday Service', reason: 'hidden in overrides.json', hidden: true }]);
  assert.ok(
    report.warnings.includes('overrides.json adds adds0000002, but YouTube did not return it (deleted, private or a wrong ID).'),
  );
  assert.ok(!youtube.asked.includes('adds0000005'));
  assert.deepEqual(report.skipped, []);
});

test('a run that would remove more than 10% of the videos stops unless it is allowed', async () => {
  const ids = Array.from({ length: 20 }, (_, index) => `test${String(100 + index).padStart(7, '0')}`);
  const library = libraryOf({ messages: ids.map((id) => saved(id, `Sunday Service ${id}`, { category: 'sunday' })) });
  const firstOf = (count) => ids.slice(0, count).map((id) => yt(id, `Sunday Service ${id}`));

  await assert.rejects(sync(firstOf(17), { library }), (error) => {
    assert.match(
      error.message,
      /^3 of the 20 videos on the site would be removed, more than the 10% safety limit, so nothing was changed\./,
    );
    assert.ok(error.message.includes('\n  - Sunday Service test0000117 (test0000117)'));
    assert.ok(error.message.includes('npm run videos:sync -- --allow-shrink'));
    return true;
  });

  const allowed = await sync(firstOf(17), { library, allowShrink: true });
  assert.deepEqual(
    allowed.report.removed.map((item) => `${item.id}: ${item.reason}`),
    ['test0000117', 'test0000118', 'test0000119'].map((id) => `${id}: deleted or made private on YouTube`),
  );
  assert.equal(allowed.entries.size, 17);

  const two = await sync(firstOf(18), { library });
  assert.equal(two.report.removed.length, 2);

  const hidden = { videos: Object.fromEntries(ids.slice(15).map((id) => [id, { hide: true }])) };
  const hiding = await sync(firstOf(15), { library, overrides: hidden });
  assert.equal(hiding.report.removed.length, 5);
  assert.ok(hiding.report.removed.every((item) => item.hidden));
});

test('videos from the old site keep their hand-picked category, speaker and date but get YouTube details', async () => {
  const wednesday = 'బుధవారం ఉపవాస ప్రార్థన';
  const seed = { source: 'seed', published: '', duration: 0, channel: '' };
  const library = libraryOf({
    messages: [
      saved('eANnSlTfkPc', wednesday, { ...seed, category: 'rani', speaker: 'Sis. M. Rani Abraham', date: '2024-01-03' }),
      saved('seed0000002', 'Sunday Service', { ...seed, category: 'abraham', date: '' }),
    ],
  });
  const { report, entries } = await sync(
    [
      yt('eANnSlTfkPc', 'బుధవారం   ఉపవాస ప్రార్థన ', { publishedAt: '2024-01-03T13:00:00Z', duration: 3600 }),
      yt('seed0000002', 'Sunday Service || Bro Abraham Garu', { embeddable: false }),
    ],
    { library },
  );
  assert.deepEqual(
    report.updated.map((item) => `${item.id} ${item.from} → ${item.to}: ${item.fields.join(' ')}`),
    [
      'eANnSlTfkPc rani → rani: published duration channel',
      'seed0000002 abraham → abraham: title published duration embeddable channel',
    ],
  );
  const kept = entries.get('seed0000002');
  assert.deepEqual([kept.speaker, kept.date, kept.source], ['', '', 'seed']);
  assert.deepEqual(report.added, []);
});

test('an offline run re-applies the settings without contacting YouTube or the AI helper', async () => {
  const blocked = {
    requests: 0,
    channels: () => assert.fail('an offline run must not call YouTube'),
    playlistVideoIds: () => assert.fail('an offline run must not call YouTube'),
    videos: () => assert.fail('an offline run must not call YouTube'),
  };
  const noAi = { requests: 0, classify: () => assert.fail('an offline run must not call the AI helper') };
  const on = (day) => ({ date: `2026-11-${day}`, published: `2026-11-${day}T05:00:00Z` });
  const library = libraryOf({
    songs: [saved('offl0000009', 'evaru nannu cheyi vidachina song', { category: 'songs', channel: WORSHIP, ...on('01') })],
    messages: [
      saved('offl0000001', 'Testimony of Bro. John', { category: 'testimonies', date: '2026-10-01', published: '2026-10-01T05:00:00Z' }),
      saved('offl0000002', 'Sunday Service', { category: 'sunday', ...on('08') }),
      saved('offl0000003', 'Love || Telugu Christian Short Message', {
        category: 'abraham',
        source: 'learned',
        speaker: 'Bro. M. Abraham',
        ...on('07'),
      }),
      saved('offl0000004', 'How God healed my family', { category: 'testimonies', source: 'ai', ...on('06') }),
      saved('offl0000005', 'Happy New Year Greetings', { category: 'other', source: 'fallback', ...on('05') }),
      saved('offl0000006', 'Guest message', { category: 'kids', source: 'manual', ...on('04') }),
      saved('offl0000007', 'Daily bread || Bro Abraham Garu #shorts', {
        category: 'shorts',
        short: true,
        duration: 50,
        speaker: 'Bro. M. Abraham',
        ...on('03'),
      }),
      saved('offl0000008', 'బుధవారం ఉపవాస ప్రార్థన', {
        category: 'rani',
        source: 'seed',
        speaker: 'Sis. M. Rani Abraham',
        date: '',
        published: '',
        duration: 0,
        channel: '',
      }),
    ],
  });
  const overrides = { videos: { offl0000001: { pin: true }, offl0000006: { category: 'kids' } } };
  const run = (fixes) => syncLibrary({ config, overrides: fixes, library, youtube: blocked, ai: noAi, offline: true });

  const same = await run(overrides);
  assert.equal(same.changed, false);
  assert.deepEqual(same.report, { added: [], removed: [], updated: [], skipped: [], warnings: [], requests: { youtube: 0, ai: 0 } });

  const moved = await run({
    videos: { ...overrides.videos, offl0000004: { category: 'kids' }, newvideo001: { category: 'kids' } },
  });
  assert.equal(moved.changed, true);
  assert.deepEqual(moved.report.updated, [
    {
      id: 'offl0000004',
      title: 'How God healed my family',
      fields: ['category', 'source'],
      from: 'testimonies',
      to: 'kids',
      how: 'overrides.json',
    },
  ]);
  assert.deepEqual(moved.report.warnings, [
    'overrides.json adds newvideo001, which can only be fetched online; the next online run adds it.',
  ]);
});

test('new rules in config.json move automatically sorted videos but not hand-picked ones', async () => {
  const cfg = structuredClone(config);
  cfg.rules.find((rule) => rule.category === 'testimonies').keywords.push('Thanksgiving');
  const library = libraryOf({
    messages: [
      saved('rule0000001', 'Thanksgiving Story for Kids', { category: 'kids', source: 'learned' }),
      saved('rule0000002', 'Thanksgiving Service', { category: 'sunday', source: 'ai' }),
      saved('rule0000003', 'Thanksgiving Day greetings', { category: 'other', source: 'fallback' }),
      saved('rule0000004', 'Thanksgiving Meeting', { category: 'retreats', source: 'manual' }),
      saved('rule0000005', 'Thanksgiving prayer', { category: 'rani', source: 'seed', speaker: 'Sis. M. Rani Abraham' }),
    ],
  });
  const overrides = { videos: { rule0000004: { category: 'retreats' } } };
  const { report } = await syncLibrary({ config: cfg, overrides, library, offline: true });
  assert.deepEqual(
    report.updated.map((item) => `${item.id} ${item.from} → ${item.to} (${item.how})`),
    [
      'rule0000001 kids → testimonies (title keywords)',
      'rule0000002 sunday → testimonies (title keywords)',
      'rule0000003 other → testimonies (title keywords)',
    ],
  );
});

test('YouTube problems stop the run or become warnings', async () => {
  const run = (setup) =>
    syncLibrary({ config, overrides: noFixes, library: libraryOf({}), youtube: fakeYouTube(setup) });
  const mainOnly = { uploads: { [MAIN]: ['prob0000001'] }, videos: [yt('prob0000001', 'Sunday Service')] };

  await assert.rejects(run({}), /no uploads for any channel/);
  await assert.rejects(run({ ...mainOnly, missingChannel: WORSHIP }), /did not return the channel "HAF Worship"/);

  const { report } = await run({ ...mainOnly, playlists: { retreat: null } });
  assert.deepEqual(report.warnings, [
    'YouTube listed no uploads for the channel "HAF Worship".',
    'The playlist "Retreat" (PLRPPBi5757oqwrRxO_GVM4_ECO4R5Lgsd) was not found on YouTube. ' +
      'Remove it from content/videos/config.json if it was deleted.',
  ]);

  const quota = Object.assign(new Error('quota exceeded'), { status: 403, reason: 'quotaExceeded' });
  await assert.rejects(run({ ...mainOnly, playlists: { songs: quota } }), (error) => error === quota);
});

test('the run summary and the commit message list what changed, with Markdown escaped', () => {
  const fallbackHow = 'nothing matched, so the fallback category';
  const report = {
    added: [
      {
        id: 'NE1bI4qel68',
        title: 'Second Saturday Service || 14th November 2026',
        section: 'messages',
        category: 'special',
        source: 'rule',
        how: 'title keywords',
      },
      { id: 'rprt0000001', title: 'Evening *live* worship', section: 'messages', category: 'other', source: 'fallback', how: fallbackHow },
    ],
    removed: [{ id: 'rprt0000002', title: 'Old video', reason: 'deleted or made private on YouTube' }],
    updated: [
      {
        id: 'rprt0000003',
        title: 'Wednesday Fasting Prayer',
        fields: ['category', 'source'],
        from: 'special',
        to: 'other',
        how: fallbackHow,
      },
    ],
    skipped: [{ id: 'rprt0000004', title: 'Sunday Service Live', reason: 'live right now; it is added after the stream ends' }],
    warnings: ['AI model x is busy'],
    requests: { youtube: 10, ai: 1 },
  };
  const watch = 'https://www.youtube.com/watch?v=';

  assert.equal(
    describeReport(report, { changed: true }),
    [
      '## YouTube video sync',
      '',
      '**2 new, 1 removed, 1 updated.** The video list was updated.',
      '',
      'YouTube requests: 10 (each costs 1 of the 10,000 free quota units a day). AI requests: 1.',
      '',
      '### New videos (2)',
      '',
      '| Video | Section | Category | Decided by |',
      '| --- | --- | --- | --- |',
      `| [Second Saturday Service \\|\\| 14th November 2026](${watch}NE1bI4qel68) | \`messages\` | \`special\` | title keywords |`,
      `| [Evening \\*live\\* worship](${watch}rprt0000001) | \`messages\` | \`other\` | ${fallbackHow} |`,
      '',
      '### Removed (1)',
      '',
      `- [Old video](${watch}rprt0000002): deleted or made private on YouTube`,
      '',
      '### Updated (1)',
      '',
      `- [Wednesday Fasting Prayer](${watch}rprt0000003): category \`special\` → \`other\` (${fallbackHow}); source`,
      '',
      '### Waiting on YouTube (1)',
      '',
      'These are added automatically once they are ready.',
      '',
      `- [Sunday Service Live](${watch}rprt0000004): live right now; it is added after the stream ends`,
      '',
      '### Warnings (1)',
      '',
      '- AI model x is busy',
      '',
      '1 new video went to the fallback category because nothing else matched. ' +
        'To move one, add its ID to content/videos/overrides.json.',
      '',
    ].join('\n'),
  );
  assert.equal(
    describeReport(report, { changed: true, dryRun: true }).split('\n')[2],
    '**2 new, 1 removed, 1 updated.** Dry run: the video list would change, but nothing was written.',
  );
  assert.equal(
    commitMessage(report),
    [
      'Sync YouTube videos: 2 new, 1 removed, 1 updated',
      '',
      'New:',
      '- Second Saturday Service || 14th November 2026 (special, title keywords)',
      `- Evening *live* worship (other, ${fallbackHow})`,
      '',
      'Removed:',
      '- Old video (deleted or made private on YouTube)',
      '',
      '1 video had details refreshed from YouTube.',
      '',
    ].join('\n'),
  );

  const empty = { added: [], removed: [], updated: [], skipped: [], warnings: [], requests: { youtube: 0, ai: 0 } };
  const many = {
    ...empty,
    added: Array.from({ length: 52 }, (_, index) => ({
      id: `many${String(index).padStart(7, '0')}`,
      title: `Sunday Service ${index}`,
      section: 'messages',
      category: 'sunday',
      source: 'rule',
      how: 'title keywords',
    })),
  };
  assert.ok(describeReport(many, { changed: true }).includes('\n| …and 2 more | | | |\n'));
  assert.ok(commitMessage(many).includes('\n- …and 32 more\n'));

  assert.equal(commitMessage(empty), 'Sync YouTube videos: refresh details\n');
  assert.equal(
    describeReport(empty, { offline: true }),
    [
      '## YouTube video sync',
      '',
      '**No changes.** The video list already matches the settings, so nothing was written. ' +
        'Offline run: YouTube and the AI helper were not contacted.',
      '',
      'YouTube requests: 0 (each costs 1 of the 10,000 free quota units a day). AI requests: 0.',
      '',
    ].join('\n'),
  );
});

test('pinned videos come first, then the newest; titles get single spaces and one Unicode form', () => {
  const at = (id, published) => ({ id, published });
  const videos = [
    at('a', ''),
    at('b', '2026-01-01T05:00:00Z'),
    at('c', ''),
    at('d', '2026-03-01T05:00:00Z'),
    at('e', '2025-01-01T05:00:00Z'),
    at('f', '2026-01-01T05:00:00Z'),
  ];
  assert.deepEqual(
    sortVideos(videos, ['e', 'c']).map((video) => video.id),
    ['e', 'c', 'd', 'b', 'f', 'a'],
  );

  assert.equal(collapse('  Sunday\u00a0 Service\n|| 08 Nov  '), 'Sunday Service || 08 Nov');
  assert.equal(collapse('Cafe\u0301'), 'Caf\u00e9');
  assert.equal(collapse(undefined), '');
});
