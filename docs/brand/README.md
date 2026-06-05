# FLOW — brand assets

Fork-and-merge mark: parallel executor waves converge into a verified gate node
(the green check = `VERIFY → PASS`, the one constraint that gates ship).

## Files

| File | Use |
|------|-----|
| `flow-logo-full.svg` | Full lockup (mark + wordmark + expansion). Auto-adapts to light/dark via CSS. |
| `flow-logo-full-light.svg` / `flow-logo-full-dark.svg` | Fixed-palette lockups for GitHub `<picture>` theme switching. |
| `flow-mark.svg` | Mark only (auto light/dark). Favicon, avatar, app icon. |
| `flow-mark-light.svg` / `flow-mark-dark.svg` | Fixed-palette mark variants. |

## Drop into your README

Single auto-adapting lockup (works in most renderers):

```md
<img src="docs/brand/flow-logo-full.svg" alt="FLOW — Fresh-context Loop for Orchestrated Work" width="420">
```

Reliable GitHub light/dark switching:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/flow-logo-full-dark.svg">
  <img src="docs/brand/flow-logo-full-light.svg" alt="FLOW" width="420">
</picture>
```

## Palette

- Purple nodes/paths — `#534AB7` / `#7F77DD` (light), `#AFA9EC` / `#7F77DD` (dark)
- Verify gate (teal/green) — `#0F6E56` (light), `#1D9E75` (dark)
- Wordmark — near-black `#1A1A19` / off-white `#F5F4EF`

The wordmark in the lockup is converted to vector paths (Poppins Bold), so it
renders identically without the font installed. The italic expansion line stays
live text in a serif fallback stack.
