# STUDIOOS Focus — Liquid Glass web presentation

Focus is a study workspace. The current block, timer and applicable actions have priority; the next action and compact checklist follow. The existing application continues to own study state, calculations, Google integration, storage formats and action handlers.

## Tokens and ownership

`tokens.css` owns the light/dark palette, six subject colors, study-type aliases, text roles, glass, radii 12/18/24/32, spacing 4/8/12/16/24/32, three depths, native type scale and 180/280/450 ms durations. Existing renderer aliases (`--ink`, `--mute`, `--MDP`, etc.) map to this system. Existing `motion.js` supplies sampled `linear()` springs, with cubic-bezier fallbacks.

`refinement.css` owns layout, controls, material and accessibility modes. `learning.css` owns checklist/topic components. The three legacy CSS URLs remain cached compatibility stubs. `ui-glass-effects.js` is an isolated presentation enhancement: reflection coordinates, SVG edge channel separation, decorative checklist strokes, interpolation of existing ring values and offscreen blur suspension. It does not read or write application data, routes or storage.

## Material and contrast

Compact glass has 60–86% surface coverage in light mode and 68–90% in dark mode, controlled by the original tint setting. Text-heavy block/sheet glass has 84–96% coverage. Light secondary ink is `#46536b`; dark secondary ink is `#b4c1d8`. Foreground opacity is never used as a tint control. The canvas uses restrained static lighting.

The header, timer block, floating dock, island, chips and sheets share tint, blur/saturation/brightness, inner rim, specular light and soft depth. Dense content elsewhere stays opaque. RGB displacement is confined to the small island in the original Chromium capability path. WebKit uses conic/radial gradients and double rims. This is a web approximation, not Apple's native renderer.

Standard remains opaque. Reduced transparency, increased contrast and unsupported backdrop filtering use opaque materials. Forced colors use system colors. Decorative layers never intercept pointer events. No remote font, CDN, analytics or runtime package is introduced.

## Information and controls

The selected or active block comes first through CSS. Applicable phone actions share one row; active Focus toasts use the safe top area. Other screens retain the compact island and a separate toast position. Original hidden/disabled state determines which action applies.

Closed checklist rows show time, duration, title and type. Full instructions and the type editor are visible on `.open` or `:focus-within`; no informational text is removed. Long titles wrap on narrow phones. Existing native disclosures retain secondary options and help, including Altre opzioni.

Targets are at least 44 px high, with native editable text, visible focus rings, pointer-only hover and a .96 press transform. Ring interpolation animates SVG output already calculated by the timer; it does not create another clock. Reduced motion removes springs/parallax and permits short fades. View changes currently use the CSS fade fallback. The View Transitions JavaScript API is not intercepted because original navigation also persists active sessions.

## Performance and release boundaries

The original `lensMap` alone now returns an offline-encoded 128×128 PNG instead of blocking canvas readback. A test compares all 65,536 decoded RGBA bytes against the original function. The remaining `liquid.js` source is protected. Original script execution order/attributes stay intact; preload hints fetch them together. Original timer/data/authentication JavaScript stays byte-identical.

The banner hook already created by the adapter is declared empty in HTML, with responsive minimum space. The adapter continues to populate/hide it. Long messages grow naturally. Authenticated first-load layout shifts require a real signed-in check; the synthetic audit does not cover them.

The service worker changes only its cache version and the two approved aesthetic assets; its handlers and existing asset order remain protected. Dependencies stay outside the site. Local `tools/` screenshots are ignored by Git and never pushed to Pages. CI regenerates screenshots as downloadable artifacts.

## CSS quality exceptions

Stylelint extends the standard configuration. Existing camelCase IDs cannot be renamed; uppercase subject custom properties are renderer hooks. Overlapping state/media selectors intentionally use the cascade, so descending-specificity lint is disabled. Exact WebKit prefixes remain for Safari material/mask/input compatibility. Other standard rules stay enabled. No new `!important` declaration was added.

Measured outputs and browser limits belong in the release audit and PR. Automated WebKit is not a physical Safari/iPhone test.
