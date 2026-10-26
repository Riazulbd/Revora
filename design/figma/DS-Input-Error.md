# Input/Field/Error (16:22)

## Visual description

Geometrically identical to `Input/Field/Default` (16:20) — 280px wide, ~41px
tall, radius `--md` = 14px, fill `#f5f6f8`, 16px / 12px padding, left-aligned
content. **Two things change, and only two.**

- **Border**: 1px solid `#d92d20` (`--status/danger`) — a saturated red. This is
  by far the most prominent element in the screenshot: against the near-white
  `#f5f6f8` fill the red hairline fully defines the shape, where the default
  variant's `#e9ebef` border barely registered. The border stays 1px; the error
  state is signalled by hue, not by thickening the stroke.
- **Text colour**: `#14171b` (`--ink/primary`) — near-black, not the muted
  `#9aa1aa` of the default variant. In the screenshot the word reads as dark,
  committed text rather than as a placeholder. The copy is still literally
  `Placeholder`, so this artboard is drawing *a filled field that failed
  validation*, with the placeholder string standing in for the user's value.

Everything else is unchanged: same fill, same radius, same padding, same
`items-center` left-aligned single-child row, same 14px Inter regular at normal
leading.

Visible in the screenshot but not obvious from the code: there is **no error
message below the field, no error icon inside it, and no red tint on the fill**.
The entire error treatment is the border colour plus the darker ink. Anything
that renders a helper line or a warning glyph alongside this field is not drawn
on this artboard and would need its own source.

## Design context

```tsx
type InputFieldErrorProps = {
  className?: string;
  placeholder?: string;
};

export default function InputFieldError({ className, placeholder = "Placeholder" }: InputFieldErrorProps) {
  return (
    <div className={className || "bg-[var(--surface\\/subtle,#f5f6f8)] border border-[var(--status\\/danger,#d92d20)] border-solid content-stretch flex items-center px-[var(--16,16px)] py-[var(--12,12px)] relative rounded-[var(--md,14px)] w-[280px]"} data-node-id="16:22" data-name="Input/Field/Error">
      <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-[color:var(--ink\/primary,#14171b)] whitespace-nowrap" data-node-id="16:23">
        {placeholder}
      </p>
    </div>
  );
}
```
