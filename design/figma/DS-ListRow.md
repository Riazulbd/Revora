# List/Row (16:24)

## Visual description

A 360px-wide list row on a white surface, ~72px tall, laid out as a three-part
horizontal row: icon tile, text column, trailing value. Top to bottom there is
only one band, so the description below runs left to right.

- **Container**: background `#ffffff` (`--surface/base`), 16px padding on all
  sides (`--16`), 12px gap between children (`--12`), `items-center`. **No
  border, no divider rule and no corner radius** on the row itself — in the
  screenshot the row is a flat white band, so separation between stacked rows
  must come from somewhere other than this component.

- **Left — IconTile** (`16:25`): a 40 × 40 square with radius `--sm` = **12px**,
  so it reads as a rounded squircle rather than a circle. Fill is `#fdeae3`
  (`--brand/softbg`) — the same pale peach as the secondary button, which ties
  the tile to the brand without using the full-strength orange. `overflow-clip`
  is set, and the content is centred.
  - Inside sits an **IconWrapper** (`9:5006`), a 20 × 20 centred box, holding an
    18 × 18 vector named **`star`** (`9:5017`), delivered as an SVG asset.
  - In the screenshot the star is a **five-pointed outlined star** — a dark,
    near-black stroke with the peach tile showing through the middle. It is
    *not* a filled star and it is *not* tinted to the brand orange; the stroke
    reads as the same near-black as the title text, which is the single most
    surprising detail here given the warm tile behind it.
  - Note the 18px glyph inside a 20px wrapper inside a 40px tile: there is a 1px
    breathing ring around the glyph and 10px of tile around the wrapper.

- **Middle — TextCol** (`16:29`): `flex-[1_0_0]` with `min-w-px`, so it absorbs
  all slack and is the element that truncates first. Column layout, 4px gap
  (`--4`), left-aligned, `overflow-clip`. Both lines are 14px Inter regular,
  normal leading, each `w-full`:
  - **`Title`** (`16:30`) in `#14171b` (`--ink/primary`) — near-black.
  - **`Subtitle`** (`16:31`) in `#6b727c` (`--ink/secondary`) — a mid-grey.
    Notably this is *lighter* than the title but *darker* than the `#9aa1aa`
    muted grey used for input placeholders, so it is a genuine third ink step.
  - Both lines are the same 14px size — the hierarchy is carried entirely by
    colour, not by type scale or weight.

- **Right — Value** (`16:32`): the literal copy `Value`, 14px Inter regular,
  `#14171b` (`--ink/primary`), `whitespace-nowrap` and `shrink-0` — it never
  wraps and never compresses. Same size and same colour as the title, so the
  row's two "strong" data points visually match. It sits hard against the 16px
  right padding.

Visible in the screenshot but not obvious from the code: there is **no trailing
chevron or disclosure arrow**, so this row is not drawn as navigable; the value
occupies the slot a chevron would normally take. The baselines of `Title` and
`Value` align, with `Subtitle` hanging below — the value aligns to the top line
of the text column, not to the column's vertical centre, because the whole row
centres the text column as a block.

## Design context

```tsx
const assetPathPrefix = "https://www.figma.com/api/mcp/asset/e6d64236-497f-40ce-b7fe-6f6cbc7fb40b";
const imgStar = `${assetPathPrefix}/12dbb.svg`;

type IconWrapperProps = {
  className?: string;
  size?: "20";
};

function IconWrapper({ className, size = "20" }: IconWrapperProps) {
  return (
    <div className={className || "content-stretch flex items-center justify-center relative size-[20px]"} data-node-id="9:5006">
      <div className="relative shrink-0 size-[18px]" data-node-id="9:5017" data-name="star">
        <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgStar} />
      </div>
    </div>
  );
}

type ListRowProps = {
  className?: string;
  subtitle?: string;
  title?: string;
  value?: string;
};

export default function ListRow({ className, subtitle = "Subtitle", title = "Title", value = "Value" }: ListRowProps) {
  return (
    <div className={className || "bg-[var(--surface\\/base,white)] content-stretch flex gap-[var(--12,12px)] items-center p-[var(--16,16px)] relative w-[360px]"} data-node-id="16:24" data-name="List/Row">
      <div className="bg-[var(--brand\/softbg,#fdeae3)] content-stretch flex items-center justify-center overflow-clip relative rounded-[var(--sm,12px)] shrink-0 size-[40px]" data-node-id="16:25" data-name="IconTile">
        <IconWrapper className="content-stretch flex items-center justify-center relative shrink-0 size-[20px]" />
      </div>
      <div className="[word-break:break-word] content-stretch flex flex-[1_0_0] flex-col font-['Inter:Regular'] font-normal gap-[var(--4,4px)] items-start leading-[normal] min-w-px not-italic overflow-clip relative text-[14px]" data-node-id="16:29" data-name="TextCol">
        <p className="relative shrink-0 text-[color:var(--ink\/primary,#14171b)] w-full" data-node-id="16:30">
          {title}
        </p>
        <p className="relative shrink-0 text-[color:var(--ink\/secondary,#6b727c)] w-full" data-node-id="16:31">
          {subtitle}
        </p>
      </div>
      <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-[color:var(--ink\/primary,#14171b)] whitespace-nowrap" data-node-id="16:32">
        {value}
      </p>
    </div>
  );
}
```
