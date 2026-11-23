<?php

namespace App\Http\Controllers;

use App\Models\QuickMatchQueue;
use App\Models\Room;
use App\Models\RoomPlayer;
use App\Services\ComputerStrategy;
use App\Services\MatchRules;
use App\Services\MatchStarter;
use App\Services\PlayerResume;
use App\Services\RoomBroadcaster;
use App\Services\RoomPresence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class RoomController extends Controller
{
    /** Window a turn player has before the server accepts an afk auto roll/move. */
    private const TURN_TIMEOUT_MS = 10_000;

    /** Extra delay the client adds before its timeout request lands. */
    private const TURN_TIMEOUT_GRACE_MS = 1_500;

    /** Consecutive server-auto-played turns before a quick-match seat is forfeited. */
    private const FORFEIT_AFTER_CONSECUTIVE_TIMEOUTS = 3;

    public function __construct(
        private RoomBroadcaster $broadcaster,
        private RoomPresence $presence,
    ) {}

    public static function playerToken(Request $request): string
    {
        $token = $request->session()->get('ludo_player_token');

        if (! is_string($token) || $token === '') {
            $token = Str::random(40);
            $request->session()->put('ludo_player_token', $token);
        }

        return $token;
    }

    public static function defaultPlayerName(Request $request, bool $isHost = false): string
    {
        $user = $request->user();
        if ($user && is_string($user->name) && trim($user->name) !== '') {
            return Str::limit(explode(' ', trim($user->name))[0], 24, '');
        }

        return $isHost ? 'Host' : 'Tamu';
    }

    public static function generateCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        do {
            $code = '';
            for ($i = 0; $i < 6; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (Room::where('code', $code)->exists());

        return $code;
    }

    /**
     * Backfill the AFK bookkeeping on snapshots written before the
     * consecutive-timeout policy existed.
     *
     * @param  array<string, mixed>  $state
     */
    private static function backfillAfkCounters(array &$state): void
    {
        $count = count($state['tokens'] ?? []);

        if (! isset($state['consecutive_timeouts']) || ! is_array($state['consecutive_timeouts'])) {
            $state['consecutive_timeouts'] = array_fill(0, $count, 0);
        }

        for ($i = 0; $i < $count; $i++) {
            $state['consecutive_timeouts'][$i] = (int) ($state['consecutive_timeouts'][$i] ?? 0);
        }

        if (! isset($state['forfeited']) || ! is_array($state['forfeited'])) {
            $state['forfeited'] = [];
        }

        if (! array_key_exists('turn_timed_out', $state)) {
            $state['turn_timed_out'] = false;
        }
    }

    /**
     * Close out the acting player's turn. A turn that contained any
     * server-auto-played action counts as one consecutive skip; a turn the
     * player played themselves resets the chain.
     *
     * @param  array<string, mixed>  $state
     */
    private static function closeOutTurn(array &$state, int $index, bool $countSkip): void
    {
        if ($countSkip) {
            if (! empty($state['turn_timed_out'])) {
                $state['consecutive_timeouts'][$index] = (int) ($state['consecutive_timeouts'][$index] ?? 0) + 1;
            } else {
                $state['consecutive_timeouts'][$index] = 0;
            }
        }

        $state['turn_timed_out'] = false;
    }

    /**
     * Hand a quick-match seat to the computer after three consecutive
     * auto-played turns: the row keeps its tokens and name but plays itself
     * from now on, so the match keeps its pace instead of stalling.
     *
     * @param  array<string, mixed>  $state
     */
    private static function forfeitSeatToComputer(array &$state, RoomPlayer $player, int $index): bool
    {
        if ($player->is_computer || in_array($index, $state['forfeited'] ?? [], true)) {
            return false;
        }

        $state['forfeited'][] = $index;
        $state['consecutive_timeouts'][$index] = 0;
        $player->is_computer = true;
        $player->save();

        return true;
    }

    /**
     * A forfeited player who acts manually takes the seat back. Native
     * computer seats never send manual commands, so any manual command from
     * a computer row is the returning human.
     *
     * @param  array<string, mixed>  $state
     */
    private static function reclaimForfeitedSeat(array &$state, RoomPlayer $player, int $index): bool
    {
        if (! $player->is_computer || ! in_array($index, $state['forfeited'] ?? [], true)) {
            return false;
        }

        self::clearSeatTimeouts($state, $index);
        $player->is_computer = false;
        $player->save();

        return true;
    }

    private static function clearSeatTimeouts(array &$state, int $index): void
    {
        $state['forfeited'] = array_values(array_diff($state['forfeited'] ?? [], [$index]));
        $state['consecutive_timeouts'][$index] = 0;
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'password' => [$request->session()->get('ludo_room_access') ? 'nullable' : 'required', 'string'],
            'max_players' => ['required', 'integer', Rule::in([2, 3, 4, 5, 6, 7])],
            'vs_computer' => ['sometimes', 'boolean'],
        ], [
            'max_players.required' => 'Pilih jumlah pemain terlebih dahulu.',
            'max_players.integer' => 'Jumlah pemain harus 2 sampai 7.',
            'max_players.in' => 'Jumlah pemain harus 2 sampai 7.',
        ]);

        $roomPassword = config('ludo.room_password');

        if (! $request->session()->get('ludo_room_access') && (! is_string($roomPassword) || $roomPassword === '')) {
            throw ValidationException::withMessages([
                'password' => 'Kata sandi pembuatan room belum dikonfigurasi di server.',
            ]);
        }

        if (! $request->session()->get('ludo_room_access') && ! hash_equals((string) $roomPassword, (string) $request->input('password'))) {
            throw ValidationException::withMessages([
                'password' => 'Kata sandi salah. Periksa kembali lalu coba lagi.',
            ]);
        }

        $request->session()->put('ludo_room_access', true);
        $request->session()->forget('ludo_player_name');
        $token = self::playerToken($request);
        $maxPlayers = (int) $validated['max_players'];

        $room = DB::transaction(function () use ($request, $token, $maxPlayers) {
            $room = Room::create([
                'code' => self::generateCode(),
                'host_token' => $token,
                'max_players' => $maxPlayers,
                'status' => 'waiting',
            ]);

            RoomPlayer::create([
                'room_id' => $room->id,
                'player_token' => $token,
                'user_id' => $request->user()?->id,
                'name' => self::defaultPlayerName($request, true),
                'seat_color' => null,
                'character' => null,
                'is_ready' => false,
                'is_host' => true,
                'last_seen_at' => now(),
            ]);

            if ($request->boolean('vs_computer')) {
                self::fillComputerSeats($room);
            }

            return $room;
        });

        PlayerResume::remember($request, $room->players()->where('player_token', $token)->firstOrFail(), $room->code);

        $request->session()->put('ludo_host_room_code', $room->code);

        return redirect()->route('room', ['code' => $room->code]);
    }

    public function updateSettings(Request $request, string $code): RedirectResponse
    {
        $validated = $request->validate([
            'max_players' => ['sometimes', 'integer', Rule::in([2, 3, 4, 5, 6, 7])],
            'host_advantage' => ['sometimes', 'boolean'],
            'vs_computer' => ['sometimes', 'boolean'],
        ]);

        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        if ($room->host_token !== $token) {
            abort(403, 'Hanya host yang dapat mengubah kapasitas pemain.');
        }

        // Quick-match rooms are system-owned: they have no host, never show a
        // lobby, and keep their settings — especially host_advantage off —
        // for the whole match.
        if ($room->is_quick) {
            throw ValidationException::withMessages([
                'room' => 'Room Quick Match tidak dapat diubah pengaturannya.',
            ]);
        }

        if ($room->status !== 'waiting') {
            throw ValidationException::withMessages([
                'room' => 'Permainan sudah dimulai.',
            ]);
        }

        DB::transaction(function () use ($room, $validated) {
            $lockedRoom = Room::where('id', $room->id)->lockForUpdate()->firstOrFail();
            if ($lockedRoom->status !== 'waiting') {
                throw ValidationException::withMessages(['room' => 'Permainan sudah dimulai.']);
            }
            $lockedRoom->max_players = $validated['max_players'] ?? $lockedRoom->max_players;
            $lockedRoom->host_advantage = $validated['host_advantage'] ?? $lockedRoom->host_advantage;
            $lockedRoom->save();

            $capacityChanged = array_key_exists('max_players', $validated);
            $hasComputers = $lockedRoom->players()->where('is_computer', true)->exists();
            $computerMode = $validated['vs_computer'] ?? $hasComputers;
            $refreshComputers = array_key_exists('vs_computer', $validated) || ($capacityChanged && $hasComputers);
            if ($refreshComputers) {
                $lockedRoom->players()->where('is_computer', true)->delete();
            }

            if ($capacityChanged) {
                self::resetGuestSeatsForNewCapacity($lockedRoom);
            }

            if ($refreshComputers && $computerMode) {
                if (! $capacityChanged && $lockedRoom->players()->count() >= $lockedRoom->max_players) {
                    throw ValidationException::withMessages(['room' => 'Tidak ada kursi kosong untuk komputer.']);
                }
                self::fillComputerSeats($lockedRoom);
            }
        });

        $room->refresh()->load('players');
        $this->broadcaster->publishRoomUpdated($room, __FUNCTION__);

        return back();
    }

    /**
     * Prepare the lobby again after the host changes the capacity: every
     * human guest loses their home-base colour, character and ready state and
     * picks them again for the new player count. The host keeps their seat.
     */
    private static function resetGuestSeatsForNewCapacity(Room $room): void
    {
        $room->players()
            ->reorder()
            ->where('is_host', false)
            ->where('is_computer', false)
            ->update([
                'seat_color' => null,
                'character' => null,
                'is_ready' => false,
            ]);
    }

    private static function fillComputerSeats(Room $room): void
    {
        $players = $room->players()->get();
        $takenCharacters = $players->pluck('character')->filter()->all();
        foreach ($room->allowedSeats() as $seat) {
            if ($players->count() >= $room->max_players) {
                break;
            }
            if ($players->contains('seat_color', $seat)) {
                continue;
            }
            $character = self::firstFreeCharacter($takenCharacters, [Room::DEFAULT_CHARACTER_BY_COLOR[$seat] ?? null]);
            $players->push(RoomPlayer::create([
                'room_id' => $room->id,
                'player_token' => Str::random(40),
                'name' => Room::characterName($character),
                'seat_color' => $seat,
                'character' => $character,
                'is_ready' => true,
                'is_host' => false,
                'is_computer' => true,
            ]));
            $takenCharacters[] = $character;
        }
    }

    public function randomize(Request $request, string $code): RedirectResponse
    {
        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        if ($room->host_token !== $token) {
            abort(403, 'Hanya host yang dapat mengacak warna dan karakter.');
        }

        if ($room->status !== 'waiting') {
            throw ValidationException::withMessages([
                'room' => 'Permainan sudah dimulai.',
            ]);
        }

        DB::transaction(function () use ($room) {
            $lockedRoom = Room::where('id', $room->id)->lockForUpdate()->firstOrFail();
            if ($lockedRoom->status !== 'waiting') {
                throw ValidationException::withMessages(['room' => 'Permainan sudah dimulai.']);
            }

            $players = $lockedRoom->players()->get();
            if (! $players->contains(fn (RoomPlayer $player) => (bool) $player->is_computer)) {
                throw ValidationException::withMessages([
                    'room' => 'Fitur acak hanya tersedia pada mode VS COMPUTER.',
                ]);
            }

            $targets = $players
                ->filter(fn (RoomPlayer $player) => $player->is_host || $player->is_computer)
                ->values();

            $fixedPlayers = $players->reject(fn (RoomPlayer $player) => $player->is_host || $player->is_computer);

            $reservedColors = $fixedPlayers
                ->pluck('seat_color')
                ->filter()
                ->values()
                ->all();

            $reservedCharacters = $fixedPlayers
                ->filter(fn (RoomPlayer $player) => $player->seat_color !== null || $player->character !== null)
                ->map(fn (RoomPlayer $player) => $player->character ?? ($player->seat_color ? (Room::DEFAULT_CHARACTER_BY_COLOR[$player->seat_color] ?? 'ignivar') : null))
                ->filter()
                ->unique()
                ->values()
                ->all();

            $availableColors = array_values(array_diff(Room::ALL_COLORS, $reservedColors));
            $availableCharacters = array_values(array_diff(Room::ALL_CHARACTERS, $reservedCharacters));
            $targetCount = $targets->count();

            if (count($availableColors) < $targetCount || count($availableCharacters) < $targetCount) {
                throw ValidationException::withMessages([
                    'room' => 'Tidak cukup warna atau karakter yang tersedia untuk diacak.',
                ]);
            }

            $previous = $targets
                ->map(fn (RoomPlayer $player) => [$player->seat_color, $player->character])
                ->all();

            $pickedColors = [];
            $pickedCharacters = [];

            for ($attempt = 0; $attempt < 10; $attempt++) {
                $pickedColors = array_slice(self::shuffleList($availableColors), 0, $targetCount);
                $pickedCharacters = array_slice(self::shuffleList($availableCharacters), 0, $targetCount);

                $next = [];
                for ($index = 0; $index < $targetCount; $index++) {
                    $next[] = [$pickedColors[$index], $pickedCharacters[$index]];
                }

                if ($next !== $previous) {
                    break;
                }
            }

            foreach ($targets as $index => $target) {
                $newColor = $pickedColors[$index];
                $newCharacter = $pickedCharacters[$index];

                if ($target->is_computer && ($target->name === 'Computer' || in_array($target->name, Room::CHARACTER_NAMES, true))) {
                    $target->name = Room::characterName($newCharacter);
                }

                $target->seat_color = $newColor;
                $target->character = $newCharacter;
                $target->is_ready = true;
                $target->save();
            }
        });

        $room->refresh()->load('players');
        $this->broadcaster->publishRoomUpdated($room, __FUNCTION__);

        return back();
    }

    /**
     * @param  list<string>  $items
     * @return list<string>
     */
    private static function shuffleList(array $items): array
    {
        $list = array_values($items);
        for ($i = count($list) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$list[$i], $list[$j]] = [$list[$j], $list[$i]];
        }

        return $list;
    }

    public function selectSeat(Request $request, string $code): RedirectResponse
    {
        $validated = $request->validate([
            'seat_color' => ['nullable', 'string', Rule::in(Room::ALL_COLORS)],
            'character' => ['nullable', 'string', Rule::in(Room::ALL_CHARACTERS)],
        ]);

        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        if ($room->status !== 'waiting') {
            throw ValidationException::withMessages([
                'seat_color' => 'Permainan sudah dimulai.',
            ]);
        }

        $seatColor = $validated['seat_color'] ?? null;
        $character = $validated['character'] ?? null;

        DB::transaction(function () use ($room, $token, $seatColor, $character) {
            $lockedRoom = Room::where('id', $room->id)->lockForUpdate()->firstOrFail();

            $player = $lockedRoom->players()->where('player_token', $token)->first();
            if (! $player) {
                abort(403, 'Kamu belum bergabung ke ruang ini.');
            }

            if ($seatColor !== null) {
                if ($player->seat_color === null && $lockedRoom->players()->whereNotNull('seat_color')->count() >= $lockedRoom->max_players) {
                    throw ValidationException::withMessages([
                        'seat_color' => 'Semua kursi untuk kapasitas ruang ini sudah terisi.',
                    ]);
                }

                $taken = $lockedRoom->players()
                    ->where('seat_color', $seatColor)
                    ->where('id', '!=', $player->id)
                    ->exists();

                if ($taken) {
                    throw ValidationException::withMessages([
                        'seat_color' => 'Warna home base ini sudah dipilih pemain lain.',
                    ]);
                }
            }

            $takenCharacters = $seatColor === null
                ? []
                : self::charactersTakenByOthers($lockedRoom, $player);

            if ($character !== null && in_array($character, $takenCharacters, true)) {
                throw ValidationException::withMessages([
                    'character' => 'Karakter ini sudah dipilih pemain lain.',
                ]);
            }

            $player->seat_color = $seatColor;
            if ($seatColor === null) {
                $player->character = null;
            } elseif ($character !== null) {
                $player->character = $character;
            } elseif ($player->character !== null && in_array($player->character, $takenCharacters, true)) {
                $player->character = null;
            }
            $player->is_ready = $seatColor !== null && $player->character !== null;
            $player->save();
        });

        $room->refresh()->load('players');
        $this->broadcaster->publishRoomUpdated($room, __FUNCTION__);

        return back();
    }

    /**
     * Characters held by the other seated players, using the same seat
     * default the lobby payload shows when no character is stored.
     *
     * @return list<string>
     */
    private static function charactersTakenByOthers(Room $room, RoomPlayer $player): array
    {
        return $room->players()
            ->where('id', '!=', $player->id)
            ->whereNotNull('seat_color')
            ->get()
            ->map(fn (RoomPlayer $other) => $other->character ?? (Room::DEFAULT_CHARACTER_BY_COLOR[$other->seat_color] ?? 'ignivar'))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  list<string>  $takenCharacters
     * @param  list<string|null>  $preferredCharacters
     */
    private static function firstFreeCharacter(array $takenCharacters, array $preferredCharacters): string
    {
        foreach ([...$preferredCharacters, ...Room::ALL_CHARACTERS] as $candidate) {
            if ($candidate !== null && ! in_array($candidate, $takenCharacters, true)) {
                return $candidate;
            }
        }

        return Room::ALL_CHARACTERS[0];
    }

    public function updateName(Request $request, string $code): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:24'],
        ]);

        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        $player = $room->players()->where('player_token', $token)->first();
        if (! $player) {
            abort(403, 'Kamu belum bergabung ke ruang ini.');
        }

        return $this->savePlayerName($room, $player, $validated['name'], true);
    }

    public function updatePlayerName(Request $request, string $code, int $player): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:24'],
        ]);

        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        if ($room->host_token !== $token) {
            abort(403, 'Hanya host yang dapat mengganti nama pemain.');
        }

        $target = $room->players()->whereKey($player)->firstOrFail();

        return $this->savePlayerName($room, $target, $validated['name']);
    }

    private function savePlayerName(Room $room, RoomPlayer $player, string $rawName, bool $confirmedByPlayer = false): RedirectResponse
    {
        $cleanName = trim($rawName);
        if ($cleanName === '') {
            throw ValidationException::withMessages([
                'name' => 'Nama pemain tidak boleh kosong.',
            ]);
        }

        if ($confirmedByPlayer && in_array(mb_strtolower($cleanName), ['host', 'tamu', 'tuan rumah'], true)) {
            throw ValidationException::withMessages([
                'name' => 'Masukkan nama selain nama default.',
            ]);
        }

        $player->name = $cleanName;
        if ($confirmedByPlayer) {
            $player->name_confirmed = true;
        }
        $player->save();

        $room->refresh()->load('players');
        $this->broadcaster->publishRoomUpdated($room, __FUNCTION__);

        return back();
    }

    public function toggleReady(Request $request, string $code): RedirectResponse
    {
        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        if ($room->status !== 'waiting') {
            throw ValidationException::withMessages([
                'ready' => 'Permainan sudah dimulai.',
            ]);
        }

        $player = $room->players()->where('player_token', $token)->first();
        if (! $player) {
            abort(403, 'Kamu belum bergabung ke ruang ini.');
        }

        if ($player->seat_color === null) {
            throw ValidationException::withMessages([
                'ready' => 'Pilih warna home base terlebih dahulu sebelum menandai siap.',
            ]);
        }

        if (! $player->is_computer && $player->character === null) {
            throw ValidationException::withMessages([
                'ready' => 'Pilih karakter terlebih dahulu sebelum menandai siap.',
            ]);
        }

        $player->is_ready = $request->has('is_ready')
            ? $request->boolean('is_ready')
            : ! $player->is_ready;
        $player->save();

        $room->refresh()->load('players');
        $this->broadcaster->publishRoomUpdated($room, __FUNCTION__);

        return back();
    }

    public function start(Request $request, string $code): RedirectResponse
    {
        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        if ($room->host_token !== $token) {
            abort(403, 'Hanya host yang dapat memulai permainan.');
        }

        if ($room->status === 'started') {
            return redirect()->route('play', ['room' => $room->code]);
        }

        if ($room->status === 'ended') {
            return redirect()->route('home');
        }

        // Only seated players take part in the match, and the host starts
        // only when exactly the chosen number of players is seated.
        $players = $room->players()->get()
            ->filter(fn (RoomPlayer $p) => $p->seat_color !== null)
            ->values();

        if ($players->count() !== $room->max_players) {
            throw ValidationException::withMessages([
                'start' => "Tunggu tepat {$room->max_players} pemain memilih warna home base dan duduk ({$players->count()}/{$room->max_players}).",
            ]);
        }

        if (! $players->contains(fn (RoomPlayer $p) => $p->is_host)) {
            throw ValidationException::withMessages([
                'start' => 'Host harus memilih warna home base dan duduk terlebih dahulu.',
            ]);
        }

        if ($players->contains(fn (RoomPlayer $p) => ! $p->is_computer && $p->character === null)) {
            throw ValidationException::withMessages([
                'start' => 'Semua pemain harus memilih karakter terlebih dahulu.',
            ]);
        }

        if ($players->contains(fn (RoomPlayer $p) => ! $p->is_computer && ! $p->name_confirmed)) {
            throw ValidationException::withMessages([
                'start' => 'Semua pemain harus mengisi nama sendiri sebelum permainan dimulai.',
            ]);
        }

        if ($players->contains(fn (RoomPlayer $p) => ! $p->is_ready)) {
            throw ValidationException::withMessages([
                'start' => 'Semua pemain harus menandai siap sebelum permainan dimulai.',
            ]);
        }

        $status = DB::transaction(function () use ($room, $players) {
            $room = Room::whereKey($room->id)->lockForUpdate()->firstOrFail();
            if ($room->status !== 'waiting') {
                return $room->status;
            }

            // Match turns index the room's player list, so guests left without
            // a seat (for example after the capacity was lowered) leave the room.
            $room->players()
                ->whereNotIn('id', $players->pluck('id'))
                ->where('is_host', false)
                ->get()
                ->each(fn (RoomPlayer $player) => $player->delete());

            MatchStarter::initialize($room, $players);

            return $room->status;
        });

        if ($status === 'ended') {
            return redirect()->route('home');
        }

        $room->refresh()->load('players');
        $this->broadcaster->publishRoomUpdated($room, __FUNCTION__);

        return redirect()->route('play', ['room' => $room->code]);
    }

    public function roll(Request $request, string $code): JsonResponse
    {
        self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        $player = PlayerResume::find($request, $room);
        if (! $player) {
            abort(403, 'Kamu bukan peserta ruang ini.');
        }

        $this->presence->touch($player);
        $this->presence->closeIfHostGone($room);

        $isComputer = $request->boolean('computer');
        $isTimeout = $request->boolean('timeout');

        if ($isComputer || $isTimeout) {
            $request->validate(['state_version' => ['required', 'integer', 'min:0']]);
        }

        if ($room->status !== 'started') {
            return response()->json(['message' => 'Permainan belum dimulai atau sudah berakhir.'], 422);
        }

        $seatChanged = false;

        $action = DB::transaction(function () use ($room, &$player, $isComputer, $isTimeout, $request, &$seatChanged) {
            $room = Room::whereKey($room->id)->lockForUpdate()->firstOrFail();
            $players = $room->players()->get();
            $player = $players->first(
                fn (RoomPlayer $seat) => $seat->id === $player->id && $seat->player_token === $player->player_token,
            );
            abort_unless($player, 403, 'Kamu bukan peserta ruang ini.');
            $state = $room->match_state;
            self::backfillAfkCounters($state);
            if ($isComputer) {
                $player = $players->get($state['turn'] ?? -1);
                abort_unless($player?->is_computer, 422, 'Bukan giliran komputer.');
            } elseif ($isTimeout) {
                $player = $players->get($state['turn'] ?? -1);
                abort_unless($player !== null, 422, 'Pemain giliran tidak ditemukan.');
                abort_unless((int) ($state['state_version'] ?? 0) === (int) $request->input('state_version'), 422, 'Status permainan telah berubah.');
                $turnStartedAt = (int) ($state['turn_started_at'] ?? ($room->updated_at?->getTimestampMs() ?? 0));
                $elapsedMs = now()->getTimestampMs() - $turnStartedAt;
                abort_unless(
                    $turnStartedAt > 0 &&
                        $elapsedMs >= self::TURN_TIMEOUT_MS - self::TURN_TIMEOUT_GRACE_MS,
                    422,
                    'Waktu giliran belum habis.',
                );
            }
            $index = $players->search(fn ($item) => $item->id === $player->id);
            // The version guard arbitrates concurrent computer-driver or
            // timeout requests; a manual command from a converted seat is the
            // returning owner and reclaims it without one.
            if ($player->is_computer && ($isComputer || $isTimeout)) {
                abort_unless((int) ($state['state_version'] ?? 0) === (int) $request->input('state_version'), 422, 'Status permainan telah berubah.');
            }
            abort_unless($room->status === 'started' && $state && $index !== false && $index < count($state['tokens']) && $state['turn'] === $index && ! in_array($index, $state['winners'] ?? [], true) && $state['dice'] === null && $state['winner'] === null, 422, 'Bukan giliran melempar.');
            // A timeout command marks the turn as auto-played so it counts
            // toward the forfeit chain; a manual command from a converted
            // seat is the returning owner and hands the seat back.
            if ($isTimeout) {
                $state['turn_timed_out'] = true;
            } elseif (! $isComputer) {
                $seatChanged = self::reclaimForfeitedSeat($state, $player, $index);
            }
            $value = $room->is_quick
                ? random_int(1, 6)
                : MatchRules::rollDice($state, $index, $room->host_advantage && $player->is_host && ! $player->is_computer && ! $isTimeout);
            $state = MatchRules::recordRoll($state, $index, $value, ! $room->is_quick);
            if (MatchRules::moves($state, $index, $value)) {
                $state['dice'] = $value;
                $state['afk_auto_move'] = $isTimeout;
            } else {
                $state['turn'] = MatchRules::nextTurn($state, $index);
                $state['afk_auto_move'] = false;
                self::closeOutTurn($state, $index, ! $player->is_computer);
                if (
                    $room->is_quick &&
                    ! $player->is_computer &&
                    ! in_array($index, $state['winners'] ?? [], true) &&
                    (int) $state['consecutive_timeouts'][$index] >= self::FORFEIT_AFTER_CONSECUTIVE_TIMEOUTS
                ) {
                    $seatChanged = self::forfeitSeatToComputer($state, $player, $index) || $seatChanged;
                }
            }
            $nowMs = now()->getTimestampMs();
            $state['state_version'] = (int) ($state['state_version'] ?? 0) + 1;
            $state['turn_started_at'] = $nowMs;
            $state['last_roll'] = [
                'player' => $index,
                'value' => $value,
                'state_version' => $state['state_version'],
            ];
            $room->match_state = $state;
            $room->save();

            return [
                'action_id' => (string) Str::uuid(),
                'type' => 'roll',
                'player_id' => $player->id,
                'value' => $value,
                'state_version' => $state['state_version'],
                'server_now' => $nowMs,
                'match_state' => $state,
            ];
        });

        $this->broadcaster->publishMatchAction($room, $action, $player);

        if ($seatChanged) {
            $room->refresh()->load('players');
            $this->broadcaster->publishRoomUpdated($room, 'afk.seat', $player);
        }

        return response()->json(['ok' => true, 'action' => $action]);
    }

    public function move(Request $request, string $code): JsonResponse
    {
        $isComputer = $request->boolean('computer');
        $isTimeout = $request->boolean('timeout');

        $validated = $request->validate([
            'token_index' => [($isComputer || $isTimeout) ? 'sometimes' : 'required', 'integer', 'min:0', 'max:3'],
        ]);

        self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        $player = PlayerResume::find($request, $room);
        if (! $player) {
            abort(403, 'Kamu bukan peserta ruang ini.');
        }

        $this->presence->touch($player);
        $this->presence->closeIfHostGone($room);

        if ($isComputer || $isTimeout) {
            $request->validate(['state_version' => ['required', 'integer', 'min:0']]);
        }

        if ($room->status !== 'started') {
            return response()->json(['message' => 'Permainan belum dimulai atau sudah berakhir.'], 422);
        }

        $seatChanged = false;

        $action = DB::transaction(function () use ($room, &$player, $validated, $isComputer, $isTimeout, $request, &$seatChanged) {
            $room = Room::whereKey($room->id)->lockForUpdate()->firstOrFail();
            $players = $room->players()->get();
            $player = $players->first(
                fn (RoomPlayer $seat) => $seat->id === $player->id && $seat->player_token === $player->player_token,
            );
            abort_unless($player, 403, 'Kamu bukan peserta ruang ini.');
            $state = $room->match_state;
            self::backfillAfkCounters($state);
            if ($isComputer) {
                $player = $players->get($state['turn'] ?? -1);
                abort_unless($player?->is_computer, 422, 'Bukan giliran komputer.');
            } elseif ($isTimeout) {
                $player = $players->get($state['turn'] ?? -1);
                abort_unless($player !== null, 422, 'Pemain giliran tidak ditemukan.');
                abort_unless((int) ($state['state_version'] ?? 0) === (int) $request->input('state_version'), 422, 'Status permainan telah berubah.');
                $afkAutoMove = ! empty($state['afk_auto_move']);
                $turnStartedAt = (int) ($state['turn_started_at'] ?? ($room->updated_at?->getTimestampMs() ?? 0));
                $elapsedMs = now()->getTimestampMs() - $turnStartedAt;
                abort_unless(
                    $afkAutoMove ||
                        ($turnStartedAt > 0 &&
                            $elapsedMs >=
                                self::TURN_TIMEOUT_MS - self::TURN_TIMEOUT_GRACE_MS),
                    422,
                    'Waktu giliran belum habis.',
                );
            }
            $index = $players->search(fn ($item) => $item->id === $player->id);
            // Same as the roll: only automated commands carry a version to
            // check, a manual one from a converted seat reclaims it.
            if ($player->is_computer && ($isComputer || $isTimeout)) {
                abort_unless((int) ($state['state_version'] ?? 0) === (int) $request->input('state_version'), 422, 'Status permainan telah berubah.');
            }
            abort_unless($room->status === 'started' && $state && $index !== false && $index < count($state['tokens']) && $state['turn'] === $index && $state['dice'] !== null, 422, 'Tidak ada langkah untuk dimainkan.');
            // Same as the roll: a timeout marks the turn auto-played, a
            // manual command from a converted seat reclaims it.
            if ($isTimeout) {
                $state['turn_timed_out'] = true;
            } elseif (! $isComputer) {
                $seatChanged = self::reclaimForfeitedSeat($state, $player, $index);
            }
            $moves = MatchRules::moves($state, $index, $state['dice']);
            $tokenIndex = $player->is_computer
                ? ComputerStrategy::chooseMove($state, $index, $moves)
                : ($isTimeout && $moves ? array_rand($moves) : (int) $validated['token_index']);
            abort_unless(array_key_exists($tokenIndex, $moves), 422, 'Langkah tidak sah.');
            $target = $moves[$tokenIndex];
            $colors = $state['colors'] ?? ['blue', 'green'];
            $arms = isset($state['arms']) ? (int) $state['arms'] : null;
            $spec = MatchRules::spec($colors, $arms);
            $starts = array_map(fn (string $color) => $spec['starts'][$color] ?? null, $colors);
            [$state['tokens'], $capturedPositions] = MatchRules::moveTokens($state['tokens'], $index, $tokenIndex, $target, $starts, $spec);
            $finishPosition = $spec['finish_position'];
            $capturedCount = count($capturedPositions);
            $captured = $capturedCount > 0;
            $state['stats'][$index]['captures'] = ($state['stats'][$index]['captures'] ?? 0) + $capturedCount;
            $state['total_moves'] = ($state['total_moves'] ?? 0) + 1;
            $winners = $state['winners'] ?? [];
            $playerFinished = count(array_filter($state['tokens'][$index], fn ($position) => $position === $finishPosition)) === 4;
            if ($playerFinished && ! in_array($index, $winners, true)) {
                $winners[] = $index;
            }
            $state['winners'] = $winners;
            $state = MatchRules::finalizeWhenOnePlayerRemains($state);

            $matchOver = ($state['winner'] ?? null) !== null;

            if (! $matchOver && ($playerFinished || ($state['dice'] !== 6 && ! $captured && $target !== $finishPosition))) {
                $state['turn'] = MatchRules::nextTurn($state, $index);
                self::closeOutTurn($state, $index, ! $player->is_computer);
                if (
                    $room->is_quick &&
                    ! $player->is_computer &&
                    ! in_array($index, $state['winners'] ?? [], true) &&
                    (int) $state['consecutive_timeouts'][$index] >= self::FORFEIT_AFTER_CONSECUTIVE_TIMEOUTS
                ) {
                    $seatChanged = self::forfeitSeatToComputer($state, $player, $index) || $seatChanged;
                }
            }
            $nowMs = now()->getTimestampMs();
            $state['dice'] = null;
            $state['afk_auto_move'] = false;
            $state['state_version'] = (int) ($state['state_version'] ?? 0) + 1;
            $state['turn_started_at'] = $matchOver ? null : $nowMs;
            $room->match_state = $state;
            $room->save();

            return [
                'action_id' => (string) Str::uuid(),
                'type' => 'move',
                'player_id' => $player->id,
                'token_index' => $tokenIndex,
                'state_version' => $state['state_version'],
                'server_now' => $nowMs,
                'match_state' => $state,
            ];
        });

        $this->broadcaster->publishMatchAction($room, $action, $player);

        if ($seatChanged) {
            $room->refresh()->load('players');
            $this->broadcaster->publishRoomUpdated($room, 'afk.seat', $player);
        }

        return response()->json(['ok' => true, 'action' => $action]);
    }

    public function end(Request $request, string $code): RedirectResponse
    {
        self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        $player = PlayerResume::find($request, $room);
        if (! $player) {
            abort(403, 'Kamu bukan peserta ruang ini.');
        }

        abort_unless($player->is_host, 403, 'Hanya host yang dapat mengakhiri permainan.');

        $this->closeRoom($room, $player, __FUNCTION__);

        PlayerResume::forget($room->code);

        return redirect()->route('home');
    }

    /**
     * A player leaving on purpose. The host leaving closes the room for
     * everyone (the broadcast sends every remaining player back to the home
     * page). In Quick Match the computer takes over the vacated seat.
     */
    public function leave(Request $request, string $code): RedirectResponse
    {
        self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        $player = PlayerResume::find($request, $room);
        if ($room->is_quick) {
            if ($player) {
                $this->leaveQuickMatch($room, $player);
            }

            if (PlayerResume::lastRoom($request) === $room->code) {
                cookie()->queue(cookie()->forget(PlayerResume::LAST_ROOM_COOKIE));
            }
            Inertia::clearHistory();
        } else {
            abort_unless($player, 403, 'Kamu bukan peserta ruang ini.');

            if ($player->is_host) {
                $this->closeRoom($room, $player, __FUNCTION__, 'host_left');
            }
        }

        PlayerResume::forget($room->code);

        return redirect()->route('home');
    }

    private function leaveQuickMatch(Room $room, RoomPlayer $player): void
    {
        $left = DB::transaction(function () use ($room, $player): bool {
            $lockedRoom = Room::whereKey($room->id)->lockForUpdate()->firstOrFail();
            $seat = $lockedRoom->players()->whereKey($player->id)->lockForUpdate()->first();

            if (! $seat || $seat->player_token !== $player->player_token) {
                return false;
            }

            // Keep the seat ID and turn order while revoking every way to resume it.
            $seat->forceFill([
                'player_token' => Str::random(40),
                'resume_token' => null,
                'user_id' => null,
                'handoff_code_hash' => null,
                'handoff_expires_at' => null,
                'is_computer' => true,
            ])->save();

            $state = $lockedRoom->match_state;
            $index = array_search($seat->seat_color, $state['colors'] ?? [], true);
            if ($index !== false) {
                self::clearSeatTimeouts($state, $index);
                $lockedRoom->update(['match_state' => $state]);
            }

            QuickMatchQueue::where('player_token', $player->player_token)
                ->where('status', QuickMatchQueue::MATCHED)
                ->where('room_code', $lockedRoom->code)
                ->delete();

            return true;
        }, 3);

        if ($left) {
            $room->refresh()->load('players');
            $this->broadcaster->publishRoomUpdated($room, 'player.left', $player);
        }
    }

    private function closeRoom(Room $room, RoomPlayer $host, string $operation, ?string $reason = null): void
    {
        $closed = Room::whereKey($room->id)
            ->whereIn('status', ['waiting', 'started'])
            ->update(['status' => 'ended']);

        if (! $closed) {
            return;
        }

        $room->refresh()->load('players');
        $this->broadcaster->publishRoomUpdated($room, $operation, $host);
        $this->broadcaster->publishMatchAction($room, [
            'action_id' => (string) Str::uuid(),
            'type' => 'end',
            'player_id' => $host->id,
            'ended_by' => $host->name,
            ...($reason === null ? [] : ['reason' => $reason]),
        ], $host);
    }

    /**
     * Keeps a seated player's presence stamp fresh while the tab is open,
     * even in the background where the page polls are paused. A stale host
     * stamp is what triggers the automatic room close.
     */
    public function heartbeat(Request $request, string $code): JsonResponse
    {
        self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        $player = PlayerResume::find($request, $room);
        if (! $player) {
            abort(403, 'Kamu bukan peserta ruang ini.');
        }

        $this->presence->touch($player);
        $this->presence->closeIfHostGone($room);

        return response()->json([
            'ok' => true,
            'room_status' => $room->status,
        ]);
    }
}
