# REALTIME — Reverb Protocol and State Reconciliation

## 1. Transport model

Client sends authenticated commands via HTTP. Laravel commits the game transition. An outbox publisher sends committed events through Laravel Reverb. The client receives events through Laravel Echo.

Reverb is the WebSocket transport only. It is not the source of truth. MySQL stores committed match state, action log, membership and results. Redis carries queue, cache, matchmaking and optional Reverb scaling.

Presence is advisory, not proof of game participation. Authoritative state is read through the snapshot API.

## 2. Laravel Reverb in this project

### 2.1 Installed and generated

- `laravel/reverb` v1.13.
- `laravel-echo`, `pusher-js`, and `@laravel/echo-react`.
- `config/broadcasting.php`.
- `config/reverb.php`.
- `routes/channels.php`, registered in `bootstrap/app.php`.
- `resources/js/app.tsx` calls `configureEcho`.
- `resources/views/app.blade.php` provides the CSRF meta tag.
- `BROADCAST_CONNECTION=reverb` in `.env`.
- `user.{userId}` channel authorization is active. Match channel authorization waits for the `matches` and `match_players` schema.

### 2.2 Environment

Local development values:

```env
BROADCAST_CONNECTION=reverb

REVERB_APP_ID=your-app-id
REVERB_APP_KEY=your-app-key
REVERB_APP_SECRET=your-app-secret
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http
REVERB_ALLOWED_ORIGINS=*

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

`php artisan install:broadcasting --reverb` generates the app credentials. Keep the secret out of version control. Use different credentials for staging and production.

`REVERB_HOST` is used by Laravel when publishing events to Reverb. `VITE_REVERB_HOST` is used by the browser. For a phone on the same LAN, set both to the PC LAN IP, not `localhost`. For production, use HTTPS and port `443`.

`REVERB_ALLOWED_ORIGINS` is `*` for local development. Set an explicit domain in production.

After changing `.env`:

```powershell
php artisan config:clear
php artisan reverb:restart
```

Restart `npm run dev`, or run `npm run build` again, when Vite environment values change.

### 2.3 Running with Laragon

Laragon serves HTTP. Reverb runs as a separate long-running process:

```powershell
php artisan reverb:start --debug
```

Use a separate terminal. Do not run `php artisan serve`.

Queued broadcasts and outbox jobs also need a worker. The current project uses the database queue, so run this in another terminal:

```powershell
php artisan queue:work
```

Without a worker, a `ShouldBroadcast` event can remain queued and never reach Reverb.

For frontend development with hot reload:

```powershell
npm run dev
```

For production assets:

```powershell
npm run build
```

Reverb listens on port `8080` by default. Check it with:

```powershell
Test-NetConnection 127.0.0.1 -Port 8080
```

To test from a phone, allow port `8080` through the Windows firewall, use the PC LAN IP in both Reverb host variables, and keep both devices on the same network.

### 2.4 Echo client

`resources/js/app.tsx` configures Echo once:

```tsx
configureEcho({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST ?? 'localhost',
    wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
});
```

Private channel authorization uses `/broadcasting/auth`. The CSRF token comes from the `csrf-token` meta tag in `app.blade.php`.

Example gameplay subscription:

```tsx
import { useEcho } from '@laravel/echo-react';

type MatchTransition = {
    schema_version: number;
    event_id: string;
    action_id: string;
    match_id: string;
    state_version: number;
    type: 'match.transitioned';
    server_timestamp: string;
    server_now: string;
    turn_deadline_at: string;
    payload: {
        effects: unknown[];
        state?: unknown;
    };
};

useEcho<MatchTransition>(
    `match.${matchId}`,
    'match.transitioned',
    (event) => {
        // Apply by state_version, then enqueue the visual effects.
    },
    [matchId],
);
```

`useEcho` subscribes to a private channel by default. `useEchoPresence` is available for presence channels. `useConnectionStatus` can drive the connection pill.

Do not rely on the socket for initial state. Fetch the snapshot on mount and after every visibility resume, even when the socket reports connected.

## 3. Channels

- `private-match.{matchId}`: authorized current participants, versioned gameplay events.
- `presence-match.{matchId}`: authorized participants, online presence only.
- `private-user.{userId}`: invitations and queue status.
- `private-queue.{ticketId}`: matchmaking updates, only the ticket owner.

Never place room codes, invite links, tokens, or private player data in public broadcasts.

Channel authorization in `routes/channels.php`:

```php
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('user.{userId}', function (User $user, int $userId) {
    return (int) $user->id === $userId;
});
```

When the match schema exists, add the membership check:

```php
Broadcast::channel('match.{matchId}', function (User $user, string $matchId) {
    return $user->matchPlayers()
        ->where('match_id', $matchId)
        ->exists();
});
```

For a presence channel, return member data only after the same membership check:

```php
Broadcast::channel('match.{matchId}', function (User $user, string $matchId) {
    if (! $user->matchPlayers()->where('match_id', $matchId)->exists()) {
        return false;
    }

    return [
        'id' => $user->id,
        'name' => $user->name,
    ];
});
```

Do not authorize every authenticated user. A user must be a current participant of that match.

## 4. Envelope

Recommended MVP: one composite transition event per committed mutation, with ordered visual effects inside it.

```json
{
  "schema_version": 1,
  "event_id": "evt_01",
  "action_id": "act_01",
  "match_id": "m_01",
  "state_version": 42,
  "type": "match.transitioned",
  "server_timestamp": "2026-11-11T15:00:00Z",
  "server_now": "2026-11-11T15:00:00Z",
  "turn_deadline_at": "2026-11-11T15:00:15Z",
  "payload": {
    "effects": [
      { "kind": "dice.rolled", "value": 5 },
      {
        "kind": "token.moved",
        "token_id": "red_2",
        "path": [15, 16, 17, 18, 19],
        "captured_token_id": null
      }
    ],
    "state": {}
  }
}
```

`state_version` strictly increases for accepted state transitions. Multiple semantic effects share one version. Order them with an `effects` array, not with separate events that have the same version.

`schema_version` is the event contract version. Increment it only for a breaking change.

## 5. Broadcast event

Create one event class for committed transitions:

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class MatchTransitioned implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public array $transition)
    {
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('match.'.$this->transition['match_id']),
        ];
    }

    public function broadcastAs(): string
    {
        return 'match.transitioned';
    }

    public function broadcastWith(): array
    {
        return $this->transition;
    }
}
```

Dispatch it from the outbox publisher after the database transaction commits:

```php
broadcast(new MatchTransitioned($transitionPayload));
```

Do not broadcast inside the database transaction. The outbox is at-least-once delivery. The client must deduplicate by `event_id` and apply by `state_version`.

`ShouldBroadcast` is queued. If the outbox publisher already owns retries, prefer an event that implements `ShouldBroadcastNow`, or make sure a queue worker is running. Do not queue the same transition twice without an idempotent outbox record.

When the queue connection is `database`, run `php artisan queue:work` in its own terminal. In production, run the queue through Horizon or Supervisor.

Do not use `toOthers()` for gameplay transitions. Every participant, including the acting player, needs the authoritative event.

## 6. Client algorithm

1. Subscribe to the private match channel and fetch the current snapshot. If fetching first, subscribe immediately afterward and check the version to close the race.
2. Maintain `lastAppliedVersion` and a bounded set of seen event IDs.
3. If incoming version equals `lastAppliedVersion + 1`, apply the authoritative state and enqueue the visual sequence.
4. If incoming version is lower than or equal to `lastAppliedVersion`, ignore the duplicate or stale event.
5. If incoming version is greater than `lastAppliedVersion + 1`, pause action controls, request a snapshot, cancel stale timelines, and snap sprites to the canonical state.
6. On reconnect or visibility resume, fetch a snapshot even if the socket reports connected.
7. On a failed action, show the reason and reconcile. Never optimistically commit dice or movement.

The client never derives the dice result, capture result, or winner. Those values come from committed server state.

## 7. Timers and fairness

The server includes `turn_deadline_at` and `server_now`. The client estimates an offset to render the countdown. Timer expiry is checked on the server under the transaction lock. Do not trust the client clock.

Animation completion never advances the turn. The server commits deadlines independently of visual playback.

## 8. Retry and idempotency

- Every command has a client-generated idempotency key and an expected state version.
- Retrying HTTP with the same key returns the same accepted result.
- A version conflict returns a conflict response with the current snapshot reference.
- Reverb delivery is at least once. The client deduplicates by `event_id`.
- Snapshot plus optional recent transitions is the recovery path. Do not rely on transient WebSocket delivery.

Recommended HTTP contract:

- `200`: accepted, includes new state version.
- `409`: expected version mismatch, includes current version.
- `422`: illegal move or invalid command.
- `403`: not a match participant.
- `429`: rate limited.

## 9. Operational metrics

Track WebSocket connected users, subscription authorization errors, event publish lag, snapshot resync rate, duplicate event rate, command rejection reasons, and p95 action commit latency.

Alert on Reverb disconnects, outbox backlog, publish failures, and a sustained rise in snapshot resyncs.

## 10. Local verification

1. `php artisan route:list` shows `broadcasting/auth`.
2. `php artisan reverb:start --debug` starts without errors and listens on port `8080`.
3. `php artisan queue:work` is running when broadcasts use the database queue.
4. `npm run build` succeeds and includes Echo in the bundle.
5. Log in, subscribe to `private-user.{id}`, dispatch a test event, and confirm it arrives.
6. Browser DevTools shows the WebSocket connection to port `8080`.
7. A `403` on subscription means channel authorization failed. A `419` means the CSRF token is missing or stale.
8. Check `storage/logs/laravel.log` for broadcast or queue errors when an event is not delivered.

For phone testing, use the PC LAN IP in `REVERB_HOST` and `VITE_REVERB_HOST`, allow port `8080` in the firewall, and use the same network.

For HTTPS, terminate TLS at a reverse proxy and use `REVERB_SCHEME=https` with WSS. Mixed content will block a plain `ws://` connection from an HTTPS page.

## 11. Production checklist

- Run Reverb under Supervisor or systemd with automatic restart.
- Use `REVERB_SCHEME=https` and port `443` behind a TLS proxy.
- Set `REVERB_ALLOWED_ORIGINS` to the real application origin.
- Store app credentials in environment secrets, never in the repository.
- Enable Redis scaling with `REVERB_SCALING_ENABLED=true` when running more than one Reverb node.
- Keep MySQL as the durable source of truth. Reverb restarts must not lose match results.
- Monitor connections, authorization errors, publish lag, outbox backlog, and resync rate.
- Test reconnect, duplicate events, out-of-order events, and browser background resume before pilot.
