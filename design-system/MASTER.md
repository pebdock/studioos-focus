# STUDIOOS Focus — Liquid Glass presentation system

This is the authoritative web design specification. It follows the requested Apple-inspired direction using CSS materials, not a native iOS renderer. It makes no claim about new iOS 27 APIs. The study timer, data, storage, synchronization, routes, and original JavaScript files keep their existing behavior.

## Product and hierarchy

Focus is a personal study workspace. The primary task is to begin, run, pause and confirm a study session. Keep the current timer and essential controls prominent during an active session. The original today summary, agenda, learning, preparation, plan, exam and account information remain available.

- Light canvas: pale periwinkle `#edf1fb`; white opaque reading surfaces.
- Dark canvas: deep navy `#101724`; opaque blue-gray reading surfaces.
- Use content cards only for existing major product sections. Rows and inset surfaces organize smaller values.
- The floating dock keeps all six original destinations. Its original spring and hash routing remain in charge of interaction.
- Long help lives in native disclosure controls and native auto popovers. Time-sensitive exam alerts stay visible.
- During a running session the timer card takes visual priority through CSS. No app state is changed.

## Source guidance and verified skill searches

[Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials) separates Liquid Glass controls/navigation from content surfaces. Text-heavy popovers use a regular, legible material. The implementation uses an 86–98% card-color glass fill, `blur(24px) saturate(180%)`, a directional white inset highlight, and diffuse shadows. Dense content never relies on a translucent card.

The `ui-ux-pro-max` design-system generator was queried with `study productivity calm glass` and, once, a narrower `productivity tool minimal glassmorphism` rewrite. Both returned a marketing-page layout and unrelated teal/orange branding. That output was rejected rather than persisted. This master uses the user's specific product direction and the verified domain results below.

- `glassmorphism control layer --domain style`: active `glassmorphism` result. Its overlay/navigation material guidance applies; its suggestions for transparent content cards do not apply to this brief.
- `focus not obscured --domain ux`: Web accessibility results distinguish AA minimum focus visibility from AAA full visibility. The dock reserves page space and controls have scroll margins.
- `responsive forms semantic controls --stack html-tailwind`: semantic color tokens apply generally. This repo is plain HTML/CSS, so no Tailwind syntax, plugin or framework was added.
- Reduced transparency search had no verified specific match. The explicit user requirement and CSS media-query fallback govern that behavior.

The generated concept is a layout/material reference. Dummy numbers and illustrative agenda rows in that image are not product data and were not copied into the app.

## Files and ownership

- `refinement.css`: one authoritative global system: tokens, type, layout, controls, layers, material, disclosures, modes, accessibility and responsive behavior.
- `learning.css`: learning, topic, prerequisite and study-step components only.
- `interaction.css`, `ios.css`, `liquid.css`: comment-only compatibility URLs. The unchanged service-worker precache manifest still requests these paths; deleting them would break installation.
- `index.html` and `setup.html`: native semantic markup using the same system.

No font CDN, icon runtime, CSS framework or new dependency is needed. All original functional IDs, classes, `data-*` attributes and ARIA hooks are retained. Existing generated segmented controls still write into their original select mirrors. Those mirrors use `display:none` to prevent invisible keyboard stops while their visible radio controls remain operable.

## Design tokens

All global tokens live in `:root` in `refinement.css`. Existing aliases such as `--bg`, `--ink`, `--mute`, `--acc` and `--tint` map to this system so unchanged renderers continue to work.

| Token | Light | Dark |
|---|---|---|
| `--surface-canvas` | `#edf1fb` | `#101724` |
| `--surface-card` | `#ffffff` | `#1b2535` |
| `--surface-inset` | `#f0f3f9` | `#253145` |
| `--text-primary` | `#142038` | `#edf2ff` |
| `--text-secondary` | `#53617a` | `#b4c1d8` |
| `--accent-primary` | `#2457d5` | `#a8bfff` |
| `--glass-bg` | 86–98% card color | 86–98% card color |
| `--glass-specular` | `inset 0 1px 0 0 rgba(255,255,255,.55)` | same directional highlight |
| `--radius-outer` | 28px desktop; 24px mobile; 22px narrow | same |
| `--pad-card` | 24px desktop; 20px mobile; 16px narrow | same |
| `--radius-inner` | `max(4px, outer radius - card padding)` | same |
| `--ease-spring` | `cubic-bezier(.22,1,.36,1)` | same |
| `--ease-sheet` | `cubic-bezier(.32,.72,0,1)` | same |

Nested card surfaces derive their radius from their actual inset. Capsule controls and circular timer/status components retain their semantic shape. The glass tint slider still changes control opacity through the original `--glass-tint` property. The `standard` appearance uses opaque controls. The `essential` atmosphere removes the optional greeting illustration; existing settings and saved values are retained.

## Typography and iconography

Use the native Apple/system stack, with SF Pro and Segoe UI fallbacks. No remote font is loaded. Body text is 16px with a 1.55 line height; editable fields stay at least 16px on phones. Headings use `-0.02em` tracking. Timers use a lighter display weight and all timers, numeric metrics, percentages, dates and hours use tabular numbers.

New controls use clean 24×24 inline SVG line icons with roughly 1.8–2px strokes. Decorative SVGs are hidden from accessibility APIs. Icon-only actions retain meaningful labels. Existing hint symbols use a vector mask without editing the original script that generates them.

## Interaction and motion

- Buttons and disclosure summaries have at least 44px target height; step-state buttons are 44×44px.
- Press feedback scales a control to `.97`.
- Micro motion: 220ms with `--ease-spring`.
- Sheet/drawer motion: 340ms with `--ease-sheet`.
- Only transforms and opacity animate. Width, height, position, blur, color and shadow are not animated by the stylesheets.
- Native help popovers support close buttons, Escape and outside click. Their body text wraps fully. Native details start closed.
- Existing tab-lens JavaScript still owns its spring animation. The CSS never competes with its geometry.
- `prefers-reduced-motion:reduce` and the original `body.rm` setting disable presentation motion.
- `prefers-reduced-transparency:reduce` and `prefers-contrast:more` replace materials with solid surfaces and remove backdrop filtering.

## Layer scale

| Layer | Token | Value |
|---|---|---:|
| In-component content | `--z-base` | 1 |
| Sticky section selectors | `--z-sticky` | 10 |
| Floating navigation and timer | `--z-floating-glass` | 50 |
| Help drawers and expanded status header | `--z-sheet-drawer` | 100 |
| Existing confirmation sheets and StandBy | `--z-modal` | 200 |
| Toast feedback | `--z-toast` | 300 |

Native dialog/popover top-layer rules also apply. An open status header rises to drawer level so its menu cannot disappear behind the bottom dock in short landscape viewports.

## Accessibility and validation

The opaque token pairs have these calculated WCAG contrast ratios:

| Pair | Light | Dark |
|---|---:|---:|
| Primary text / card | 16.24:1 | 13.76:1 |
| Secondary text / card | 6.25:1 | 8.48:1 |
| Accent text / card | 6.18:1 | 8.48:1 |

Glass uses a high-opacity surface color to keep those roles legible over content. Runtime browser checks must also inspect composed backgrounds. Fields use a stronger border token than decorative dividers. Keyboard focus has a 3px accent outline with a 4px offset. Text, filenames, instructions, topic names and status chips wrap instead of being line-clamped.

Verification targets: desktop 1440×900; phone 390×844; narrow 375px; landscape; both supported themes; reduced motion; reduced transparency; long fixture text; active timer; original OLED and StandBy modes; existing sheets and release/prerequisite dialogs; all new popovers and disclosures. Test results and any limits belong in `docs/QA-RESULTS.md` or the PR description, not in claims of pixel-perfect fidelity here.
