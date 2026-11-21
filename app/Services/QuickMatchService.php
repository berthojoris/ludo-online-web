<?php

namespace App\Services;

use App\Http\Controllers\RoomController;
use App\Models\QuickMatchQueue;
use App\Models\Room;
use App\Models\RoomPlayer;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Quick Match matchmaking pool.
 *
 * A full pool starts immediately. In the four-seat pool, the oldest active
 * search starts a match after two minutes even if computers are needed.
 */
class QuickMatchService
{
    private const AUTO_FILL_SECONDS = 120;

    public function __construct(private RoomBroadcaster $broadcaster) {}

    /**
     * Snapshot of this browser for the quick-match page.
     *
     * @return array{state: string, room: string|null, pool: int, name: string, token: string, waiting: int, elapsed: int}
     */
    public function pageState(Request $request, int $fallbackPool): array
    {
        $token = RoomController::playerToken($request);
        $this->sweep();

        if ($room = $this->activeRoom($request)) {
            return ['state' => 'active', 'room' => $room->code, 'pool' => $fallbackPool, 'name' => $this->defaultName($request), 'token' => $token, 'waiting' => 0, 'elapsed' => 0];
        }

        if ($entry = $this->matchedEntry($token)) {
            return ['state' => 'matched', 'room' => $entry->room_code, 'pool' => $fallbackPool, 'name' => $entry->name, 'token' => $token, 'waiting' => 0, 'elapsed' => 0];
        }

        $entry = $this->waitingEntry($token);
        $pool = (int) ($entry?->players ?? $fallbackPool);

        return [
            'state' => $entry ? 'waiting' : 'idle',
            'room' => null,
            'pool' => $pool,
            'name' => $entry?->name ?? $this->defaultName($request),
            'token' => $token,
            'waiting' => $this->waitingCount($pool),
            'elapsed' => $this->elapsedSeconds($entry),
        ];
    }

    /**
     * Join (or rejoin, or switch pools in) a quick-match pool, then try to
     * pair right away so a full pool starts its match in this very request.
     *
     * @return array{ok: bool, state: string, room: string|null, waiting: int, elapsed?: int}
     */
    public function join(Request $request, int $pool, string $name): array
    {
        $token = RoomController::playerToken($request);
        $this->sweep();

        if ($room = $this->activeRoom($request)) {
            return ['ok' => true, 'state' => 'active', 'room' => $room->code, 'waiting' => 0];
        }

        if ($entry = $this->matchedEntry($token)) {
            return ['ok' => true, 'state' => 'matched', 'room' => $entry->room_code, 'waiting' => 0];
        }

        $name = trim($name);
        $name = $name === '' ? $this->defaultName($request) : $name;

        try {
            DB::transaction(function () use ($request, $token, $pool, $name): void {
                $entries = QuickMatchQueue::where('player_token', $token)->lockForUpdate()->get();
                if ($entries->contains('status', QuickMatchQueue::MATCHED)) {
                    return;
                }

                $entry = $entries->first() ?? new QuickMatchQueue([
                    'player_token' => $token,
                    'status' => QuickMatchQueue::WAITING,
                ]);
                if ($entry->exists && $entry->players !== $pool) {
                    $entry->created_at = now();
                }

                $entry->fill([
                    'players' => $pool,
                    'user_id' => $request->user()?->id,
                    'name' => $name,
                    'last_seen_at' => now(),
                ])->save();
            }, 3);
        } catch (UniqueConstraintViolationException) {
            // Another join from this browser inserted the queue entry first.
        }

        $this->pairWaitingBrowser($token);

        return $this->queueStatus($token, $pool);
    }

    /**
     * Refresh this browser's waiting stamp and try to pair its pool; the
     * searching page calls this every few seconds.
     *
     * @return array{ok: bool, state: string, room: string|null, waiting: int, elapsed?: int}
     */
    public function touchStatus(Request $request, int $fallbackPool): array
    {
        $token = RoomController::playerToken($request);
        $this->sweep();

        QuickMatchQueue::where('player_token', $token)
            ->where('status', QuickMatchQueue::WAITING)
            ->update(['last_seen_at' => now()]);

        $this->pairWaitingBrowser($token);

        return $this->queueStatus($token, $fallbackPool);
    }

    public function cancel(Request $request): void
    {
        QuickMatchQueue::query()
            ->where('player_token', RoomController::playerToken($request))
            ->where('status', QuickMatchQueue::WAITING)
            ->delete();
    }

    /**
     * The two-seat pool also offers a manual match against a computer.
     *
     * @return array{ok: bool, state: string, room: string|null, waiting: int, elapsed?: int}
     */
    public function fillBots(Request $request, int $pool): array
    {
        $token = RoomController::playerToken($request);
        $entry = $this->waitingEntry($token);
        abort_unless($entry, 422, 'Kamu sedang tidak dalam pencarian pemain.');
        abort_unless((int) $entry->players === $pool, 422, 'Mode pencarian sudah berubah. Mulai ulang pencarianmu.');

        if ($pool === 4) {
            return $this->touchStatus($request, $pool);
        }

        $code = DB::transaction(function () use ($entry, $pool): string {
            $locked = QuickMatchQueue::whereKey($entry->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->status === QuickMatchQueue::WAITING && $locked->players === $pool, 422, 'Pencarian sudah berakhir.');

            $room = $this->createRoom($pool, [$locked], $pool - 1);

            $locked->status = QuickMatchQueue::MATCHED;
            $locked->room_code = $room->code;
            $locked->save();

            return $room->code;
        });

        return ['ok' => true, 'state' => 'matched', 'room' => $code, 'waiting' => 0];
    }

    /**
     * Only a browser actively searching triggers pairing. Its response is
     * resolved separately since the oldest entries may belong to others.
     */
    private function pairWaitingBrowser(string $token): void
    {
        if ($entry = $this->waitingEntry($token)) {
            $this->attemptPair($entry->players);
        }
    }

    private function attemptPair(int $pool): void
    {
        $paired = DB::transaction(function () use ($pool): ?array {
            $entries = QuickMatchQueue::query()
                ->where('players', $pool)
                ->where('status', QuickMatchQueue::WAITING)
                ->where('last_seen_at', '>=', now()->subSeconds(QuickMatchQueue::ELIGIBLE_SECONDS))
                ->orderBy('created_at')
                ->orderBy('id')
                ->lockForUpdate()
                ->limit($pool)
                ->get();

            $oldest = $entries->first();
            $computers = $pool - $entries->count();
            $canFill = $pool === 4 && $this->elapsedSeconds($oldest) >= self::AUTO_FILL_SECONDS;
            if (! $oldest || ($computers > 0 && ! $canFill)) {
                return null;
            }

            $room = $this->createRoom($pool, $entries->all(), $computers);

            QuickMatchQueue::whereIn('id', $entries->pluck('id'))->update([
                'status' => QuickMatchQueue::MATCHED,
                'room_code' => $room->code,
            ]);

            return [$room->code, $entries->pluck('player_token')->all()];
        }, 3);

        if ($paired === null) {
            return;
        }

        [$code, $tokens] = $paired;

        // Broadcast only after the pairing transaction commits; a failed
        // broadcast is never fatal because every searching client polls.
        foreach ($tokens as $token) {
            $this->broadcaster->publishQuickMatchFound($token, $code);
        }
    }

    /** @return array{ok: bool, state: string, room: string|null, waiting: int, elapsed?: int} */
    private function queueStatus(string $token, int $fallbackPool): array
    {
        $waiting = $this->waitingEntry($token);
        if ($matched = $this->matchedEntry($token)) {
            return ['ok' => true, 'state' => 'matched', 'room' => $matched->room_code, 'waiting' => 0];
        }

        return [
            'ok' => true,
            'state' => $waiting ? 'waiting' : 'idle',
            'room' => null,
            'waiting' => $this->waitingCount($waiting?->players ?? $fallbackPool),
            'elapsed' => $this->elapsedSeconds($waiting),
        ];
    }

    private function elapsedSeconds(?QuickMatchQueue $entry): int
    {
        $startedAt = $entry?->created_at?->getTimestamp();

        return $startedAt === null ? 0 : max(0, now()->getTimestamp() - $startedAt);
    }

    /**
     * Create a host-less quick room for the paired entries, fill any
     * remaining seats with computers, and start the match immediately.
     *
     * @param  list<QuickMatchQueue>  $humans
     */
    private function createRoom(int $pool, array $humans, int $computers): Room
    {
        $seats = Room::SEATS_BY_COUNT[$pool] ?? Room::SEATS_BY_COUNT[4];

        // No human host ever matches this token, so every host-gated room
        // control (settings, start, end, randomize) stays out of reach and
        // host_advantage can never be switched on for a quick match.
        $room = Room::create([
            'code' => RoomController::generateCode(),
            'host_token' => Str::random(64),
            'max_players' => $pool,
            'status' => 'waiting',
            'is_quick' => true,
        ]);

        $players = new Collection();
        $seatIndex = 0;

        foreach ($humans as $entry) {
            $seat = $seats[$seatIndex++] ?? $seats[0];
            $players->push(RoomPlayer::create([
                'room_id' => $room->id,
                'player_token' => $entry->player_token,
                'user_id' => $entry->user_id,
                'name' => $entry->name,
                'seat_color' => $seat,
                'character' => Room::DEFAULT_CHARACTER_BY_COLOR[$seat] ?? 'ignivar',
                'is_ready' => true,
                'is_host' => false,
                'name_confirmed' => true,
                'last_seen_at' => now(),
            ]));
        }

        for ($remaining = $computers; $remaining > 0; $remaining--) {
            $seat = $seats[$seatIndex++] ?? $seats[0];
            $character = Room::DEFAULT_CHARACTER_BY_COLOR[$seat] ?? 'ignivar';
            $players->push(RoomPlayer::create([
                'room_id' => $room->id,
                'player_token' => Str::random(40),
                'name' => Room::characterName($character),
                'seat_color' => $seat,
                'character' => $character,
                'is_ready' => true,
                'is_host' => false,
                'is_computer' => true,
                'last_seen_at' => now(),
            ]));
        }

        // Quick rooms skip the lobby entirely: the paired players land on a
        // board that is already running.
        MatchStarter::initialize($room, $players);

        return $room;
    }

    /**
     * A running match this browser already belongs to. Queueing a second
     * match while one is live makes no sense, so callers redirect there.
     */
    private function activeRoom(Request $request): ?Room
    {
        $codes = [];

        $hostCode = $request->session()->get('ludo_host_room_code');
        if (is_string($hostCode) && $hostCode !== '') {
            $codes[] = strtoupper($hostCode);
        }

        if ($last = PlayerResume::lastRoom($request)) {
            $codes[] = $last;
        }

        foreach (array_unique($codes) as $code) {
            $room = Room::where('code', $code)->first();

            if ($room && $room->status === 'started' && PlayerResume::find($request, $room)) {
                return $room;
            }
        }

        return null;
    }

    private function waitingEntry(string $token): ?QuickMatchQueue
    {
        return QuickMatchQueue::query()
            ->where('player_token', $token)
            ->where('status', QuickMatchQueue::WAITING)
            ->first();
    }

    /**
     * This browser's unconsumed pairing, if the room behind it is still
     * running. A pairing whose room has ended is dead and gets deleted so
     * the player can queue again.
     */
    private function matchedEntry(string $token): ?QuickMatchQueue
    {
        $entry = QuickMatchQueue::query()
            ->where('player_token', $token)
            ->where('status', QuickMatchQueue::MATCHED)
            ->first();

        if (! $entry || ! is_string($entry->room_code) || $entry->room_code === '') {
            return null;
        }

        $room = Room::where('code', $entry->room_code)->first();

        if (! $room || $room->status !== 'started') {
            $entry->delete();

            return null;
        }

        return $entry;
    }

    private function waitingCount(int $pool): int
    {
        return QuickMatchQueue::query()
            ->where('players', $pool)
            ->where('status', QuickMatchQueue::WAITING)
            ->where('last_seen_at', '>=', now()->subSeconds(QuickMatchQueue::ELIGIBLE_SECONDS))
            ->count();
    }

    private function defaultName(Request $request): string
    {
        $user = $request->user();

        if ($user && is_string($user->name) && trim($user->name) !== '') {
            return Str::limit(explode(' ', trim($user->name))[0], 24, '');
        }

        return 'Pemain';
    }

    /**
     * Opportunistic hygiene on every queue touch: expire long-stale waiting
     * entries, forget pairings nobody consumed, and close quick rooms that
     * have been silent for half an hour. A host-less quick room only
     * progresses while some browser drives its turns (every roll and move
     * touches the room row), so half an hour of silence means every tab is
     * gone and the room is closed instead of lingering as "started".
     */
    private function sweep(): void
    {
        QuickMatchQueue::query()
            ->where('status', QuickMatchQueue::WAITING)
            ->where('last_seen_at', '<', now()->subSeconds(QuickMatchQueue::STALE_SECONDS))
            ->delete();

        QuickMatchQueue::query()
            ->where('status', QuickMatchQueue::MATCHED)
            ->where('updated_at', '<', now()->subMinutes(30))
            ->delete();

        Room::query()
            ->where('is_quick', true)
            ->whereIn('status', ['waiting', 'started'])
            ->where('updated_at', '<', now()->subMinutes(30))
            ->get()
            ->each(function (Room $room): void {
                $room->status = 'ended';
                $room->save();
                PlayerResume::forget($room->code);
            });
    }
}
