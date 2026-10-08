# Field art overhaul

The campaign retains its Canvas 2.5D renderer, deterministic simulation, fog and authoritative multiplayer. No third-party art, dependencies or network services were added.

## Battlefield

- Close terrain is rendered into camera-local, world-aligned tiles instead of stretching the 3200 × 1800 country bitmap. Density follows zoom and display density. Camera movement reuses existing tiles. Once settled, at most one tile is baked per render; stationary views then reuse their tiles. Fine material marks remain anchored during zoom.
- The terrain cache is limited to 64 MiB of RGBA pixels and 256 entries. Resolution tiers reach 16 pixels per projected unit. Protected visible tiles cannot evict one another; budget exhaustion keeps the overview underneath. This avoids an allocation/thrashing loop. The budget counts retained canvas pixels, not browser/GPU overhead.
- Broad vegetation colour varies continuously. Elevation lighting, roads with shoulders, field furrows, streets and alternate house orientations supply detail at region and ground scale.
- Shared models have improved directional material shading, contact shadows, rounded tree crowns, roof caps, wall details, porches, vehicle stowage, antennas and alternating infantry strides. Organic models use inexpensive depth sorting; structures retain overlap-aware sorting. The sprite cache remains limited to 16 MiB, with up to 512 appropriately sized entries. Sprites follow screen density. Camera movement retains existing resolutions; sharpness upgrades resume after settling. Cold model work is limited to two builds per frame and stops starting builds after a 3 ms CPU budget. A single indivisible model build may exceed that time. Cached representative art, or a cheap faction-coloured footprint, covers pending sprites.

## Combat effects

`battlefield-fx.js` derives all transient phases from the existing simulation's effect ages. It does not change hits, blast radii, command timing or network packets. It adds travelling tracers, muzzle flashes, shell trails, pressure light, spreading dust, flame cores, airborne debris, rising smoke, vehicle dust, damaged-building/wreck fires and crater rims.

Four small radial sprites are shared (147,456 bytes). At most 40 impact effects and 240 puff draws run per frame; only 12 shells receive detailed trails. Large blasts receive priority over small hits. Budget overflow retains cheap impact feedback. Off-screen/unseen effects are skipped. Country view and reduced-motion use simpler effects. **Controls → Battle effects → Reduced** also disables elaborate effects manually. No camera shake or full-screen flashes.

## Field console

The conflicting old CSS layers were replaced by one stylesheet: a compact resource strip, session disclosure, continuous lower console, minimap, selected-unit portrait, explicit orders and model thumbnails for construction. Fog, selection, placement, terrain picking and shortcuts retain their existing rules.

## Inspect and validate

- Campaign: `/`.
- Shared-art artillery study: `/preview/battlefield-range.html`. Drag the volley timeline, change zoom/quality, or fire a volley. The draw-time readout is a single render measurement, not a whole-game FPS benchmark.
- Individual model inspection: `/preview/model-yard.html`.
- `npm test`: full suite, including new tile-density, bounded-cache, stationary reuse, visibility and VFX-budget checks.
- `python -m unittest server_test.py`: local asset-serving security checks.
- Browser observed: campaign startup, ground zoom, company selection, construction tray; field-range effects and model art. No new console errors in the campaign check. At 1280 × 720 the checked order/build controls fit without horizontal overflow.

Acceptance still needed: sustained busy multiplayer play on target hardware, different home networks, and narrow/zoomed desktop layouts. The browser viewport override did not alter the actual 1280 × 720 viewport, so narrow-layout visual acceptance is not claimed. This is stylised projected art, not physically based 3D rendering.

## Camera regression correction

The first art pass rasterised every model at up to four pixels per model unit, even when region view displayed it at about half a pixel per unit. Variable town models exhausted the 16 MiB cache. Repeated eviction rebuilt the same visible geometry every frame.

A local instrumented 120-frame pan/zoom sweep, paused simulation, terrain seed 823901, 1280 × 720 browser viewport measured:

| Render-call CPU work | Before | Corrected |
| --- | ---: | ---: |
| Mean total | 275.4 ms | 12.7 ms |
| Mean models | 256.3 ms | 8.0 ms |
| Mean terrain | 12.6 ms | 1.1 ms |
| Worst sampled total | 574.5 ms | 26.8 ms |

A second cold-cache sweep from 0.8 to 7.0 zoom and back measured 10.2 ms mean render work and 33.3 ms worst sampled render, with 7.2 MiB of retained sprite pixels. Separate system sampling observed 90�100% total CPU use from the concurrent workload. Cached-draw stalls also appeared during earlier loaded runs; this machine load limits displayed-frame acceptance.

These are JavaScript render timings, not guaranteed displayed FPS; browser background scheduling affected frame intervals. The comparison includes cold art and changing detail levels. Temporary profiling controls were removed. Regression tests cover a 90-variant region working set, bounded cold sprite builds, reuse while zooming, restored sharpness after settling, and no terrain baking during camera motion.
