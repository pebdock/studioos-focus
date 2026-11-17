# Liquid Glass UI verification

The branch `feat/ios27-liquid-glass-ui` changes presentation while preserving the original application source. The baseline is `0451dcd5f333bc46338acf2f0954f8d52fcdbf08` on `main`. No merge or deployment is part of this change.

## Result

- **1,081 automated checks passed**, across 28 Chromium/WebKit viewport, theme and browser cases, plus two real functional baseline/candidate runs. No failures.
- **184 additional interaction checks passed** at 1440×900 and 390×844 in light and dark themes. Every new disclosure and both help drawers were opened and closed. Close buttons, Escape, outside click, focus return and shortcut isolation were exercised.
- **17 original JavaScript files are byte-identical as Git source blobs.** This includes timer, calculation, learning, storage, routing, sync, navigation, release and service-worker code.
- All **249 original IDs**, **496 original DOM hook elements**, **17 original script tags**, 463 literal selector references, 144 listener bindings and 29 storage references are protected. Original classes, data attributes, functional ARIA attributes, handlers and script order are retained.
- The single new `ui-glass-controls` inline block only isolates keyboard events while a new help surface is open and manages focus. It does not read or write application data. Its exact SHA-256 is authorized by the original content security policy; no broad inline-script permission was added.
- Linked and inline CSS decreased from **103,534 to 48,028 bytes**, a **53.6% reduction**. No production dependency was added.

The app is static HTML/CSS/JavaScript and has no application build step. Asset digests, source contracts and actual browser runs validate the delivered files.

## Functional evidence

The test loads a synthetic 90-minute study block into a fresh local browser context. It uses the original visible controls, rather than replacing the timer with a screenshot fixture. The baseline and branch both:

1. Start a session and advance the displayed timer.
2. Pause and resume, closing and reopening measured time segments.
3. Save notes and a checklist state, reload, and recover the same active session.
4. Cancel an interruption, then record an interruption and resume.
5. Return from the completion sheet without losing the paused run.
6. Confirm one session and discard another.
7. Export both terminal outcomes with matching normalized state and routing.

Regression checks also prove that guide prose does not trigger timer, OLED or route shortcuts; Escape restores the opener; opening another help panel retains its focus; clicking an outside input dismisses help without stealing that input's focus; and the account banner does not cover the active timer heading.

The source test and browser summary are retained in `docs/evidence/`. CI runs `python3 tests/ui_parity.py` and `node .github/ui-check/check.cjs`. The existing UI workflow was repaired to compare the actual release and baseline instead of requiring obsolete version 2.3.1 and twelve release notes. Touch-target assertions still require 44px; their fixture now opens the type editor before measuring it.

## Text disclosure map

The full 23-paragraph and dynamic-text inventory is in [UI-AUDIT.md](UI-AUDIT.md). This branch adds the following closed native disclosures without copying or replacing their renderer roots:

| Original root | Entry point |
| --- | --- |
| `#planRules` | Regole e quote del piano |
| `#pInfo` | Come arrivano le proposte |
| `#prQuality` | Qualità e limiti dei dati |
| `#anLimit` | Legenda del carico settimanale |
| `#anFeas` | Fattibilità e scenari |
| `#anEx` | Esercizi, verifiche e simulazioni |
| `#anGrade` | Stima del voto |
| `#sGlassHelp` | Dettagli sulla trasparenza; its original `aria-describedby` relation is preserved |
| `#installTxt` | Istruzioni per il tuo dispositivo, opening a native help drawer |

The new **Guida** drawer groups session instructions, navigation and keyboard help into short sections. Existing formulas, legends, full tasks, materials, notes and settings groups retain their original disclosures. Exam-change notices remain visible: `#tdExams` keeps its original parent because the renderer inserts `#tdNews` beside it.

## Visual and accessibility evidence

The browser matrix covers 320, 375, 390, 430, 768, 1280 and 1440 CSS pixels, both themes and both engines. The requested captures use 1440×900 and 390×844. It checks all main destinations, horizontal reflow, long filenames, expanded checklist controls, 200% text, release-dialog reflow, keyboard navigation and reduced motion.

Computed text colors were measured against composed backgrounds in fourteen representative route/help states. No contrast failure was found: the minimum measured ratio was **5.53:1 in light mode** and **7.21:1 in dark mode**. The six subject badge palettes also retain at least 5.76:1 and 8.42:1 respectively. These are measured representative states, not a claim that every possible user-supplied image or third-party state was tested.

A browser context with service workers allowed reported **zero console errors, warnings or uncaught exceptions**. Both reduced-transparency and reduced-motion media queries were emulated through the DevTools protocol: glass filtering and presentation animation became `none`. OLED, StandBy, show-controls, the floating timer, all existing sheets and settings mirrors were independently checked. The native select mirrors remain in the DOM but no longer create invisible keyboard stops.

Chrome DevTools MCP and Playwright MCP could not launch because their configured Chrome Stable executable is absent. Verification used installed Chromium through a persistent Playwright session and the Chrome DevTools protocol instead. The full automated matrix used Playwright 1.65.1 and its matching cached Chromium/WebKit engines. No browser installation or system configuration change was required.

A new PWA installation was loaded online, switched offline, reloaded and opened the new guide successfully. New UI behavior travels inside the cached HTML; no uncached runtime dependency was introduced.

## Concept comparison

The generated concept is an art-direction reference, not a replacement for product data. Its native image is 1487×1058; implementation evidence uses the user's requested 1440×900 viewport and responsive 390×844 viewport. The concept and final rendered screenshots were inspected directly with `view_image`.

| Comparison point | Result and intentional differences |
| --- | --- |
| Palette and materials | Cool periwinkle/navy canvas, opaque readable content, regular glass only on floating controls and overlays |
| Layout | Original two-column focus/agenda structure preserved; the active timer moves ahead of the today summary through CSS |
| Type and numbers | Native system font, clear weights, tabular timers and metrics; existing subject tint remains authoritative |
| Controls and icons | Capsule actions and floating six-destination SVG dock; existing action names and enabled/hidden states preserved |
| Spacing and geometry | One spacing/radius system; nested radii derive from actual padding; content retains a consistent 1200px container |
| Copy and real data | The only new top-level action is the requested Guida entry point; summary labels implement the requested disclosures. The concept's illustrative numbers, agenda rows and connected status were not copied |
| Responsive behavior | Small-screen cards reflow, the dock remains reachable, the active timer is unobscured and text wraps without clamps |
| Motion | Only transform/opacity transitions; the original navigation spring remains unchanged; reduced-effect preferences are honored |

Visual review corrected an invisible subject badge, connection-popover stacking in landscape, offscreen active-session hierarchy, and the sticky account banner overlapping mobile study. No remaining material visual mismatch was found within the preserved product structure and the intentional differences above. This verifies the implementation against the requested design direction, not a pixel-identical rendering of the concept's invented data.

## Screenshots

All sample study content is synthetic. Before/after empty states use the same viewport and theme.

| State | Desktop | Mobile |
| --- | --- | --- |
| Before, light | [View](screenshots/before-desktop-light.png) | [View](screenshots/before-mobile-light.png) |
| After, light | [View](screenshots/after-desktop-light.png) | [View](screenshots/after-mobile-light.png) |
| Before, dark | [View](screenshots/before-desktop-dark.png) | [View](screenshots/before-mobile-dark.png) |
| After, dark | [View](screenshots/after-desktop-dark.png) | [View](screenshots/after-mobile-dark.png) |
| Active session, light | [View](screenshots/active-desktop-light.png) | [View](screenshots/active-mobile-light.png) |
| Active session, dark | [View](screenshots/active-desktop-dark.png) | [View](screenshots/active-mobile-dark.png) |
| Guide, light | [View](screenshots/guide-desktop-light.png) | [View](screenshots/guide-mobile-light.png) |

## Limits and rollout

**Existing installed PWAs keep their previous cached shell.** The original cache-first worker and its cache version are intentionally byte-identical under the absolute JavaScript guardrail. A normal release needs a separately authorized cache-version update, or existing clients must clear their app cache/reinstall. The successful fresh-install offline check does not prove an old installation updates automatically. This PR does not change `main` or deploy the new shell.

Authenticated Google sign-in, live Sheets/Calendar traffic, real multi-device writes, wake lock, physical-device vibration, notifications and sustained 60/120fps hardware performance were not exercised. Their original code is unchanged. The inherited Escape behavior in the original application sheets remains as documented in the audit; new help drawers handle Escape correctly.
