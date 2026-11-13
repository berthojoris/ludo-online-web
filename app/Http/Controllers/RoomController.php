<?php

namespace App\Http\Controllers;

use App\Events\RoomUpdated;
use App\Models\Room;
use App\Models\RoomPlayer;
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
            'max_players' => ['required', 'integer', Rule::in([2, 3, 4])],
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

        $newMax = (int) $validated['max_players'];

        DB::transaction(function () use ($room, $newMax) {
            $lockedRoom = Room::where('id', $room->id)->lockForUpdate()->firstOrFail();
            $lockedRoom->max_players = $newMax;
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

        $room->status = 'started';
        $room->started_at = now();
        $room->save();

        $room->refresh()->load('players');
        broadcast(new RoomUpdated($room));

        return redirect()->route('play', ['room' => $room->code]);
    }
}
