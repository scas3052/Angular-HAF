// Updates the Videos page from the church's YouTube channels. GitHub Actions runs it every six hours
// (.github/workflows/sync-videos.yml), and it can be run by hand:
//   npm run videos:sync                  -> fetch from YouTube and update the video list
//   npm run videos:sync -- --dry-run     -> show what would change without writing anything
//   npm run videos:sync -- --offline     -> re-apply config.json and overrides.json without YouTube
// Keys come from the environment or from .env.local (git ignores it). See "Videos Update Automatically" in README.md.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import { createAiClassifier, checkBaseUrl, modelList } from './videos/ai.mjs';
import { formatLibrary, validateConfig, validateOverrides } from './videos/schema.mjs';
import { commitMessage, describeReport, syncLibrary } from './videos/sync.mjs';
import { createYouTubeClient } from './videos/youtube.mjs';

const root = path.resolve(import.meta.dirname, '..');
const files = {
  config: path.join(root, 'content', 'videos', 'config.json'),
  overrides: path.join(root, 'content', 'videos', 'overrides.json'),
  library: path.join(root, 'src', 'app', 'pages', 'videos', 'video-library.json'),
};

const HELP = `Updates the Videos page from YouTube (src/app/pages/videos/video-library.json).

Usage: npm run videos:sync -- [options]

  --dry-run             Show what would change without writing anything.
  --offline             Don't contact YouTube or the AI helper. Re-applies content/videos/config.json
                        and overrides.json to the videos already on the site.
  --allow-shrink        Allow a run to remove more videos than the safety limit (or ALLOW_SHRINK=true).
  --ai-max-requests=N   Most AI helper requests for this run (default in config.json; 0 turns it off).
  --message-file=PATH   Write a commit message describing the changes to PATH.
  -h, --help            Show this help.

Settings come from the environment or from a .env.local file in the project folder:
  YOUTUBE_API_KEY                       needed unless --offline
  AI_API_KEY, AI_BASE_URL, AI_MODEL     optional AI helper for videos the rules can't place

See "Videos Update Automatically" in README.md for how to get the free keys.
`;

const secrets = () => [process.env.YOUTUBE_API_KEY, process.env.AI_API_KEY].map((value) => value?.trim()).filter((value) => value && value.length >= 8);
const redact = (text) => secrets().reduce((result, secret) => result.split(secret).join('***'), String(text ?? ''));

/** Fills in settings from .env.local without replacing ones already set (GitHub Actions sets them itself). */
async function loadEnvFile() {
  let text;
  try {
    text = await readFile(path.join(root, '.env.local'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const [name, value] of Object.entries(parseEnv(text))) process.env[name] ??= value;
}

async function readJson(file, { optional = false } = {}) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (optional && error.code === 'ENOENT') return null;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path.relative(root, file)} is not valid JSON: ${error.message}`);
  }
}

/** The AI helper, or null when it is not set up or turned off for this run. */
function createAi(config, options, warnings) {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey || options.offline) return null;
  const limit = options['ai-max-requests'];
  const maxRequests = limit === undefined ? config.ai.maxRequestsPerRun : Number(limit);
  if (!Number.isInteger(maxRequests) || maxRequests < 0) throw new Error('--ai-max-requests must be a whole number (0 or more).');
  if (maxRequests === 0) return null;
  const baseUrl = process.env.AI_BASE_URL?.trim() ?? '';
  const models = modelList(process.env.AI_MODEL);
  const problem = !baseUrl ? 'AI_BASE_URL is not set' : checkBaseUrl(baseUrl) || (models.length ? '' : 'AI_MODEL is not set');
  if (problem) {
    warnings.push(`The AI helper is off because ${problem}. Unclear videos go to the fallback category until it is fixed.`);
    return null;
  }
  return createAiClassifier({
    apiKey,
    baseUrl,
    models,
    batchSize: config.ai.batchSize,
    maxRequests,
    temperature: config.ai.temperature,
    descriptionChars: config.ai.descriptionChars,
    timeoutMs: config.ai.timeoutSeconds * 1000,
    delayMs: config.ai.delayMs,
  });
}

async function main() {
  const { values: options } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      offline: { type: 'boolean', default: false },
      'allow-shrink': { type: 'boolean', default: false },
      'ai-max-requests': { type: 'string' },
      'message-file': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  await loadEnvFile();
  const config = validateConfig(await readJson(files.config));
  const overrides = validateOverrides(await readJson(files.overrides), config);
  const library = await readJson(files.library, { optional: true });

  let youtube = null;
  if (!options.offline) {
    const apiKey = process.env.YOUTUBE_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'YOUTUBE_API_KEY is not set. Create a free YouTube Data API key (see "Videos Update Automatically" in README.md) and put it in .env.local, ' +
          'or in the repository secret YOUTUBE_API_KEY for GitHub Actions. To re-apply config.json and overrides.json without YouTube, add --offline.',
      );
    }
    youtube = createYouTubeClient({ apiKey });
  }
  const warnings = [];
  const ai = createAi(config, options, warnings);
  const allowShrink = options['allow-shrink'] || process.env.ALLOW_SHRINK?.trim().toLowerCase() === 'true';

  const { library: next, report, changed } = await syncLibrary({ config, overrides, library, youtube, ai, offline: options.offline, allowShrink, log: console.log });
  report.warnings.unshift(...warnings);
  const summary = redact(describeReport(report, { changed, dryRun: options['dry-run'], offline: options.offline }));
  console.log(`\n${summary}`);

  const write = changed && !options['dry-run'];
  if (write) {
    await writeFile(files.library, formatLibrary(next));
    console.log(`Wrote ${path.relative(root, files.library)}`);
  }
  if (options['message-file']) await writeFile(options['message-file'], redact(commitMessage(report)));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${write}\n`);
}

try {
  await main();
} catch (error) {
  const usage = String(error?.code ?? '').startsWith('ERR_PARSE_ARGS');
  const bug = !usage && (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError);
  let text = redact(bug ? error.stack : (error?.message ?? error));
  if (usage) text += '\nRun "npm run videos:sync -- --help" to see the options.';
  console.error(`\nVideo sync failed: ${text}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## YouTube video sync\n\n**Failed.** Nothing was changed.\n\n\`\`\`text\n${text}\n\`\`\`\n`).catch(() => {});
  }
  process.exitCode = 1;
}
