import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YouTubeError, createYouTubeClient, parseDuration, toVideo, utcTime } from './youtube.mjs';

const KEY = 'AIza-test-key';
const MAIN = 'UC3GpmL_SvIIMygJErxq_XcA';

/** A client whose requests are answered by handle(url, index): a Response, or { status, body } sent as JSON. */
function fakeYouTube(handle) {
  const urls = [];
  const fetch = async (address) => {
    const url = new URL(address);
    urls.push(url);
    const reply = handle(url, urls.length - 1);
    return reply instanceof Response ? reply : Response.json(reply.body, { status: reply.status ?? 200 });
  };
  return { client: createYouTubeClient({ apiKey: KEY, fetch }), urls };
}

const failing = (error) => createYouTubeClient({ apiKey: KEY, timeoutMs: 30_000, fetch: async () => Promise.reject(error) });

test('parseDuration reads ISO 8601 durations', () => {
  assert.equal(parseDuration('PT1H2M3S'), 3723);
  assert.equal(parseDuration('PT59S'), 59);
  assert.equal(parseDuration('PT15M'), 900);
  assert.equal(parseDuration('P1DT1S'), 86401);
  assert.equal(parseDuration('PT1.6S'), 2);
  assert.equal(parseDuration('P0D'), 0, 'live streams');
  assert.equal(parseDuration(undefined), 0);
  assert.equal(parseDuration('1:02:03'), 0);
});

test('utcTime gives whole seconds in UTC', () => {
  assert.equal(utcTime('2026-11-08T19:56:15Z'), '2026-11-08T19:56:15Z');
  assert.equal(utcTime('2026-11-09T01:26:15.250+05:30'), '2026-11-08T19:56:15Z');
  assert.equal(utcTime(undefined), '');
  assert.equal(utcTime('not a time'), '');
});

test('toVideo keeps the fields the sync uses and spots vertical videos', () => {
  const item = {
    id: 'ShortVideo1',
    snippet: { title: '  కలవరం #shorts ', description: 'Short message', channelId: MAIN, publishedAt: '2026-11-08T19:56:15Z', liveBroadcastContent: 'none' },
    contentDetails: { duration: 'PT58S' },
    status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: true },
    player: { embedHtml: '<iframe></iframe>', embedWidth: '270', embedHeight: '480' },
  };
  assert.deepEqual(toVideo(item), {
    id: 'ShortVideo1',
    title: 'కలవరం #shorts',
    description: 'Short message',
    channel: MAIN,
    publishedAt: '2026-11-08T19:56:15Z',
    startedAt: '',
    live: 'none',
    duration: 58,
    privacy: 'public',
    uploadStatus: 'processed',
    embeddable: true,
    portrait: true,
  });
  const live = toVideo({
    id: 'LiveVideo01',
    snippet: { liveBroadcastContent: 'live' },
    liveStreamingDetails: { actualStartTime: '2026-11-14T05:53:24Z' },
    contentDetails: { duration: 'P0D' },
    status: { embeddable: false },
    player: { embedWidth: 480, embedHeight: 270 },
  });
  assert.deepEqual([live.startedAt, live.live, live.duration, live.embeddable, live.portrait], ['2026-11-14T05:53:24Z', 'live', 0, false, false]);
  assert.equal(toVideo({ id: 'NoPlayer001' }).portrait, false, 'no player size means not vertical');
});

test('channels gives each channel name and uploads playlist', async () => {
  const { client, urls } = fakeYouTube(() => ({
    body: { items: [{ id: MAIN, snippet: { title: 'Holy Army Fellowship' }, contentDetails: { relatedPlaylists: { uploads: 'UU3GpmL_SvIIMygJErxq_XcA' } } }] },
  }));
  const found = await client.channels([MAIN, 'UCmissing']);
  assert.deepEqual([...found], [[MAIN, { name: 'Holy Army Fellowship', uploads: 'UU3GpmL_SvIIMygJErxq_XcA' }]]);
  const [url] = urls;
  assert.equal(url.origin + url.pathname, 'https://www.googleapis.com/youtube/v3/channels');
  assert.deepEqual(Object.fromEntries(url.searchParams), { part: 'contentDetails,snippet', id: `${MAIN},UCmissing`, key: KEY });
  assert.equal(client.requests, 1);
});

test('playlistVideoIds follows every page and drops repeats', async () => {
  const pages = [
    { items: [{ contentDetails: { videoId: 'a' } }, { contentDetails: { videoId: 'b' } }], nextPageToken: 'P2' },
    { items: [{ contentDetails: { videoId: 'b' } }, { contentDetails: {} }, { contentDetails: { videoId: 'c' } }] },
  ];
  const { client, urls } = fakeYouTube((_url, index) => ({ body: pages[index] }));
  assert.deepEqual(await client.playlistVideoIds('PLfastsun'), ['a', 'b', 'c']);
  assert.deepEqual(urls.map((url) => url.searchParams.get('pageToken')), [null, 'P2']);
  assert.equal(urls[0].searchParams.get('maxResults'), '50');
  assert.equal(urls[0].searchParams.get('playlistId'), 'PLfastsun');

  const endless = fakeYouTube(() => ({ body: { items: [], nextPageToken: 'again' } }));
  await assert.rejects(endless.client.playlistVideoIds('PLloop'), { message: 'Playlist PLloop has more than 10000 videos, so it was not read' });
});

test('videos asks for 50 IDs at a time with a player size', async () => {
  const ids = Array.from({ length: 120 }, (_, index) => `video${String(index).padStart(6, '0')}`);
  const { client, urls } = fakeYouTube((url) => ({ body: { items: url.searchParams.get('id').split(',').map((id) => ({ id, snippet: { title: id } })) } }));
  const videos = await client.videos(ids);
  assert.deepEqual(videos.map((video) => video.id), ids);
  assert.deepEqual(urls.map((url) => url.searchParams.get('id').split(',').length), [50, 50, 20]);
  assert.equal(urls[0].searchParams.get('part'), 'snippet,contentDetails,status,liveStreamingDetails,player');
  assert.equal(urls[0].searchParams.get('maxWidth'), '480');
  assert.deepEqual(await client.videos([]), []);
  assert.equal(client.requests, 3);
});

test('errors say what failed without showing the key', async () => {
  const quota = fakeYouTube(() => ({
    status: 403,
    body: { error: { code: 403, message: `You have exceeded your <a href="/youtube/v3/getting-started#quota">quota</a>. key=${KEY}`, errors: [{ reason: 'quotaExceeded' }] } },
  }));
  await assert.rejects(quota.client.channels([MAIN]), (error) => {
    assert.ok(error instanceof YouTubeError);
    assert.equal(error.message, 'YouTube channels.list failed with 403 (quotaExceeded): You have exceeded your quota. key=***');
    assert.deepEqual([error.status, error.reason], [403, 'quotaExceeded']);
    return true;
  });
  const missing = fakeYouTube(() => ({ status: 404, body: { error: { message: 'Playlist not found.', errors: [{ reason: 'playlistNotFound' }] } } }));
  await assert.rejects(missing.client.playlistVideoIds('PLgone'), { status: 404, message: 'YouTube playlistItems.list failed with 404 (playlistNotFound): Playlist not found.' });
  const gateway = fakeYouTube(() => new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }));
  await assert.rejects(gateway.client.videos(['a']), { status: 502, message: 'YouTube videos.list failed with 502: Bad Gateway' });
  const html = fakeYouTube(() => new Response('<html>Sign in</html>', { status: 200 }));
  await assert.rejects(html.client.channels([MAIN]), { message: 'YouTube channels.list did not return JSON' });
});

test('network problems and a missing key are reported clearly', async () => {
  const dns = new TypeError('fetch failed', { cause: new Error(`getaddrinfo ENOTFOUND www.googleapis.com (key=${KEY})`) });
  await assert.rejects(failing(dns).videos(['a']), { message: 'YouTube videos.list could not be reached: getaddrinfo ENOTFOUND www.googleapis.com (key=***)' });
  const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  await assert.rejects(failing(timeout).channels([MAIN]), { message: 'YouTube channels.list could not be reached: no answer within 30 seconds' });
  assert.throws(() => createYouTubeClient({ apiKey: '' }), { message: 'YOUTUBE_API_KEY is not set' });
});
