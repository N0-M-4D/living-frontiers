# Security, startup and reliability audit — 8 October 2026

Scope: local static browser game at commit d1d6f0e, campaign state, renderer, save/load, input/UI and local HTTP serving. No account system, server-side game API, payment flow or multiplayer service exists in this repository. This is a focused source/runtime audit, not a penetration-test certification.

## Confirmed findings and fixes

| Priority | Finding / evidence | Resolution |
| --- | --- | --- |
| High for usability | Terrain preparation issued 62,975 separate filled/stroked patches for seed 823901. One observed browser terrain bake took 32,880.8 ms before the setup flow was usable. | Batch non-overlapping seeded patches by colour. Same 62,975 patches now require 1,194 fills, with contours and geometry retained. Lightness is quantised to half-percent steps. Legacy folded geography retains painter ordering. |
| Medium | Save restoration accepted an own `__proto__` property, changing the restored campaign object's prototype; invalid coordinates/types and forged fog dimensions were also accepted. This did not alter Object.prototype globally. | Validate bounded input before restoration; reject reserved/unknown runtime properties, invalid types, identities, routes, fog dimensions and occupation. Rebuild authored region geometry and current fog visibility. |
| Medium, conditional | Saved unit names flowed into `innerHTML`. A modified same-origin save could introduce markup. There is no public save import or remote name-entry path in this version. | Construct formation labels with DOM nodes and `textContent`. A regression supplies an HTML-shaped name and makes any HTML sink fail. Followed [OWASP DOM XSS prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html). |
| Medium for deployment | The old `python -m http.server` returned 200 for `/.git/config` and directory listings. It was bound to 127.0.0.1, not publicly exposed by this launcher. | `python serve.py` serves only explicitly approved files, rejects repository/private paths and listings, and stays loopback-only. Local running server was replaced after checking its process identity. |
| Medium for efficiency | A periodic UI update unconditionally requested a new world render while paused; concluded campaigns also kept rendering. | Idle paused/concluded scenes only redraw on input/camera changes. Final camera movement refreshes the UI. Paused status no longer displays a misleading FPS counter. |
| Low for reliability | Cached development assets previously mixed old and new modules. | The local launcher sends `Cache-Control: no-store`; HTML script revision strings were updated. |
| Defence in depth | The local server had no browser security policy. | CSP restricts scripts to this origin and disallows connections, object embeds, forms and framing. Also sends nosniff, no-referrer and frame-denial headers. Inline styles remain permitted for existing dynamic positioning; inline scripts are not permitted. |

## Performance evidence and limits

- Baseline browser terrain bake: 32,880.8 ms (random seed). After batching: 469.3 ms on another initial landscape, 357.1 ms when beginning seed 823901. These are individual observations, not a controlled benchmark or total page-load measurement. Instrumentation was removed after collection.
- Seed 823901 submission count: 62,975 fills reduced to 1,194 (98.1% fewer). Vertex coverage and patch count have automated guards. The regional terrain was visually inspected after batching.
- Headless Node simulation only: 600 fixed steps took 315.5 ms for seed 1 and 282.7 ms for seed 823901. This excludes browser drawing, GPU/compositing and input and must not be reported as live FPS.
- Short live-browser checks covered setup, seeded launch, pause and regional view without captured page errors. Some in-app-browser navigation/control requests still timed out before later succeeding; the terrain bottleneck is measured, but these tool-level timings alone cannot establish a second game defect.

## Remaining issues / next priorities

1. Sustained full-match CPU/GPU/memory performance is still unverified. Profile a populated battle across zoom levels on the target machine. The shared sprite cache has a byte bound, but cache churn and face-ordering cost under mixed armies need measurements.
2. Dead formations remain in campaign history; long, casualty-heavy games can grow that list and simulation scans. Save validation caps units at 2,048 and save text at 4 MiB. Larger saves fail clearly rather than entering an unbounded restore; long-campaign retention needs a deliberate design pass.
3. Save is one local-browser slot. Clearing site data or changing origin loses it. There is no export, cloud backup or cross-device support.
4. Mobile/touch usability is incomplete: key actions rely on right-click or keyboard modifiers. The current audit does not certify touch play or screen-reader access to battlefield actions.
5. The game is single-player and trusts its client simulation. Editing local state/resources is possible; multiplayer would require server-authoritative validation. This is not a remotely exploitable account vulnerability in the current product.
6. `serve.py` is a local development server, not production hosting. A public host needs HTTPS, its own response headers/CSP and deployment of only the approved assets. Do not publish the checkout or expose Python's development server to the internet.
7. Navigation is still based on authored routes, not least-steep paths. Fog visibility is distance-based while firing checks ridges. Those are gameplay limitations rather than security bugs.

## Verification

83 JavaScript checks and 3 Python HTTP checks pass. Coverage includes existing campaign, combat, fog, movement, terrain, projection and model tests; new tests reproduce malicious/malformed saves, text-only labels, bounded restore, idle rendering, terrain batching and blocked HTTP paths. Save round-trips are exercised after 60 seconds of simulated combat/production, including seeded and legacy landscapes. JavaScript syntax and `git diff --check` also pass.

## Complexity report

Manual counts include control branches and logical decision operators; no linter/dependency was installed. Counts are approximate because compound predicates are counted conservatively.

| Function | Before | After |
| --- | ---: | ---: |
| Campaign.restore | ~20 | 3 |
| TerrainArt.paint | ~24 | 8 |
| game.frame | ~17 | 9 |

Extracted: save validation and migration helpers; terrain colour, patch, contour and batch helpers; camera advancement and frame-counter updates. New helpers have one responsibility. Behaviour is verified by the suites above; intended changes are strict rejection of invalid saves, text-only labels, batched terrain painting and idle redraw suppression.
