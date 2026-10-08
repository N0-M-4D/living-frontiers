# Living Frontiers: visual direction and RTS research

8 October 2026. Status: **interactive prototype for approval; production integration pending**.

Open `/preview/visual-lab.html` through the local server. Country, Region and Battle show the same continuous landscape. Advance front and Artillery salvo are scripted demonstrations, not the campaign simulation. Resources and formation strength are illustrative. The prototype contains 53 individual scene figures/vehicles; that is not a large-army performance test.

## Research and recommended adaptations

Three research agents examined official developer pages, manuals and store material. Twelve further agents audited separate performance domains. We inspected official Hegemony III and Lines of Battle screenshots directly. We did not play these games or profile their engines. The adaptations below are our design recommendations, not claims about their internal implementation.

| Reference | What it does well | Adaptation for Living Frontiers |
| --- | --- | --- |
| [Hegemony III](https://longbowgames.com/hegemony3/) | Seamless strategic/tactical scale, supply and resource warfare | Closest structural reference: the country remains one battlefield; industry and supply routes become legible as you approach. |
| [OpenFront](https://github.com/openfrontio/OpenFrontIO) | Territorial expansion and geographic decisions | Strong ownership at country scale, clear neutral expansion opportunities; retain individually commanded companies. |
| [Lines of Battle](https://linesofbattle.net/) | Planned formations and simultaneous order resolution | Borrow facing and order clarity. Keep our real-time combat and pause system. |
| [Steel Division](https://www.paradoxinteractive.com/media/press-releases/press-release/paradox-allies-with-eugen-systems-to-deploy-steel-division-normandy-44) | Dynamic frontlines and tactical battlefield readability | Show pressure bulges and contested ground. Explain separately why occupation has not yet become province ownership. |
| [Supreme Commander manual](https://manuals.thqnordic.com/SupremeCommander/SupremeCommander_PC_Manual_EN.pdf) | Strategic zoom and commands across scales | Preserve selection and destination feedback while zooming; reduce models to symbols at distance. |
| [Beyond All Reason icons](https://www.beyondallreason.info/guide/strategic-icons) and [commands](https://www.beyondallreason.info/commands-2-0-grid) | Consistent strategic symbol grammar and formation controls | Distinguish infantry, armour, support and structures through shape as well as colour. Retain box selection, right-drag formations and queued orders. |
| [BAR radar guide](https://www.beyondallreason.info/guide/radar) | Different kinds of battlefield knowledge | Keep visible, remembered and unknown information distinct. Remembered structures would need snapshots, not live hidden data; radar is not proposed for this pass. |
| [Age of Empires IV accessibility](https://www.ageofempires.com/age-iv-accessibility/) | HUD readability and adjustable presentation | Compact command deck, legible resource labels, visible hotkeys and clear selection hierarchy. |
| [Regiments](https://store.steampowered.com/app/1109680/Regiments/) | Platoon-scale command with many soldiers visible | Simulate companies, draw convincing groups. Infantry should feel present without every soldier becoming an AI agent. |
| [WARNO](https://store.steampowered.com/app/1611600/WARNO/) | Varied terrain and recognisable battlefield districts | Distinct industrial, agricultural, forest and crossing landmarks rather than uniform scenery. |
| [Company of Heroes 3 destruction diary](https://sega.prezly.com/company-of-heroes-3-destruction-dev-diary) | Destruction changes the battlefield and cover | Clear damaged silhouettes and persistent impact marks. Explain the economic consequence of damaged infrastructure. |
| [Broken Arrow manual](https://ftp.matrixgames.com/pub/BrokenArrow/BrokenArrowManualEBOOK.pdf) | Artillery targeting and trajectory feedback | Visible aim area, shell travel and invalid-target reasons; point/line barrage options are a later gameplay proposal. |

## Proposed visual direction

An original geometric miniature battlefield: desaturated sage and straw terrain, deep woodland, slate water, pale industrial roofs, teal friendly accents, rust enemy accents and brass selection outlines. Geometry is authored in code; no generated bitmap art, copied commercial assets or new dependencies are used.

- **Country:** ownership fills, province names, strategic unit symbols, main supply routes. Colour fades continuously towards close range.
- **Region:** highlighted selected boundary, factories, settlements, forest edges, crossings and a thin evolving front.
- **Battle:** tank turrets and tracks, mechanised silhouettes, human infantry, trench earthworks, roof details and ground scars. Cover feedback explicitly belongs to infantry and disappears when they advance out of the trench.
- **Interface:** dark green field-command surfaces with brass edges, a compact resource strip and a continuous bottom command deck. The explanatory card belongs only to this approval prototype.
- **VFX:** brief bright impact core, outward dirt/debris, slower smoke and persistent craters. Shell trajectories lead into the impact. Distant effects should simplify rather than remain equally detailed. Avoid full-screen flashes and camera shake.

The prototype caps live impact effects at 48, shells at 12 and craters at 32; device pixel ratio is capped at 1.5. It pauses initially for reduced-motion preferences and removes flashes, debris and tracers in that mode. Paused rendering wakes only for input/camera changes. These are prototype budgets, not final production settings.

## Optimisation audit: twelve domains

Measurements below are agents' local Node microbenchmarks unless otherwise stated. They isolate particular workloads; they do not measure browser compositing, GPU time, sustained FPS or a full campaign. Percentiles across different scenarios are not directly comparable.

| # | Domain | Evidence and recommendation |
| --- | --- | --- |
| 1 | Rendering | `game.js` creates per-figure objects and sorts projected box faces repeatedly; scenery is filtered and depth-sorted each frame. Investigate chunked scenery, merging static/dynamic draw lists, distant sprites and bounds checks for region/front paths. Existing caches and culling should be preserved. |
| 2 | Simulation | A 60-second, 80-alive-company sample measured 0.298 ms mean / 0.648 ms p95 per step, with 6,083,774 enemy candidate visits. Skip searches when move/retreat forbids combat; avoid repeated retreat replans. This sample does not establish simulation as the main persistent bottleneck. |
| 3 | Navigation | Sixty route pairs measured 4.20 ms mean / 24.52 ms p95 / 38.18 ms max. A* linear open-list scans and synchronous enemy route bursts warrant attention. Preserve a blocked order's destination rather than replacing its path with an empty array. Consider a heap and cached static neighbours after equivalence checks. |
| 4 | Territory | Across 80 updates with 65 companies and 3,663 cells: stationary warm mean 0.95 ms / p95 2.55 ms; moving all companies 1–2 world units per update mean 9.26 ms / p95 13.19 ms. Exact-position footprint invalidation and line-of-sight work are a priority. Add obstacle broad-phase pruning; do not silently quantise capture behaviour. |
| 5 | Fog | 1,000 fog updates averaged 0.042 ms on the existing 69×49 grid. Fog computation itself was cheap. Cache unchanged minimap layers and cull hidden drawing consistently. Current ownership visibility is a design choice, not a performance bug. |
| 6 | VFX | Each landing shell scans unit/infrastructure candidates; simultaneous landings can concentrate cost. Reuse candidate lists and consider a verified spatial broad phase. Existing effect caps are bounded; no runaway particle leak was demonstrated. |
| 7 | UI | `updateUI` requests painting every 0.15 seconds even while paused. A hidden formation list still gets roster work and repeated region lookups. Dirty-check DOM values and stop hidden/unchanged work before adding richer HUD effects. |
| 8 | Camera and picking | Five existing projection tests passed. Box selection uses raw client coordinates while picking uses canvas scaling; unify this for resized/embed cases. Prototype advance culling was based on pre-move position; corrected in this delivery. |
| 9 | Memory and saves | Dead companies remain in state. A synthetic additional 1,000 dead records grew a save from 141,374 to 609,400 bytes. This is retained data, not proof of a heap leak. Remove obsolete records safely; reduce save copies and redundant restore geometry. Existing base/fog buffers are about 27.5 MiB before browser copies; this separate prototype adds about 22 MiB when both are open. |
| 10 | Orders | Eight existing order tests passed, but a single-company right-drag ignores its release endpoint and uses the press point. Add a regression and fix this before visual integration. A green placement/formation preview establishes dry land, not route reachability across damaged bridges. Formation assignment itself was modest: 60-company median 0.226 ms / p95 0.641 ms. |
| 11 | Startup | Static terrain generation runs before the first painted frame. Cold Node imports measured geography 28 ms and world 48.9 ms; fresh state 19.2 ms and restore 31.4 ms. Profile browser startup before chunking. Avoid generating identical geometry again during restore. Current game HTML/JS/CSS is about 158 KB; a bundler/dependency migration is not justified. |
| 12 | Independent review | The prototype still sorts static detail and redraws building geometry. Cache these before scaling to the live campaign. Its 53 scripted figures cannot validate full-game performance. Preserve production left-drag box selection and right-drag formation controls; prototype left-drag panning is only for inspection. |

### Corrections made in the prototype

Consistent fog checks for scene objects, shells, impacts and labels; reduced-motion handling; culling at the actual advanced position; infantry-only cover text that changes when cover is lost; dirty-checked labels/metrics; and an event-driven paused render loop. Production findings remain an implementation backlog while the visual direction is under review.

### Integration order after approval

1. Fix single-company drag endpoints and truthful destination feedback; establish repeatable country, close battle, moving army and concentrated artillery benchmark scenarios.
2. Remove redundant paused UI work; optimise occupation line-of-sight and route bursts with behaviour-equivalence checks.
3. Integrate terrain, model silhouettes, scale-dependent symbols and the command deck into the existing renderer and controls. Cache static detail and keep fog rules intact.
4. Add layered artillery/destruction effects within measured budgets. Compare frame-time median/p95, long frames and memory under equal scenarios, including sustained play on the user's hardware.

Air force, new engine, new faction systems, radar and a full economic rebalance are outside this visual approval pass. The live campaign remains unchanged.

## Verification

Prototype JavaScript syntax checked. Browser inspection covered all three camera scales, advance/cover feedback, artillery, pause/resume, fog/cover controls and desktop/narrow layout. Existing projection and order suites passed in the audit. These checks demonstrate prototype behaviour and source-level findings; they do not establish a production FPS improvement.
