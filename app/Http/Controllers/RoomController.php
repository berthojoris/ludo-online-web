<?php

namespace App\Http\Controllers;

use App\Events\MatchAction;
use App\Events\RoomUpdated;
use App\Models\Room;
use App\Models\RoomPlayer;
use App\Services\MatchRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RoomController extends Controller
{
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

        $sessionName = $request->session()->get('ludo_player_name');
        if (is_string($sessionName) && trim($sessionName) !== '') {
            return Str::limit(trim($sessionName), 24, '');
        }

        return $isHost ? 'Tuan Rumah' : 'Tamu';
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
        $token = self::playerToken($request);
        $maxPlayers = (int) $request->input('max_players', 4);
        if (! in_array($maxPlayers, [2, 3, 4], true)) {
            $maxPlayers = 4;
        }

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
                'seat_color' => $room->allowedSeats()[0],
                'is_ready' => false,
                'is_host' => true,
            ]);

            return $room;
        });

        $request->session()->put('ludo_host_room_code', $room->code);

        return redirect()->route('room', ['code' => $room->code]);
    }

    public function updateSettings(Request $request, string $code): RedirectResponse
    {
        $validated = $request->validate([
            'max_players' => ['sometimes', 'integer', Rule::in([2, 3, 4])],
            'host_advantage' => ['sometimes', 'boolean'],
        ]);

        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        if ($room->host_token !== $token) {
            abort(403, 'Hanya tuan rumah yang dapat mengubah kapasitas pemain.');
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

            $allowedSeats = $lockedRoom->allowedSeats();
            $players = $lockedRoom->players()->get();

            foreach ($players as $player) {
                if ($player->seat_color !== null && ! in_array($player->seat_color, $allowedSeats, true)) {
                    $player->seat_color = null;
                    $player->is_ready = false;
                    $player->save();
                }
            }
        });

        $room->refresh()->load('players');
        broadcast(new RoomUpdated($room));

        return back();
    }

    public function selectSeat(Request $request, string $code): RedirectResponse
    {
        $validated = $request->validate([
            'seat_color' => ['nullable', 'string', Rule::in(['red', 'green', 'blue', 'yellow'])],
        ]);

        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        if ($room->status !== 'waiting') {
            throw ValidationException::withMessages([
                'seat_color' => 'Permainan sudah dimulai.',
            ]);
        }

        $seatColor = $validated['seat_color'] ?? null;

        DB::transaction(function () use ($room, $token, $seatColor) {
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

            $player->seat_color = $seatColor;
            if ($seatColor === null) {
                $player->is_ready = false;
            }
            $player->save();
        });

        $room->refresh()->load('players');
        broadcast(new RoomUpdated($room));

        return back();
    }

    public function updateName(Request $request, string $code): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:24'],
        ]);

        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();
        $cleanName = trim($validated['name']);

        $player = $room->players()->where('player_token', $token)->first();
        if (! $player) {
            abort(403, 'Kamu belum bergabung ke ruang ini.');
        }

        $player->name = $cleanName;
        $player->save();

        $request->session()->put('ludo_player_name', $cleanName);

        $room->refresh()->load('players');
        broadcast(new RoomUpdated($room));

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
        broadcast(new RoomUpdated($room));

        return back();
    }

    public function start(Request $request, string $code): RedirectResponse
    {
        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        if ($room->host_token !== $token) {
            abort(403, 'Hanya tuan rumah yang dapat memulai permainan.');
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

        if ($players->count() > 2) {
            throw ValidationException::withMessages([
                'start' => 'Pertandingan saat ini mendukung dua pemain.',
            ]);
        }

        if ($players->contains(fn (RoomPlayer $p) => $p->seat_color === null)) {
            throw ValidationException::withMessages([
                'start' => 'Semua pemain harus memilih kursi terlebih dahulu.',
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
        $room->match_state = MatchRules::initial($players->search(fn ($player) => $player->id === $startingPlayer->id));
        $room->started_at = now();
        $room->save();

        $room->refresh()->load('players');
        broadcast(new RoomUpdated($room));

        return redirect()->route('play', ['room' => $room->code]);
    }

    public function roll(Request $request, string $code): JsonResponse
    {
        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        $player = $room->players()->where('player_token', $token)->first();
        if (! $player) {
            abort(403, 'Kamu bukan peserta ruang ini.');
        }

        if ($room->status !== 'started') {
            return response()->json(['message' => 'Permainan belum dimulai atau sudah berakhir.'], 422);
        }

        $action = DB::transaction(function () use ($room, $player) {
            $room = Room::whereKey($room->id)->lockForUpdate()->firstOrFail();
            $players = $room->players()->get();
            $index = $players->search(fn ($item) => $item->id === $player->id);
            $state = $room->match_state;
            abort_unless($room->status === 'started' && $state && $index !== false && $index < 2 && $state['turn'] === $index && $state['dice'] === null && $state['winner'] === null, 422, 'Bukan giliran melempar.');
            $value = random_int(1, 6);
            if ($room->host_advantage && $player->is_host) {
                $preferred = MatchRules::captureRolls($state, $index);
                if (! $preferred && count(array_filter($state['tokens'][$index], fn ($position) => $position !== -1)) === 0) {
                    $preferred = [6];
                }
                if ($preferred && random_int(1, 2) === 1) {
                    $value = $preferred[array_rand($preferred)];
                } elseif ($preferred) {
                    $other = array_values(array_diff(range(1, 6), $preferred));
                    $value = $other ? $other[array_rand($other)] : $value;
                }
            }
            if (MatchRules::moves($state, $index, $value)) {
                $state['dice'] = $value;
            } else {
                $state['turn'] = 1 - $index;
            }
            $room->match_state = $state;
            $room->save();

            return ['action_id' => (string) Str::uuid(), 'type' => 'roll', 'player_id' => $player->id, 'value' => $value];
        });

        broadcast(new MatchAction($room->code, $action));

        return response()->json(['ok' => true, 'action' => $action]);
    }

    public function move(Request $request, string $code): JsonResponse
    {
        $validated = $request->validate([
            'token_index' => ['required', 'integer', 'min:0', 'max:3'],
        ]);

        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        $player = $room->players()->where('player_token', $token)->first();
        if (! $player) {
            abort(403, 'Kamu bukan peserta ruang ini.');
        }

        if ($room->status !== 'started') {
            return response()->json(['message' => 'Permainan belum dimulai atau sudah berakhir.'], 422);
        }

        $action = DB::transaction(function () use ($room, $player, $validated) {
            $room = Room::whereKey($room->id)->lockForUpdate()->firstOrFail();
            $players = $room->players()->get();
            $index = $players->search(fn ($item) => $item->id === $player->id);
            $state = $room->match_state;
            abort_unless($room->status === 'started' && $state && $index !== false && $index < 2 && $state['turn'] === $index && $state['dice'] !== null, 422, 'Tidak ada langkah untuk dimainkan.');
            $tokenIndex = (int) $validated['token_index'];
            $moves = MatchRules::moves($state, $index, $state['dice']);
            abort_unless(array_key_exists($tokenIndex, $moves), 422, 'Langkah tidak sah.');
            $target = $moves[$tokenIndex];
            $state['tokens'][$index][$tokenIndex] = $target;
            $absolute = MatchRules::absolute($index, $target);
            $captured = false;
            if ($absolute !== null && ! in_array($absolute, [0, 8, 13, 21, 26, 34, 39, 47], true)) {
                foreach ($state['tokens'][1 - $index] as $i => $position) {
                    if (MatchRules::absolute(1 - $index, $position) === $absolute) {
                        $state['tokens'][1 - $index][$i] = -1;
                        $captured = true;
                    }
                }
            }
            if (count(array_filter($state['tokens'][$index], fn ($position) => $position === 56)) === 4) {
                $state['winner'] = $index;
            } elseif ($state['dice'] !== 6 && ! $captured && $target !== 56) {
                $state['turn'] = 1 - $index;
            }
            $state['dice'] = null;
            $room->match_state = $state;
            $room->save();

            return ['action_id' => (string) Str::uuid(), 'type' => 'move', 'player_id' => $player->id, 'token_index' => $tokenIndex];
        });

        broadcast(new MatchAction($room->code, $action));

        return response()->json(['ok' => true, 'action' => $action]);
    }

    public function end(Request $request, string $code): RedirectResponse
    {
        $token = self::playerToken($request);
        $room = Room::where('code', strtoupper($code))->firstOrFail();

        $player = $room->players()->where('player_token', $token)->first();
        if (! $player) {
            abort(403, 'Kamu bukan peserta ruang ini.');
        }

        if ($room->status !== 'ended') {
            $room->status = 'ended';
            $room->save();

            $room->refresh()->load('players');
            broadcast(new RoomUpdated($room));
            broadcast(new MatchAction($room->code, [
                'action_id' => (string) Str::uuid(),
                'type' => 'end',
                'player_id' => $player->id,
                'ended_by' => $player->name,
            ]));
        }

        return redirect()->route('home');
    }
}
