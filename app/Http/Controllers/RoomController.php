<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomPlayer;
use App\Services\MatchRules;
use App\Services\PlayerResume;
use App\Services\RoomBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RoomController extends Controller
{
    public function __construct(private RoomBroadcaster $broadcaster) {}

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

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => [$request->session()->get('ludo_room_access') ? 'nullable' : 'required', 'string'],
            'vs_computer' => ['sometimes', 'boolean'],
        ]);

        if (! $request->session()->get('ludo_room_access') && ! hash_equals((string) config('ludo.room_password'), (string) $request->input('password'))) {
            throw ValidationException::withMessages([
                'password' => 'Kata sandi salah. Periksa kembali lalu coba lagi.',
            ]);
        }

        $request->session()->put('ludo_room_access', true);
        $request->session()->forget('ludo_player_name');
        $token = self::playerToken($request);
        $maxPlayers = (int) $request->input('max_players', 4);
        if (! in_array($maxPlayers, [2, 3, 4, 5, 6, 7], true)) {
            $maxPlayers = 4;
        }

        $room = DB::transaction(function () use ($request, $token, $maxPlayers) {
            $room = Room::create([
                'code' => self::generateCode(),
                'host_token' => $token,
                'max_players' => $maxPlayers,
                'status' => 'waiting',
            ]);

            $firstSeat = $room->allowedSeats()[0];

            RoomPlayer::create([
                'room_id' => $room->id,
                'player_token' => $token,
                'user_id' => $request->user()?->id,
                'name' => self::defaultPlayerName($request, true),
                'seat_color' => $firstSeat,
                'character' => Room::DEFAULT_CHARACTER_BY_COLOR[$firstSeat] ?? 'ignivar',
                'is_ready' => true,
                'is_host' => true,
            ]);

            if ($request->boolean('vs_computer')) {
                $seat = $room->allowedSeats()[1];
                RoomPlayer::create([
                    'room_id' => $room->id,
                    'player_token' => Str::random(40),
                    'name' => 'Computer',
                    'seat_color' => $seat,
                    'character' => Room::DEFAULT_CHARACTER_BY_COLOR[$seat],
                    'is_ready' => true,
                    'is_host' => false,
                    'is_computer' => true,
                ]);
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

            if (array_key_exists('vs_computer', $validated)) {
                $computer = $lockedRoom->players()->where('is_computer', true)->first();
                if (! $validated['vs_computer']) {
                    $computer?->delete();
                } elseif (! $computer) {
                    $players = $lockedRoom->players()->get();
                    $seat = collect($lockedRoom->allowedSeats())->first(fn ($color) => ! $players->contains('seat_color', $color));
                    if ($players->count() >= $lockedRoom->max_players || ! $seat) {
                        throw ValidationException::withMessages(['room' => 'Tidak ada kursi kosong untuk komputer.']);
                    }
                    $taken = $players->pluck('character')->filter()->all();
                    RoomPlayer::create([
                        'room_id' => $lockedRoom->id,
                        'player_token' => Str::random(40),
                        'name' => 'Computer',
                        'seat_color' => $seat,
                        'character' => self::firstFreeCharacter($taken, [Room::DEFAULT_CHARACTER_BY_COLOR[$seat] ?? null]),
                        'is_ready' => true,
                        'is_host' => false,
                        'is_computer' => true,
                    ]);
                }
            }

            $allowedSeats = $lockedRoom->allowedSeats();
            $players = $lockedRoom->players()->get();

            foreach ($players as $player) {
                if ($player->seat_color !== null && ! in_array($player->seat_color, $allowedSeats, true)) {
                    if ($player->is_computer) {
                        $seat = collect($allowedSeats)->first(fn ($color) => ! $players->contains('seat_color', $color));
                        if (! $seat) {
                            throw ValidationException::withMessages(['room' => 'Tidak ada kursi kosong untuk komputer pada kapasitas ini.']);
                        }
                        $player->seat_color = $seat;
                        $player->save();
                        continue;
                    }
                    $player->seat_color = null;
                    $player->character = null;
                    $player->is_ready = false;
                    $player->save();
                }
            }
        });

        $room->refresh()->load('players');
        $this->broadcaster->publishRoomUpdated($room, __FUNCTION__);

        return back();
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

            if ($seatColor !== null && ! in_array($seatColor, $lockedRoom->allowedSeats(), true)) {
                throw ValidationException::withMessages([
                    'seat_color' => 'Kursi tidak tersedia untuk kapasitas ruang ini.',
                ]);
            }

            $player = $lockedRoom->players()->where('player_token', $token)->first();
            if (! $player) {
                abort(403, 'Kamu belum bergabung ke ruang ini.');
            }

            if ($seatColor !== null) {
                $taken = $lockedRoom->players()
                    ->where('seat_color', $seatColor)
                    ->where('id', '!=', $player->id)
                    ->exists();

                if ($taken) {
                    throw ValidationException::withMessages([
                        'seat_color' => 'Kursi ini sudah ditempati pemain lain.',
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
            $player->character = $seatColor === null
                ? null
                : ($character ?? self::firstFreeCharacter($takenCharacters, [
                    $player->character,
                    Room::DEFAULT_CHARACTER_BY_COLOR[$seatColor] ?? null,
                ]));
            // Taking a seat opts the player in right away; they can still
            // switch themselves back to "not ready" from the lobby.
            $player->is_ready = $seatColor !== null;
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
                'ready' => 'Pilih kursi terlebih dahulu sebelum menandai siap.',
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

        $players = $room->players()->get();

        if ($players->count() < 2) {
            throw ValidationException::withMessages([
                'start' => 'Minimal 2 pemain harus bergabung untuk memulai.',
            ]);
        }

        if ($players->contains(fn (RoomPlayer $p) => $p->seat_color === null)) {
            throw ValidationException::withMessages([
                'start' => 'Semua pemain harus memilih kursi terlebih dahulu.',
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

        $startingPlayer = $players->random();

        $room->status = 'started';
        $room->starting_player_id = $startingPlayer->id;
        $room->match_state = MatchRules::initial(
            $players->search(fn ($player) => $player->id === $startingPlayer->id),
            $players->pluck('seat_color')->all(),
            $room->max_players >= 5 ? $room->max_players : 4,
        );
        $room->started_at = now();
        $room->save();

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

        if ($request->boolean('computer')) {
            $request->validate(['state_version' => ['required', 'integer', 'min:0']]);
            $player = $room->players()->where('is_computer', true)->firstOrFail();
        }

        if ($room->status !== 'started') {
            return response()->json(['message' => 'Permainan belum dimulai atau sudah berakhir.'], 422);
        }

        $action = DB::transaction(function () use ($room, $player, $request) {
            $room = Room::whereKey($room->id)->lockForUpdate()->firstOrFail();
            $players = $room->players()->get();
            $index = $players->search(fn ($item) => $item->id === $player->id);
            $state = $room->match_state;
            if ($player->is_computer) {
                abort_unless((int) ($state['state_version'] ?? 0) === (int) $request->input('state_version'), 422, 'Status permainan telah berubah.');
            }
            abort_unless($room->status === 'started' && $state && $index !== false && $index < count($state['tokens']) && $state['turn'] === $index && ! in_array($index, $state['winners'] ?? [], true) && $state['dice'] === null && $state['winner'] === null, 422, 'Bukan giliran melempar.');
            $value = $player->is_computer ? random_int(1, 6) : MatchRules::rollDice($state, $index, (bool) ($room->host_advantage && $player->is_host));
            if (! isset($state['had_six']) || ! is_array($state['had_six'])) {
                $state['had_six'] = array_fill(0, count($state['tokens']), false);
            }
            if ($value === 6 || count(array_filter($state['tokens'][$index], fn ($position) => $position !== -1)) > 0) {
                $state['had_six'][$index] = true;
            }
            $state['stats'][$index]['rolls'] = ($state['stats'][$index]['rolls'] ?? 0) + 1;
            if (MatchRules::moves($state, $index, $value)) {
                $state['dice'] = $value;
            } else {
                $state['turn'] = MatchRules::nextTurn($state, $index);
            }
            $state['state_version'] = (int) ($state['state_version'] ?? 0) + 1;
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
                'match_state' => $state,
            ];
        });

        $this->broadcaster->publishMatchAction($room, $action, $player);

        return response()->json(['ok' => true, 'action' => $action]);
    }

    public function move(Request $request, string $code): JsonResponse
    {
        $validated = $request->validate([
            'token_index' => [$request->boolean('computer') ? 'sometimes' : 'required', 'integer', 'min:0', 'max:3'],
        ]);

        self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        $player = PlayerResume::find($request, $room);
        if (! $player) {
            abort(403, 'Kamu bukan peserta ruang ini.');
        }

        if ($request->boolean('computer')) {
            $request->validate(['state_version' => ['required', 'integer', 'min:0']]);
            $player = $room->players()->where('is_computer', true)->firstOrFail();
        }

        if ($room->status !== 'started') {
            return response()->json(['message' => 'Permainan belum dimulai atau sudah berakhir.'], 422);
        }

        $action = DB::transaction(function () use ($room, $player, $validated, $request) {
            $room = Room::whereKey($room->id)->lockForUpdate()->firstOrFail();
            $players = $room->players()->get();
            $index = $players->search(fn ($item) => $item->id === $player->id);
            $state = $room->match_state;
            if ($player->is_computer) {
                abort_unless((int) ($state['state_version'] ?? 0) === (int) $request->input('state_version'), 422, 'Status permainan telah berubah.');
            }
            abort_unless($room->status === 'started' && $state && $index !== false && $index < count($state['tokens']) && $state['turn'] === $index && $state['dice'] !== null, 422, 'Tidak ada langkah untuk dimainkan.');
            $tokenIndex = $player->is_computer ? MatchRules::computerMove($state, $index) : (int) $validated['token_index'];
            $moves = MatchRules::moves($state, $index, $state['dice']);
            abort_unless(array_key_exists($tokenIndex, $moves), 422, 'Langkah tidak sah.');
            $target = $moves[$tokenIndex];
            $state['tokens'][$index][$tokenIndex] = $target;
            $colors = $state['colors'] ?? ['blue', 'green'];
            $arms = isset($state['arms']) ? (int) $state['arms'] : null;
            $safeIndices = MatchRules::safeIndices($colors, $arms);
            $finishPosition = MatchRules::finishPosition($colors, $arms);
            $absolute = MatchRules::absolute($index, $target, $colors, $arms);
            $capturedCount = 0;
            if ($absolute !== null && ! in_array($absolute, $safeIndices, true)) {
                foreach ($state['tokens'] as $opponentIndex => $tokens) {
                    if ($opponentIndex === $index) {
                        continue;
                    }
                    foreach ($tokens as $i => $position) {
                        if (MatchRules::absolute($opponentIndex, $position, $colors, $arms) === $absolute) {
                            $state['tokens'][$opponentIndex][$i] = -1;
                            $capturedCount++;
                        }
                    }
                }
            }
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
            }
            $state['dice'] = null;
            $state['state_version'] = (int) ($state['state_version'] ?? 0) + 1;
            $room->match_state = $state;
            $room->save();

            return [
                'action_id' => (string) Str::uuid(),
                'type' => 'move',
                'player_id' => $player->id,
                'token_index' => $tokenIndex,
                'state_version' => $state['state_version'],
                'match_state' => $state,
            ];
        });

        $this->broadcaster->publishMatchAction($room, $action, $player);

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

        if ($room->status !== 'ended') {
            $room->status = 'ended';
            $room->save();

            $room->refresh()->load('players');
            $this->broadcaster->publishRoomUpdated($room, __FUNCTION__);
            $this->broadcaster->publishMatchAction($room, [
                'action_id' => (string) Str::uuid(),
                'type' => 'end',
                'player_id' => $player->id,
                'ended_by' => $player->name,
            ], $player);
        }

        return redirect()->route('home');
    }
}
