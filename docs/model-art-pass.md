# Model art pass — 8 October 2026

This pass replaces the game's generic box models with a shared geometric asset library. Inspect it at [`preview/model-yard.html`](../preview/model-yard.html). The yard, battlefield study and playable campaign use `models.js`; the yard enlarges models for inspection rather than representing their actual screen size.

## Asset review

| Family | Previous limitation | New treatment |
| --- | --- | --- |
| Infantry | A few strokes and a head circle | Helmet, boots, separate legs, jacket, pack, belt pouches and rifle. Facing follows the company or trench. |
| Armour | Stacked rectangular boxes | Chamfered hull and turret, tracks with running wheels and tread detail, hatch, engine grilles, lights, stowage and faction markings. Turret aiming remains independent of hull heading. |
| Mechanised vehicles | Box on small wheel blocks | Six visible road wheels, raised cab, vision ports, troop compartment and roof hatch. |
| Mobile artillery | A tank with a longer barrel | Dedicated field gun with shield, wheels, breech and split trail; retained for legacy saves. |
| Artillery emplacement | Three tank-like guns on a slab | Three field guns, ammunition crates and protective sandbags. The campaign still adds six crew figures. |
| Trenches | Thick zigzag strokes | Earth parapets, timber lining, duckboards, staggered traverses and sandbags. Exact authored rotation is preserved. |
| Barracks | Generic factory | Pitched dormitory roof, windows, entrance steps and flag. |
| Vehicle depot | Generic depot | Broad maintenance bays, roller doors, roof vents and a lower workshop silhouette. |
| Supply depot | Generic depot | Loading platform, canopy and stacked field stores. |
| Machine works | Generic factory | Sawtooth roof lights, industrial doors and a brick chimney. |
| Refinery | Generic factory | Separate storage vessels, distillation tower, access platforms and pipes. |
| Headquarters | Generic depot | Command building, observation tower and aerial. |
| Town buildings and warehouses | Repeated flat boxes | Gabled roofs, chimneys, windows, loading doors and roof ribs. |
| Bridges | Painted road strokes | Deck, piers and steel trusses. Destroyed crossings lose the centre deck. |
| Trees | Single pyramids | Faceted broadleaf crowns with branches, plus layered conifers. Existing placement remains unchanged. |
| Reusable props | Incidental boxes | Crates, sandbag positions, storage vessels and industrial chimneys, all inspectable separately. |

There are 21 catalogue entries, including the props used inside larger assets. Construction models show foundations, braces and stores. Damaged structures show damage marks; ruins retain rubble and structural remnants. Refinery ruins retain broken vessels, and destroyed emplacements retain disabled guns. Decorative scenery has no new simulation state.

Building-placement ghosts now use the same model as the finished building, including rotated trenches. This changes drawing only: costs, placement validation, capture, supply, collision/navigation rules and army composition are unchanged.

## Drawing and performance

The existing Canvas renderer remains. Geometry is projected into cached sprites; normal cached draws submit one image instead of rebuilding every face. Small models use up to four source pixels per projected unit. Large sprite dimensions are capped at 512 pixels per axis.

The shared per-renderer cache is limited to **160 entries and 16 MiB of RGBA pixel storage**, excluding browser/GPU copies. Static town dimensions are rounded to four world units for cache reuse. Unit facing uses 32 heading steps (16 for infantry); trench placement angles remain exact. Distant models omit optional fine detail. No dependency, downloaded art, generated bitmap or engine migration is included.

Faces are ordered by depth where their projected polygons overlap. This avoids a large floor hiding a gun behind its centre or a roof hiding a tower. Ordering runs when generating a model/sprite, not on cache hits. First encounters and cache eviction still have a cost; bounded memory does not establish sustained FPS acceptance.

## Validation

- 57 existing simulation, campaign, territory, fog, projection and order checks passed.
- Seven model checks cover all catalogue entries across four quadrants and both detail levels, distinct construction/damage states, bridge/gun destruction, cache reuse/invalidation, exact trench angles and cache byte/entry limits.
- Browser inspection covered the asset roster, rotation and condition controls, the campaign's close view and the revised battlefield study. No script errors were reported in the inspected pages.
- Narrow layout was inspected at 390 × 844. Target-hardware sustained battle performance, every possible mesh overlap and every camera angle remain playtest gates.

## Next: environment overhaul

With the models available, the next pass can address terrain materials, forest composition, industrial yards, settlement layout, road shoulders, riverbanks, lighting and atmosphere. This model pass changes individual tree/bridge assets, but does not redesign terrain generation, scenery placement or the map layout.
