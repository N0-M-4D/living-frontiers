# Living Frontiers — Grand campaign MVP

A build-free JavaScript / Canvas ground-war game. One continuously zoomable country contains 32 provinces and **10 times the original playable land area** (each axis ×√10). All terrain, troops and industry use geometric artwork drawn in code; there are no generated images or external art dependencies.

## Play

From this directory:

```powershell
python serve.py
```

Open http://127.0.0.1:8765/ and choose Solo or **Create peer invite / Join peer invite**. The host sends an invite; the friend sends a reply back. Both ready up, then the host starts. Browser peer matches also work on the public GitHub Pages website, with no dedicated hosting account. Keep both game tabs open; direct connectivity depends on the two networks. Solo offers doctrine and campaign length choices. Optional dedicated rooms still use Node.js 22+, `npm ci` and `npm start`. See [online play, peer limitations and free deployment](docs/online-play.md). Refresh the existing tab after source changes. Save and Load store one campaign in this browser's local storage; loading pauses the game. Changing browser, origin or clearing site data loses that local save.

## Visual direction study

An optional [interactive visual prototype](preview/visual-lab.html) explores the proposed terrain, troop silhouettes, command deck and artillery effects. It is a scripted approval scene, separate from the live campaign. See the [RTS research and twelve-domain optimisation audit](docs/visual-research.md) for references, findings and the proposed integration order.

The [model yard](preview/model-yard.html) lets you inspect 21 shared troop, structure, scenery and prop models. Rotate them and compare faction colours, detail levels and supported damage states. These models are integrated into the playable game; see the [model art pass notes](docs/model-art-pass.md). Landscape composition remains the next phase.

## Commands

The game uses an olive-metal and brass RTS HUD: a top resource strip, a continuous bottom command area, and a clickable minimap with troops and camera footprint. The minimap redraws at most four times per second. Click/drag it to navigate, or use arrow keys while it has keyboard focus. The minimap is hidden on narrow screens. The bottom command bar always shows troop selection and named orders. Build opens a labelled catalogue with costs and build times; Place new and Manage buildings separate construction from recruitment and repair. Region opens capture and infrastructure information. Controls ? opens the field manual. Resource labels remain visible.

Only one targeting or placement mode is active at a time. Escape or right-click cancels that mode without losing the selection or issuing a move; Escape again clears selection. Right-click ground otherwise moves, including a slightly dragged click. Camera panning uses middle-drag or Space-drag exclusively.

- Click a blue marker, vehicle or roster entry to select. Shift-click adds/removes companies; left-drag box selects and Shift-drag adds. Keys 1–9 select the first nine companies.
- Right-click ground to move and disengage, or an enemy to attack. **A** then click gives attack-move, which stops to fight. **M** then click gives a move order. Moving troops remain vulnerable.
- **H** holds. Return & repair withdraws to headquarters or a connected supply depot and spends materiel healing. Optional automatic retreat activates below 25% strength.
- **Build → Artillery emplacement → Aim artillery emplacement** shows a 3,200 m range ring. Click a target to repeat three-shell volleys every 12 seconds, with 240 m blast radius per shell and an 18-materiel volley cost. Cease bombardment stops future volleys; shells already in flight still land. Supply, construction and damage gate firing. Older saves can retain mobile artillery and its F command.
- Scroll to zoom continuously; Space-drag or middle-drag pans. Country, Region and Close view are camera presets in the same world. Selected regions retain a gold outline; strategic ownership colours fade out at close range.
- **P** pauses; orders can be planned while paused. Escape first cancels the active mode; a second press clears selection.

## Capture and economy

Push troops across the persistent occupation grid, then hold a town zone for eight uncontested seconds with at least 35% of its province occupied. Neutral militia defend towns but do not expand enemy control. The Intel tab shows the ground requirement, capture timer, ownership and objective. Larger provinces require spreading formations or advancing through multiple positions.

First capture grants that province's materiel reward, 20 manpower and 15 fuel. Controlled facilities generate materiel, fuel and manpower. Their integrity affects output. Captured production buildings retain their damage; the previous owner's recruitment orders are cancelled. Intact conquest saves reconstruction costs; bombardment helps break defenses but damages the economy you inherit.

The Build tab provides barracks, vehicle depots, artillery emplacements, infantry trenches, supply depots, machine works and oil refineries. Place on occupied friendly land within 220 world units of a road, clear of other buildings. While placing a trench, R rotates it 15 degrees and Shift+R rotates back; the Rotate button is an alternative. The preview, dry-land footprint, infantry ranks and cover area share the same angle, which is saved with the building. Completed trenches keep their built orientation. Trenches cost 60 materiel, take eight seconds and need no nearby road; their whole footprint must fit on controlled dry land. Move infantry into the visible earthworks and hold position for 50% less incoming damage, stacking with terrain. The unit panel explicitly confirms active cover. Moving troops, vehicles, ruined or unfinished trenches get no trench protection. Construction costs materiel. Recruit infantry, mechanised companies and armour from suitable completed buildings. Recruitment spends materiel/fuel/manpower when queued; cancelling the last queued order refunds its original cost. Set a reachable rally point and upgrade buildings up to level three.

Supply follows roads through friendly provinces with intact central facilities back to the capital. Destroyed bridges block road connections and physical crossings; alternate intact crossings can still provide routes. Cut-off factories stop recruiting, regional income drops to 20%, and troop carried supplies drain. Low supplies reduce firepower; exhausted supplies cause attrition. Vehicles consume fuel while moving and refill through supply. Damaged structures and controlled bridges can be repaired at a materiel cost.

Terrain effects appear in the selected-unit panel: forest reduces incoming damage by 25% and movement by 25%; hills reduce incoming damage by 10%; marsh slows movement by 40%.

## Campaign options

- Arden Union: +20% regional industry output.
- Iron Vanguard: +20% tank health, +10% tank recruitment cost.
- Frontier League: +15% movement speed, 25% faster infantry recruitment.
- Operation: 20-minute limit; capture 60% of provinces plus Eastwatch for early victory.
- Grand campaign: 45-minute limit; conquer every province for early victory.
- At the time limit, accumulated province control score decides the winner. Losing the field army ends the game only when no friendly production building remains operational in friendly territory.

Enemy AI recruits, advances into unclaimed provinces, responds to threatened territory, withdraws damaged companies and adds barracks in newly held regions when affordable.

## Rendering and performance

New campaigns open with 65 simulated companies: 12 player (ten infantry, two armour), 32 enemy (twenty-four infantry, eight armour) and 21 neutral militia. Enemy vehicle recruitment waits until its field army and queues support at least three infantry per vehicle. Existing saved armies retain their composition. Infantry companies display up to 28 soldiers at close range; emplacements have three guns and a crew. Recruitment caps the player at 60 and the enemy field army at 55; militia are additional. Visible close-up groups contain multiple vehicles or soldiers, rather than running a separate simulation for every model.

Simulation runs at 20 Hz. Static terrain uses one cached 3200 × 1800 canvas (about 23 MB of pixel storage before browser/GPU copies). Scenery is viewport-culled; overview formations use markers. Exact-position influence footprints and regional outlines are cached. Close views add crisp road geometry, small ground detail, buildings, infantry and vehicles. Shells, explosions, craters, tracers and wrecks have explicit bounds (96 / 96 / 120 / 160 / 180).

A local 60-second simulation stress check starting with 136 formations measured 2.21 ms median and 18.21 ms p95 per tick. Short headless Edge samples at 1440 × 1000 measured roughly 5 ms median country rendering and 6.6 ms median / 11 ms p95 close rendering. These measurements exclude some browser/GPU costs and were taken under competing machine load; they are not a guaranteed frame rate or a full-length campaign benchmark.

## Validation

```powershell
node simulation.test.cjs
node campaign.test.cjs
node territory.test.cjs
node fog.test.cjs
node projection.test.cjs
node orders.test.cjs
node --check game.js
node --check world.js
node --check campaign.js
```

Tests cover combat, continuous routes, movement/disengagement, capture persistence and neutral defense, construction, recruitment/refunds, broken supply links, delayed artillery impacts, faction modifiers, enemy mobilisation, saves, captured infrastructure and campaign outcomes. Browser checks separately exercise selection, placement clicks, recruitment, save/load, fire-mission clicks and a 390-pixel layout, with no page errors observed.

## MVP boundaries

This is a playable solo MVP with experimental two-player browser-peer and dedicated-server matches, not a finished or fully balanced release. Coastlines and province layouts are authored; seeded terrain, doctrine, campaign length and strategy provide variation. Artwork is geometric and still needs an art pass. Units navigate as formations; buildings are not individual collision obstacles. Road sabotage currently means destroying bridge crossings, not arbitrary road segments. Online matches currently support two human commanders with neutral militia, equal starting armies and independent fog. There are no persistent online saves, accounts, ranked matchmaking, individual vehicle physics, audio mix or air force. Aircraft remain deferred until after the ground V1.0 milestone. Full-match balance and sustained performance on the player's machine remain playtest gates.

`geography.js` is the base terrain/navigation template; `world.js` builds the enlarged country. `simulation.js` handles movement and combat, `territory.js` occupation, `campaign.js` economy/logistics/AI/saves, `models.js` the shared geometric art and bounded sprite cache, and `game.js` camera, rendering and interface. Run `node models.test.cjs` for the model and cache checks.


### Rendering optimisation — 6 October 2026

A profile of the expanded game found recurring frontline rebuilds above 50 ms and off-screen soldier animation in close views. Frontier cell geometry, adjacency and border curves are now cached; static road/region paths use retained Canvas paths. Only formations near the viewport generate individual animated soldiers. Close-up ground detail reuses its geometry while the camera stays still. Initial frontier geometry is prepared during campaign setup.

A paired, short headless Edge check at 1440 × 1000 forced the same border rebuilds in the old and new renderer. Median rebuild time fell from 52–61 ms to 5–6 ms across views. Close-view render median fell from 13.3 to 6.5 ms; country render median stayed around 7 ms. Initial border edges matched exactly. These CPU submission measurements exclude some compositor/GPU work and are not a guaranteed frame rate. Combat, capture cadence, map size and particle limits were not changed.

### Fog, picking and load audit

Fog reveals opponents within 1,000 world units of living companies, 650 of completed friendly buildings and 700 of controlled facilities. Sight refreshes at 4 Hz; explored ground persists in saves. Terrain and province names remain charted, while hidden troops, placed enemy buildings, effects, minimap markers and live facility intelligence are withheld. Enemy simulation continues outside vision. This first sight model uses distance, without terrain occlusion.

Terrain picking now uses a bracketed height intersection rather than unstable fixed-point iteration. The placement preview follows a stationary pointer as the camera moves. Infantry are centred on their logical destination, and group orders mark the assigned formation slots.

The five-part audit also removed unused legacy capture scans, reused blocked-bridge lists with immediate damage/repair invalidation, cached grass by world chunk, cached static tree geometry and building sprites, bounded marker collision checks with screen bins, and reused route geometry. Fog has a cached 1600 x 900 overlay (about 5.8 MB before browser copies); grass retains at most 512 chunks and building sprites at most 192 entries. Paused scenes redraw on UI/camera/input updates instead of every animation frame. Sustained full-match performance remains a separate playtest gate.

### Army control

Right-drag on the ground to spread selected companies along a line. Green/red rings preview reachable/unreachable formation slots; release confirms reachable slots and reports the accepted count. M or A also shows destination slots before clicking. Shift + right-click (or Shift + left-click in M/A mode) queues movement/attack-move waypoints; an ordinary valid order, Hold or Return & repair replaces the queue. Direct enemy attacks replace existing waypoints. Each company holds up to 32 pending waypoints, retained through saves. If a queued route is blocked by a destroyed crossing, it waits and replans when crossing availability changes. Invalid orders preserve earlier orders.

Fog geometry is merged into row strips, retaining sampled terrain edges, and cached world images are cropped to the viewport before submission. Unexplored scenery uses the overview terrain image instead of expensive close-up geometry; explored terrain keeps its detail. The active-battle profile identified rendering as the dominant cost. Browser CPU samples and target-machine gameplay acceptance remain distinct; no fixed FPS is promised.

Verification: 57 automated checks pass, including eight army-control checks. Headless Edge input checks exercised right-drag slots, Shift queuing and Hold cancellation without page errors. Two alternating active-battle rendering samples at 1440 x 1000 measured old/new medians of 10.1/9.5 ms and 14.6/10.2 ms; old/new p95 values were 32.4/28.3 ms and 169.8/32.9 ms. Shared machine load makes these short CPU samples variable; they do not establish sustained gameplay FPS.

### Seeded terrain and model refinement

New campaigns generate Perlin hills, ridges and valleys. Leave Landscape seed blank for a random landscape, or enter a number to replay one. Existing saves retain their original terrain. Ridges block direct fire and provide 20% damage reduction; artillery can fire over them. The company panel reports elevation, cover and movement penalties. Coastlines, province borders and river crossings remain authored. Roofs have steeper pitches and ridge/eave detail, with rounded armour and storage silhouettes at close zoom. See [terrain notes](docs/seeded-terrain.md). Run `node terrain.test.cjs` for nine terrain, combat, picking and save checks.

### Security and reliability audit

Use `python serve.py` for local solo and browser-peer play. It binds only to localhost, serves an explicit asset allowlist, blocks private files/directory listings, disables stale development caching and sends a Content Security Policy. It is a development launcher, not a production HTTPS host. Run `node audit.test.cjs` and `python -m unittest server_test.py` for save/input, idle-render and HTTP security checks. See [audit findings and remaining deployment gates](docs/security-reliability-audit.md).
