# Button/Pill/Secondary (16:18)

## Visual description

The same pill silhouette as the primary button and the same measured size
(~86 × 41 px, hugging its label), but rendered as a soft tinted button rather
than a solid one.

- **Shape**: fully rounded pill, radius `--full` = 999px.
- **Fill**: very pale peach `#fdeae3` (`--brand/softbg`) — a desaturated tint of
  the primary orange, light enough that against a white canvas the button reads
  mostly as its outline.
- **Border**: 1px solid `#f6d3c5` (`--brand/softborder`). In the screenshot this
  is only slightly darker than the fill — a quiet containing edge, not a strong
  outline. It is what separates the button from a white background; on a white
  page the fill alone would be nearly invisible.
- **Padding**: 20px horizontal (`--20`), 12px vertical (`--12`) — identical to
  the primary, so the two buttons sit at the same height and can be paired in a
  row without optical adjustment.
- **Layout**: single child, `items-center justify-center`. No icon, no chevron,
  no divider.
- **Copy**: exactly `Button`.
- **Type**: 14px, regular, not italic, Inter, `leading-[normal]`. Colour is
  `--brand/onsoft` = `#c93d0e` — a rust/burnt orange, slightly deeper and less
  saturated than the primary fill `#d2400f`, which is what keeps it legible on
  the pale peach.
- **State**: resting / enabled. No focus ring, no pressed state, no disabled
  dimming.

Visible in the screenshot but not obvious from the code: the border is the
lowest-contrast element in the component — at 1px against `#fdeae3` it reads as
a hairline, and the three brand values in play (`#fdeae3` fill, `#f6d3c5`
border, `#c93d0e` text) form a deliberate light-to-dark ramp of the same hue
rather than three unrelated colours.

## Design context

```tsx
type ButtonPillSecondaryProps = {
  className?: string;
  label?: string;
};

export default function ButtonPillSecondary({ className, label = "Button" }: ButtonPillSecondaryProps) {
  return (
    <div className={className || "bg-[var(--brand\\/softbg,#fdeae3)] border border-[var(--brand\\/softborder,#f6d3c5)] border-solid content-stretch flex items-center justify-center px-[var(--20,20px)] py-[var(--12,12px)] relative rounded-[var(--full,999px)]"} data-node-id="16:18" data-name="Button/Pill/Secondary">
      <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-[color:var(--brand\/onsoft,#c93d0e)] whitespace-nowrap" data-node-id="16:19">
        {label}
      </p>
    </div>
  );
}
```
