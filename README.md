# Holy Army Fellowship: Angular

A standalone Angular 21 conversion of the original English and Telugu website. The original `../HAF-Website` directory is not modified or needed to build and deploy this application.

## Run Locally

Use Node.js 24.x and npm. Angular CLI is installed locally with this project's dependencies; a global installation is not required.

```powershell
cd HAF-Website-Angular
npm.cmd ci
npm.cmd start -- --port 4201
```

Open http://localhost:4201. Every visit starts with the animated loading screen, which leads to language selection; the language chosen last time is not remembered. Pages use clean URLs without file names, such as `/english/home` and `/telugu/gallery`. Existing links such as `/English/home-english.html` still work: they redirect to the clean URL and keep any query string or `#fragment`.

To use the local CLI, run `npm.cmd run ng -- version` or `npm.cmd run ng -- generate component components/example`.

## Project Structure

- `src/app/pages`: standalone page components and their original bilingual content.
- `src/app/shared/site-layout.ts`: shared header, navigation, and footer components. Their templates preserve the original page-specific layout variations.
- `src/app/features`: gallery/lightbox, book reader, chapter/audio, timeline, video library, testimonies, calendar, and prayer-form components and directives.
- `src/app/core/page-context.ts`: route-specific styles, document language, and layout selection. Styles from the previous page are removed on navigation.
- `src/app/core/seo.ts`: sets each page's description, sharing tags, canonical URL and English/Telugu alternates from the route data (`description`, `language`).
- `src/app/core/motion.ts`: scroll-reveal animations for section titles, cards, books, photos, videos and chapters, and the pointer-following tilt on cards.
- `src/app/content.routes.ts`: clean content URLs, translated titles, and lazy-loaded page definitions.
- `src/app/page-urls.ts`: maps each original `.html` path to its clean URL. The redirects are built from it, and the tests use it to compare each page with the original.
- `public`: local images and the page stylesheets. `src/css/style.css` holds the shared header, navigation, hero and card design; each page adds its own stylesheet (`books.css`, `gallery.css`, ...), which is loaded only on that page. The old JavaScript files are not executed.
- `content/videos`: settings for the YouTube video sync. `config.json` holds the channels, playlists, categories and keyword rules; `overrides.json` holds fixes for single videos.
- `scripts/sync-videos.mjs` and `scripts/videos`: the video sync and its tests. `.github/workflows/sync-videos.yml` runs it every 6 hours.
- `src/app/pages/videos/video-library.json`: the videos shown on both Videos pages. The sync writes this file, so don't edit it by hand; change `content/videos` instead.

Interactive features use Angular signals, bindings, directives, and forms. Testimony collections are typed data and the video library is generated JSON (see [Videos Update Automatically](#videos-update-automatically)); both are rendered by reusable components. Rich-text book chapters and stories use Angular-sanitized HTML bindings.

## Design And Motion

The site uses a "midnight and gold" design: dark animated heroes, header, navigation drawer and footer, with light, readable content sections. Colours, fonts and shadows are CSS variables in `src/styles.css`, which also holds the shared animations.

- Pages change with the browser's View Transitions API (Chrome, Edge and Safari 18+; other browsers change pages instantly). A page opened from a link spreads out from that link as a widening circle of light; Back and Forward cross-fade. Following an in-page link such as `#contact` scrolls smoothly instead.
- Content arrives as the visitor scrolls, each kind in its own way (`src/app/core/motion.ts`): section titles rise out of a slot and draw their gold underline, cards stand up from lying back, books swing open on their spines, photos drop in and (with a mouse) develop from pale to full colour, beliefs glide in from alternate sides, and the footer cascades in. Icons spin into place just after their block. Cards tilt slightly towards the mouse pointer.
- Every hero has slowly turning rays of light behind its words; with a mouse, its stars twinkle and its layers (aurora, stars, sparks, words) drift at different depths as the pointer moves. As the page scrolls on, the hero's words sink back and fade (scroll-driven animation, where the browser supports it). The founder banner and the language page's night sky have the same depth.
- A gold halo trails the mouse and opens up over anything that can be pressed; the main buttons lean towards the pointer. Every press, by mouse, touch or keyboard, sends out a small burst of gold sparks, and a sent prayer request is celebrated with sparks and confetti (`src/app/core/effects.ts`). These decorations are never focusable and never in the way of a click.
- Shuffled testimonies and videos, and gallery photos after a filter, glide to their new places. An opened photo flies out of its thumbnail, and the next and previous photos slide in from that side. Book chapters turn like pages.
- A gold bar at the top shows how far down the page the visitor has read, and the back-to-top button that appears after scrolling fills a matching gold ring.
- When the visitor's system asks for reduced motion, looping, scroll and pointer animations are switched off and all content is shown at once. Animations are also turned off for printing. On touch screens the hero sky stays still, so scrolling stays smooth on phones.

## Build And Test

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:videos
```

Production output: `dist/haf-website-angular/browser`.

`npm.cmd run test:videos` runs the video sync's own tests with Node's test runner. They use made-up YouTube and AI answers, so they need no network or API key.

Tests use Playwright Chromium at desktop (1440 x 1000) and mobile (390 x 844) sizes. On a new machine, install the browser once with `npx.cmd playwright install chromium`.

When the original sibling folder is present, the suite also checks that all 19 content pages and the language selector keep the original text. The pages were deliberately redesigned, so they are no longer compared with screenshots of the original. It starts a read-only comparison server on port 4173 and uses the Angular preview on port 4201. Test artifacts are under `test-results` and are ignored by Git. Image fetching is bounded and shared between the compared pages; unavailable external images are reported as test annotations.

Behavior tests cover the splash screen, language selection, navigation and refresh, accessibility structure (one h1, landmarks, heading order, named links and frames), page metadata, calendar times, clean URLs and redirects from the original `.html` URLs, galleries, book chapters, audio controls, video search/categories/shuffle/playback, testimony search/expansion, calendar downloads, prayer forms, scroll reveals, the back-to-top button and reduced motion. Email responses and media playback are mocked: tests do not send real prayer requests or verify third-party playback availability. The video tests work out what to expect from `video-library.json`, so they keep passing as the sync adds videos.

## Deploy To Vercel

1. Push this application folder and its lockfile to GitHub. Do not commit `node_modules`, `dist`, or `test-results`.
2. Import the repository into Vercel. Set Root Directory to `HAF-Website-Angular` if the repository contains both sibling folders, or leave it at the repository root if this application has its own repository. A sibling of your original Git repository is not automatically part of that repository.
3. Select the Angular framework preset and Node.js 24.x.
4. Use `npm run build` as the build command and `dist/haf-website-angular/browser` as the output directory. These are also configured in `vercel.json`.
5. Verify a Preview Deployment, including direct visits and refreshes on the clean URLs and on the original `.html` URLs (which redirect), before moving your existing domain to it.

The included Vercel rewrite sends non-asset requests to Angular's entry document so deep links work. GitHub-triggered deployments work as before. The video sync workflow pushes its updates to `master`, and Vercel deploys them like any other commit (see [Videos Update Automatically](#videos-update-automatically)).

## Videos Update Automatically

The Videos pages show the public videos of the church's two YouTube channels, Holy Army Fellowship and HAF Worship, and of the playlists listed in `content/videos/config.json`. Nobody has to change code when a video is uploaded, and no access to the channels is needed. The GitHub Actions workflow `.github/workflows/sync-videos.yml` keeps the pages up to date:

1. Every 6 hours it reads the channels' uploads and those playlists from the YouTube Data API v3.
2. `scripts/sync-videos.mjs` gives each new video a section (Messages or Worship Songs) and a category, removes videos that were deleted or made private, and writes `src/app/pages/videos/video-library.json`.
3. If anything changed, the workflow commits that file to `master` and Vercel deploys the commit. A new upload usually appears within 6 hours, with a "New" badge for its first 14 days.

Each run's page in the **Actions** tab has a summary of the new, removed and updated videos and how each one was sorted. A run that fails changes nothing, and GitHub notifies the person who added the workflow.

### One-time setup

1. **Create a free YouTube API key.** In the [Google Cloud console](https://console.cloud.google.com/), create a project; no billing account is needed. Under **APIs & Services → Library**, enable **YouTube Data API v3**. Under **APIs & Services → Credentials**, choose **Create credentials → API key**, then restrict the key to YouTube Data API v3 under **API restrictions**.
2. **Add the key to GitHub.** In the repository, open **Settings → Secrets and variables → Actions**, choose **New repository secret**, name it `YOUTUBE_API_KEY` and paste the key.
3. **Import the new videos.** Once the workflow is on `master`, open **Actions → Sync YouTube videos → Run workflow**. Merging the workflow also starts a run, because the merge changes `content/videos`: if the secret is already set, that run does the first import.
4. Optional: set up the [AI helper](#optional-ai-helper).
5. Only if the repository is made private: add a [Vercel deploy hook](#troubleshooting).

To run the sync on your own computer, create a file named `.env.local` in the project folder (Git ignores it) with this line:

```text
YOUTUBE_API_KEY=your-key
```

The AI helper's `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` can go in the same file.

### Optional AI helper

The keyword rules and the titles of earlier videos sort most new videos. The AI helper only sees the rest; without it, they go to **Other Messages** until you move them. Any provider with an OpenAI-compatible chat API works. These have free plans:

| Provider | `AI_BASE_URL` | `AI_MODEL` |
| --- | --- | --- |
| [Groq](https://console.groq.com/keys) (recommended) | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` |
| [OpenRouter](https://openrouter.ai/settings/keys) | `https://openrouter.ai/api/v1` | `openrouter/free` |
| [Google AI Studio](https://aistudio.google.com/apikey) | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-3.8-flash` |

Save the provider's key as the repository secret `AI_API_KEY`, and save `AI_BASE_URL` and `AI_MODEL` as repository variables (**Settings → Secrets and variables → Actions → Variables**). Providers rename and retire models often. If the run summary says a model is not available, choose a current one from the provider's model list. `AI_MODEL` can list several models, separated by commas, to try in order.

The helper is sent only public video titles and the start of their descriptions, and it makes at most 5 requests a run (`ai.maxRequestsPerRun` in `config.json`). If it fails, the run still succeeds: the videos wait in Other Messages and are tried again on the next run. Its choices are marked "AI helper" in the run summary, so they are easy to check.

### Costs

Nothing here has to be paid for:

- **GitHub Actions** is free for public repositories. A private repository on the free plan gets 2,000 minutes a month, and this workflow uses about 120.
- **YouTube Data API** allows 10,000 free units a day. A run makes about 35 requests of 1 unit each (the 100-unit search request is never used), so four runs a day use under 2%. Without a billing account Google cannot charge anything: if the quota ever ran out, requests would simply fail until the next day.
- **The AI helper** is optional, and the providers above have free plans.
- **Vercel** deploys the bot's commits on the Hobby plan like any other commit while the repository is public.

### How videos are sorted

A video's section comes from its channel (HAF Worship videos are songs), then its playlists (Video Songs), then its title (song, album or పాట). Everything else is a message.

A message's category is the first of these that applies:

1. A fix for that video in `content/videos/overrides.json`.
2. The category it had on the old, hand-made Videos page.
3. **Shorts**: up to 3 minutes long, and vertical or tagged `#shorts`. Shorts have their own tab and are left out of All Messages.
4. The keyword rules in `content/videos/config.json`. A keyword in the title counts first, then the rules' playlists, then a keyword in the first 300 characters of the description; within each, the first rule in the list wins. A rule is skipped when one of its `exclude` words is in the title, so a Wednesday fasting prayer is not a Second Saturday Service.
5. The category it got on an earlier run.
6. Earlier videos: a title that shares a part (the text between `|` or `_` separators, such as a series name) with at least two sorted videos, or title words that strongly suggest one topic category.
7. The AI helper, if it is set up.
8. **Other Messages**.

Keywords match the start of a word and ignore capitals and punctuation, so `Retreat` also finds "retreats". Rules are checked again on every run, so a new or changed rule also moves videos the sync sorted itself, but not those sorted by hand (1 and 2). Videos that went to Other Messages because nothing matched are tried again on every run.

A message's speaker is the one named in its title (from `speakers` in `config.json`), else its category's speaker. Its date is one written in the title, else the day it was streamed or uploaded, in India time. Speakers and dates already on the site are kept.

### Fix one video

Add the video's ID to `content/videos/overrides.json`. The ID is the 11 characters after `watch?v=`, `youtu.be/` or `shorts/` in the video's link. For example:

```json
{
  "videos": {
    "ySA6wgUsy2A": { "pin": true },
    "AAAAAAAAAAA": { "category": "sunday" },
    "BBBBBBBBBBB": { "speaker": "Sis. M. Rani Abraham", "date": "2026-04" },
    "CCCCCCCCCCC": { "hide": true }
  }
}
```

| Field | Effect |
| --- | --- |
| `category` | Moves the video to this category. It also adds a video the sync would not find by itself, such as an unlisted video or one from another channel. |
| `speaker` | The speaker shown on the video; `""` shows none. |
| `title` | The title shown instead of YouTube's. |
| `date` | `"2026-04-11"`, `"2026-04"` or `"2026"`; `""` shows no date. |
| `hide` | `true` takes the video off the site. |
| `pin` | `true` shows the video first. Pinned videos follow their order in this file. |

The category keys are `abraham`, `rani`, `special`, `sunday`, `retreats`, `ai`, `testimonies`, `kids`, `shorts` and `other` for messages, and `songs` for songs.

The file can be edited on GitHub: open it and choose the pencil icon. A change to `content/videos` on `master` starts the sync straight away. A mistake, such as a misspelt field or category, stops the run with a message saying what is wrong, and the site is not changed.

### Change the rules or add a category

Rules and categories are in `content/videos/config.json`; keys that start with `$` are comments. Each rule names a `category` and can have `keywords` (looked for in titles and descriptions), `playlists` (keys from the `playlists` list) and `exclude` words (the rule is skipped when one is in the title). For example, to give Bible studies their own tab:

1. Add the category to the Messages section's `categories`, with English and Telugu labels. Keys use lowercase letters, digits and dashes.

   ```json
   { "key": "bible-study", "label": { "en": "Bible Study", "te": "బైబిల్ అధ్యయనం" } }
   ```

2. Add a rule to `rules`. The first matching rule wins, so put specific rules before general ones.

   ```json
   { "category": "bible-study", "keywords": ["Bible Study", "బైబిల్ అధ్యయనం"] }
   ```

The new tab appears on both language pages as soon as a video is in it, with no code changes. Tabs follow the order of the `categories` list. A category for one preacher can also name a `speaker`.

To follow another playlist, add it to `playlists` with a short `key`, its `name` and its `id` (the part after `list=` in its link). Its public videos are then added to the site too, and rules can use its key. Add `"section": "songs"` if it holds only songs.

### Run it on your computer

```powershell
npm.cmd run videos:sync -- --dry-run   # show what would change, without writing anything
npm.cmd run videos:sync                # update video-library.json from YouTube
npm.cmd run videos:sync -- --offline   # re-apply config.json and overrides.json without contacting YouTube
npm.cmd run test:videos                # the sync's tests
```

The first two need `YOUTUBE_API_KEY` in `.env.local`, and `npm.cmd run videos:sync -- --help` lists every option. Commit the updated `video-library.json` yourself, or push only the `content/videos` change and let the workflow update it.

### Troubleshooting

- **"… would be removed, more than the 10% safety limit, so nothing was changed."** Many videos disappeared at once, which is more often a YouTube problem than real deletions. Check some of the listed videos on YouTube. If they really are gone, open **Actions → Sync YouTube videos → Run workflow**, tick **Allow removing more than 10% of the videos** and run it. On your computer, run `npm.cmd run videos:sync -- --allow-shrink` instead.
- **"YOUTUBE_API_KEY is not set"**, or YouTube says the key is not valid: add or replace the repository secret (setup step 2). Check that YouTube Data API v3 is enabled in the key's Google Cloud project and allowed by the key's API restrictions.
- **Quota errors** (`quotaExceeded`): the quota resets at midnight Pacific time, and the next run catches up. Normal use is far below the quota, so check that the key isn't used anywhere else.
- **A new video is missing**: the sync runs every 6 hours. The run summary's "Waiting on YouTube" list shows videos that are still processing, live or scheduled; they are added once they are ready. Unlisted videos are shown only when `overrides.json` gives them a category.
- **Many videos in Other Messages**: move them with `overrides.json`, add a keyword rule so later videos are sorted too, or set up the AI helper.
- **Runs stopped**: GitHub turns off scheduled workflows in a public repository after 60 days with no activity in it. New videos normally keep it active; if it was turned off, open **Actions → Sync YouTube videos** and choose **Enable workflow**.
- **The run fails at "Commit the new video list"**: the workflow pushes straight to `master`, so a branch protection rule or ruleset that requires pull requests on `master` stops it. Turn off that requirement for `master` so the workflow can push.
- **The repository is made private**: on Vercel's Hobby plan, commits to a private repository are only deployed when their author is the Vercel account owner, so the bot's commits would not be. In Vercel, open the project's **Settings → Git → Deploy Hooks**, create a hook for `master`, and save its URL as the repository secret `VERCEL_DEPLOY_HOOK_URL`. The workflow then asks Vercel to deploy after each update.

## Preserved External Dependencies

- Font Awesome, Google Fonts, Google Maps, YouTube, Archive.org audio, ImgBB images, and Google Drive downloads keep their original URLs. Their availability still depends on those providers and the visitor's connection.
- Both original founder pages contain a duplicated portrait URL. It is preserved to avoid changing the supplied content; correcting it is a separate content change.
- Calendar buttons use the times printed on their own page, built on India time (IST) so visitors in any timezone get the church's local hours. The English and Telugu pages currently list different service times (Sunday 10:00 AM to 1:00 PM and Saturday from 9:30 AM in English, Sunday 9:00 AM to 12:00 PM and Saturday from 9:00 AM in Telugu); update the text and the `calendarStart`/`calendarEnd` attributes in `home-en.html` and `home-te.html` together once the correct times are confirmed.
- Prayer requests use the original WhatsApp destination and Web3Forms public access key. The public key is designed for browser submission; configure domain restrictions in Web3Forms as appropriate. No server-side secret is added to this client application.
- Rendering is client-side Angular. Prerendering/SSR is not enabled in this migration.
