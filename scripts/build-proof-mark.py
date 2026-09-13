#!/usr/bin/env python3
"""Regenerates src/features/records/brandMark.ts from the app mark.

The Proof Pack PDF is a standalone HTML string handed to expo-print, which has
no bundler and no asset server behind it, so the mark has to be embedded as a
data URI. Run this after changing assets/splash-icon-light.png:

    python3 scripts/build-proof-mark.py

Needs Pillow (`pip install Pillow`).
"""
import base64
import io
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets' / 'splash-icon-light.png'
TARGET = ROOT / 'src' / 'features' / 'records' / 'brandMark.ts'
# The mark prints at roughly 46px wide; 3x survives a zoomed PDF without
# carrying a megabyte of splash artwork into the JS bundle.
SIDE = 168

HEADER = '''/**
 * The Revora mark, inlined as a data URI.
 *
 * The Proof Pack is rendered by handing a standalone HTML string to
 * expo-print, which resolves nothing: there is no bundler, no asset registry
 * and no file server behind it, so `require('../../assets/…')` and a relative
 * `<img src>` both produce an empty box in the PDF. The bytes have to travel
 * inside the document.
 *
 * Generated from `assets/splash-icon-light.png` — do not edit by hand, run
 * `python3 scripts/build-proof-mark.py` instead.
 */
export const REVORA_MARK_DATA_URI =
  'data:image/png;base64,' +
'''


def main() -> None:
    image = Image.open(SOURCE).convert('RGBA')
    image = image.crop(image.split()[3].getbbox())

    side = max(image.size)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
    square = square.resize((SIDE, SIDE), Image.LANCZOS)

    buffer = io.BytesIO()
    square.save(buffer, format='PNG', optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode()

    lines = [f"  '{encoded[i:i + 96]}' +" for i in range(0, len(encoded), 96)]
    lines[-1] = lines[-1].rstrip(' +')
    TARGET.write_text(HEADER + '\n'.join(lines) + ';\n')
    print(f'{TARGET.relative_to(ROOT)} — {len(encoded):,} chars')


if __name__ == '__main__':
    main()
