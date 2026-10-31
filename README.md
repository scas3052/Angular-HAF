# Holy Army Fellowship: Angular

A standalone Angular 21 conversion of the original English and Telugu website. The original `../HAF-Website` directory is not modified or needed to build and deploy this application.

## Run Locally

Use Node.js 24.x and npm. Angular CLI is installed locally with this project's dependencies; a global installation is not required.

```powershell
cd HAF-Website-Angular
npm.cmd ci
npm.cmd start -- --port 4201
```

Open http://localhost:4201. The original loading screen leads to language selection. Pages use clean URLs without file names, such as `/english/home` and `/telugu/gallery`. Existing links such as `/English/home-english.html` still work: they redirect to the clean URL and keep any query string or `#fragment`.

To use the local CLI, run `npm.cmd run ng -- version` or `npm.cmd run ng -- generate component components/example`.

## Project Structure

- `src/app/pages`: standalone page components and their original bilingual content.
- `src/app/shared/site-layout.ts`: shared header, navigation, and footer components. Their templates preserve the original page-specific layout variations.
- `src/app/features`: gallery/lightbox, book reader, chapter/audio, timeline, video library, testimonies, calendar, and prayer-form components and directives.
- `src/app/core/page-context.ts`: route-specific styles, document language, and layout selection. Styles from the previous page are removed on navigation.
- `src/app/core/seo.ts`: sets each page's description, sharing tags, canonical URL and English/Telugu alternates from the route data (`description`, `language`).
- `src/app/content.routes.ts`: clean content URLs, translated titles, and lazy-loaded page definitions.
- `src/app/page-urls.ts`: maps each original `.html` path to its clean URL. The redirects are built from it, and the tests use it to compare each page with the original.
- `public`: original CSS and local images, copied unchanged apart from two accessibility-driven edits: the header title selector (`.site-title .site-name`, formerly `h1`) and `height: auto` on the founder photo. The old JavaScript files are not executed.

Interactive features use Angular signals, bindings, directives, and forms. Video and testimony collections are typed data rendered by reusable components. Rich-text book chapters and stories use Angular-sanitized HTML bindings.

## Build And Test

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
```

Production output: `dist/haf-website-angular/browser`.

Tests use Playwright Chromium at desktop (1440 x 1000) and mobile (390 x 844) sizes. On a new machine, install the browser once with `npx.cmd playwright install chromium`.

When the original sibling folder is present, the suite also compares all 19 content pages and the language selector with the original text and screenshots. It starts a read-only comparison server on port 4173 and uses the Angular preview on port 4201. Screenshot artifacts are under `test-results` and are ignored by Git. Image fetching is bounded and shared between the compared pages; unavailable external images are reported as test annotations. Synchronous image decoding is used only for screenshots to prevent unfinished offscreen painting from producing false differences.

Behavior tests cover the splash screen, language selection, navigation and refresh, accessibility structure (one h1, landmarks, heading order, named links and frames), page metadata, calendar times, clean URLs and redirects from the original `.html` URLs, galleries, book chapters, audio controls, video search/categories/shuffle/playback, testimony search/expansion, calendar downloads, and prayer forms. Email responses and media playback are mocked: tests do not send real prayer requests or verify third-party playback availability. Maps and external player frames are excluded from visual comparisons.

## Deploy To Vercel

1. Push this application folder and its lockfile to GitHub. Do not commit `node_modules`, `dist`, or `test-results`.
2. Import the repository into Vercel. Set Root Directory to `HAF-Website-Angular` if the repository contains both sibling folders, or leave it at the repository root if this application has its own repository. A sibling of your original Git repository is not automatically part of that repository.
3. Select the Angular framework preset and Node.js 24.x.
4. Use `npm run build` as the build command and `dist/haf-website-angular/browser` as the output directory. These are also configured in `vercel.json`.
5. Verify a Preview Deployment, including direct visits and refreshes on the clean URLs and on the original `.html` URLs (which redirect), before moving your existing domain to it.

The included Vercel rewrite sends non-asset requests to Angular's entry document so deep links work. GitHub-triggered deployments work as before. No production deployment or Git push is performed by this migration.

## Preserved External Dependencies

- Font Awesome, Google Fonts, Google Maps, YouTube, Archive.org audio, ImgBB images, and Google Drive downloads keep their original URLs. Their availability still depends on those providers and the visitor's connection.
- Both original founder pages contain a duplicated portrait URL. It is preserved to avoid changing the supplied design/content; correcting it is a separate content change.
- Calendar buttons use the times printed on their own page, built on India time (IST) so visitors in any timezone get the church's local hours. The English and Telugu pages currently list different service times (Sunday 10:00 AM to 1:00 PM and Saturday from 9:30 AM in English, Sunday 9:00 AM to 12:00 PM and Saturday from 9:00 AM in Telugu); update the text and the `calendarStart`/`calendarEnd` attributes in `home-en.html` and `home-te.html` together once the correct times are confirmed.
- Prayer requests use the original WhatsApp destination and Web3Forms public access key. The public key is designed for browser submission; configure domain restrictions in Web3Forms as appropriate. No server-side secret is added to this client application.
- Rendering is client-side Angular. Prerendering/SSR is not enabled in this migration.
