# Online play — free testing

The game supports solo campaigns and experimental two-player matches. The public static website can run solo without a server. Multiplayer needs the Node server; publishing HTML alone does not host matches.

## Run locally

Install Node.js 22 or newer, then run:

```powershell
npm ci
$env:HOST = '127.0.0.1'
npm start
```

Open http://127.0.0.1:8765/ in two tabs. Host a match in the first tab, enter its invite code in the second, mark both players Ready, then Start match as host. A public room appears in the room browser; private rooms require their code. Each commander sees their own army in blue and the opposing army in red. Both start with two armour and two infantry companies, equal resources and production buildings. Neutral defenders occupy other provinces. The server controls movement, combat, capture, recruitment, resources and fog.

For LAN testing, bind `HOST` to `0.0.0.0` and use the host computer's LAN address. Only open a local firewall rule if you intentionally want LAN access. Internet play should use an HTTPS host with WSS, rather than exposing this development port.

Solo remains available through the opening menu. `python serve.py` is an optional localhost-only solo launcher; it does not run multiplayer. Solo saves stay in browser storage. Online pause/save/load/restart are disabled.

## Publish a solo website

```powershell
node scripts/build-static.cjs
```

This creates an allowlisted `dist` folder containing public game assets, a CSP, and no server source, tests, Git history or credentials. Publish its contents through GitHub Pages. The `codex/public-site` branch holds generated site assets; game development remains on the source branch. Rebuild and update that site branch after source changes.

Without a configured multiplayer endpoint, the published website explicitly offers solo and explains that the match server is not connected.

## Free Render multiplayer test server

The repository includes `render.yaml` with `plan: free`. In your Render account, create a Blueprint from this repository and select the branch containing this multiplayer implementation. Keep the Free instance; no disk or paid service is needed. For a strict zero-cost test, do not add a payment method; if the account already has one, configure zero spending limits before deployment because included bandwidth/build usage can otherwise incur charges. Build is `npm ci`, start is `npm start`, and `/healthz` is the health endpoint. Render provides the `PORT` environment variable.

Once deployed, open the service's HTTPS URL directly. It serves both the game and WebSocket endpoint `/ws`, so no separate website configuration is needed. Two people can visit that URL and use the invite code.

To connect the separate GitHub Pages website, set `ALLOWED_ORIGINS` on Render to the exact website origin (`https://n0-m-4d.github.io`, no trailing slash or repository path), then rebuild the static site:

```powershell
$env:MULTIPLAYER_SERVER_URL = 'wss://YOUR-SERVICE.onrender.com/ws'
node scripts/build-static.cjs
Remove-Item Env:MULTIPLAYER_SERVER_URL
```

Publish the rebuilt files. The endpoint is public configuration, not a secret. Never put account tokens in it.

## Test-build limits

- Rooms are memory-only. Restart, redeploy or free-host shutdown loses matches. This build does not promise persistent long campaigns.
- Refreshing the same tab can resume its seat within 60 seconds using a tab-local token. A disconnected commander pauses server simulation until reconnect; leaving intentionally ends the match.
- No accounts, ranking, matchmaking, spectators or cross-device resume yet. A private room code is an invitation, not an account-level privacy guarantee.
- Simulation ticks at 20 Hz and sends filtered snapshots at 5 Hz. Initial snapshots are about 20 KB per player (down from 112 KB); fog is bit-packed and occupation values use bounded rounding. Traffic grows with visible armies and effects, so this is intended for a small test group. The client interpolates presentation. Enemy units and placed buildings outside your vision are excluded; province ownership and map geography remain public.
- Bounds exist for rooms, connections, payload size, commands and slow clients. These are prototype safeguards, not a production anti-abuse service or capacity guarantee.
- Free hosting has startup and availability limits. Review the current [Render free-service limits](https://render.com/docs/free) before inviting a larger test group. No paid plan is configured.

## Verification

`npm test` runs gameplay, security, multiplayer simulation, WebSocket transport and static-package checks. `python -m unittest server_test.py` covers the optional Python launcher. Live browser checks and a real two-person internet match are separate acceptance gates; automated tests do not establish sustained FPS, WAN latency or free-server capacity.
