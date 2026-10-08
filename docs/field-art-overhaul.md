# Field art overhaul

The campaign retains its Canvas 2.5D renderer, deterministic simulation, fog and authoritative multiplayer. No third-party art, dependencies or network services were added.

## Battlefield

- Close terrain is rendered into camera-local, world-aligned tiles instead of stretching the 3200 × 1800 country bitmap. Density follows zoom and display density. Two tiles at most are baked per render; stationary views reuse their tiles. Fine material marks remain anchored during zoom.
- The terrain cache is limited to 64 MiB of RGBA pixels and 256 entries. Resolution tiers reach 16 pixels per projected unit. Protected visible tiles cannot evict one another; budget exhaustion keeps the overview underneath. This avoids an allocation/thrashing loop. The budget counts retained canvas pixels, not browser/GPU overhead.
- Broad vegetation colour varies continuously. Elevation lighting, roads with shoulders, field furrows, streets and alternate house orientations supply detail at region and ground scale.
- Shared models have improved directional material shading, contact shadows, rounded tree crowns, roof caps, wall details, porches, vehicle stowage, antennas and alternating infantry strides. Organic models use inexpensive depth sorting; structures retain overlap-aware sorting. Existing sprite cache remains 16 MiB / 160 entries.

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
