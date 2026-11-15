// Turns a sync report into the run summary (Markdown, shown on the GitHub Actions run page) and the
// commit message. Long lists are cut short so the first big import stays readable.

const SUMMARY_LIMIT = 50;
const COMMIT_LIMIT = 20;
const QUOTA = 10_000;

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const escape = (text) => String(text ?? '').replace(/[\\`*_[\]<>|]/g, '\\$&');
const link = (item) => `[${escape(item.title)}](https://www.youtube.com/watch?v=${item.id})`;

function capped(items, limit, line, more = (count) => `- …and ${count} more`) {
  const lines = items.slice(0, limit).map(line);
  if (items.length > limit) lines.push(more(items.length - limit));
  return lines;
}

function updateText(item) {
  const fields = item.fields.filter((field) => field !== 'category');
  const parts = [];
  if (item.fields.includes('category')) parts.push(`category \`${item.from}\` → \`${item.to}\` (${escape(item.how)})`);
  if (fields.length) parts.push(fields.join(', '));
  return parts.join('; ');
}

/** One line saying what changed, used at the top of the summary and in the console. */
export function headline(report) {
  const parts = [];
  if (report.added.length) parts.push(`${report.added.length} new`);
  if (report.removed.length) parts.push(`${report.removed.length} removed`);
  if (report.updated.length) parts.push(`${report.updated.length} updated`);
  return parts.length ? parts.join(', ') : 'no changes';
}

/** The run summary in Markdown. */
export function describeReport(report, { changed = false, dryRun = false, offline = false } = {}) {
  const lines = ['## YouTube video sync', ''];
  let state = `The video list already matches ${offline ? 'the settings' : 'YouTube'}, so nothing was written.`;
  if (changed) state = dryRun ? 'Dry run: the video list would change, but nothing was written.' : 'The video list was updated.';
  if (offline) state += ' Offline run: YouTube and the AI helper were not contacted.';
  const counts = headline(report);
  lines.push(`**${counts[0].toUpperCase()}${counts.slice(1)}.** ${state}`, '');
  const { youtube = 0, ai = 0 } = report.requests ?? {};
  lines.push(`YouTube requests: ${youtube} (each costs 1 of the ${QUOTA.toLocaleString('en-US')} free quota units a day). AI requests: ${ai}.`, '');

  if (report.added.length) {
    lines.push(`### New videos (${report.added.length})`, '', '| Video | Section | Category | Decided by |', '| --- | --- | --- | --- |');
    const row = (item) => `| ${link(item)} | \`${item.section}\` | \`${item.category}\` | ${escape(item.how)} |`;
    lines.push(...capped(report.added, SUMMARY_LIMIT, row, (count) => `| …and ${count} more | | | |`), '');
  }
  if (report.removed.length) {
    lines.push(`### Removed (${report.removed.length})`, '');
    lines.push(...capped(report.removed, SUMMARY_LIMIT, (item) => `- ${link(item)}: ${escape(item.reason)}`), '');
  }
  if (report.updated.length) {
    lines.push(`### Updated (${report.updated.length})`, '');
    lines.push(...capped(report.updated, SUMMARY_LIMIT, (item) => `- ${link(item)}: ${updateText(item)}`), '');
  }
  if (report.skipped.length) {
    lines.push(`### Waiting on YouTube (${report.skipped.length})`, '', 'These are added automatically once they are ready.', '');
    lines.push(...capped(report.skipped, SUMMARY_LIMIT, (item) => `- ${link(item)}: ${escape(item.reason)}`), '');
  }
  if (report.warnings.length) {
    lines.push(`### Warnings (${report.warnings.length})`, '');
    lines.push(...report.warnings.map((warning) => `- ${escape(warning)}`), '');
  }
  const unsure = report.added.filter((item) => item.source === 'fallback').length;
  if (unsure) {
    lines.push(`${plural(unsure, 'new video')} went to the fallback category because nothing else matched. To move one, add its ID to content/videos/overrides.json.`, '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/** The commit message for the bot's commit: a short subject, then the new and removed videos. */
export function commitMessage(report) {
  const counts = headline(report);
  const subject = `Sync YouTube videos: ${counts === 'no changes' ? 'refresh details' : counts}`;
  const body = [];
  if (report.added.length) {
    body.push('New:', ...capped(report.added, COMMIT_LIMIT, (item) => `- ${item.title} (${item.category}, ${item.how})`), '');
  }
  if (report.removed.length) {
    body.push('Removed:', ...capped(report.removed, COMMIT_LIMIT, (item) => `- ${item.title} (${item.reason})`), '');
  }
  if (report.updated.length) body.push(`${plural(report.updated.length, 'video')} had details refreshed from YouTube.`, '');
  return `${[subject, '', ...body].join('\n').trimEnd()}\n`;
}
