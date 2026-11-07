// Builds smaller copies of the gallery photos and records each photo's size in gallery.data.ts.
// The originals are 16-megapixel camera photos; phones choke decoding them for 400px-wide tiles.
//   npm run optimize:images            -> only builds missing copies
//   npm run optimize:images -- --force -> rebuilds every copy
import { readdir, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const galleryDir = path.join(root, 'public', 'src', 'images', 'Gallery');
const dataFile = path.join(root, 'src', 'app', 'features', 'gallery.data.ts');
const widths = [480, 960, 1920];
const quality = 78;
const force = process.argv.includes('--force');

const exists = file => stat(file).then(() => true, () => false);
const originals = (await readdir(galleryDir, { withFileTypes: true }))
  .filter(entry => entry.isFile() && /\.(webp|jpe?g|png)$/i.test(entry.name))
  .map(entry => entry.name);

const dimensions = new Map();
let before = 0;
let after = 0;
for (const name of originals) {
  const source = path.join(galleryDir, name);
  const meta = await sharp(source).metadata();
  const rotated = (meta.orientation ?? 1) >= 5;
  dimensions.set(name, { width: rotated ? meta.height : meta.width, height: rotated ? meta.width : meta.height });
  before += (await stat(source)).size;
  for (const size of widths) {
    const target = path.join(galleryDir, `w${size}`, name.replace(/\.\w+$/, '.webp'));
    if (force || !(await exists(target))) {
      await mkdir(path.dirname(target), { recursive: true });
      await sharp(source).rotate().resize({ width: size, withoutEnlargement: true })
        .webp({ quality, effort: 5 }).toFile(target);
    }
    if (size === 480) after += (await stat(target)).size;
  }
}

// Keep the order and categories in gallery.data.ts and refresh only the sizes.
const source = await readFile(dataFile, 'utf8');
const match = /=\s*(\[[\s\S]*\]);?\s*$/.exec(source);
if (!match) throw new Error('Could not find the image list in gallery.data.ts');
const images = JSON.parse(match[1]).map(({ src, category }) => {
  const size = dimensions.get(path.posix.basename(src));
  if (!size) throw new Error(`No original found for ${src}`);
  return { src, category, width: size.width, height: size.height };
});
await writeFile(dataFile, `${source.slice(0, match.index)}= ${JSON.stringify(images, null, 2)};\n`);

const mb = bytes => (bytes / 1048576).toFixed(1) + ' MB';
console.log(`${originals.length} photos: originals ${mb(before)}, grid copies ${mb(after)}`);
