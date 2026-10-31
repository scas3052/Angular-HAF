// Re-encodes the testimony recordings to small speech-friendly MP3s served from /src/audio/.
// Usage: npm i --no-save ffmpeg-static && npm run encode:audio [-- --force]
// ffmpeg is resolved from FFMPEG_PATH, then ffmpeg-static, then the PATH.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE_BASE = 'https://archive.org/download/abraham_testimony/';
const LOCAL_BASE = '/src/audio/';
const BITRATE = '64k';
const CONCURRENCY = 4;
const MAX_DRIFT_SECONDS = 0.5;
const cacheDir = path.join(root, '.audio-cache');
const outDir = path.join(root, 'public', 'src', 'audio');
const pages = ['chosen-en.html', 'chosen-te.html'].map((name) =>
  path.join(root, 'src', 'app', 'pages', 'chosen', name),
);
const force = process.argv.includes('--force');
const sourcePattern = new RegExp(
  `audioSource="(${escape(ARCHIVE_BASE)}|${escape(LOCAL_BASE)})([\\w.-]+\\.mp3)"`,
  'g',
);

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

async function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const { default: bundled } = await import('ffmpeg-static');
    if (bundled && existsSync(bundled)) return bundled;
  } catch {}
  return 'ffmpeg';
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

async function probe(ffmpeg, file) {
  const { stderr } = await run(ffmpeg, ['-hide_banner', '-i', file]);
  const duration = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const audio = stderr.match(/Audio: ([^\r\n]+)/);
  if (!duration || !audio) throw new Error(`Could not probe ${file}`);
  const [, h, m, s] = duration;
  return { seconds: +h * 3600 + +m * 60 + +s, audio: audio[1] };
}

async function download(name) {
  const target = path.join(cacheDir, name);
  if (existsSync(target)) return target;
  const partial = `${target}.part`;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(ARCHIVE_BASE + name, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await writeFile(partial, Buffer.from(await response.arrayBuffer()));
      await rename(partial, target);
      return target;
    } catch (error) {
      await rm(partial, { force: true });
      if (attempt >= 3) throw new Error(`Download failed for ${name}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

async function encode(ffmpeg, name) {
  const output = path.join(outDir, name);
  const source = await download(name);
  if (!force && existsSync(output)) return report(ffmpeg, name, source, output, true);
  const temporary = `${output}.tmp.mp3`;
  const { code, stderr } = await run(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', source,
    '-map', '0:a:0', '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0',
    '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', BITRATE,
    temporary,
  ]);
  if (code !== 0) {
    await rm(temporary, { force: true });
    throw new Error(`ffmpeg failed for ${name}: ${stderr.trim()}`);
  }
  await rename(temporary, output);
  return report(ffmpeg, name, source, output, false);
}

async function report(ffmpeg, name, source, output, skipped) {
  const [before, after] = await Promise.all([probe(ffmpeg, source), probe(ffmpeg, output)]);
  const drift = Math.abs(before.seconds - after.seconds);
  if (drift > MAX_DRIFT_SECONDS) throw new Error(`${name}: duration drift ${drift.toFixed(2)}s`);
  if (!/\bmono\b/.test(after.audio) || !/\b64 kb\/s/.test(after.audio)) {
    throw new Error(`${name}: unexpected output format (${after.audio})`);
  }
  const [{ size: originalBytes }, { size: encodedBytes }] = await Promise.all([stat(source), stat(output)]);
  return { name, originalBytes, encodedBytes, seconds: after.seconds, skipped };
}

async function pool(items, worker) {
  const results = [];
  const failures = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        try {
          results.push(await worker(item));
          process.stdout.write('.');
        } catch (error) {
          failures.push(error.message);
          process.stdout.write('x');
        }
      }
    }),
  );
  process.stdout.write('\n');
  return { results, failures };
}

const mb = (bytes) => (bytes / 1048576).toFixed(2);

const pageText = new Map();
const names = new Set();
for (const page of pages) {
  if (!existsSync(page)) continue;
  const text = await readFile(page, 'utf8');
  pageText.set(page, text);
  for (const match of text.matchAll(sourcePattern)) names.add(match[2]);
}
if (!names.size) throw new Error('No audio sources found in the chosen pages.');

const ffmpeg = await resolveFfmpeg();
await mkdir(cacheDir, { recursive: true });
await mkdir(outDir, { recursive: true });
console.log(`Encoding ${names.size} recordings with ${ffmpeg}`);

const { results, failures } = await pool([...names].sort(), (name) => encode(ffmpeg, name));
results.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
console.table(
  results.map(({ name, originalBytes, encodedBytes, seconds, skipped }) => ({
    file: name,
    'before MB': mb(originalBytes),
    'after MB': mb(encodedBytes),
    seconds: Math.round(seconds),
    skipped,
  })),
);
const totalBefore = results.reduce((sum, r) => sum + r.originalBytes, 0);
const totalAfter = results.reduce((sum, r) => sum + r.encodedBytes, 0);
const largest = Math.max(...results.map((r) => r.encodedBytes));
console.log(
  `Total ${mb(totalBefore)} MB -> ${mb(totalAfter)} MB; ` +
    `average ${mb(totalAfter / results.length)} MB; largest ${mb(largest)} MB`,
);

if (failures.length) {
  console.error(`\n${failures.length} recording(s) failed; page sources were left unchanged:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

for (const [page, text] of pageText) {
  const updated = text.split(`audioSource="${ARCHIVE_BASE}`).join(`audioSource="${LOCAL_BASE}`);
  if (updated !== text) {
    await writeFile(page, updated);
    console.log(`Pointed ${path.relative(root, page)} at ${LOCAL_BASE}`);
  }
}
