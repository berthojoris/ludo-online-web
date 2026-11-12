# ARCHITECTURE — Modular Monolith + Realtime Rendering

## 1. System boundaries
**Client:** PWA React + Inertia navigation; PixiJS board; GSAP animation; Echo Reverb listener; optional SFX/haptics.  
**Laravel:** auth, room, matchmaking, rules engine, authoritative state transitions, persistence, event outbox, moderation and reporting.  
**Reverb:** websocket broadcast and presence, not authoritative game processing.  
**Redis:** queue, cache, matchmaking, short locks/rate limits; do not make ephemeral Redis the only durable match record.  
**MySQL:** match state, action log, membership and results.  
**Horizon:** queue processing and monitoring.

## 2. Architecture decisions
- Modular monolith before microservices; no Node game backend required.
- POST commands via HTTP; Reverb emits versioned events.
- State mutation uses transaction + row lock on match; unique action idempotency key; outbox inserted in same transaction.
- Dedicated outbox publisher dispatches committed events; at-least-once delivery, client deduplicates.
- Redis lock optional for reducing contention but database transaction is final serialization boundary.
- Laravel domain engine is framework-agnostic pure PHP where practical.

## 3. Example folder structure
```text
app/Domain/Ludo/{Engine,Rules,Actions,DTOs,Events,Exceptions}
app/Domain/Rooms/{Actions,Policies}
app/Domain/Matchmaking/{Actions,Jobs}
app/Http/Controllers/{MatchController,RoomController,MatchActionController}
app/Models/{Match,MatchPlayer,MatchState,MatchAction,OutboxEvent}
app/Jobs/{PublishOutboxEvent,ExpireTurn,MatchmakingTick}
resources/js/{pages,features/game,features/rooms,features/matchmaking,components,pwa}
tests/{Unit/Domain/Ludo,Feature/Match,Integration/Reverb,E2E}
```

## 4. Mutation transaction (conceptual)
1. Authenticate player and authorize match membership.
2. Check idempotency key; return prior result if already accepted.
3. Lock match row `FOR UPDATE` in DB transaction.
4. Validate expected state version, current turn and deadline.
5. Run pure rules engine; produce new state and semantic domain events.
6. Persist state version+1, action log and outbox events atomically.
7. Commit; return accepted action and new version.
8. Outbox worker publishes through Reverb; clients apply or resync.

## 5. Timer strategy
Store authoritative `turn_deadline_at` in UTC; client renders countdown from server time offset. Schedule timeout job but re-check version/deadline under lock because queue jobs can arrive late or duplicate. Timer actions use idempotent action keys.

## 6. Horizontal scale
- Reverb may scale via Redis Pub/Sub with appropriate configuration.
- All Laravel app nodes share DB and Redis; no in-memory authoritative state.
- Load balancing with TLS/WSS and websocket proxy configuration.
- Measure concurrency and event fanout before adding nodes.

## 7. Failure modes
- WebSocket down: HTTP snapshot still source of truth; show degraded state and block unsafe actions.
- Queue lag: committed game state remains correct; client fetches snapshot.
- Redis outage: matchmaking/queue impaired; DB remains durable; fail closed for actions that cannot be safely serialized.
- DB outage: no game mutations; communicate service degradation.
- PWA background: pause rendering; on resume resync before enabling controls.

## 8. No voice
Do not deploy LiveKit, WebRTC audio services, microphone permissions, voice tokens, or voice channels.
