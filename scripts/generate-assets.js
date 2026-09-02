/**
 * Generates every Android/iOS launcher asset from the approved Revora logo.
 * Run with: node scripts/generate-assets.js
 * Source of truth: ./logo.png (approved brand mark — do not substitute or recolour).
 *
 * logo.png is 1536x1024 with a transparent background. Measured content boxes:
 *   R mark   x 475..956, y 189..484
 *   Full lockup (mark + REVORA + KNOW YOUR BIKE)  x 132..1405, y 189..784
 */
const sharp = require('sharp');
const path = require('path');

const SRC = path.join(__dirname, '..', 'logo.png');
const OUT = path.join(__dirname, '..', 'assets');

const MARK = { left: 475, top: 189, width: 482, height: 296 };
const LOCKUP = { left: 132, top: 189, width: 1274, height: 596 };

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const canvas = (size, background) =>
  sharp({ create: { width: size, height: size, channels: 4, background } });

const centred = (size, w, h) => ({ left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) });

async function main() {
  const markAt = async (w) => {
    const h = Math.round((w * MARK.height) / MARK.width);
    return { buf: await sharp(SRC).extract(MARK).resize(w, h).png().toBuffer(), w, h };
  };

  // 1. Launcher icon — full-bleed square, opaque white ground (matches how the
  //    approved design presents the logo on a white card).
  {
    const { buf, w, h } = await markAt(760);
    await canvas(1024, WHITE)
      .composite([{ input: buf, ...centred(1024, w, h) }])
      .png()
      .toFile(path.join(OUT, 'icon.png'));
  }

  // 2. Android adaptive foreground — mark inside the 66% safe zone.
  {
    const { buf, w, h } = await markAt(600);
    await canvas(1024, TRANSPARENT)
      .composite([{ input: buf, ...centred(1024, w, h) }])
      .png()
      .toFile(path.join(OUT, 'adaptive-icon.png'));
  }

  // 3. Splash — the full lockup, transparent so the configured background shows through.
  {
    const w = 900;
    const h = Math.round((w * LOCKUP.height) / LOCKUP.width);
    const buf = await sharp(SRC).extract(LOCKUP).resize(w, h).png().toBuffer();
    await canvas(1024, TRANSPARENT)
      .composite([{ input: buf, ...centred(1024, w, h) }])
      .png()
      .toFile(path.join(OUT, 'splash-icon.png'));
  }

  // 4. Android notification icon — white silhouette on transparency, driven by
  //    the logo's own alpha channel so the whole mark survives.
  {
    const size = 192;
    const h = Math.round((size * MARK.height) / MARK.width);
    const { data, info } = await sharp(SRC)
      .extract(MARK)
      .resize(size, h)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const mono = Buffer.alloc(size * h * 4);
    for (let px = 0; px < size * h; px++) {
      const a = data[px * info.channels + 3];
      mono[px * 4] = 255;
      mono[px * 4 + 1] = 255;
      mono[px * 4 + 2] = 255;
      mono[px * 4 + 3] = a > 60 ? 255 : 0;
    }
    const shape = await sharp(mono, { raw: { width: size, height: h, channels: 4 } }).png().toBuffer();
    await canvas(size, TRANSPARENT)
      .composite([{ input: shape, ...centred(size, size, h) }])
      .png()
      .toFile(path.join(OUT, 'notification-icon.png'));
  }

  // 5. Dark-theme logo.
  //    The approved lockup sets the REVORA wordmark in near-black ink (rgb 22,22,24),
  //    which is invisible on the dark theme's #101214 ground. This variant keeps the
  //    geometry, the orange mark and the tagline exactly as approved and lifts only
  //    the neutral ink to the dark theme's --ink token. Nothing is redrawn.
  {
    const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.from(data);
    const INK = [0xf2, 0xf4, 0xf6];
    for (let px = 0; px < info.width * info.height; px++) {
      const i = px * info.channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      // Neutral (grey/black) pixels only — the orange mark has high chroma.
      if (chroma <= 18 && max <= 110) {
        out[i] = INK[0];
        out[i + 1] = INK[1];
        out[i + 2] = INK[2];
      }
    }
    await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toFile(path.join(OUT, 'logo-dark.png'));
  }

  // 6. Web favicon.
  {
    const { buf, w, h } = await markAt(56);
    await canvas(64, WHITE)
      .composite([{ input: buf, ...centred(64, w, h) }])
      .png()
      .toFile(path.join(OUT, 'favicon.png'));
  }

  console.log('Assets written to assets/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
