# Independent review: numbers and whole-app thumbnail proportions

Status: PASS for the current concrete acceptance criteria; preview only, not published. Owner aesthetic approval remains pending.
Baseline: published v309, commit 626ed3c.

The earlier candidate was rejected by the owner: it changed colour-strip treatment and only normalized wide list thumbnails. That candidate and its sign-off are superseded. The current scope is Uses/Share numeric typography plus harmonious thumbnail proportions throughout the app. Original colour strips are preserved.

## Current acceptance

| Requirement | Independent evidence | Result |
| --- | --- | --- |
| Preserve original colour strips and all numeric calculations | Colour-strip CSS rules, statistics-page markup function, colour sampling/aggregation and purchase functions compared with 626ed3c and remain identical | Pass |
| Uses/Share are restrained, consistent numeric text | Both explicitly set to 14px, weight 400, line-height 1.5 and tabular numerals; corrected browser result confirms matching font and baseline; independent before/after screenshot inspected | Pass |
| Headers and numeric rows align | Root browser measured common right edges for Uses/Share and matching tops/heights; no overlap in the actual-page width matrix | Pass |
| Shared miniature sizing works across square and wide frames | Independent execution of actual compact renderer at 44/48/56/64px in both contexts; single and named/custom horizontal/vertical duos remain 70–110% of quad per-pan area, avoiding both oversized blocks and unreadably small pans | Pass |
| Medium remains recognizable and proportionate | Existing one-wide-top plus two-by-two layout and pan order unchanged; total thumbnail width capped consistently relative to frame height; independent visual inspection of all five contexts | Pass |
| Functional shade controls remain usable | Actual styles for noncompact detail/history-edit controls and editor preview byte-identical to v309; root browser verified representative detail pan buttons remain at least 44px | Pass |

## Whole-app render-path inventory

| Context | Renderer / handling |
| --- | --- |
| Collection product list | miniPalette with wide compact frame, shared optical helper |
| Record-a-look product picker | miniPalette with wide compact frame, same helper |
| Recently used recording cards | miniPalette with square compact frame, same helper |
| Recording confirmation product headers | archiveThumbnail, same compact helper |
| History saved-look palettes | archiveThumbnail, same compact helper; existing selected-shade treatment preserved |
| History saved-look singles | Previously standalone large square; now archiveThumbnail with shared single sizing |
| History milestones | Individual shade represented through the shared virtual-single thumbnail |
| Active Archive product journal | Whole product through archiveThumbnail; individual shade/single through shared virtual-single thumbnail |
| Archive grouped/legacy cards | Existing miniPalette/archiveThumbnail paths inherit shared helper |
| Optional legacy Most-used palette block | miniPalette inherits shared helper; this function currently has no live call site |

Intentional exceptions: decorative Favourite colour strips and Statistics colour strips retain their existing design; small individual-shade chips in review/editor/directory remain semantic colour chips; missing-history placeholders remain placeholders. Main interactive detail/editor/history-edit pan grids are not miniatures and are unchanged. Home's editorial images are not product thumbnails.

## Verification and iteration

- 759 independent assertions passed across real geometry/style functions, frame contexts, eight product types and relevant source invariance. Dense 60-shade compact geometry remains positive and bounded; this is not a claim that tiny dense pans support interaction.
- All 94 existing regression checks passed: 42 app/state, 14 mocked cloud, 14 backup import, 7 collection, 17 purchase.
- Root's browser matrix covered 24 actual-page cases: Collection, recording picker/recent, History, Archive, review, detail, editor and Statistics at 320/390/768px; no horizontal overflow. Dialogs remained within viewport.
- Independent reviewer inspected both final browser-rendered images: Uses/Share before/after and the whole-app thumbnail matrix (list, recent, confirmation, history, archive).
- A browser-found cascade defect initially left Share at 13px despite Uses at 14px. That candidate was rejected, an explicit higher-specificity font declaration was added, and the corrected browser result confirmed 14px/400 for both with matching baseline.
- Whitespace/diff check passed. No cloud, data schema, stored layout, HEX colours or counting logic changed.

## Limits

This report verifies the clarified scope and objective design criteria. It does not establish universal aesthetic perfection, exact physical-product reproduction, real-phone acceptance or live two-device synchronization. Screenshots use demonstration colours/data. Browser checks were performed by root and independently reviewed here; the tester did not concurrently control the shared browser. Publication requires the owner's explicit authorization after preview.


## Final owner-approved row alignment (v310)

Supersedes the earlier family-title baseline criterion: the owner requested Uses and Share numbers centered on the colour rail in row two, with the family name alone in row one. Browser measurements at 320/390/768px show zero vertical-center difference for both numeric columns across all four families, stable right edges, and no horizontal overflow. Rail dimensions and colours are retained. Evidence: colour-rail-number-alignment-results.json. The owner approved the final image preview and explicitly requested publication. This final row-alignment browser check was performed by the primary assistant; the earlier independent review does not claim to cover this later change.
