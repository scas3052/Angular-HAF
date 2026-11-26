// Builds the website's video library from YouTube, the settings in content/videos/config.json and
// the fixes in content/videos/overrides.json. scripts/sync-videos.mjs runs it; the tests call it
// with a fake YouTube client.

import { VIDEO_KEYS, validateLibrary, formatLibrary } from './schema.mjs';
import { createCategorizer, parseDate, localDate } from './categorize.mjs';
import { createMatcher } from './matcher.mjs';

export { describeReport, commitMessage, headline } from './report.mjs';

const DAY_MS = 86_400_000;
const AUTOMATIC = new Set(['rule', 'learned', 'ai']);
const VIA = {
  section: 'only category in its section',
  shorts: 'Shorts length and shape',
  title: 'title keywords',
  playlist: 'YouTube playlist',
  description: 'description keywords',
};

/** Single spaces only, so spacing changes on YouTube are not treated as new titles. */
export const collapse = (text) => String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();

const realIds = (overrides) => Object.entries(overrides.videos).filter(([id]) => !id.startsWith('$'));
const pinnedIds = (overrides) => realIds(overrides).filter(([, fix]) => fix.pin).map(([id]) => id);
const entry = (fields) => Object.fromEntries(VIDEO_KEYS.map((key) => [key, fields[key]]));
const changedKeys = (before, after) => VIDEO_KEYS.filter((key) => key !== 'id' && before[key] !== after[key]);

/** The library file contents for the given videos (a Map of section key to videos). */
export function buildLibrary(config, videosBySection) {
  return {
    version: 1,
    settings: { pageSize: config.display.pageSize, newBadgeDays: config.display.newBadgeDays },
    sections: config.sections.map((section) => ({
      key: section.key,
      title: section.title,
      icon: section.icon,
      search: section.search,
      all: section.all,
      categories: section.categories.map((category) => ({
        key: category.key,
        label: category.label,
        includeInAll: category.includeInAll ?? true,
      })),
      videos: videosBySection.get(section.key) ?? [],
    })),
  };
}

/** Pinned videos first (in overrides.json order), then newest first. Videos without a publish time keep their order at the end. */
export function sortVideos(videos, pins = []) {
  const rank = new Map(pins.map((id, index) => [id, index]));
  return videos
    .map((video, index) => ({ video, index }))
    .sort((a, b) => {
      const pinA = rank.has(a.video.id);
      const pinB = rank.has(b.video.id);
      if (pinA || pinB) return pinA && pinB ? rank.get(a.video.id) - rank.get(b.video.id) : pinA ? -1 : 1;
      const timeA = a.video.published;
      const timeB = b.video.published;
      if (timeA !== timeB) {
        if (!timeA) return 1;
        if (!timeB) return -1;
        return timeA < timeB ? 1 : -1;
      }
      return a.index - b.index;
    })
    .map(({ video }) => video);
}

/** What YouTube knows: video details, playlist membership and every video ID worth checking. */
async function fetchOnline({ config, youtube, known, report, log }) {
  const channels = await youtube.channels(config.channels.map((channel) => channel.id));
  const uploads = [];
  for (const channel of config.channels) {
    const found = channels.get(channel.id);
    if (!found?.uploads) {
      throw new Error(`YouTube did not return the channel "${channel.name}" (${channel.id}). Check its ID in content/videos/config.json.`);
    }
    const ids = await youtube.playlistVideoIds(found.uploads);
    log(`${channel.name}: ${ids.length} uploads`);
    if (!ids.length) report.warnings.push(`YouTube listed no uploads for the channel "${channel.name}".`);
    uploads.push(...ids);
  }
  if (!uploads.length) {
    throw new Error('YouTube listed no uploads for any channel, which usually means a YouTube problem. Nothing was changed; the next run will try again.');
  }

  const memberOf = new Map();
  for (const playlist of config.playlists) {
    let ids;
    try {
      ids = await youtube.playlistVideoIds(playlist.id);
    } catch (error) {
      if (error?.status !== 404 && error?.reason !== 'playlistNotFound') throw error;
      report.warnings.push(`The playlist "${playlist.name}" (${playlist.id}) was not found on YouTube. Remove it from content/videos/config.json if it was deleted.`);
      continue;
    }
    log(`Playlist ${playlist.name}: ${ids.length} videos`);
    for (const id of ids) {
      if (!memberOf.has(id)) memberOf.set(id, new Set());
      memberOf.get(id).add(playlist.key);
    }
  }

  // Videos already on the site come first so their order is the starting point; a Set drops repeats.
  const candidates = new Set([...known, ...uploads, ...memberOf.keys()]);
  const details = new Map();
  for (const video of await youtube.videos([...candidates])) details.set(video.id, video);
  log(`Details for ${details.size} of ${candidates.size} videos`);
  return { details, memberOf, candidates };
}

/** The YouTube fields of a saved video, for offline runs. */
const offlineItem = (saved) => ({
  id: saved.id,
  title: saved.title,
  description: '',
  channel: saved.channel,
  publishedAt: saved.published,
  startedAt: '',
  live: 'none',
  duration: saved.duration,
  privacy: 'public',
  uploadStatus: 'processed',
  embeddable: saved.embeddable,
  portrait: saved.short,
});

/** Why a new video should wait, or '' when it can be added. */
function waitReason(item, fix) {
  if (item.uploadStatus === 'uploaded') return 'still processing on YouTube';
  if (item.uploadStatus !== 'processed') return `upload ${item.uploadStatus} on YouTube`;
  if (item.live === 'live') return 'live right now; it is added after the stream ends';
  if (item.live === 'upcoming') return 'scheduled stream that has not started yet';
  if (item.privacy !== 'public' && !fix.category) return `${item.privacy} on YouTube (add it in overrides.json to show it anyway)`;
  return '';
}

/** An override, else the speaker already saved for this category, else the one named in the title or set for the category. */
function pickSpeaker({ fix, saved, category, title, categorizer }) {
  if (fix.speaker !== undefined) return fix.speaker;
  if (saved?.category === category && (saved.source === 'seed' || saved.speaker)) return saved.speaker;
  return categorizer.speaker(title, category);
}

/**
 * An override, else the saved date, else a date written in the title, else the day the stream
 * started or the video was published (in the church's time zone). A date in the title that is
 * after the upload is an announcement, so the upload day is used instead.
 */
function pickDate({ fix, saved, title, item, timeZone }) {
  if (fix.date !== undefined) return fix.date;
  if (saved && (saved.source === 'seed' || saved.date)) return saved.date;
  const published = localDate(item.publishedAt, timeZone);
  const written = parseDate(title);
  if (written.length === 10) {
    const latest = published && localDate(new Date(Date.parse(item.publishedAt) + DAY_MS).toISOString(), timeZone);
    if (!latest || written <= latest) return written;
  } else if (written.length === 7 && (!published || written < published.slice(0, 7))) {
    return written;
  }
  return localDate(item.startedAt, timeZone) || published;
}

/**
 * First pass: an override, a hand-picked category from the old site, or the rules. Rules are tried
 * again on videos sorted automatically, so rule changes in config.json reach them. Returns null
 * when the similar-title matcher or the AI helper has to decide.
 */
function firstChoice({ fix, saved, sectionKey, video, categorizer, sectionOf }) {
  if (fix.category) return { category: fix.category, source: 'manual', how: 'overrides.json' };
  const valid = Boolean(saved) && sectionOf.get(saved.category) === sectionKey;
  if (valid && saved.source === 'seed') return { category: saved.category, source: 'seed', how: 'kept' };
  const decided = categorizer.decide(video, sectionKey);
  if (decided) return { category: decided.category, source: 'rule', how: VIA[decided.via] ?? decided.via };
  if (valid && AUTOMATIC.has(saved.source) && !categorizer.excluded(video, sectionKey).has(saved.category)) {
    return { category: saved.category, source: saved.source, how: 'kept' };
  }
  return null;
}

/** Second pass for videos the rules could not place: similar titles, then the AI helper, then the fallback category. */
async function secondPass({ config, section, pending, decided, categorizer, ai, report, memberOf }) {
  const skip = new Set([section.fallbackCategory, config.shorts.category]);
  const training = decided
    .filter((job) => ['seed', 'manual', 'rule'].includes(job.source) && !skip.has(job.category))
    .map(({ title, category }) => ({ title, category }));
  // Words in a title say what a message is about, not who preached it, so word matches only give topic categories.
  const wordCategories = section.categories.filter((category) => !category.speaker && !skip.has(category.key)).map((category) => category.key);
  const matcher = createMatcher(training, { ...config.matcher, wordCategories });
  const waiting = [];
  for (const job of pending) {
    const match = matcher.match(job.title);
    if (match && !job.excluded.has(match.category)) {
      const how = match.via === 'series' ? 'same series as earlier videos' : `title words like earlier videos (${Math.round(match.confidence * 100)}%)`;
      Object.assign(job, { category: match.category, source: 'learned', how });
    } else {
      waiting.push(job);
    }
  }

  if (waiting.length && ai && section.categories.length > 1) {
    const categories = section.categories
      .filter((category) => category.key !== config.shorts.category)
      .map((category) => ({
        key: category.key,
        label: category.label.en,
        speaker: category.speaker,
        words: config.rules.filter((rule) => rule.category === category.key).flatMap((rule) => rule.keywords ?? []),
      }));
    const shown = new Map();
    const examples = training.filter(({ category }) => {
      const count = shown.get(category) ?? 0;
      shown.set(category, count + 1);
      return count < config.ai.examplesPerCategory;
    });
    const channelNames = new Map(config.channels.map((channel) => [channel.id, channel.name]));
    const playlistNames = new Map(config.playlists.map((playlist) => [playlist.key, playlist.name]));
    const items = waiting.map((job) => ({
      id: job.id,
      title: job.title,
      description: job.item.description,
      duration: job.item.duration,
      channel: channelNames.get(job.item.channel) ?? '',
      playlists: [...(memberOf.get(job.id) ?? [])].map((key) => playlistNames.get(key)),
    }));
    const result = await ai.classify(items, { categories, examples, fallback: section.fallbackCategory });
    report.warnings.push(...result.warnings);
    for (const job of waiting) {
      const answer = result.decisions.get(job.id);
      if (answer && !job.excluded.has(answer)) Object.assign(job, { category: answer, source: 'ai', how: 'AI helper' });
    }
  }

  for (const job of waiting) {
    if (!job.category) Object.assign(job, { category: section.fallbackCategory, source: 'fallback', how: 'nothing matched, so the fallback category' });
  }
}

/**
 * Returns { library, report, changed }. Throws (so nothing is written) when YouTube fails, when
 * too many videos would disappear at once, or when the result does not pass validateLibrary.
 * Offline runs make no network calls: they re-apply config.json and overrides.json to the saved videos.
 */
export async function syncLibrary({ config, overrides, library, youtube = null, ai = null, offline = false, allowShrink = false, log = () => {} }) {
  const categorizer = createCategorizer(config);
  const report = { added: [], removed: [], updated: [], skipped: [], warnings: [], requests: { youtube: 0, ai: 0 } };
  const sectionOf = new Map(config.sections.flatMap((section) => section.categories.map((category) => [category.key, section.key])));
  const previous = new Map();
  for (const section of library?.sections ?? []) {
    for (const video of section.videos ?? []) previous.set(video.id, { video, section: section.key });
  }
  const fixes = new Map(realIds(overrides));
  const extra = [...fixes].filter(([, fix]) => fix.category && !fix.hide).map(([id]) => id);

  let details = new Map();
  let memberOf = new Map();
  let candidates;
  if (offline) {
    candidates = new Set(previous.keys());
    for (const id of extra) {
      if (!previous.has(id)) report.warnings.push(`overrides.json adds ${id}, which can only be fetched online; the next online run adds it.`);
    }
  } else {
    ({ details, memberOf, candidates } = await fetchOnline({ config, youtube, known: [...previous.keys(), ...extra], report, log }));
  }

  const jobs = [];
  for (const id of candidates) {
    const fix = fixes.get(id) ?? {};
    const saved = previous.get(id);
    if (fix.hide) {
      if (saved) report.removed.push({ id, title: saved.video.title, reason: 'hidden in overrides.json', hidden: true });
      continue;
    }
    const item = offline ? offlineItem(saved.video) : details.get(id);
    if (!item) {
      if (saved) report.removed.push({ id, title: saved.video.title, reason: 'deleted or made private on YouTube' });
      else if (fix.category) report.warnings.push(`overrides.json adds ${id}, but YouTube did not return it (deleted, private or a wrong ID).`);
      continue;
    }
    if (!saved) {
      const reason = waitReason(item, fix);
      if (reason) {
        report.skipped.push({ id, title: collapse(item.title), reason });
        continue;
      }
    }
    const title = fix.title ?? (offline ? saved.video.title : collapse(item.title));
    const video = { ...item, title, playlists: memberOf.get(id) ?? new Set() };
    let sectionKey = fix.category ? sectionOf.get(fix.category) : '';
    if (!sectionKey && saved && sectionOf.get(saved.video.category) === saved.section) sectionKey = saved.section;
    if (!sectionKey) sectionKey = categorizer.section(video);
    const job = { id, item, saved: saved?.video, fix, sectionKey, title, video };
    Object.assign(job, firstChoice({ fix, saved: job.saved, sectionKey, video, categorizer, sectionOf }));
    if (!job.category) job.excluded = categorizer.excluded(video, sectionKey);
    jobs.push(job);
  }

  for (const section of config.sections) {
    const inSection = jobs.filter((job) => job.sectionKey === section.key);
    const pending = inSection.filter((job) => !job.category);
    if (!pending.length) continue;
    const decided = inSection.filter((job) => job.category);
    await secondPass({ config, section, pending, decided, categorizer, ai: offline ? null : ai, report, memberOf });
  }

  const bySection = new Map(config.sections.map((section) => [section.key, []]));
  for (const job of jobs) {
    const { id, item, saved, fix, title, category, source, how } = job;
    const next = entry({
      id,
      title,
      speaker: pickSpeaker({ fix, saved, category, title, categorizer }),
      date: pickDate({ fix, saved, title, item, timeZone: config.timeZone }),
      published: item.publishedAt,
      duration: item.duration,
      category,
      source,
      embeddable: item.embeddable,
      short: offline ? saved.short : categorizer.isShort(item),
      channel: item.channel,
    });
    bySection.get(job.sectionKey).push(next);
    if (!saved) {
      report.added.push({ id, title, section: job.sectionKey, category, source, how });
    } else {
      const fields = changedKeys(saved, next);
      if (fields.length) report.updated.push({ id, title, fields, from: saved.category, to: category, how });
    }
  }

  const pins = pinnedIds(overrides);
  const listed = new Set(jobs.map((job) => job.id));
  for (const id of pins) {
    if (!listed.has(id)) report.warnings.push(`overrides.json pins ${id}, but that video is not on the site.`);
  }

  const lost = report.removed.filter((item) => !item.hidden);
  if (previous.size && lost.length > config.safety.maxShrink * previous.size && !allowShrink) {
    const examples = lost.slice(0, 10).map((item) => `\n  - ${item.title} (${item.id})`).join('');
    throw new Error(
      `${lost.length} of the ${previous.size} videos on the site would be removed, more than the ` +
        `${Math.round(config.safety.maxShrink * 100)}% safety limit, so nothing was changed.${examples}\n` +
        'If they really were deleted or made private, run the "Sync YouTube videos" workflow by hand with ' +
        '"allow_shrink" ticked, or run: npm run videos:sync -- --allow-shrink',
    );
  }

  for (const [key, videos] of bySection) bySection.set(key, sortVideos(videos, pins));
  const next = validateLibrary(buildLibrary(config, bySection));
  report.requests.youtube = youtube?.requests ?? 0;
  report.requests.ai = ai?.requests ?? 0;
  let before = '';
  try {
    before = library ? formatLibrary(library) : '';
  } catch {
    // An unreadable old library is simply replaced.
  }
  return { library: next, report, changed: before !== formatLibrary(next) };
}
