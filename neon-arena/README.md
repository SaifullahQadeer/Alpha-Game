# Neon Arena — Multiplayer FPS (MVP)

A first-person arena shooter in the browser. Real-time multiplayer over Socket.io, 3D rendering via Three.js, authoritative combat on a Node.js backend.

**Status:** playable MVP · Free-for-All · single weapon · single arena.

```
client/   Three.js + Socket.io client (ES modules, no build step)
server/   Express + Socket.io game server with fixed-rate tick
```

---

## Quick start

Requirements: **Node.js 18+**.

```bash
npm install
npm start
```

Then open **http://localhost:3000** in two or more browser tabs (or different browsers) to play against yourself. Each tab is a separate player.

- Enter a callsign and click **DEPLOY**.
- Click the canvas to lock the mouse.
- **WASD** move · **SPACE** jump · **LMB** fire · **R** reload · **TAB** scoreboard · **ESC** release mouse.

Match is first-to-25 kills or 5 minutes, whichever comes first.

Dev mode (auto-restart on server file changes, Node 18.11+):

```bash
npm run dev
```

---

## Architecture

### High level

```
┌───────────────────────────────┐           ┌────────────────────────────┐
│  BROWSER (each player)        │           │  NODE SERVER               │
│  ─ Three.js renderer          │  WS (SIO) │  ─ Express static host     │
│  ─ LocalPlayer (prediction)   │ ◀───────▶ │  ─ GameRoom (30Hz tick)    │
│  ─ RemotePlayer (interp.)     │           │  ─ Auth. hit detection     │
│  ─ HUD / minimap / kill feed  │           │  ─ Respawn + scoring       │
└───────────────────────────────┘           └────────────────────────────┘
```

### Authority model (MVP trade-off)

| Concern        | Authority       | Why |
|----------------|-----------------|-----|
| Movement       | Client          | Simplest path to responsive, zero-input-lag control. Server clamps to map bounds to block trivial teleports. |
| Shooting       | **Server**      | Server validates fire-rate and ammo, does ray-vs-AABB hit detection, applies damage, manages respawns. |
| Reload timer   | **Server**      | Prevents instant-reload cheats; client only renders the progress bar. |
| Match state    | **Server**      | Kill feed, scores, match end. |

For ranked play, replace client-authoritative movement with server-authoritative movement plus input commands + reconciliation. Hooks for that are noted in `server/game/GameRoom.js`.

### Networking

- **Transport:** WebSocket only (`transports: ['websocket']`) to skip long-polling fallbacks and save ~50–100 ms on initial connect.
- **Server tick:** `TICK_RATE = 30 Hz`. Each tick, the server broadcasts a snapshot of all players to everyone in the room.
- **Client send rate:** `SEND_RATE_HZ = 20` for player input (pos/rot). Rate-limited in `Network.sendInput`.
- **Interpolation delay:** Remote players are rendered 100 ms behind server time (`INTERP_DELAY_MS`). This smooths jitter at the cost of a small visual lag for other players — standard for this class of game.
- **Server time sync:** `init` payload includes `serverTime`; the client computes `serverTimeOffset = serverTime - Date.now()` once, and derives all render/match times from that.

### Wire protocol

Messages are tiny JSON objects. Strings below are event names.

Server → client:

| Event               | Payload                                                                 |
|---------------------|-------------------------------------------------------------------------|
| `init`              | `{ selfId, map, players[], constants, matchStartedAt, serverTime }`     |
| `snapshot`          | `{ t, players: [{id,pos,rot,health,alive,kills,deaths}, ...] }`         |
| `playerJoined`      | player snapshot                                                         |
| `playerLeft`        | `{ id }`                                                                |
| `shotFired`         | `{ shooterId, origin, dir, hit?, ammo }`                                |
| `hitConfirmed`      | `{ targetId, damage, killing }`   (to shooter only)                     |
| `tookDamage`        | `{ attackerId, damage, health }`   (to victim only)                     |
| `playerKilled`      | `{ killerId, killerName, victimId, victimName, weapon, t }`             |
| `respawn`           | `{ pos, health, ammo }` (to respawning player)                          |
| `playerRespawned`   | `{ id, pos }` (broadcast)                                               |
| `reloadStart` / `reloadComplete` | `{ duration }` / `{ ammo }`                                |
| `matchEnd`          | `{ winnerId, winnerName, standings[] }`                                 |

Client → server:

| Event       | Payload                                   |
|-------------|-------------------------------------------|
| `joinGame`  | `{ name }`                                |
| `input`     | `{ pos, rot, t }`                         |
| `shoot`     | `{ origin, dir }`                         |
| `reload`    | —                                         |

### File layout

```
neon-arena/
├── package.json
├── README.md
├── server/
│   ├── index.js              Express + Socket.io bootstrap
│   └── game/
│       ├── constants.js      Tick rate, damage, map size, etc.
│       ├── math.js           randomSpawn, rayAABB, raycastPlayer
│       ├── Player.js         Per-player server state
│       └── GameRoom.js       Tick loop, input/shoot/reload handlers, match state
└── client/
    ├── index.html            Lobby + HUD markup, import map
    ├── css/style.css         Dark neon theme
    └── js/
        ├── main.js           Entry: wires UI → Game
        ├── config.js         Client constants (mirrors server)
        ├── Network.js        Socket.io wrapper with rate-limited input
        ├── World.js          Three.js scene, arena, collision AABBs
        ├── LocalPlayer.js    Pointer lock, WASD, collision, shooting
        ├── RemotePlayer.js   Capsule body + nameplate + snapshot interpolation
        ├── Weapon.js         Viewmodel, muzzle flash, tracers, recoil
        ├── HUD.js            DOM HUD: HP, ammo, kill feed, minimap, scoreboard
        ├── UI.js             Lobby / loading / endgame screen switcher
        └── Game.js           Orchestrator + main loop
```

### Performance notes

- **No build step.** Client uses native ES modules + an import map for Three.js from `unpkg`. Good for iteration; swap for a bundler + local three for production.
- **Snapshot payload** is ~80–120 bytes per player per tick (JSON). At 16 players × 30 Hz that's ~50 KB/s per client — well within budget. If you scale further, swap to a binary schema (e.g. `cbor-x` or hand-rolled `DataView`) and move to msgpack or delta snapshots.
- **Collision** is AABB vs AABB with slide resolution (per-axis). No physics engine.
- **Hit detection** is server-side ray-vs-AABB. Lag-compensation (rewinding victim positions to shooter's timestamp) is not implemented — see below.

### Security / anti-cheat

This is an MVP; assume any client-authoritative value can be forged. Mitigations present:

- Server enforces fire-rate, magazine size, reload duration, damage per hit.
- Position clamped to map bounds.
- Names sanitized (`^[\w \-]{1,16}$`).

Not yet present (upgrade path below):
- Server-authoritative movement with input reconciliation.
- Lag-compensated hit detection (server rewinds targets to the shooter's snapshot time).
- Rate limiting on `joinGame` / `shoot` / `reload` beyond fire-rate.
- Signed match tokens for session resumption.

---

## Tunables

Change these in one place on each side:

- `server/game/constants.js` — `TICK_RATE`, `WEAPON`, `MAX_HEALTH`, `MAP_SIZE`, `MATCH_DURATION_MS`, `SCORE_TO_WIN`.
- `client/js/config.js` — `SEND_RATE_HZ`, `INTERP_DELAY_MS`, `MOVE_SPEED`, `JUMP_VEL`, `MOUSE_SENSITIVITY`, `FOV`.

Keep weapon and health values identical on both sides.

---

## Upgrade path (recommended order)

**Phase 1 — core fidelity**
1. **Lag compensation.** Keep a ring-buffer of server snapshots; when a `shoot` arrives, rewind player positions to `now - shooter.ping/2 - INTERP_DELAY_MS` and re-test the ray. Dramatically improves hit feel on higher pings.
2. **Server-authoritative movement.** Send input commands (`{seq, keys, yaw, dt}`) instead of positions. Server simulates, sends `{seq, pos, vel}`. Client reconciles: snap to server and re-apply unacknowledged inputs.
3. **Binary snapshots.** Swap JSON for a `DataView` or msgpack layout. Expect a 3–5× size reduction.

**Phase 2 — gameplay**
4. **Team Deathmatch.** Add `team` to `Player`, filter kill-feed and scoring by team, spawn points per side. The `GameRoom` already owns all of this.
5. **Weapon system.** Replace the single `WEAPON` constant with a weapon registry: pistol, SMG, rifle, shotgun (spread), sniper (single-shot, high damage). Add `weaponId` to player state, `switchWeapon` event, pickups.
6. **Pickups.** Health packs, ammo, weapon pickups as `Entity` instances on the server. Broadcast `pickupSpawned` / `pickupTaken`.
7. **Maps.** Move arena geometry out of `GameRoom._buildWalls` into JSON maps under `server/maps/` and load by `roomId`.

**Phase 3 — scale**
8. **Matchmaker.** Replace the single `defaultRoom` with a pool of rooms (size cap `MAX_PLAYERS_PER_ROOM`). On `joinGame`, assign the least-loaded non-full room; auto-spawn new rooms as needed.
9. **Horizontal scale.** Put a Redis adapter on Socket.io (`@socket.io/redis-adapter`) and run multiple server processes behind a sticky-session load balancer. Each process can still own whole rooms locally — no cross-process game state.
10. **Observability.** Add `/metrics` (Prometheus: ticks/sec, players/room, snapshot size, input rate) and structured logs.

**Phase 4 — polish**
11. **Skins / cosmetics.** Add `skinId` to player state; render different materials/models per skin.
12. **Spectator mode.** Dead players get a free camera orbiting the killer or map.
13. **Sound.** Positional audio (Three.js `PositionalAudio`) for shots, hits, footsteps.
14. **Mobile touch controls.** Virtual joystick + fire button; auto-detect via pointer type.

---

## License

MIT.
