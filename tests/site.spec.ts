import { test, expect, Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { legacyPageUrls } from '../src/app/page-urls';
import { serviceSchedule } from '../src/app/features/service-schedule';

const root = path.resolve(__dirname, '..');
const hasOriginal = existsSync(path.resolve(root, '../HAF-Website/index.html'));
const inventory: { path: string; title: string; language: string; kind: string }[] = JSON.parse(readFileSync(path.join(root, 'scripts/page-inventory.json'), 'utf8'));
const pages = [{ path: 'language.html', title: 'Welcome - Holy Army Fellowship', language: 'en', kind: 'language' }, ...inventory];
const appPath = (legacyPath: string) => '/' + legacyPageUrls[legacyPath];
const imageResponses = new Map<string, Promise<{ body: Buffer; contentType: string } | null>>();

// The original site still loads these images from external hosts; the app now serves the same files itself.
const ibbPrefix = 'https://i.ibb.co/';
const founderImage = ibbPrefix + 'bg1NLhDy/Picsart-26-05-06-18-46-39-159.jpg';
const localCopies: Record<string, string> = {
  [ibbPrefix + 'm5dQmmCm/Scan-Picsart-Ai-Image-Enhancer.png']: 'images/books/ujjeeva-prasangamulu-part-1.png',
  [ibbPrefix + 'S4CFFnSD/Scan-3-Picsart-Ai-Image-Enhancer.png']: 'images/books/ujjeeva-prasangamulu-part-2.png',
  [ibbPrefix + 'gFbTxQzs/Scan-5-Picsart-Ai-Image-Enhancer.png']: 'images/books/siluvalo-daagina-viluva.png',
  [founderImage]: 'images/founder/founder.jpg',
  [founderImage + founderImage]: 'images/founder/founder.jpg',
  'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&q=80': 'images/bg/prayer-request-bg.jpg'
};
function localCopy(url: URL): { body: Buffer; contentType: string } | null {
  const gallery = url.hostname === 'i.ibb.co' && /^\/[^/]+\/(\d+\.webp)$/.exec(url.pathname);
  const relative = gallery ? 'images/Gallery/' + gallery[1] : localCopies[url.href];
  if (!relative) return null;
  const extension = path.extname(relative).slice(1);
  return { body: readFileSync(path.join(root, 'public/src', relative)),
    contentType: extension === 'jpg' ? 'image/jpeg' : 'image/' + extension };
}

test.beforeEach(async ({ context }, testInfo) => {
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname === 'api.web3forms.com' || request.resourceType() === 'media') return route.abort();
    if (request.resourceType() === 'document' || url.pathname === '/iframe_api') {
      return route.fulfill({ status: 200, contentType: url.pathname === '/iframe_api' ? 'text/javascript' : 'text/html', body: '' });
    }
    if (request.resourceType() === 'image') {
      const local = localCopy(url);
      if (local) return route.fulfill({ status: 200, ...local });
      let response = imageResponses.get(url.href);
      if (!response) {
        response = (async () => {
          try {
            const result = await context.request.get(url.href, { timeout: 15000 });
            if (!result.ok()) return null;
            return { body: await result.body(), contentType: result.headers()['content-type'] ?? 'image/jpeg' };
          } catch { return null; }
        })();
        imageResponses.set(url.href, response);
      }
      const result = await response;
      if (result) return route.fulfill({ status: 200, ...result });
      testInfo.annotations.push({ type: 'unavailable-external-image', description: url.href });
      return route.abort();
    }
    return route.continue();
  });
});

async function settle(page: Page): Promise<void> {
  await page.bringToFront();
  await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; caret-color: transparent !important; }' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(document.images).filter(image => {
      const bounds = image.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 && !image.closest('.collapsed, .lightbox, .reader-modal');
    });
    for (const image of images) {
      image.loading = 'eager';
      image.decoding = 'sync';
    }
    await Promise.all(images.map(async image => {
      if (!image.complete) await new Promise<void>(resolve => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      });
      await image.decode().catch(() => undefined);
    }));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function contentText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      // The footer is a deliberately redesigned shared component, so it has its own tests below.
      if (!node.parentElement?.closest('script, style, noscript, footer')) {
        const text = node.textContent?.replace(/\s+/g, ' ').trim();
        if (text) parts.push(text);
      }
    }
    return parts.join(' ');
  });
}

// Deliberate text changes from the original site: [original text, current text].
const intentionalTextChanges: Record<string, [string, string][]> = {
  'Telugu/home-telugu.html': [
    ['ఉదయం 9:00 నుండి మధ్యాహ్నం 12:00 వరకు', 'ఉదయం 10:00 నుండి మధ్యాహ్నం 1:00 వరకు'],
    ['ఉదయం 9:00 నుండి మధ్యాహ్నం 2:30 వరకు', 'ఉదయం 9:30 నుండి మధ్యాహ్నం 2:30 వరకు']
  ],
  'Telugu/books-telugu.html': [['Previous Chapter', 'మునుపటి అధ్యాయం'], ['Next Chapter', 'తదుపరి అధ్యాయం']]
};

const hideFooter = (target: Page) => target.addStyleTag({ content: 'footer { display: none !important; }' });

for (const entry of pages) {
  test(`page parity: ${entry.path}`, async ({ page, context }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(appPath(entry.path), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(entry.title);
    await expect(page.locator('html')).toHaveAttribute('lang', entry.language);
    await expect(page.locator(entry.kind === 'language' ? '.language-container' : 'header')).toBeVisible();
    await settle(page);
    expect(errors).toEqual([]);
    if (!hasOriginal) return;
    const original = await context.newPage();
    await original.goto('http://127.0.0.1:4173/' + entry.path, { waitUntil: 'domcontentloaded' });
    await settle(original);
    const originalText = (intentionalTextChanges[entry.path] ?? [])
      .reduce((text, [before, after]) => text.replaceAll(before, after), await contentText(original));
    expect(await contentText(page)).toBe(originalText);
    if (entry.kind === 'gallery') {
      for (const [name, current] of [['angular', page], ['original', original]] as const) {
        const imageState = await current.locator('.gallery-item img').evaluateAll(images => images.map(element => {
          const image = element as HTMLImageElement;
          const bounds = image.getBoundingClientRect();
          return { src: image.src, currentSrc: image.currentSrc, complete: image.complete,
            naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, loading: image.loading,
            bounds: bounds.toJSON(), visibility: getComputedStyle(image).visibility,
            opacity: getComputedStyle(image).opacity, itemOpacity: getComputedStyle(image.closest('.gallery-item')!).opacity };
        }));
        await testInfo.attach(`${name}-images`, { body: JSON.stringify(imageState, null, 2), contentType: 'application/json' });
        writeFileSync(testInfo.outputPath(`${name}-images.json`), JSON.stringify(imageState, null, 2));
      }
    }
    await Promise.all([hideFooter(page), hideFooter(original)]);
    const actualBytes = await page.screenshot({ path: testInfo.outputPath('angular.png'), fullPage: true, animations: 'disabled', mask: [page.locator('iframe')] });
    const originalBytes = await original.screenshot({ path: testInfo.outputPath('original.png'), fullPage: true, animations: 'disabled', mask: [original.locator('iframe')] });
    const actual = PNG.sync.read(actualBytes);
    const expected = PNG.sync.read(originalBytes);
    expect({ width: actual.width, height: actual.height }).toEqual({ width: expected.width, height: expected.height });
    const difference = new PNG({ width: actual.width, height: actual.height });
    const changed = pixelmatch(actual.data, expected.data, difference.data, actual.width, actual.height, { threshold: 0.15 });
    const ratio = changed / (actual.width * actual.height);
    writeFileSync(testInfo.outputPath('difference.png'), PNG.sync.write(difference));
    testInfo.annotations.push({ type: 'pixel-difference', description: `${(ratio * 100).toFixed(4)}%` });
    expect(ratio, 'Rendered pixels should match the original design').toBeLessThan(0.002);
    await original.close();
  });
}

test('splash leads to language selection', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.loading-text')).toHaveText('Welcome to HOLY ARMY FELLOWSHIP');
  await expect(page).toHaveURL(/\/language$/);
  await page.locator('a[href="/telugu/home"]').click();
  await expect(page).toHaveURL(/\/telugu\/home$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'te');
});

for (const state of [
  { name: 'navigation', path: 'English/home-english.html', clicks: ['.menu-toggle', '.dropdown-toggle'], selector: '.main-nav' },
  { name: 'book chapter', path: 'English/books-english.html', clicks: ['.read-btn'], selector: '.reader-content' },
  { name: 'founder chapter', path: 'English/chosen-english.html', clicks: ['.chapter-header'], selector: '.chapter.active' },
  { name: 'video card', path: 'English/videos-english.html', clicks: ['.songs-section .section-header'], selector: '.songs-section .video-card' },
  { name: 'email form', path: 'English/prayer-request-english.html', clicks: ['.method-btn:not(.active)'], selector: '.form-container' },
  { name: 'expanded testimony', path: 'Telugu/testimonies-telugu.html', clicks: ['.read-more-btn'], selector: '.testimony-card.expanded .testimony-full' }
]) {
  test(`expanded state parity: ${state.name}`, async ({ page, context }, testInfo) => {
    test.skip(!hasOriginal, 'Original website is needed for visual comparison.');
    const original = await context.newPage();
    for (const [current, url] of [[page, 'http://127.0.0.1:4201' + appPath(state.path)], [original, 'http://127.0.0.1:4173/' + state.path]] as const) {
      await current.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(current.locator('header')).toBeVisible();
      await settle(current);
      for (const selector of state.clicks) await current.locator(selector).first().click();
      await expect(current.locator(state.selector).first()).toBeVisible();
      await settle(current);
    }
    const actual = PNG.sync.read(await page.locator(state.selector).first().screenshot({ path: testInfo.outputPath('angular.png'), animations: 'disabled' }));
    const expected = PNG.sync.read(await original.locator(state.selector).first().screenshot({ path: testInfo.outputPath('original.png'), animations: 'disabled' }));
    expect({ width: actual.width, height: actual.height }).toEqual({ width: expected.width, height: expected.height });
    const difference = new PNG({ width: actual.width, height: actual.height });
    const changed = pixelmatch(actual.data, expected.data, difference.data, actual.width, actual.height, { threshold: 0.15 });
    writeFileSync(testInfo.outputPath('difference.png'), PNG.sync.write(difference));
    expect(changed / (actual.width * actual.height)).toBeLessThan(0.002);
    await original.close();
  });
}

test('navigation survives route changes, back, and refresh', async ({ page }) => {
  await page.goto('/english/home', { waitUntil: 'domcontentloaded' });
  await page.locator('.menu-toggle').click();
  await expect(page.locator('.main-nav')).toHaveClass(/active/);
  await page.locator('.main-nav a[href="/english/books"]').click();
  await expect(page).toHaveTitle('Books - Holy Army Fellowship');
  await expect(page.locator('.main-nav')).not.toHaveClass(/active/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.book-card')).toHaveCount(3);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.hero')).toBeVisible();
  await page.locator('.hero-buttons .cta-button').first().click();
  await expect(page).toHaveURL(/\/english\/home#contact$/);
  await expect(page.locator('#contact')).toBeInViewport();
  await page.locator('.hero-buttons a[title="Change Language"]').click();
  await expect(page).toHaveURL(/\/language$/, { timeout: 1500 });
  await expect(page.locator('link[data-page-style]')).toHaveCount(1);
});

test('original .html URLs redirect to clean URLs and keep the query and fragment', async ({ page }) => {
  for (const [legacy, clean] of Object.entries(legacyPageUrls)) {
    await page.goto(`/${legacy}?ref=old#contact`, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\.html/);
    if (clean) await expect(page).toHaveURL(new RegExp(`/${clean}\\?ref=old#contact$`));
  }
});

test('in-app links never expose file names', async ({ page }) => {
  for (const home of ['/english/home', '/telugu/home', '/language']) {
    await page.goto(home, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[href^="/"]').first()).toBeAttached();
    const hrefs = await page.locator('a[href^="/"]').evaluateAll(links => links.map(link => link.getAttribute('href') ?? ''));
    expect(hrefs.filter(href => /\.html/i.test(href))).toEqual([]);
  }
});

test('gallery filtering, navigation, and close restore scroll', async ({ page }) => {
  await page.goto('/english/gallery', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.gallery-item')).toHaveCount(24);
  await page.locator('[data-filter="foundation"]').click();
  await expect(page.locator('[data-filter="foundation"]')).toHaveClass(/active/);
  await page.locator('.gallery-item').first().click();
  await expect(page.locator('#lightbox')).toHaveClass(/active/);
  const first = await page.locator('#lightbox-img').getAttribute('src');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#lightbox-img')).not.toHaveAttribute('src', first!);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#lightbox-img')).toHaveAttribute('src', first!);
  await page.locator('#lightbox').evaluate(element => {
    for (const [type, screenX] of [['touchstart', 250], ['touchend', 100]] as const) {
      const touch = new Touch({ identifier: 1, target: element, screenX, clientX: screenX });
      element.dispatchEvent(new TouchEvent(type, { bubbles: true, changedTouches: [touch] }));
    }
  });
  await expect(page.locator('#lightbox-img')).not.toHaveAttribute('src', first!);
  await page.keyboard.press('Escape');
  await expect(page.locator('#lightbox')).not.toHaveClass(/active/);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('book reader keeps all chapters and selection in sync', async ({ page }) => {
  await page.goto('/english/books', { waitUntil: 'domcontentloaded' });
  await page.locator('.read-btn').first().click();
  await expect(page.locator('#readerModal')).toBeVisible();
  await expect(page.locator('#readerTitle')).toHaveText('UJJEVA PRASANGAMULU - 1');
  await expect(page.locator('#chapterSelect option')).toHaveCount(28);
  const opening = await page.locator('#readerContent').innerText();
  await page.locator('.reader-navigation .nav-btn').last().click();
  await expect(page.locator('#chapterSelect')).toHaveValue('1');
  expect(await page.locator('#readerContent').innerText()).not.toBe(opening);
  await page.locator('#chapterSelect').selectOption('10');
  await page.locator('.reader-navigation .nav-btn').first().click();
  await expect(page.locator('#chapterSelect')).toHaveValue('9');
  await page.keyboard.press('Escape');
  await expect(page.locator('#readerModal')).toBeHidden();
  await page.locator('.read-btn').last().click();
  await expect(page.locator('#readerTitle')).toHaveText('Siluvalo Daagina Viluva');
  await expect(page.locator('#chapterSelect')).toHaveValue('0');
  await page.locator('.close-reader').click();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('chapters expand individually and audio stops on close', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = async function () { this.dispatchEvent(new Event('play')); this.dispatchEvent(new Event('playing')); };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
  });
  await page.goto('/english/chosen', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.chapter.active')).toHaveCount(0);
  await page.locator('.chapter-header').first().click();
  await expect(page.locator('.chapter.active')).toHaveCount(1);
  await page.locator('.audio-play-btn').first().click();
  await expect(page.locator('.audio-container.playing')).toHaveCount(1);
  await page.locator('.audio-play-btn').nth(1).click();
  await expect(page.locator('.audio-container.playing')).toHaveCount(1);
  await page.locator('.chapter-header').nth(1).click();
  await expect(page.locator('.chapter.active')).toHaveCount(1);
  await expect(page.locator('.audio-container.playing')).toHaveCount(0);
});

test('testimony audio is self-hosted as 64 kbps mono MP3', () => {
  const html = readFileSync(path.join(root, 'src/app/pages/chosen/chosen-en.html'), 'utf8');
  const sources = [...html.matchAll(/audioSource="([^"]+)"/g)].map(match => match[1]);
  expect(sources).toHaveLength(81);
  for (const source of sources) {
    expect(source).toMatch(/^\/src\/audio\/c\d+p\d+\.mp3$/);
    const file = path.join(root, 'public', source);
    expect(existsSync(file), source).toBe(true);
    const bytes = readFileSync(file);
    let offset = 0;
    if (bytes.subarray(0, 3).toString('latin1') === 'ID3') {
      offset = 10 + ((bytes[6] & 0x7f) << 21 | (bytes[7] & 0x7f) << 14 | (bytes[8] & 0x7f) << 7 | (bytes[9] & 0x7f));
    }
    while (offset < bytes.length - 4 && !(bytes[offset] === 0xff && (bytes[offset + 1] & 0xe0) === 0xe0)) offset++;
    const [, versionLayer, rate, mode] = bytes.subarray(offset, offset + 4);
    expect((versionLayer >> 1) & 0x0f, `${source} is MPEG-1 Layer III`).toBe(0b1101);
    expect(rate >> 4, `${source} bitrate index`).toBe(5);
    expect(mode >> 6, `${source} channel mode`).toBe(3);
  }
});

test('audio warms up the opened chapter and shows loading and retry states', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = async function () { this.dispatchEvent(new Event('play')); };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event('pause')); };
  });
  // Recordings never arrive, like a stalled connection on a slow phone.
  await page.route('**/src/audio/**', () => {});
  await page.goto('/english/chosen', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('head link[rel="preconnect"][href="https://archive.org"]')).toHaveCount(0);
  await expect(page.locator('audio[src]')).toHaveCount(0);

  await page.locator('.chapter-header').first().click();
  const audio = page.locator('.chapter.active audio').first();
  await expect(audio).toHaveAttribute('src', '/src/audio/c1p1.mp3');
  await expect(audio).toHaveAttribute('preload', 'metadata');
  await expect(page.locator('.chapter:not(.active) audio[src]')).toHaveCount(0);
  await expect(page.locator('.audio-container.failed')).toHaveCount(0);

  const player = page.locator('.chapter.active .audio-container').first();
  const button = player.locator('.audio-play-btn');
  await button.click();
  await expect(player).toHaveClass(/loading/);
  await expect(button).toHaveAttribute('aria-label', 'Loading audio…');
  await expect(player.locator('.audio-status')).toHaveText('Loading audio…');
  await button.click();
  await expect(player).toHaveClass(/loading/);
  await expect(player).toHaveClass(/playing/);

  await audio.evaluate(element => element.dispatchEvent(new Event('playing')));
  await expect(player).not.toHaveClass(/loading/);
  await expect(button).toHaveAttribute('aria-label', 'Pause audio');
  await expect(player.locator('.audio-status')).toHaveCount(0);

  await audio.evaluate(element => element.dispatchEvent(new Event('error')));
  await expect(player).toHaveClass(/failed/);
  await expect(button).toHaveAttribute('aria-label', 'Retry audio');
  await expect(player.locator('.audio-status')).toContainText('could not be loaded');

  await button.click();
  await expect(player).not.toHaveClass(/failed/);
  await expect(player).toHaveClass(/loading/);
  await page.clock.runFor(20_000);
  await expect(player).toHaveClass(/failed/);
  await expect(player).not.toHaveClass(/loading/);
});
test('video search, categories, shuffle, and playback', async ({ page }) => {
  await page.goto('/english/videos', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.video-section.collapsed')).toHaveCount(2);
  await page.locator('.section-header').first().click();
  const songs = page.locator('.songs-section');
  await expect(songs).not.toHaveClass(/collapsed/);
  await songs.locator('.play-button').first().click();
  await expect(songs.locator('.video-thumbnail iframe')).toHaveCount(1);
  await songs.locator('.play-button').nth(1).click();
  await expect(songs.locator('.video-thumbnail iframe')).toHaveCount(1);
  await songs.locator('.search-box input').fill('no-such-video-938257');
  await expect(songs.locator('.video-card:visible')).toHaveCount(0);
  await expect(songs.locator('.video-thumbnail iframe')).toHaveCount(0);
  await songs.locator('.search-box input').fill('Naasanakaramaina');
  await expect(songs.locator('.video-card:visible')).toHaveCount(1);
  await page.locator('.messages-section .section-header').click();
  await expect(songs).toHaveClass(/collapsed/);
  const messages = page.locator('.messages-section');
  await messages.locator('[data-category="rani"]').first().click();
  expect(await messages.locator('.video-card:visible').count()).toBeGreaterThan(0);
  expect(await messages.locator('.video-card:visible').evaluateAll(cards => cards.every(card => card.getAttribute('data-category')?.split(' ').includes('rani')))).toBe(true);
  const count = await messages.locator('.video-card').count();
  await messages.locator('.control-btn').click();
  await expect(messages.locator('.video-card')).toHaveCount(count);
});

test('testimony search, empty results, expand and shuffle', async ({ page }) => {
  await page.goto('/english/testimonies', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.testimony-card')).not.toHaveCount(0);
  const total = await page.locator('.testimony-card').count();
  await page.locator('.search-bar').fill('Israel Raju');
  await expect(page.locator('.testimony-card:visible')).toHaveCount(1);
  await page.locator('.testimony-card:visible .read-more-btn').click();
  await expect(page.locator('.testimony-card.expanded')).toHaveCount(1);
  await page.locator('.search-bar').fill('no-such-name-58478');
  await expect(page.locator('.no-results')).toBeVisible();
  await page.locator('.search-bar').fill('');
  await page.locator('#shuffleTestimonies').click();
  await expect(page.locator('.testimony-card:visible')).toHaveCount(total);
});

test('WhatsApp encodes prayer content without sending requests', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).openedUrls = [];
    window.open = ((url: string) => { (window as any).openedUrls.push(url); return null; }) as typeof window.open;
  });
  await page.goto('/english/prayer-request', { waitUntil: 'domcontentloaded' });
  await page.locator('#name').fill('Test & Family');
  await page.locator('#place').fill('A+B #1');
  await page.locator('#prayer-type').selectOption('family');
  await page.locator('#prayer-request').fill('Line one & two\nSecond # line');
  await page.locator('#submitButton').click();
  const urls = await page.evaluate(() => (window as any).openedUrls as string[]);
  expect(urls).toHaveLength(1);
  const url = new URL(urls[0]);
  expect(url.origin + url.pathname).toBe('https://wa.me/918639067225');
  expect(url.searchParams.get('text')).toContain('Test & Family');
  expect(url.searchParams.get('text')).toContain('Line one & two\nSecond # line');
  await expect(page.locator('#name')).toHaveValue('');
  await expect(page.locator('.toast.success')).toBeVisible();
});

test('email form validates, handles failure, and reports mocked success', async ({ page }) => {
  let requests = 0;
  await page.route('https://api.web3forms.com/submit', async route => {
    requests++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postData()).toContain('test@example.com');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: requests > 1 }) });
  });
  await page.goto('/english/prayer-request', { waitUntil: 'domcontentloaded' });
  await page.locator('.method-btn').last().click();
  await expect(page.locator('#email')).toBeVisible();
  await page.locator('#submitButton').click();
  expect(requests).toBe(0);
  await page.locator('#name').fill('Test Person');
  await page.locator('#email').fill('test@example.com');
  await page.locator('#prayer-type').selectOption('healing');
  await page.locator('#prayer-request').fill('Test only, never sent to the service.');
  await page.locator('#submitButton').click();
  await expect(page.locator('.toast.error')).toBeVisible();
  await expect(page.locator('#name')).toHaveValue('Test Person');
  await page.locator('#submitButton').click();
  await expect(page.locator('.toast.success')).toBeVisible();
  await expect(page.locator('#name')).toHaveValue('');
  await page.locator('.method-btn').first().click();
  await expect(page.locator('#email')).toHaveCount(0);
});

test('calendar download produces a complete event', async ({ page }) => {
  await page.goto('/english/home', { waitUntil: 'domcontentloaded' });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('button[hafCalendar="download"]').first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('sunday-service.ics');
  const calendar = readFileSync((await download.path())!, 'utf8');
  expect(calendar).toContain('BEGIN:VCALENDAR');
  expect(calendar).toContain('SUMMARY:Sunday Service');
  expect(calendar).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  expect(calendar).toContain('END:VCALENDAR');
});

const contentPaths = [...new Set(Object.values(legacyPageUrls))].filter(clean => clean && clean !== 'language');

test('every page has one h1, a main landmark, an unbroken heading outline, and named iframes and links', async ({ page }) => {
  for (const clean of [...contentPaths, 'language']) {
    await page.goto('/' + clean, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main'), clean).toHaveCount(1);
    const summary = await page.evaluate(() => {
      const levels = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'))
        .map(heading => Number(heading.getAttribute('aria-level')) || Number(heading.tagName[1]));
      const unnamed = (element: Element) => !(element.textContent?.trim() || element.getAttribute('aria-label') || element.getAttribute('title'));
      return {
        h1: levels.filter(level => level === 1).length,
        skippedLevels: levels.filter((level, index) => index > 0 && level - levels[index - 1] > 1).length,
        iframesWithoutTitle: Array.from(document.querySelectorAll('iframe')).filter(frame => !frame.title).length,
        unnamedLinks: Array.from(document.querySelectorAll('a')).filter(unnamed).length
      };
    });
    expect(summary, clean).toEqual({ h1: 1, skippedLevels: 0, iframesWithoutTitle: 0, unnamedLinks: 0 });
  }
});

test('the footer email is a mail link', async ({ page }) => {
  await page.goto('/english/home', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('footer a[href^="mailto:"]').first()).toHaveAttribute('href', 'mailto:Haf@holyarmyfellowship.org');
});

test('every page shows the same footer for its language, with no phone number', async ({ page }) => {
  const footers = new Map<string, string>();
  for (const clean of contentPaths) {
    await page.goto('/' + clean, { waitUntil: 'domcontentloaded' });
    const footer = page.locator('footer');
    await expect(footer, clean).toHaveCount(1);
    const html = await footer.evaluate(element => element.outerHTML.replace(/<!--.*?-->/g, ''));
    expect(html, clean).not.toMatch(/tel:|\+91|phone|ఫోన్/i);
    const language = clean.split('/')[0];
    if (!footers.has(language)) footers.set(language, html);
    expect(html, clean).toBe(footers.get(language));
  }
  expect([...footers.keys()].sort()).toEqual(['english', 'telugu']);
});

test('home page service times match the church schedule in both languages', async ({ page }) => {
  for (const [path, key] of [['/english/home', 'englishTime'], ['/telugu/home', 'teluguTime']] as const) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const cards = page.locator('.calendar-buttons').locator('..');
    for (const [index, service] of (['sunday', 'second-saturday'] as const).entries()) {
      await expect(cards.nth(index), `${path} ${service}`).toContainText(serviceSchedule[service][key].replace(' (IST)', ''));
    }
  }
});

test('photos and book PDFs are served by the site itself', async ({ page, request }) => {
  const assets = new Set<string>();
  for (const route of ['/english/books', '/telugu/books', '/english/chosen', '/telugu/chosen', '/english/gallery']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();
    for (const src of await page.locator('main img, .gallery-item img').evaluateAll(images => images.map(image => image.getAttribute('src') ?? ''))) assets.add(src);
    for (const href of await page.locator('a.download-btn').evaluateAll(links => links.map(link => link.getAttribute('href') ?? ''))) {
      expect(href).toMatch(/^\/src\/pdfs\/.+\.pdf$/);
      assets.add(href);
    }
  }
  expect(assets.size).toBeGreaterThan(24);
  for (const asset of assets) {
    expect(asset, 'asset should be local').toMatch(/^\/src\//);
    const response = await request.get(asset);
    expect(response.status(), asset).toBe(200);
    expect(response.headers()['content-type'], asset).toMatch(asset.endsWith('.pdf') ? /application\/pdf/ : /^image\//);
  }
});

test('the About menu works with the space bar', async ({ page }) => {
  await page.goto('/english/home', { waitUntil: 'domcontentloaded' });
  await page.locator('.menu-toggle').click();
  const toggle = page.locator('.dropdown-toggle').first();
  await toggle.focus();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});

test('reduced-motion preference stops looping animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/english/home', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.site-name').first()).toHaveCSS('animation-iteration-count', '1');
});

test('pages publish a description, canonical URL and language alternates', async ({ page, baseURL }) => {
  await page.goto('/english/books', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /spiritual resources/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${baseURL}/english/books`);
  await expect(page.locator('link[rel="alternate"][hreflang="te"]')).toHaveAttribute('href', `${baseURL}/telugu/books`);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', `${baseURL}/language`);
  await page.goto('/telugu/books', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', `${baseURL}/english/books`);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'te_IN');
  // Moving to a page without its own description must not leave the previous one behind.
  await page.goto('/english/home', { waitUntil: 'domcontentloaded' });
  await page.locator('.hero-buttons a[title="Change Language"]').click();
  await expect(page).toHaveURL(/\/language$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${baseURL}/language`);
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Join us in worship/);
});

test.describe('calendar events use the church time, whatever the visitor timezone', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  for (const [path, service, start, end] of [
    ['/english/home', 'sunday', 'T043000Z', 'T073000Z'],
    ['/english/home', 'second-saturday', 'T040000Z', 'T090000Z'],
    ['/telugu/home', 'sunday', 'T043000Z', 'T073000Z'],
    ['/telugu/home', 'second-saturday', 'T040000Z', 'T090000Z']
  ] as const) {
    test(`${path} ${service}`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const downloadPromise = page.waitForEvent('download');
      await page.locator(`button[hafCalendar="download"][calendarService="${service}"]`).click();
      const calendar = readFileSync((await (await downloadPromise).path())!, 'utf8');
      expect(calendar).toMatch(new RegExp(`DTSTART:\\d{8}${start}`));
      expect(calendar).toMatch(new RegExp(`DTEND:\\d{8}${end}`));
    });
  }
});
