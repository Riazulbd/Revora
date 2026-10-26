# Input/Field/Default (16:20)

## Visual description

A single-line text field drawn at a fixed width of 280px and a height of ~41px.
Unlike the buttons, the width is pinned rather than hugging.

- **Shape**: rounded rectangle, radius `--md` = **14px**. Noticeably softer than
  a typical 8px input but well short of the pill used on buttons — at this
  height the corners are a generous arc with a clear straight run along the top
  and bottom edges.
- **Fill**: `#f5f6f8` (`--surface/subtle`) — a very light neutral grey, just a
  step off white.
- **Border**: 1px solid `#e9ebef` (`--border/default`). Against the `#f5f6f8`
  fill this is almost imperceptible in the screenshot: the field reads as a soft
  grey slab, and the border only does real work where the field meets a white
  surface.
- **Padding**: 16px horizontal (`--16`), 12px vertical (`--12`).
- **Layout**: a row with `items-center` and **no** `justify-center` — the
  content is left-aligned, which is what makes this read as an input rather than
  a button. The text sits 16px in from the left edge and is vertically centred.
- **Copy**: exactly `Placeholder`.
- **Type**: 14px, regular, not italic, Inter, `leading-[normal]`. Colour is
  `--ink/muted` = `#9aa1aa` — a mid grey that reads clearly as placeholder text,
  not as an entered value.
- **State**: empty / resting. There is no label above the field, no helper text
  below it, no leading or trailing icon, no clear button, and no caret — this
  artboard draws the unfocused empty field only.

Visible in the screenshot but not obvious from the code: the fill and the border
are close enough in value that the component's perceived edge comes mostly from
the fill, so on a `#f5f6f8` page background this field would nearly disappear —
it is designed to sit on white or on a lighter surface. The 14px radius is also
larger than the 12px `--sm` used for the list row's icon tile, so inputs are the
softer of the two shapes.

## Design context

```tsx
type InputFieldDefaultProps = {
  className?: string;
  placeholder?: string;
};

export default function InputFieldDefault({ className, placeholder = "Placeholder" }: InputFieldDefaultProps) {
  return (
    <div className={className || "bg-[var(--surface\\/subtle,#f5f6f8)] border border-[var(--border\\/default,#e9ebef)] border-solid content-stretch flex items-center px-[var(--16,16px)] py-[var(--12,12px)] relative rounded-[var(--md,14px)] w-[280px]"} data-node-id="16:20" data-name="Input/Field/Default">
      <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-[color:var(--ink\/muted,#9aa1aa)] whitespace-nowrap" data-node-id="16:21">
        {placeholder}
      </p>
    </div>
  );
}
```
