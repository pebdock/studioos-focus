# UI regression inventory

The baseline is `origin/main`, resolved to its commit SHA by each parity run.
All tests use public assets and synthetic data. No personal Google account is
needed. This is a static PWA; there is no package build or dependency install.

## Source guardrail

Run `python tests/ui_parity.py --base origin/main` from the repository.

The test compares the canonical Git bytes of **every original production
JavaScript file**, including the timer, storage, adapter, navigation, existing
UI modules, release code and service worker. It also checks all original HTML
IDs, original class tokens, `data-*`, `aria-*`, roles, form constraints, event
attributes, original script contents and loading order. Added classes and
wrappers are allowed. Added IDs and production scripts use `ui-glass-`.
One new inline `ui-glass-controls` block isolates application keyboard
shortcuts while a help popover is open. It cannot touch storage, network or
routing. The HTML content-security policy must authorize its exact SHA256
hash and preserve every original restriction; arbitrary inline scripts remain
blocked. Original scripts and their relative loading order remain protected.

The original JavaScript staying byte-identical protects both literal and
computed selectors, event listeners, storage keys and algorithms at their
source. This does **not** prove that a new wrapper leaves every runtime DOM
relationship intact. The browser checks below cover those relationships.

## Browser coverage list

| Claim / control | Action and expected result | Visual state / evidence |
| --- | --- | --- |
| Primary navigation | Click all six original tabs; verify matching `aria-selected`, panel and unchanged hash. Arrow keys, Home and End select the expected tab. | All views at desktop 1440×900 and mobile 390×844. |
| Analysis sections | Select Ritmo, Argomenti, Piano and Esami; return to the same view and reload. Existing stored section selection persists. | Each selected section; long numeric and title content wraps. |
| Study sections | Select Materiali, Ripasso and Registro; reload and verify existing selection persists. | Materials, error list, simulations, export. |
| Timer start | Seed one synthetic cached block, open it and click Avvia. The active run identifies that block; elapsed time advances. | Timer, phase, enabled controls, tabular digits. |
| Timer pause / resume | Click Pausa; inspect the paused run, then resume. Reload and verify the same active run is restored. | Paused/running labels remain readable and usable. |
| Interruption | Open Interrompi, select a reason and cancel; reopen and record. Existing interruption and timer state are preserved. | `mInt` sheet, backdrop, keyboard focus. |
| Session completion | Open Concludi, cancel with Torna allo studio; reopen, enter evidence, confirm or discard the synthetic run. | `mDone`, validation, rating controls and long labels. |
| Notes / checklist | Enter notes, mark a checklist item, change its activity classification; reload. | Full source task/file names remain available; stored values return. |
| Settings | Change theme, look, glass amount, work/break length and reduced-motion setting. Reload. | Light and dark independently; native select/segmented controls. |
| Calendar | Previous / next / today, week previous / next and the link back to all-day view still work. | Empty and populated synthetic states. |
| Backup export | Generate JSON in Study → Registro, verify parseable synthetic state; copy control still runs. | Textarea is accessible inside any new disclosure. |
| Original first-run release dialog | Open with `STUDIOOS_RELEASE.open()`, dismiss with its existing action. | Small-screen reflow and no background obstruction after dismiss. |
| New disclosures | Inventory every `ui-glass-` trigger. Open and close each using its trigger, ×, Escape and backdrop where applicable. | Open state, closing transition, focus return, no duplicate IDs. |
| New modal / drawer focus | Tab and Shift+Tab within it. Open from the keyboard; dismiss and verify focus returns to its trigger. | Visible focus throughout; fixed bars never cover it. |
| Source text retained | Compare long-text map with each new disclosure. Every original instruction, legend and operational note remains reachable. | Screenshots of sheet and compact details. |
| Motion | Emulate `prefers-reduced-motion: reduce`; repeat new open/close behavior. Enable the app's own reduced-motion setting. | No background drift; nonessential motion removed. |
| Transparency | Emulate `prefers-reduced-transparency: reduce`, or validate the matching media rules in DevTools when unsupported by automation. | Opaque controls and modal surfaces preserve contrast. |
| Contrast | Read computed foreground/background values; composite translucent surfaces over the rendered backing and calculate WCAG contrast. | Normal body/control text ≥4.5:1 in each theme; focus indicators visible. |
| Layout | Compare document scroll width with viewport in every view and open overlay. Check long file names and 200% text. | No horizontal page overflow at 390px; also test 375px and mobile landscape. |
| Console / resources | Record page exceptions, console errors/warnings and failed local asset requests during all cases. | Zero new errors; record baseline issues separately. |

## Off-path probes

1. Rapidly open, close and reopen a new drawer, then press Escape twice. Its
   final visual, `open`/expanded state, focus and page scrolling must agree.
2. Navigate with the hash directly to `#focus`, `#registro` and
   `#b=R20-9001`; reload while a synthetic timer is running. Existing routing
   and recovery must match the baseline.
3. Use a long unbroken file name/URL and a multi-line instruction in a
   checklist; enlarge text to 200% with an open disclosure. The full value
   must remain available without widening the page.
4. Start with empty storage and offline networking. The app still exposes
   navigation and clear empty/local-copy states; opening guidance must not
   change application storage or trigger a network request.

## Existing preflight limitations

`.github/ui-check/check.cjs` supplies a Chromium/WebKit, width/theme matrix
and synthetic DOM fixtures. This PR repairs the baseline's stale version
`2.3.1` and twelve-note assumptions: version checks now compare BUILD with
the actual release version; note counts must match the before variant.
All sixteen application scripts, including the release module, stay identical.
The user additionally authorized rollout to installed PWAs. Only the single
cache VERSION literal in the service worker may change; CORE and every handler
remain identical. BUILD must name that new cache version. The separate
cache-update browser test upgrades an already cached installation at the same
origin, verifies data retention and deferred reload during active study, and
reloads the upgraded shell offline.

The matrix covers 320, 375, 390, 430, 768, 1280 and 1440 CSS pixels in both
themes and both browser engines. The requested 390 case uses 844px height;
1440 uses 900px. Chromium captures before/after full viewports at both requested
widths and themes. Existing checklist target, text enlargement, navigation,
modal reflow and reduced-motion checks remain in place.
The checklist layout fixture uses expanded rows, because the original
`learning.css` correctly hides the type selector in collapsed rows. The
44px target check still measures every checkbox and selector in that visible
state; closed controls are not mistaken for zero-size touch targets.

The Chromium functional pair at 1440×900 uses a real cached all-day synthetic
block with a 90-minute target. It starts through the original `bStudy` button,
observes timer progression, pauses and resumes, saves notes and a checklist
state, reloads the active run, cancels and records an interruption, returns
from completion, confirms one run, discards a second and exports both. A
normalized summary of the actual stored outcomes must match before/after.
The after variant also clicks guide prose and presses O, 2, C and Space:
none may change OLED, route, completion sheet or running phase. Escape must
close the guide and return focus to its opener.

Authenticated Google sign-in, live Sheets/Calendar reads and writes, actual
notifications, wake lock, device vibration, and installed-PWA updates cannot
be certified by offline public-asset UI tests. Their original source remains
protected by the parity test; live service behavior is outside this test run.
