# Online play — free testing

The game supports solo campaigns, browser-hosted peer matches, and optional dedicated-server matches. The public static website supports peer matches without running Node or creating a hosting account.

## Play with a friend: browser peer hosting

1. Both players open the same game version at the public website (or a local static server).
2. Host chooses **Create peer invite**, then sends the entire connection text privately to the friend.
3. Friend chooses **Join peer invite**, pastes the invite, and chooses **Create reply**. The friend sends the resulting reply back to the host.
4. Host pastes the reply and chooses **Connect to friend**.
5. Both choose **Ready**. The host chooses **Start match**.

The host's browser runs the authoritative simulation in a Web Worker. WebRTC data channels carry guest orders and filtered snapshots directly between browsers. Each commander sees their own army in blue. The host validates guest ownership, resources and fog; the guest never chooses their authoritative side. Rendering remains on each player's own device.

There is no hosted lobby or signaling account: exchanging the invite and reply performs signaling manually. The browser uses Cloudflare's [free public STUN service](https://developers.cloudflare.com/realtime/turn/faq/) to discover network addresses. STUN does not relay match traffic. No TURN relay, camera or microphone is enabled. Some NAT/firewall combinations cannot connect directly; the UI reports a timeout or connection failure instead of promising universal connectivity.

Keep the host browser and game tab open. Either player leaving, refreshing, closing the tab, losing the connection, or the browser suspending the host can end the match. There is no peer reconnect, host migration or match persistence in this first version. A fast host and stable connection matter; a background worker cannot prevent operating-system sleep or browser tab suspension. Only play with trusted friends: peer connections expose network addresses, and a player hosting the simulation can modify it. This is suitable for friendly tests, not ranked anti-cheat.

Invites are session-specific, data-only, size-limited and matched to the corresponding reply. Invalid packets, excessive commands, incomplete snapshots and disconnected peers are rejected. Snapshot data is chunked and bounded; a slow connection skips newer state updates before queuing unbounded traffic.

## Run a static local copy

```powershell
python serve.py
```

Open http://127.0.0.1:8765/. Solo and peer hosting both work with the static launcher. It only serves files; the peer match runs in the host browser. To test both seats on one computer, use two tabs and exchange their connection text through the UI. This verifies the data-channel flow but does not prove connectivity across different home networks.

## Optional dedicated match server

Install Node.js 22 or newer, then run:

```powershell
npm ci
$env:HOST = '127.0.0.1'
npm start
```

Open http://127.0.0.1:8765/ in two tabs. Host a match in the first tab, enter its invite code in the second, mark both players Ready, then Start match as host. A public room appears in the room browser; private rooms require their code. Each commander sees their own army in blue and the opposing army in red. Both start with two armour and two infantry companies, equal resources and production buildings. Neutral defenders occupy other provinces. The dedicated server controls movement, combat, capture, recruitment, resources and fog.

For LAN testing, bind `HOST` to `0.0.0.0` and use the host computer's LAN address. Only open a local firewall rule if you intentionally want LAN access. Internet play should use an HTTPS host with WSS, rather than exposing this development port.

Solo remains available through the opening menu. `python serve.py` serves solo and browser-peer assets; it does not run dedicated matches. Solo saves stay in browser storage. Online pause/save/load/restart are disabled.

## Publish the static website

```powershell
node scripts/build-static.cjs
```

This creates an allowlisted `dist` folder containing public game assets, a CSP, and no Node server executable, tests, Git history or credentials. The shared simulation module is included so browser hosts can run matches. Publish its contents through GitHub Pages. The `codex/public-site` branch holds generated site assets; game development remains on the source branch. Rebuild and update that site branch after source changes.

Without a configured dedicated endpoint, solo and peer invites remain available. The separate Dedicated server options explain when no dedicated match server is connected.

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

## Dedicated-server test limits

- Rooms are memory-only. Restart, redeploy or free-host shutdown loses matches. This build does not promise persistent long campaigns.
- Refreshing the same tab can resume its seat within 60 seconds using a tab-local token. A disconnected commander pauses server simulation until reconnect; leaving intentionally ends the match.
- No accounts, ranking, matchmaking, spectators or cross-device resume yet. A private room code is an invitation, not an account-level privacy guarantee.
- Simulation ticks at 20 Hz and sends filtered snapshots at 5 Hz. Initial snapshots are about 20 KB per player (down from 112 KB); fog is bit-packed and occupation values use bounded rounding. Traffic grows with visible armies and effects, so this is intended for a small test group. The client interpolates presentation. Enemy units and placed buildings outside your vision are excluded; province ownership and map geography remain public.
- Bounds exist for rooms, connections, payload size, commands and slow clients. These are prototype safeguards, not a production anti-abuse service or capacity guarantee.
- Free hosting has startup and availability limits. Review the current [Render free-service limits](https://render.com/docs/free) before inviting a larger test group. No paid plan is configured.

## Verification

`npm test` runs gameplay, security, shared multiplayer simulation, browser-worker isolation, peer signaling/transport, WebSocket transport and static-package checks. `python -m unittest server_test.py` covers the optional Python launcher. Live browser checks and a real two-person internet match are separate acceptance gates; automated tests do not establish sustained FPS, WAN latency or free-server capacity.
