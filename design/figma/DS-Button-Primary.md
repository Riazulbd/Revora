# Button/Pill/Primary (16:2)

## Visual description

A single pill-shaped button, rendered roughly 86 × 41 px — the frame hugs its
label, so the width is entirely a function of the text plus padding.

- **Shape**: fully rounded pill. Radius token `--full` = 999px, so the left and
  right ends are perfect semicircles at this height. No border, no shadow, no
  outline of any kind — the shape is a flat solid fill against the canvas.
- **Fill**: solid brand orange-red `#d2400f` (`--brand/primary`). Flat, no
  gradient and no overlay.
- **Padding**: 20px horizontal (`--20`), 12px vertical (`--12`). With a 14px
  label and normal line-height that lands the total height at ~41px.
- **Layout**: a single-child row, `items-center justify-center` — the label is
  optically centred on both axes. There is nothing else inside: no leading icon,
  no trailing chevron, no spinner slot.
- **Copy**: exactly `Button` (the component's default label prop).
- **Type**: 14px, regular weight, not italic, `leading-[normal]`, set in Inter in
  the Figma file. Colour is `--brand/onprimary` = white (`#ffffff`), which reads
  as clean white against the orange — high contrast, no transparency.
- **State**: this is the resting / enabled state. Nothing in the screenshot
  indicates press, hover, focus, disabled or loading — there is no focus ring,
  no pressed darkening, no reduced opacity.

Visible in the screenshot but not obvious from the code: the label does not sit
mathematically centred in the box so much as optically centred — the 20px side
padding is generous relative to the short word, so the pill reads wider than it
is tall by roughly 2:1. The white text has no letter-spacing adjustment applied.

## Design context

```tsx
type ButtonPillPrimaryProps = {
  className?: string;
  label?: string;
};

export default function ButtonPillPrimary({ className, label = "Button" }: ButtonPillPrimaryProps) {
  return (
    <div className={className || "bg-[var(--brand\\/primary,#d2400f)] content-stretch flex items-center justify-center px-[var(--20,20px)] py-[var(--12,12px)] relative rounded-[var(--full,999px)]"} data-node-id="16:2" data-name="Button/Pill/Primary">
      <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-[color:var(--brand\/onprimary,white)] whitespace-nowrap" data-node-id="16:3">
        {label}
      </p>
    </div>
  );
}
```
