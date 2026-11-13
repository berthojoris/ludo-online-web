<?php

namespace App\Http\Controllers;

use App\Events\RoomUpdated;
use App\Models\Room;
use App\Models\RoomPlayer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PageController extends Controller
{
    public function home(): Response
    {
        return Inertia::render('Home');
    }

    public function howItWorks(): Response
    {
        return Inertia::render('Home', [
            'howItWorksOpen' => true,
        ]);
    }

    public function play(Request $request): Response
    {
        $roomPayload = null;
        $mePayload = null;

        if ($request->filled('room')) {
            $code = strtoupper(trim((string) $request->query('room')));
            $room = Room::with('players')->where('code', $code)->first();

            if ($room) {
                $token = RoomController::playerToken($request);
                $me = $room->players->firstWhere('player_token', $token);
                $roomPayload = $room->toLobbyPayload();
                $mePayload = $me ? $this->playerPayload($me) : null;
            }
        }

        return Inertia::render('Play', [
            'room' => $roomPayload,
            'me' => $mePayload,
        ]);
    }

    public function room(Request $request): Response
    {
        if ($request->boolean('join') && ! $request->filled('code')) {
            return Inertia::render('Room', [
                'mode' => 'join',
                'room' => null,
                'me' => null,
                'roomError' => null,
            ]);
        }

        $token = RoomController::playerToken($request);

        if ($request->filled('code')) {
            $code = strtoupper(trim((string) $request->query('code')));
            $room = Room::where('code', $code)->first();

            if (! $room) {
                return Inertia::render('Room', [
                    'mode' => 'join',
                    'room' => null,
                    'me' => null,
                    'roomError' => 'Kode ruang tidak ditemukan.',
                ]);
            }

            $result = DB::transaction(function () use ($request, $room, $token) {
                $lockedRoom = Room::where('id', $room->id)->lockForUpdate()->firstOrFail();
                $me = $lockedRoom->players()->where('player_token', $token)->first();
                $joinedNow = false;

                if (! $me) {
                    if ($lockedRoom->status !== 'waiting') {
                        return ['error' => 'Permainan di ruang ini sudah dimulai.', 'me' => null, 'joined' => false];
                    }

                    if ($lockedRoom->players()->count() >= $lockedRoom->max_players) {
                        return ['error' => 'Ruang sudah penuh.', 'me' => null, 'joined' => false];
                    }

                    $isHost = $lockedRoom->host_token === $token;
                    $me = RoomPlayer::create([
                        'room_id' => $lockedRoom->id,
                        'player_token' => $token,
                        'user_id' => $request->user()?->id,
                        'name' => RoomController::defaultPlayerName($request, $isHost),
                        'seat_color' => null,
                        'is_ready' => false,
                        'is_host' => $isHost,
                    ]);
                    $joinedNow = true;
                }

                return ['error' => null, 'me' => $me, 'joined' => $joinedNow];
            });

            if ($result['error'] !== null) {
                return Inertia::render('Room', [
                    'mode' => 'join',
                    'room' => null,
                    'me' => null,
                    'roomError' => $result['error'],
                ]);
            }

            $freshRoom = $room->fresh('players');
            if ($result['joined'] && $freshRoom) {
                broadcast(new RoomUpdated($freshRoom));
            }

            /** @var RoomPlayer $me */
            $me = $result['me'];

            return Inertia::render('Room', [
                'mode' => $me->is_host ? 'create' : 'lobby',
                'room' => $freshRoom?->toLobbyPayload(),
                'me' => $this->playerPayload($me),
                'roomError' => null,
            ]);
        }

        $existingCode = $request->session()->get('ludo_host_room_code');
        $room = is_string($existingCode)
            ? Room::where('code', $existingCode)
                ->where('host_token', $token)
                ->where('status', 'waiting')
                ->first()
            : null;

        if (! $room) {
            $request->session()->forget('ludo_player_name');
            $room = DB::transaction(function () use ($request, $token) {
                $created = Room::create([
                    'code' => RoomController::generateCode(),
                    'host_token' => $token,
                    'max_players' => 4,
                    'status' => 'waiting',
                ]);

                RoomPlayer::create([
                    'room_id' => $created->id,
                    'player_token' => $token,
                    'user_id' => $request->user()?->id,
                    'name' => RoomController::defaultPlayerName($request, true),
                    'seat_color' => $created->allowedSeats()[0],
                    'is_ready' => false,
                    'is_host' => true,
                ]);

                return $created;
            });

            $request->session()->put('ludo_host_room_code', $room->code);
        }

        $freshRoom = $room->fresh('players');
        $me = $freshRoom?->players->firstWhere('player_token', $token);

        return Inertia::render('Room', [
            'mode' => 'create',
            'room' => $freshRoom?->toLobbyPayload(),
            'me' => $me ? $this->playerPayload($me) : null,
            'roomError' => null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function playerPayload(RoomPlayer $player): array
    {
        return [
            'id' => $player->id,
            'name' => $player->name,
            'seat_color' => $player->seat_color,
            'is_ready' => $player->is_ready,
            'is_host' => $player->is_host,
        ];
    }
}
