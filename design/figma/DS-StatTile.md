# Stat/Tile (16:8)

## Visual description

A small dark metric card, 160px wide and ~104px tall, holding three stacked
lines of text. This is the **dark/accent** variant — every colour token on it is
namespaced `accentdark/*`, and the screenshot confirms a near-black card, so
this tile is drawn to sit on a dark accent panel rather than on the white
`--surface/base` used by the list row.

- **Container**: fill `#23272c` (`--accentdark/surface2`) — a very dark neutral
  with a slight cool cast, not pure black. Radius `--lg` = **16px**, the largest
  radius in this set (vs. 14px inputs, 12px icon tile), giving noticeably round
  corners at this small size. Padding 16px on all sides (`--16`). No border and
  no shadow.
- **Layout**: a column, `items-start`, 8px gap (`--8`) between the three lines.
  Each line is `w-full` and left-aligned, so the three values form a clean left
  edge 16px in from the card.
- **Type**: all three lines are **14px Inter regular**, not italic, normal
  leading. There is no size change and no weight change between them — exactly
  as in the list row, hierarchy is carried entirely by colour.

Top to bottom:

1. **`Label`** (`16:9`) — `#9aa1aa` (`--accentdark/textsecondary`). A mid-grey
   that recedes against the dark card; in the screenshot it is clearly the
   quietest of the three.
2. **`$0.00`** (`16:10`) — white `#ffffff` (`--accentdark/textprimary`). The
   brightest element, and the one the eye lands on. Note the copy is a currency
   amount with a `$` symbol and two decimal places.
3. **`+0%`** (`16:11`) — green `#4cc38a` (`--status/successondark`). A mint/
   spring green chosen for legibility on dark ground, not the usual saturated
   success green. The copy carries an explicit leading `+` sign.

Visible in the screenshot but not obvious from the code: the delta line is
**green even though its value is `+0%`** — zero is being drawn in the positive
colour, so the token is tied to the sign character in the string rather than to
a computed sign. There is also **no icon, no sparkline, no trend arrow and no
divider** anywhere on the tile; it is purely three lines of text. And because
the metric and the label are the same 14px, this tile does *not* use an
oversized display number — the value is distinguished only by being white.

## Design context

```tsx
type StatTileProps = {
  className?: string;
  delta?: string;
  label?: string;
  value?: string;
};

export default function StatTile({ className, delta = "+0%", label = "Label", value = "$0.00" }: StatTileProps) {
  return (
    <div className={className || '[word-break:break-word] bg-[var(--accentdark\\/surface2,#23272c)] content-stretch flex flex-col font-["Inter:Regular"] font-normal gap-[var(--8,8px)] items-start leading-[normal] not-italic p-[var(--16,16px)] relative rounded-[var(--lg,16px)] text-[14px] w-[160px]'} data-node-id="16:8" data-name="Stat/Tile">
      <p className="relative shrink-0 text-[color:var(--accentdark\/textsecondary,#9aa1aa)] w-full" data-node-id="16:9">
        {label}
      </p>
      <p className="relative shrink-0 text-[color:var(--accentdark\/textprimary,white)] w-full" data-node-id="16:10">
        {value}
      </p>
      <p className="relative shrink-0 text-[color:var(--status\/successondark,#4cc38a)] w-full" data-node-id="16:11">
        {delta}
      </p>
    </div>
  );
}
```
