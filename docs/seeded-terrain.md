# Seeded landscape pass

New campaigns use a random unsigned 32-bit seed. Enter a Landscape seed to repeat a landscape; 823901 is used by the visual study. A seed survives saves and loads. Legacy saves load the authored height field. Terrain version 1 is stored separately so future generators can be migrated deliberately.

## Land and tactical effects

Independent seeded 2D gradient noise, based on the principles of [Ken Perlin's improved noise](https://cs.nyu.edu/~perlin/noise/), combines broad hills, warped ridgelines and smaller undulations. River valleys and coastal shelves blend down to water. Town centres have gently blended terraces. Elevation, light-facing slopes and restrained contour strokes make relief visible. Forest positions follow the generated classification.

| Ground | Incoming damage | Movement speed |
| --- | --- | --- |
| Open / valley | 100% | 100% |
| Forest | 75% | 75% |
| Hillside | 90% | 92% |
| Ridge | 80% | 85% |
| Marsh | 100% | 60% |

Eligible infantry trench cover multiplies incoming damage by another 0.5. The selected company panel shows the actual combined cover, elevation and terrain movement effect. Direct fire checks the terrain between formations. A blocked company reports the ridge obstruction and can reposition; artillery retains its indirect-fire role. Fog remains distance-based, so seeing a target does not guarantee a clear firing line.

Coastlines, region polygons, roads and river crossings remain authored. This pass randomises elevation and vegetation, not every geographical feature. Navigation remains connected and uses existing routes; it does not yet find the least-steep route or prohibit construction on steep slopes.

## Rendering and cost

Height and classification occupy 193,390 bytes in typed arrays per campaign. Noise is evaluated at campaign creation, never in the animation loop. Bilinear sampling supplies rendering, targeting and picking from one field. Per-axis slope is bounded at 0.27 to prevent the isometric surface folding over and returning a different location under the pointer. Picking brackets use the field's elevation bounds.

Terrain shading and contours bake into the existing 3200 x 1800 ground cache. Ground detail, sprite cache limits and fog culling remain in use. A new campaign clears terrain-dependent cached paths, projected frontier vertices, fog and detail chunks. The one-time bake is more detailed; this is not a sustained-FPS claim.

Town roofs now have a stronger pitch, eaves, ridge caps and subtle surface bands. Close-view armour has rounded corners; refinery/storage cylinders have more sides. Those details still render into bounded cached sprites rather than rebuilding every frame.

## Evidence

Nine terrain checks cover deterministic/different seeds, varied landforms, picking through zoom and pan, spawn/route connectivity, save compatibility, real crest occlusion, blocked direct-fire damage, artillery over a crest and actual ridge damage reduction. Existing simulation, campaign, territory, fog, orders, projection and model checks also pass (73 total).

Browser inspection covers the real campaign setup and regional view, the seeded visual study, and revised house roof in the model yard. The final in-app browser reload timed out after those observations; the server continued serving assets and all automated checks passed. Final reload acceptance, full-match balance, sustained target-machine FPS and a broad multi-seed visual review remain playtest gates.

Follow-up: the [security and reliability audit](security-reliability-audit.md) identified the expensive individual terrain submissions and replaced them with batched fills. Seeded launch and regional rendering were subsequently observed in the browser.
