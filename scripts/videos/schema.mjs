// Checks the hand-edited video settings and the generated library, and formats the library so
// every video stays on one line (small, readable diffs in the sync commits).

export const VIDEO_KEYS = Object.freeze([
  'id', 'title', 'speaker', 'date', 'published', 'duration', 'category', 'source', 'embeddable', 'short', 'channel',
]);
export const SOURCES = Object.freeze(['seed', 'manual', 'rule', 'learned', 'ai', 'fallback']);
export const OVERRIDE_FIELDS = Object.freeze(['category', 'speaker', 'title', 'date', 'hide', 'pin']);

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[\w-]{22}$/;
const PLAYLIST_ID = /^[\w-]{12,64}$/;
const KEY = /^[a-z0-9][a-z0-9-]*$/;
const ICON = /^fa-[a-z0-9-]+$/;
const PUBLISHED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isKey = (value) => typeof value === 'string' && KEY.test(value);
const isCount = (value, min = 0) => Number.isInteger(value) && value >= min;
const isNumberIn = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export const isVideoId = (value) => typeof value === 'string' && VIDEO_ID.test(value);

/** True for '', 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' when the parts form a real calendar date. */
export function isDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2] ?? 1), Number(match[3] ?? 1)];
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && year <= 2100 && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function collector(file) {
  const problems = [];
  return {
    add: (path, message) => {
      problems.push(`${path} ${message}`);
    },
    done() {
      if (!problems.length) return;
      const count = problems.length === 1 ? 'a problem' : `${problems.length} problems`;
      throw new Error(`${file} has ${count}:\n  - ${problems.join('\n  - ')}`);
    },
  };
}

function checkLabel(add, path, value) {
  if (!isObject(value) || !isText(value.en) || !isText(value.te)) add(path, 'needs non-empty "en" and "te" text');
}

function checkWords(add, path, value) {
  if (value !== undefined && !(Array.isArray(value) && value.every(isText))) add(path, 'must be a list of words in quotes');
}

function checkKnownFields(add, path, value, allowed) {
  for (const field of Object.keys(value)) {
    if (!field.startsWith('$') && !allowed.includes(field)) add(`${path}.${field}`, 'is not a known setting (check the spelling)');
  }
}

function checkNumbers(add, path, value, limits) {
  if (!isObject(value)) return add(path, 'must be an object');
  for (const [field, [min, max, whole]] of Object.entries(limits)) {
    const number = value[field];
    const ok = whole ? isCount(number, min) && number <= max : isNumberIn(number, min, max);
    if (!ok) add(`${path}.${field}`, `must be a ${whole ? 'whole ' : ''}number from ${min} to ${max}`);
  }
}

/** Throws a readable error listing every problem in content/videos/config.json. */
export function validateConfig(config) {
  const { add, done } = collector('content/videos/config.json');
  if (!isObject(config)) {
    add('The file', 'must contain one JSON object');
    done();
  }

  const sectionKeys = new Set();
  const sectionOfCategory = new Map();
  const sections = Array.isArray(config.sections) ? config.sections : [];
  if (!sections.length) add('sections', 'must list at least one section');
  sections.forEach((section, i) => {
    const path = `sections[${i}]`;
    if (!isObject(section)) return add(path, 'must be an object');
    checkKnownFields(add, path, section, ['key', 'title', 'icon', 'search', 'all', 'keywords', 'exclude', 'fallbackCategory', 'categories']);
    if (!isKey(section.key)) add(`${path}.key`, 'must use lowercase letters, digits and dashes');
    else if (sectionKeys.has(section.key)) add(`${path}.key`, `"${section.key}" is used twice`);
    sectionKeys.add(section.key);
    checkLabel(add, `${path}.title`, section.title);
    if (typeof section.icon !== 'string' || !ICON.test(section.icon)) add(`${path}.icon`, 'must be a Font Awesome icon such as "fa-music"');
    checkLabel(add, `${path}.search`, section.search);
    if (!isObject(section.all) || !isKey(section.all.key)) add(`${path}.all.key`, 'must use lowercase letters, digits and dashes');
    checkLabel(add, `${path}.all.label`, section.all?.label);
    checkWords(add, `${path}.keywords`, section.keywords);
    checkWords(add, `${path}.exclude`, section.exclude);
    const categories = Array.isArray(section.categories) ? section.categories : [];
    if (!categories.length) add(`${path}.categories`, 'must list at least one category');
    categories.forEach((category, j) => {
      const at = `${path}.categories[${j}]`;
      if (!isObject(category)) return add(at, 'must be an object');
      checkKnownFields(add, at, category, ['key', 'label', 'speaker', 'includeInAll']);
      if (!isKey(category.key)) add(`${at}.key`, 'must use lowercase letters, digits and dashes');
      else if (sectionOfCategory.has(category.key)) add(`${at}.key`, `"${category.key}" is used twice`);
      else sectionOfCategory.set(category.key, section.key);
      checkLabel(add, `${at}.label`, category.label);
      if (category.speaker !== undefined && typeof category.speaker !== 'string') add(`${at}.speaker`, 'must be text');
      if (category.includeInAll !== undefined && typeof category.includeInAll !== 'boolean') add(`${at}.includeInAll`, 'must be true or false');
    });
    if (!categories.some((category) => category?.key === section.fallbackCategory)) {
      add(`${path}.fallbackCategory`, "must be one of this section's category keys");
    }
  });
  for (const section of sections) {
    if (sectionOfCategory.has(section?.all?.key)) add(`sections "${section.key}" all.key`, 'must differ from every category key');
  }
  if (!sectionKeys.has(config.defaultSection)) add('defaultSection', 'must be one of the section keys');

  const channelKeys = new Set();
  const channels = Array.isArray(config.channels) ? config.channels : [];
  if (!channels.length) add('channels', 'must list at least one YouTube channel');
  channels.forEach((channel, i) => {
    const path = `channels[${i}]`;
    if (!isObject(channel)) return add(path, 'must be an object');
    if (!isKey(channel.key) || channelKeys.has(channel.key)) add(`${path}.key`, 'must be a unique key using lowercase letters, digits and dashes');
    channelKeys.add(channel.key);
    if (typeof channel.id !== 'string' || !CHANNEL_ID.test(channel.id)) add(`${path}.id`, 'must be a channel ID: 24 characters starting with "UC"');
    if (!isText(channel.name)) add(`${path}.name`, 'must be text');
    if (channel.section !== undefined && !sectionKeys.has(channel.section)) add(`${path}.section`, 'must be one of the section keys');
  });

  const playlistKeys = new Set();
  const playlists = config.playlists ?? [];
  if (!Array.isArray(playlists)) add('playlists', 'must be a list');
  else {
    playlists.forEach((playlist, i) => {
      const path = `playlists[${i}]`;
      if (!isObject(playlist)) return add(path, 'must be an object');
      if (!isKey(playlist.key) || playlistKeys.has(playlist.key)) add(`${path}.key`, 'must be a unique key using lowercase letters, digits and dashes');
      playlistKeys.add(playlist.key);
      if (typeof playlist.id !== 'string' || !PLAYLIST_ID.test(playlist.id)) add(`${path}.id`, 'must be a playlist ID such as "PL..."');
      if (!isText(playlist.name)) add(`${path}.name`, 'must be text');
      if (playlist.section !== undefined && !sectionKeys.has(playlist.section)) add(`${path}.section`, 'must be one of the section keys');
    });
  }

  const rules = config.rules ?? [];
  if (!Array.isArray(rules)) add('rules', 'must be a list');
  else {
    rules.forEach((rule, i) => {
      const path = `rules[${i}]`;
      if (!isObject(rule)) return add(path, 'must be an object');
      checkKnownFields(add, path, rule, ['category', 'keywords', 'playlists', 'exclude']);
      if (!sectionOfCategory.has(rule.category)) add(`${path}.category`, 'must be one of the category keys');
      checkWords(add, `${path}.keywords`, rule.keywords);
      checkWords(add, `${path}.exclude`, rule.exclude);
      if (rule.playlists !== undefined && !(Array.isArray(rule.playlists) && rule.playlists.every((key) => playlistKeys.has(key)))) {
        add(`${path}.playlists`, 'must list playlist keys from "playlists"');
      }
      const hasWords = Array.isArray(rule.keywords) && rule.keywords.length > 0;
      const hasPlaylists = Array.isArray(rule.playlists) && rule.playlists.length > 0;
      if (!hasWords && !hasPlaylists) add(path, 'needs "keywords" or "playlists"');
    });
  }

  const speakers = config.speakers ?? [];
  if (!Array.isArray(speakers)) add('speakers', 'must be a list');
  else {
    speakers.forEach((speaker, i) => {
      if (!isObject(speaker) || !isText(speaker.name)) add(`speakers[${i}].name`, 'must be text');
      if (!isObject(speaker) || !Array.isArray(speaker.aliases) || !speaker.aliases.length) add(`speakers[${i}].aliases`, 'must list at least one name');
      else checkWords(add, `speakers[${i}].aliases`, speaker.aliases);
    });
  }

  if (!isObject(config.shorts) || !sectionOfCategory.has(config.shorts.category)) add('shorts.category', 'must be one of the category keys');
  else checkNumbers(add, 'shorts', config.shorts, { maxSeconds: [1, 3600, true] });
  checkNumbers(add, 'matcher', config.matcher, { minConfidence: [0.5, 1], minKnownWords: [1, 20, true] });
  checkNumbers(add, 'ai', config.ai, {
    batchSize: [1, 50, true],
    maxRequestsPerRun: [0, 100, true],
    temperature: [0, 2],
    descriptionChars: [0, 5000, true],
    timeoutSeconds: [1, 600, true],
    delayMs: [0, 60000, true],
    examplesPerCategory: [0, 10, true],
  });
  checkNumbers(add, 'safety', config.safety, { maxShrink: [0, 1] });
  checkNumbers(add, 'display', config.display, { pageSize: [1, 500, true], newBadgeDays: [0, 365, true] });
  try {
    new Intl.DateTimeFormat('en', { timeZone: config.timeZone });
    if (!isText(config.timeZone)) throw new RangeError('missing');
  } catch {
    add('timeZone', 'must be a time zone name such as "Asia/Kolkata"');
  }

  done();
  return config;
}

/** Throws a readable error listing every problem in content/videos/overrides.json. */
export function validateOverrides(overrides, config) {
  const { add, done } = collector('content/videos/overrides.json');
  if (!isObject(overrides) || !isObject(overrides.videos)) {
    add('"videos"', 'must be an object keyed by YouTube video ID');
    done();
  }
  const categories = config.sections.flatMap((section) => section.categories.map((category) => category.key));
  for (const [id, entry] of Object.entries(overrides.videos)) {
    if (id.startsWith('$')) continue;
    const path = `videos.${id}`;
    if (!isVideoId(id)) add(path, 'is not an 11-character YouTube video ID');
    if (!isObject(entry)) {
      add(path, 'must be an object');
      continue;
    }
    checkKnownFields(add, path, entry, OVERRIDE_FIELDS);
    if (entry.category !== undefined && !categories.includes(entry.category)) add(`${path}.category`, `must be one of: ${categories.join(', ')}`);
    if (entry.speaker !== undefined && typeof entry.speaker !== 'string') add(`${path}.speaker`, 'must be text ("" leaves it blank)');
    if (entry.title !== undefined && !isText(entry.title)) add(`${path}.title`, 'must be non-empty text');
    if (entry.date !== undefined && !isDate(entry.date)) add(`${path}.date`, 'must look like "2026-04-11", "2026-04", "2026" or ""');
    for (const flag of ['hide', 'pin']) {
      if (entry[flag] !== undefined && typeof entry[flag] !== 'boolean') add(`${path}.${flag}`, 'must be true or false');
    }
  }
  done();
  return overrides;
}

/** Throws a readable error listing every problem in the generated video-library.json. */
export function validateLibrary(library) {
  const { add, done } = collector('video-library.json');
  if (!isObject(library)) {
    add('The file', 'must contain one JSON object');
    done();
  }
  if (library.version !== 1) add('version', 'must be 1');
  if (!isObject(library.settings) || !isCount(library.settings.pageSize, 1) || !isCount(library.settings.newBadgeDays)) {
    add('settings', 'needs whole-number pageSize (1 or more) and newBadgeDays');
  }
  const seen = new Set();
  const sections = Array.isArray(library.sections) ? library.sections : [];
  if (!sections.length) add('sections', 'must list at least one section');
  sections.forEach((section, i) => {
    const path = `sections[${i}]`;
    if (!isObject(section)) return add(path, 'must be an object');
    if (!isKey(section.key)) add(`${path}.key`, 'must use lowercase letters, digits and dashes');
    checkLabel(add, `${path}.title`, section.title);
    if (typeof section.icon !== 'string' || !ICON.test(section.icon)) add(`${path}.icon`, 'must be a Font Awesome icon');
    checkLabel(add, `${path}.search`, section.search);
    if (!isObject(section.all) || !isKey(section.all.key)) add(`${path}.all.key`, 'must use lowercase letters, digits and dashes');
    checkLabel(add, `${path}.all.label`, section.all?.label);
    const categoryKeys = new Set();
    (Array.isArray(section.categories) ? section.categories : []).forEach((category, j) => {
      const at = `${path}.categories[${j}]`;
      if (!isObject(category) || !isKey(category.key) || typeof category.includeInAll !== 'boolean') add(at, 'needs a key, a label and includeInAll');
      else categoryKeys.add(category.key);
      checkLabel(add, `${at}.label`, category?.label);
    });
    if (!categoryKeys.size) add(`${path}.categories`, 'must list at least one category');
    if (!Array.isArray(section.videos)) return add(`${path}.videos`, 'must be a list');
    section.videos.forEach((video, j) => {
      const at = `${path}.videos[${j}]`;
      if (!isObject(video)) return add(at, 'must be an object');
      const fields = Object.keys(video);
      if (fields.length !== VIDEO_KEYS.length || !VIDEO_KEYS.every((key) => fields.includes(key))) {
        add(at, `must have exactly these fields: ${VIDEO_KEYS.join(', ')}`);
      }
      if (!isVideoId(video.id)) add(`${at}.id`, 'is not an 11-character YouTube video ID');
      else if (seen.has(video.id)) add(`${at}.id`, `${video.id} appears more than once`);
      seen.add(video.id);
      if (!isText(video.title)) add(`${at}.title`, 'must be non-empty text');
      if (typeof video.speaker !== 'string') add(`${at}.speaker`, 'must be text');
      if (!isDate(video.date)) add(`${at}.date`, 'must be "", "YYYY", "YYYY-MM" or "YYYY-MM-DD"');
      if (video.published !== '' && !(typeof video.published === 'string' && PUBLISHED.test(video.published))) {
        add(`${at}.published`, 'must be "" or a UTC time such as "2026-04-11T13:30:00Z"');
      }
      if (!isCount(video.duration)) add(`${at}.duration`, 'must be a whole number of seconds');
      if (!categoryKeys.has(video.category)) add(`${at}.category`, `"${video.category}" is not a category of this section`);
      if (!SOURCES.includes(video.source)) add(`${at}.source`, `must be one of: ${SOURCES.join(', ')}`);
      for (const flag of ['embeddable', 'short']) {
        if (typeof video[flag] !== 'boolean') add(`${at}.${flag}`, 'must be true or false');
      }
      if (video.channel !== '' && !(typeof video.channel === 'string' && CHANNEL_ID.test(video.channel))) {
        add(`${at}.channel`, 'must be "" or a channel ID');
      }
    });
  });
  done();
  return library;
}

const orderVideo = (video) => Object.fromEntries(VIDEO_KEYS.map((key) => [key, video[key]]));

/** Pretty JSON with one compact line per video and a trailing newline. */
export function formatLibrary(library) {
  const videos = [];
  const shell = {
    ...library,
    sections: library.sections.map((section) => ({
      ...section,
      videos: section.videos.map((video) => `\u0000V${videos.push(video) - 1}`),
    })),
  };
  const text = JSON.stringify(shell, null, 2).replace(/"\\u0000V(\d+)"/g, (_, index) => JSON.stringify(orderVideo(videos[Number(index)])));
  return `${text}\n`;
}
