What this repo does: STUDIOOS Focus is a static study timer and personal study planner. It stores local study records and can read or write the user's chosen Google Sheets; it reads Google Calendar and public exam dates. The assumed load is one student using a phone and a computer, sometimes with two tabs open, up to 422 planned blocks and months of study records.

This is the **pre-refactor audit**, against `main` at `0451dcd5f333bc46338acf2f0954f8d52fcdbf08`. Line numbers below refer to that commit. It separates inherited problems from changes introduced by this UI work. The user's rule protects all existing application JavaScript, storage, network and routing behavior; an inherited JavaScript issue below is a follow-up, not permission to change it.

## Must fix

1. **The existing UI check rejects the current release** (`.github/ui-check/check.cjs:28`, `.github/ui-check/check.cjs:83`)
   - **What this is:** GitHub Actions runs this browser check for CSS pull requests. It checks asset hashes, protected scripts and sample layouts.
   - **Problem:** The check requires version `2.3.1` and twelve release notes. Current `main` has version `2.4.0` and four notes, so a UI-only change fails before it can prove the new layout works.
   - **Fix:** Make the release assertions compare against the actual base commit and current manifest. Keep the hash and protected-script checks; replace stale release-copy assumptions with behavior checks.
   - **If we skip it:** Every CSS PR is red for a reason unrelated to the PR. Reviewers cannot tell a new regression from an old test failure.

2. **Escape stops working when a sheet field has focus** (`app.js:558`, `app.js:603`)
   - **What this is:** Existing session completion, interruption and register panels are `.sheet` dialogs. A global keyboard handler includes Escape to dismiss them.
   - **Problem:** That handler returns early for `input`, `textarea`, `select`, `button` and links. Open the completion sheet, focus its outcome select or a button, then press Escape: its Escape branch cannot run.
   - **Fix:** In a separate behavior change, handle Escape before the shortcut exclusion and restore focus to the opener. New `ui-glass-*` dialogs must handle their own Escape key and prevent timer shortcuts while their content has focus.
   - **If we skip it:** A keyboard user has to find a visible dismissal control or move focus out of the field. This inherited handler remains protected in the present UI change.

3. **The hidden original settings select remains a keyboard stop** (`liquid.js:97`, `liquid.js:102`, `liquid.css:104`)
   - **What this is:** Settings with a few options are shown as segmented buttons. The original select stays in the document so its existing change listener still works.
   - **Problem:** `.lg-hidden-select` makes that select one pixel wide, transparent and clipped, but `segmented()` leaves it keyboard-focusable. Tab reaches an invisible select as well as the visible radio buttons.
   - **Fix:** In a separate behavior change, remove only the mirrored native select from sequential keyboard navigation, or keep the native select visible instead of showing its mirror. Preserve the select, value and original change handler.
   - **If we skip it:** Keyboard focus appears to disappear in Appearance settings. This is an inherited issue; the present refactor must avoid adding more invisible focus stops.

## Should fix

4. **The same controls are styled by four conflicting layers** (`refinement.css:43`, `interaction.css:29`, `ios.css:34`, `liquid.css:75`)
   - **What this is:** Inline CSS and five external stylesheets all contribute to the final interface. Later rules override earlier ones.
   - **Problem:** A button press scales to `.98`, then `.975`, then `.955`, then `1.035`. Changing the iOS press rule does nothing on the normal Liquid Glass screen because the later rule reverses it.
   - **Fix:** Give each shared component one owner and one set of semantic tokens. Keep compatibility selectors that the JavaScript uses; remove earlier declarations only after comparing light, dark, standard, OLED and reduced-motion states.
   - **If we skip it:** A small fix can silently fail or change only one theme. Each later UI change needs a full search through the cascade.

5. **The small help target overrides the accessible target size** (`learning.css:107`, `learning.css:108`)
   - **What this is:** `compact.js` folds long static explanations into `details.hint`. Its summary is the only way to reveal that explanation.
   - **Problem:** The final summary rule sets `min-height:0!important` and vertical padding to `2px`. This overrides the 44-pixel summary size used elsewhere, making text help much harder to tap on a phone.
   - **Fix:** Give help summaries at least 44 CSS pixels of usable height. Keep their text and closed-by-default disclosure behavior.
   - **If we skip it:** A user who needs the hidden instructions has a smaller target than the main controls. Wrapping more text in this component repeats that problem.

6. **Browser fixtures do not exercise the timer or queued saves** (`.github/ui-check/check.cjs:37`, `.github/ui-check/check.cjs:70`, `app.js:291`, `app.js:200`)
   - **What this is:** The current browser fixture inserts sample text into the DOM and checks navigation, sizing and release notes. The timer and persistence code are separate runtime paths.
   - **Problem:** The fixture can pass while a timer button is hidden by a new wrapper or while a disclosure prevents access to the notes input. It never starts, pauses, confirms, reloads a stored run, or checks storage writes against the base version.
   - **Fix:** Add a synthetic plan on a local test origin and run those user actions against both base and branch. Compare all original script bytes and original DOM hooks before claiming functional parity.
   - **If we skip it:** A visually correct screenshot becomes the only evidence for core study behavior. It cannot support a claim of zero functional regressions.

## Nice to have

7. **Ten old CSS lines have no useful effect** (`index.html:55`, `index.html:158`, `index.html:160`, `refinement.css:40`, `learning.css:97`)
   - **What this is:** These rules come from an older animated background and checkbox checklist. The current page uses `#lgBg` and button-based checklist states.
   - **Problem:** `#aurora` is always hidden by `liquid.css:44`; its old paint rules never become visible. The checklist renderer emits buttons and `ck2`, so `.steps input` and `.steps li.ck label` match no current item; the 520px grid rule repeats the unconditional rule at `learning.css:77`.
   - **Fix:** Delete the six old aurora paint/display lines at `index.html:55-59,62`, its refinement line, the two dead checklist rules and the repeated media rule. Keep the original `#aurora` DOM node and the final hide rule to satisfy hook preservation.
   - **If we skip it:** Readers keep checking obsolete rules when they change the page. The browser still downloads declarations that cannot change the rendered app.

## Text disclosure map

The HTML contains **23 static paragraphs with at least 90 characters**. Nine are already inside native details. `compact.js` folds eligible static paragraphs outside details automatically; it skips paragraphs with an id, interactive descendants or nested id-bearing content. Do not report those already-folded paragraphs as newly exposed text.

| Area / original source | Content | Baseline presentation | Safe presentation target |
| --- | --- | --- | --- |
| Focus `index.html:348` | Keyboard shortcut list | Folded by `compact.js` on desktop; hidden on touch layouts | Concise help disclosure; keep `.kbd` spans and original text |
| Focus `index.html:357` | Optional check-in explanation | Inside `#studyCheckinDetails` | Keep inside its existing details |
| Focus `index.html:364` | Five checklist states and completion rule | Folded by `compact.js` | Details with state legend; preserve completion meaning |
| Focus `#dCrit`, `#dCons`, `#dMatList`, `#dMat`, `#dOpen` | Completion rule, full task and exact materials | Three existing details under `#detail` | Keep original renderer roots and links; style the existing disclosures |
| Focus `#planInfo` (`app.js:330`) | Current cycle plan and why its length was chosen | Dynamic paragraph; skipped by compact mode | Retain the active state and move only secondary explanation into help; never change timer text generation |
| Focus `#statBody` (`app.js:516`) | Explanation that time is not proof of preparation | Generated paragraph without `small`; not folded by compact mode | Keep the metrics visible; put the explanation in a details wrapper around its own paragraph only |
| Analysis `index.html:407-408` | Rome-hour heatmap limits and suggested weight limits | Existing details | Keep existing grouping and all caveats |
| Analysis `index.html:413` | Separate coverage, time, confidence and proof | Folded by compact mode | Details attached to the topic list |
| Analysis `index.html:417` | Declared completion is different from timer time | Folded by compact mode | Details attached to preparation metrics |
| Analysis `index.html:419-425` | Five paragraphs explaining the percentage formula | Existing `details.formula-details` | Existing disclosure or a clearly titled guide sheet; preserve all formula text |
| Analysis `index.html:432` | Career data source, read-only rules and grade conventions | Folded by compact mode | Details within the career card |
| Analysis `index.html:438`, `index.html:441` | Weekly and per-subject bar legends | Folded by compact mode | Labelled chart details; keep units beside data |
| Analysis `#anLimit` (`index.html:442`, `app.js:840`) | Dynamic weekly chart limit and data source | Remains visible because it has an id | Native details around the original paragraph, keeping the id and dynamic updates |
| Analysis `#anInfo`, `#anFeas`, `#anEx`, `#anGrade` (`app.js:837-853`) | Planned/residual work, feasibility caveats, exercise evidence and grade estimates | Generated on entry; compact mode does not revisit them | Closed analytical details grouped by their existing heading; do not clone changing values |
| Analysis `#learningInfo`, `#learningInterruptions`, `#learningWeights`, `#prQuality` | Measured-time rules, interruption advice and unclassified-minute explanations | Dynamic render roots; some already inside details | Keep summary numbers visible; place explanatory containers in labelled native details |
| Study `index.html:455` | Spaced review intervals and answer-before-correction instruction | Folded by compact mode | Keep recovery controls visible; preserve the instruction in details |
| Study `#expTxt` and import/export controls | Backup instructions and exported JSON | Original backup card | Place technical explanation in details; never hide the restore/export action itself without a visible entry point |
| Plan `#planRules` (`index.html:474`, `app.js:775`) | Limits, synchronization rules and subject allocation | Dynamic multi-paragraph block | Closed rules disclosure around the original container; preserve every generated value |
| Plan `index.html:474`, `index.html:484` | Recovery-request explanation and approval reminder | Folded by compact mode | Existing concise disclosures |
| Plan `#pInfo` (`index.html:476`) | Tutor proposals and one-hour approved-plan delay | Remains visible because it has an id | Native details around the original paragraph; keep approval buttons outside |
| Settings `index.html:490` | Health evidence and unknown-status explanation | Inside existing health details; later moved into `#lgSys` | Keep its original id-bearing health root within the existing settings group |
| Settings `index.html:504` | Open-page sound and suspended-phone limitation | Folded by compact mode | Timer help details; keep the limitation available before relying on alerts |
| Settings `#sGlassHelp` (`index.html:510`) | Glass-opacity and reduced-transparency explanation | Visible; referenced by `sGlass` via `aria-describedby` | Retain the original id and description relation; native details may contain it |
| Settings `#installTxt` (`app.js:570-576`) | Platform-specific Home Screen installation steps | Native platform details; primary platform initially expanded as plain content | Existing system group or a guide sheet with a clear platform heading |
| Settings `#pwaCard` (`adapter.js:452-472`) | Google account, local/cloud save rules, Calendar consent and advanced picker setup | Dynamic card inside `#lgSys` | Keep warning/save status and actual controls reachable; technical instructions may be nested details |
| Completion `#mdCrit`, `#mdLearning`, `#mdInfo` | Completion criteria, optional self-check and mini-quiz | Existing session sheet | Keep within completion; these affect user decisions and must not be silently removed |
| Version notes `release.js:13-24` | Four release-note blocks and sign-off | Existing `#relDialog` and settings opener | Preserve this existing modal, its controls and stored release-seen behavior |
| Prerequisite guide `prerequisites.js:49-73` | Required bases, checklist and materials | Existing `#prqDialog` | Preserve existing modal and delegated `data-prereq-*` hooks |

## DOM and behavior guardrails

- All original JavaScript is protected. This includes the presentational scripts `compact.js`, `liquid.js`, `sections.js`, `navigation.js` and `release.js`, because they also own listeners or storage keys.
- Keep `.sheet > :first-child` as the existing inner panel. `app.js:559-563` uses `firstElementChild` for dismissal and drag behavior. Do not put a new close button before that panel.
- Keep original `.tab` buttons, `#tabInd`, `data-v`, `aria-controls` and their sibling geometry. The navigation spring measures offsets and sizes from those elements.
- Keep the original article containing each dynamic card id. `sections.js` finds `closest('article')` and moves whole articles into its tab groups; wrapping several articles in another article changes that contract.
- Keep renderer roots as the same elements, especially `#steps`, `#dMatList`, `#planRules`, `#pwaCard` and `#mdLearning`. The application replaces their `innerHTML`; controls inserted inside those roots may be destroyed on refresh.
- Avoid copying dynamic text into a second panel. A copied description goes stale when the timer, plan or account state updates. Move the original node or wrap it without changing its id, attributes or listeners.
- Keep `[data-sec][hidden]{display:none!important}`, reduced-motion overrides and OLED overrides unless their replacement proves the same behavior. These are functional protections, not merely messy specificity.
- New modal content must block the existing global shortcuts while it is open. The old shortcut handler ignores inputs and buttons but still acts on prose, so Space/C/S/O can otherwise operate the timer behind an informational modal.

## Deployment guardrail

`sw.js` uses cache-first lookup for the exact CORE list, with cache name `studioos-focus-202611161948`. An installed PWA that already has those cached files will keep the old HTML/CSS if the worker stays byte-identical. New CSS/JS URLs are also absent from its offline CORE cache. A cache-version/CORE-only worker update is the smallest normal release fix, but the user's absolute original-JavaScript rule excludes even that file in this task; this restriction must be stated honestly in the PR unless the user explicitly relaxes it. A fresh browser context does not test an existing installed PWA update.

Verdict: Fix the stale UI gate first, consolidate component ownership, and prove timer/storage parity with real actions. Keep inherited JavaScript behavior issues visible as separate follow-ups.

Lean: -10 lines, -0 dependencies possible. This is a conservative minimum; it does not count broader cascade consolidation.

Not checked: Authenticated Google sign-in, live user documents, real cross-device concurrent writes, the PC-side UniBoh bridge, push notifications, wake lock and physical iPhone/Android GPU performance were not exercised by this read-only audit. Public exam parsing was read, not fetched against all current UniBo pages. The audit did not run a complete line-by-line proof of every calculation in `learning.js`, `progress.js` or `app.js`; it traced their UI entry points, storage/network paths and current tests. Browser and computed-style evidence belongs to the refactor verification report.
