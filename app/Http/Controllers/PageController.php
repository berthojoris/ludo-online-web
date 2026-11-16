<?php

namespace App\Http\Controllers;

use App\Events\RoomUpdated;
use App\Models\Room;
use App\Models\RoomPlayer;
use App\Services\PlayerResume;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PageController extends Controller
{
    public function home(Request $request): Response
    {
        return Inertia::render('Home', [
            'createRoomOpen' => (bool) $request->session()->get('create_room_required', false),
        ]);
    }

    public function howItWorks(): Response
    {
        return Inertia::render('Home', [
            'howItWorksOpen' => true,
        ]);
    }

    public function play(Request $request): Response|RedirectResponse
    {
        $roomPayload = null;
        $mePayload = null;
        $roomNotice = null;

        if ($request->filled('room')) {
            $code = strtoupper(trim((string) $request->query('room')));
            $room = Room::with('players')->where('code', $code)->first();

            if (! $room) {
                $roomNotice = 'Ruang tidak ditemukan. Periksa kembali kode undanganmu.';
            } elseif ($room->status === 'waiting') {
                return redirect()->route('room', ['code' => $room->code]);
            } elseif ($room->status === 'ended') {
                return redirect()->route('home');
            } else {
                RoomController::playerToken($request);
                $me = PlayerResume::find($request, $room);

                if ($me) {
                    PlayerResume::remember($request, $me, $room->code);
                } else {
                    $roomNotice = 'Kamu belum duduk di ruang ini. Minta kode undangan ke host untuk ikut bermain.';
                }

                $roomPayload = $room->toLobbyPayload();
                $mePayload = $me ? $this->playerPayload($me) : null;
            }
        }

        return Inertia::render('Play', [
            'room' => $roomPayload,
            'me' => $mePayload,
            'roomNotice' => $roomNotice,
        ]);
    }

    public function room(Request $request): Response|RedirectResponse
    {
        $canCreateRoom = (bool) $request->session()->get('ludo_room_access', false);

        if ($request->boolean('join') && ! $request->filled('code')) {
            return Inertia::render('Room', [
                'mode' => 'join',
                'room' => null,
                'me' => null,
                'roomError' => null,
                'canCreateRoom' => $canCreateRoom,
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
                    'canCreateRoom' => $canCreateRoom,
                ]);
            }

            // A browser that already sat in this room (even after its session
            // expired) reclaims its old seat instead of joining as a new player.
            $resumed = PlayerResume::find($request, $room);
            $token = RoomController::playerToken($request);

            $result = DB::transaction(function () use ($request, $room, $token, $resumed) {
                $lockedRoom = Room::where('id', $room->id)->lockForUpdate()->firstOrFail();
                $me = $resumed
                    ? $lockedRoom->players()->whereKey($resumed->id)->first()
                    : $lockedRoom->players()->where('player_token', $token)->first();
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
                    'canCreateRoom' => $canCreateRoom,
                ]);
            }

            $freshRoom = $room->fresh('players');
            if ($result['joined'] && $freshRoom) {
                broadcast(new RoomUpdated($freshRoom));
            }

            /** @var RoomPlayer $me */
            $me = $result['me'];
            PlayerResume::remember($request, $me, $room->code);

            return Inertia::render('Room', [
                'mode' => $me->is_host ? 'create' : 'lobby',
                'room' => $freshRoom?->toLobbyPayload(),
                'me' => $this->playerPayload($me),
                'roomError' => null,
                'canCreateRoom' => $canCreateRoom,
            ]);
        }

        $existingCode = $request->session()->get('ludo_host_room_code');

        if (! is_string($existingCode) || $existingCode === '') {
            $existingCode = PlayerResume::lastRoom($request);
        }

        $room = null;

        if (is_string($existingCode) && $existingCode !== '') {
            $candidate = Room::where('code', $existingCode)->first();

            if ($candidate && PlayerResume::find($request, $candidate)) {
                if ($candidate->status === 'started') {
                    return redirect()->route('play', ['room' => $candidate->code]);
                }

                if ($candidate->status === 'waiting') {
                    $room = $candidate;
                }
            }
        }

        $token = RoomController::playerToken($request);

        if (! $room) {
            if (! $canCreateRoom) {
                return redirect()->route('home')->with('create_room_required', true);
            }

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
                    'is_ready' => true,
                    'is_host' => true,
                ]);

                return $created;
            });

            $request->session()->put('ludo_host_room_code', $room->code);
        }

        $freshRoom = $room->fresh('players');
        $me = $freshRoom ? PlayerResume::find($request, $freshRoom) : null;

        if ($me && $freshRoom) {
            PlayerResume::remember($request, $me, $freshRoom->code);
        }

        return Inertia::render('Room', [
            'mode' => 'create',
            'room' => $freshRoom?->toLobbyPayload(),
            'me' => $me ? $this->playerPayload($me) : null,
            'roomError' => null,
            'canCreateRoom' => true,
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
