// Read-only YouTube Data API v3 client for the video sync. It needs only an API key and uses the
// cheap list endpoints (1 quota unit per request), never search.list (100 units per request).

const API = 'https://www.googleapis.com/youtube/v3/';
const MAX_PAGES = 200;

export class YouTubeError extends Error {
  constructor(message, status = 0, reason = '') {
    super(message);
    this.name = 'YouTubeError';
    this.status = status;
    this.reason = reason;
  }
}

/** Seconds in an ISO 8601 duration such as "PT1H2M3S"; 0 for live streams and unknown values. */
export function parseDuration(value) {
  const match = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value ?? '');
  if (!match) return 0;
  const [weeks, days, hours, minutes, seconds] = match.slice(1).map((part) => Number(part ?? 0));
  return Math.round(((weeks * 7 + days) * 24 + hours) * 3600 + minutes * 60 + seconds);
}

/** A UTC time such as "2026-04-11T13:30:00Z", or '' when the value is missing or invalid. */
export function utcTime(value) {
  const time = value ? new Date(value) : null;
  return time && !Number.isNaN(time.getTime()) ? time.toISOString().replace(/\.\d{3}Z$/, 'Z') : '';
}

/** The fields the sync uses from a videos.list item. */
export function toVideo(item) {
  const snippet = item.snippet ?? {};
  const status = item.status ?? {};
  const player = item.player ?? {};
  return {
    id: item.id,
    title: String(snippet.title ?? '').trim(),
    description: String(snippet.description ?? ''),
    channel: snippet.channelId ?? '',
    publishedAt: utcTime(snippet.publishedAt),
    startedAt: utcTime(item.liveStreamingDetails?.actualStartTime),
    live: snippet.liveBroadcastContent ?? 'none',
    duration: parseDuration(item.contentDetails?.duration),
    privacy: status.privacyStatus ?? 'public',
    uploadStatus: status.uploadStatus ?? 'processed',
    embeddable: status.embeddable !== false,
    portrait: Number(player.embedHeight) > Number(player.embedWidth),
  };
}

export function createYouTubeClient({ apiKey, fetch = globalThis.fetch, baseUrl = API, timeoutMs = 30_000 }) {
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set');
  let requests = 0;
  const hideKey = (text) => String(text ?? '').split(apiKey).join('***');

  async function list(resource, params) {
    const url = new URL(resource, baseUrl);
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(name, String(value));
    }
    url.searchParams.set('key', apiKey);
    requests += 1;
    let response;
    try {
      response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const why = error?.name === 'TimeoutError' ? `no answer within ${timeoutMs / 1000} seconds` : error?.cause?.message ?? error?.message;
      throw new YouTubeError(`YouTube ${resource}.list could not be reached: ${hideKey(why)}`);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body?.error;
      const reason = detail?.errors?.[0]?.reason ?? detail?.status ?? '';
      const message = hideKey(detail?.message ?? response.statusText).replace(/<[^>]*>/g, '');
      throw new YouTubeError(`YouTube ${resource}.list failed with ${response.status}${reason ? ` (${reason})` : ''}: ${message}`, response.status, reason);
    }
    if (!body || typeof body !== 'object') throw new YouTubeError(`YouTube ${resource}.list did not return JSON`, response.status);
    return body;
  }

  return {
    /** Requests made so far; each one costs 1 unit of the 10,000-unit daily quota. */
    get requests() {
      return requests;
    },

    /** Map of channel ID to its name and uploads playlist. Unknown channels are left out. */
    async channels(ids) {
      const body = await list('channels', { part: 'contentDetails,snippet', id: ids.join(',') });
      const found = new Map();
      for (const item of body.items ?? []) {
        found.set(item.id, { name: item.snippet?.title ?? '', uploads: item.contentDetails?.relatedPlaylists?.uploads ?? '' });
      }
      return found;
    },

    /** Every video ID in a playlist, in playlist order and without repeats. */
    async playlistVideoIds(playlistId) {
      const ids = new Set();
      let pageToken;
      for (let page = 0; page < MAX_PAGES; page++) {
        const body = await list('playlistItems', { part: 'contentDetails', playlistId, maxResults: 50, pageToken });
        for (const item of body.items ?? []) {
          const id = item.contentDetails?.videoId;
          if (id) ids.add(id);
        }
        pageToken = body.nextPageToken;
        if (!pageToken) return [...ids];
      }
      throw new YouTubeError(`Playlist ${playlistId} has more than ${MAX_PAGES * 50} videos, so it was not read`);
    },

    /** Details for the given video IDs, 50 per request. Private and deleted videos are not returned. */
    async videos(ids) {
      const found = [];
      for (let start = 0; start < ids.length; start += 50) {
        const body = await list('videos', {
          part: 'snippet,contentDetails,status,liveStreamingDetails,player',
          id: ids.slice(start, start + 50).join(','),
          // Asking for a player size makes YouTube report the video's shape, which identifies Shorts.
          maxWidth: 480,
        });
        for (const item of body.items ?? []) found.push(toVideo(item));
      }
      return found;
    },
  };
}
