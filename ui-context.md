# UI Context 

## Theme

Light, warm, and energetic. The visual language is **playful neobrutalism** — a cream/off-white background, bold black borders, hard flat offset shadows, vivid accent fills, and rounded (but still chunky) corners. Think Figma meets a zine. No gradients. No blur. No softness in shadows.

All colors are defined as CSS custom properties in `globals.css` and mapped to Tailwind tokens via `@theme inline`. Components must use these tokens — no hardcoded hex values or raw Tailwind color classes.

---

## Color Tokens

| Role              | CSS Variable             | Hex / Value                          |
| ----------------- | ------------------------ | ------------------------------------ |
| Page background   | `--bg-base`              | `#F5EFE6` (warm cream)               |
| Surface (card)    | `--bg-surface`           | `#FFFFFF`                            |
| Elevated surface  | `--bg-elevated`          | `#F9F6F1`                            |
| Subtle surface    | `--bg-subtle`            | `#F0EBE2`                            |
| Border            | `--border-default`       | `#111111` (near-black, all borders)  |
| Border muted      | `--border-muted`         | `#444444`                            |
| Primary text      | `--text-primary`         | `#111111`                            |
| Secondary text    | `--text-secondary`       | `#555555`                            |
| Muted text        | `--text-muted`           | `#888888`                            |
| Brand accent      | `--accent-yellow`        | `#F5C842` (CTA yellow)               |
| Brand accent dark | `--accent-yellow-dark`   | `#C49B10`                            |
| Accent pink       | `--accent-pink`          | `#FF6B8A`                            |
| Accent teal       | `--accent-teal`          | `#00C8B4`                            |
| Accent cyan       | `--accent-cyan`          | `#00C8D4`                            |
| AI accent         | `--accent-ai`            | `#7B5CF5` (purple)                   |
| AI text           | `--accent-ai-text`       | `#EDE8FF`                            |
| Error             | `--state-error`          | `#FF6B6B`                            |
| Success           | `--state-success`        | `#B6F5C8`                            |
| Success text      | `--state-success-text`   | `#0A6630`                            |
| Warning           | `--state-warning`        | `#F5C842`                            |
| Shadow            | `--shadow-nb`            | `4px 4px 0 #111111`                  |
| Shadow large      | `--shadow-nb-lg`         | `6px 6px 0 #111111`                  |
| Shadow accent     | `--shadow-nb-accent`     | `4px 4px 0 var(--accent-yellow)`     |
| Shadow AI         | `--shadow-nb-ai`         | `4px 4px 0 var(--accent-ai)`         |

---

## Neobrutalism Rules

These are hard rules. Every component follows all of them.

1. **Borders are thick and black.** All surfaces use `border: 2.5px solid var(--border-default)`. Structural dividers use `border: 1.5px solid var(--border-muted)`.
2. **Hard offset shadows only.** `box-shadow: var(--shadow-nb)` — no blur, no spread, no alpha softening. The shadow is a solid black rectangle offset 4px right and 4px down.
3. **Rounded but chunky corners.** This is playful neobrutalism, not zero-radius brutalism. Use the scale below — corners are visible and intentional, never pill-soft except for avatar circles and status badges.
4. **Flat fills.** Accents are used as solid fills. No tint overlays, no opacity dimming as resting states.
5. **Heavy typography.** Buttons, labels, nav links, and card titles use `font-weight: 800`, `text-transform: uppercase`, `letter-spacing: 0.05em`. Body text stays at 500 for readability at small sizes.
6. **Yellow is the primary CTA color.** The main action button is always `--accent-yellow` with `color: --text-primary`. Other accent fills (pink, teal, cyan, purple) are used for supporting UI and states.
7. **Active/pressed state.** On click: `transform: translate(3px, 3px); box-shadow: none` — the element "pushes in" to its shadow. Transition is `80ms ease-in`.
8. **No dark mode.** The design is light-only. The warm cream page background is always `--bg-base`.

---

## Typography

| Role         | Font      | Variable              |
| ------------ | --------- | --------------------- |
| UI / display | Geist Sans | `--font-geist-sans`  |
| Code / mono  | Geist Mono | `--font-geist-mono`  |

### Type Scale

| Role            | Size  | Weight | Transform | Tracking |
| --------------- | ----- | ------ | --------- | -------- |
| Hero / H1       | 48px+ | 900    | uppercase | 0        |
| Section heading | 24px  | 800    | none      | -0.01em  |
| Card title      | 14px  | 800    | uppercase | 0.03em   |
| Label / meta    | 11px  | 800    | uppercase | 0.08em   |
| Body            | 14px  | 500    | none      | 0        |
| Code / mono     | 13px  | 400    | none      | 0        |
| Button text     | 13px  | 800    | uppercase | 0.05em   |

Accent headings and active section labels use `color: var(--text-primary)` — no color accent on type itself. Color lives in fills and backgrounds, not in text.

---

## Border Radius Scale

Corners are rounded but deliberate. This distinguishes playful neobrutalism from hard-edged neobrutalism.

| Context                   | Value             |
| ------------------------- | ----------------- |
| Small elements (badges, chips, inputs) | `border-radius: 10px` |
| Buttons                   | `border-radius: 12px` |
| Cards / panels            | `border-radius: 16px` |
| Modals / large overlays   | `border-radius: 20px` |
| Pill badges / status dots | `border-radius: 9999px` |
| Circular avatars          | `border-radius: 50%` |

---

## Shadows

| Token                | Value                              | Use                            |
| -------------------- | ---------------------------------- | ------------------------------ |
| `--shadow-nb`        | `4px 4px 0 #111111`                | Cards, buttons, inputs         |
| `--shadow-nb-lg`     | `6px 6px 0 #111111`                | Modals, sidebars, large panels |
| `--shadow-nb-sm`     | `3px 3px 0 #111111`                | Small elements, badges         |
| `--shadow-nb-accent` | `4px 4px 0 var(--accent-yellow)`   | Focused inputs, highlighted cards |
| `--shadow-nb-ai`     | `4px 4px 0 var(--accent-ai)`       | AI sidebar, AI-driven actions  |

Active / pressed: `transform: translate(4px, 4px); box-shadow: none`

---

## Component Patterns

### Cards / Panels

```css
.card {
  background: var(--bg-surface);           /* white */
  border: 2.5px solid var(--border-default);
  border-radius: 16px;
  box-shadow: var(--shadow-nb);
  padding: 1rem 1.25rem;
}

/* Accent fill variants */
.card--yellow  { background: var(--accent-yellow); color: var(--text-primary); }
.card--pink    { background: var(--accent-pink);   color: #ffffff; }
.card--teal    { background: var(--accent-teal);   color: var(--text-primary); }
.card--ai      { background: var(--accent-ai);     color: #ffffff; }
```

### Buttons

```css
.btn {
  background: var(--accent-yellow);
  color: var(--text-primary);
  border: 2.5px solid var(--border-default);
  border-radius: 12px;
  box-shadow: var(--shadow-nb);
  padding: 9px 20px;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: transform 80ms ease-in, box-shadow 80ms ease-in;
}
.btn:active {
  transform: translate(4px, 4px);
  box-shadow: none;
}

/* Variants */
.btn--black  { background: #111; color: #fff; }
.btn--white  { background: #fff; color: #111; }
.btn--teal   { background: var(--accent-teal); color: #111; }
.btn--ai     { background: var(--accent-ai);   color: #fff; }
```

### Inputs

```css
.input {
  background: var(--bg-surface);
  border: 2.5px solid var(--border-default);
  border-radius: 10px;
  box-shadow: var(--shadow-nb-sm);
  padding: 9px 13px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  outline: none;
}
.input:focus {
  box-shadow: var(--shadow-nb-accent);
}
```

### Badges / Pills

```css
/* Status pill (rounded) */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 2px solid var(--border-default);
  border-radius: 9999px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge--success { background: var(--state-success);  color: var(--state-success-text); }
.badge--error   { background: var(--state-error);    color: #ffffff; }
.badge--warning { background: var(--state-warning);  color: var(--text-primary); }
.badge--ai      { background: var(--accent-ai);      color: #ffffff; }
```

---

## Canvas

### Node Color Palette

Nodes use light-tinted fills with dark readable text — matching the warm light theme. All nodes get `border: 2.5px solid #111111`, `border-radius: 10px`, and `box-shadow: 3px 3px 0 #111111`. Node labels are `font-weight: 800`, `text-transform: uppercase`.

| Node fill | Text color   | Border    | Character              |
| --------- | ------------ | --------- | ---------------------- |
| `#FFFFFF`  | `#111111`   | `#111111` | Default white          |
| `#DDEEFF`  | `#1155AA`   | `#111111` | Blue — process/step    |
| `#EDE8FF`  | `#5B3FC8`   | `#111111` | Purple — AI/logic      |
| `#FFE8CC`  | `#B05000`   | `#111111` | Orange — trigger/event |
| `#FFDDEA`  | `#B02050`   | `#111111` | Pink — output/result   |
| `#D0FAF4`  | `#0A7A6E`   | `#111111` | Teal — data/storage    |
| `#EAFAD0`  | `#2A6010`   | `#111111` | Green — success/done   |
| `#FFF5CC`  | `#8A6000`   | `#111111` | Yellow — decision      |

Default node: white fill `#FFFFFF`, text `#111111`.

### Node Shadow Pattern (SVG)

```jsx
{/* Shadow rect behind, then node rect on top */}
<rect x={x+3} y={y+3} width={w} height={h} fill="#111111" rx={10} />
<rect x={x}   y={y}   width={w} height={h} fill={nodeFill}
      stroke="#111111" strokeWidth={2.5} rx={10} />
```

### Edge Style

Smooth-step path, arrowhead marker. Stroke: `#111111`, width: `2px`. The arrow is bold and angular, matching the border weight of nodes.

### Node Shapes

All shapes use `rx=10` for the rounded-chunky feel. Pill shape is retained (use `rx=9999` for pill).

- `rectangle` — default, rounded corners
- `diamond` — decision / gateway (SVG polygon, thick stroke)
- `circle` — event / endpoint
- `pill` — service / process
- `cylinder` — database / storage
- `hexagon` — external system / boundary

### Connection Handles

Small **rounded square** handles: `8px × 8px`, `border-radius: 4px`, `background: #fff`, `border: 2px solid #111`, `box-shadow: 2px 2px 0 #111`. Hidden by default, shown on hover.

### Canvas Background

React Flow `<Background variant="dots">` on `--bg-base` (`#F5EFE6`). The warm cream base gives the canvas a paper / sketchbook feel.

---

## Layout Patterns

- **Editor workspace:** Full-viewport. Warm cream canvas center. Floating left sidebar: `background: #fff; border: 2.5px solid #111; border-radius: 16px; box-shadow: var(--shadow-nb-lg)`. Right AI slide-over: `background: #fff; border-left: 2.5px solid #111; box-shadow: -4px 0 0 #111`.
- **Sidebars:** White background, thick black border, hard offset shadow. Nav items are full-width blocks, `border-bottom: 1.5px solid #ddd`, uppercase labels, 800 weight. Active item: `background: var(--accent-yellow); color: #111; border-bottom-color: #111`.
- **Modals:** `background: #fff; border: 2.5px solid #111; border-radius: 20px; box-shadow: var(--shadow-nb-lg)`. No backdrop blur — overlay is flat `rgba(245, 239, 230, 0.85)`.
- **Navbar:** `background: #fff; border: 2.5px solid #111; border-radius: 14px; box-shadow: var(--shadow-nb)`. Sits at the top, not full-bleed — has its own card-like border. Brand name is `font-weight: 900`. Nav links are `uppercase`, `font-weight: 700`. Active link has `border-bottom: 2.5px solid #111`. A right-aligned AI/status pill uses `background: var(--accent-ai); color: #fff; border-radius: 9999px; border: 2px solid #111`.

---

## Icons

Lucide React. Stroke-based only, no filled variants. Stroke width bumped to `2` (from default 1.5) to match the heavy border language.

| Context         | Size              |
| --------------- | ----------------- |
| Inline / label  | `h-4 w-4` (16px)  |
| Buttons         | `h-5 w-5` (20px)  |
| Feature / empty | `h-8 w-8` (32px)  |

---

## Motion

Snappy and mechanical. No springy easing, no long durations.

| Interaction              | Transition                                        |
| ------------------------ | ------------------------------------------------- |
| Button press             | `transform 80ms ease-in` + shadow off             |
| Input focus              | `box-shadow 80ms ease-in`                         |
| Card hover               | `transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #111` (lift) |
| Sidebar open/close       | `transform 150ms ease-in`                         |
| Node drag                | Immediate — no transition                         |
| Modal open               | `opacity + scale(0.97→1) 120ms ease-out`          |

Card hover is the one "alive" micro-interaction — lifting the card up-left as the shadow grows slightly makes the canvas feel physical.