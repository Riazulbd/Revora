/**
 * Play Store listing assets, generated from the approved brand artwork and real
 * screenshots captured on the emulator against live data.
 *
 *   play-assets/icon-512.png                 512x512 hi-res icon
 *   play-assets/feature-graphic.png          1024x500 feature graphic
 *   play-assets/screenshots/phone-NN.png     1080x1920 framed phone screenshots
 *
 * Run: node scripts/generate-play-assets.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'play-assets');
const SHOTS = path.join(ROOT, 'shots');
const MANROPE_BOLD = path.join(ROOT, 'node_modules/@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf');
const MANROPE_MED = path.join(ROOT, 'node_modules/@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf');

const INK = '#14171B';
const MUT = '#878E98';
const BG = '#F5F6F8';
const DARK = '#0A0B0C';
const ACC = '#F4511E';

const MARK = { left: 475, top: 189, width: 482, height: 296 };
const LOCKUP = { left: 132, top: 189, width: 1274, height: 596 };

const text = (str, { fontfile = MANROPE_BOLD, width, height, colour = INK, dpi = 300 }) =>
  sharp({
    text: {
      text: `<span foreground="${colour}">${str}</span>`,
      fontfile,
      width,
      height,
      rgba: true,
      dpi,
      align: 'centre',
    },
  })
    .png()
    .toBuffer();

async function icon512() {
  const mark = await sharp(path.join(ROOT, 'logo.png')).extract(MARK).resize(380, 233).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: '#FFFFFF' } })
    .composite([{ input: mark, left: 66, top: 140 }])
    .png()
    .toFile(path.join(OUT, 'icon-512.png'));
}

async function featureGraphic() {
  const lockup = await sharp(path.join(ROOT, 'assets/logo-dark.png'))
    .extract(LOCKUP)
    .resize(700, 327)
    .png()
    .toBuffer();
  const strap = await text('Fuel · Mileage · Maintenance · Expenses', {
    fontfile: MANROPE_MED,
    colour: '#9AA1AA',
    dpi: 150,
  });
  await sharp({ create: { width: 1024, height: 500, channels: 4, background: DARK } })
    .composite([
      { input: lockup, left: 162, top: 55 },
      { input: strap, left: 262, top: 415 },
    ])
    .png()
    .toFile(path.join(OUT, 'feature-graphic.png'));
}

const SCREENS = [
  ['10-dashboard-data', 'Know your bike.', BG, INK],
  ['31-analytics', 'Mileage you can trust', BG, INK],
  ['12-fuel-list', 'Every fill-up, logged', BG, INK],
  ['20-maintenance', 'Never miss a service', BG, INK],
  ['17-expenses-all', 'Every taka accounted for', BG, INK],
  ['23-services', 'History that proves itself', BG, INK],
  ['14-garage', 'Your garage, in your pocket', BG, INK],
  ['51-dashboard-dark', 'Easy on the eyes at night', DARK, '#F2F4F6'],
];

async function phoneShots() {
  const dir = path.join(OUT, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });

  for (const [index, [name, caption, background, colour]] of SCREENS.entries()) {
    const source = path.join(SHOTS, `${name}.png`);
    if (!fs.existsSync(source)) {
      console.warn('missing shot', name);
      continue;
    }

    // The device frame: the screenshot with rounded corners and a hairline.
    const shot = await sharp(source).resize(700, 1556, { fit: 'cover', position: 'top' }).png().toBuffer();
    const rounded = Buffer.from(
      `<svg width="700" height="1556"><rect x="0" y="0" width="700" height="1556" rx="34" ry="34"/></svg>`,
    );
    const framed = await sharp(shot)
      .composite([{ input: rounded, blend: 'dest-in' }])
      .png()
      .toBuffer();
    const border = Buffer.from(
      `<svg width="708" height="1564"><rect x="2" y="2" width="704" height="1560" rx="38" ry="38" fill="none" stroke="${
        background === DARK ? '#2C3138' : '#D8DBE0'
      }" stroke-width="3"/></svg>`,
    );

    const captionImg = await text(caption, { colour, dpi: 340 });
    const captionMeta = await sharp(captionImg).metadata();

    await sharp({ create: { width: 1080, height: 1920, channels: 4, background } })
      .composite([
        { input: captionImg, left: Math.round((1080 - captionMeta.width) / 2), top: 120 },
        { input: framed, left: Math.round((1080 - 700) / 2), top: 260 },
        { input: border, left: Math.round((1080 - 708) / 2), top: 256 },
      ])
      .png()
      .toFile(path.join(dir, `phone-${String(index + 1).padStart(2, '0')}.png`));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await icon512();
  await featureGraphic();
  await phoneShots();
  console.log('play-assets written');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
