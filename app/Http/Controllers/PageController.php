<?php

namespace App\Http\Controllers;

use App\Events\RoomUpdated;
use App\Models\QuickMatchQueue;
use App\Models\Room;
use App\Models\RoomPlayer;
use App\Services\PlayerResume;
use App\Services\QuickMatchService;
use App\Services\RoomBroadcaster;
use App\Services\RoomPresence;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class PageController extends Controller
{
    public function __construct(
        private RoomBroadcaster $broadcaster,
        private RoomPresence $presence,
        private QuickMatchService $quickMatch,
    ) {}

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

    /**
     * The quick-match searching screen. A browser that is already waiting
     * resumes its search, and a browser whose pairing already happened (or
     * that still has a running match) is sent straight back to the board.
     */
    public function quickMatch(Request $request): Response|RedirectResponse
    {
        $pool = (int) $request->query('players', 4);

        if (! in_array($pool, QuickMatchQueue::POOLS, true)) {
            return redirect()->route('quick-match', ['players' => 4]);
        }

        $state = $this->quickMatch->pageState($request, $pool);

        if (($state['state'] === 'active' || $state['state'] === 'matched') && is_string($state['room']) && $state['room'] !== '') {
            return redirect()->route('play', ['room' => $state['room']]);
        }

        return Inertia::render('QuickMatch', [
            'pool' => $state['pool'],
            'state' => $state['state'],
            'name' => $state['name'],
            'token' => $state['token'],
            'waiting' => $state['waiting'],
            'elapsed' => $state['elapsed'],
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
            } else {
                // A host that stopped heartbeating closes the room; the
                // status checks below then send this browser home.
                $this->presence->closeIfHostGone($room);

                if ($room->status === 'waiting') {
                    return redirect()->route('room', ['code' => $room->code]);
                }

                if ($room->status === 'ended') {
                    PlayerResume::forget($room->code);

                    return redirect()->route('home');
                }

                RoomController::playerToken($request);
                $me = PlayerResume::find($request, $room);

                if ($me) {
                    $this->presence->touch($me);
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
                    'attemptedCode' => $code,
                    'canCreateRoom' => $canCreateRoom,
                ]);
            }

            // A browser that already sat in this room (even after its session
            // expired) reclaims its old seat instead of joining as a new player.
            $this->presence->closeIfHostGone($room);

            if ($room->status === 'ended') {
                PlayerResume::forget($room->code);

                return redirect()->route('home');
            }

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
                        // A visitor who joined but never picked a colour is not
                        // part of the match yet. Let the newest invitation take
                        // over the oldest idle slot instead of turning it away
                        // because the room is full of unseated guests.
                        $idle = $lockedRoom->players()
                            ->where('is_host', false)
                            ->whereNull('seat_color')
                            ->orderBy('id')
                            ->first();

                        if (! $idle) {
                            return ['error' => 'Ruang sudah penuh.', 'me' => null, 'joined' => false];
                        }

                        $idle->player_token = $token;
                        $idle->resume_token = Str::random(40);
                        $idle->user_id = $request->user()?->id;
                        $idle->name = RoomController::defaultPlayerName($request);
                        $idle->name_confirmed = false;
                        $idle->character = null;
                        $idle->is_ready = false;
                        $idle->save();
                        $me = $idle;
                        $joinedNow = true;
                    } else {
                        $isHost = $lockedRoom->host_token === $token;
                        $me = RoomPlayer::create([
                            'room_id' => $lockedRoom->id,
                            'player_token' => $token,
                            'user_id' => $request->user()?->id,
                            'name' => RoomController::defaultPlayerName($request, $isHost),
                            'seat_color' => null,
                            'character' => null,
                            'is_ready' => false,
                            'is_host' => $isHost,
                            'last_seen_at' => now(),
                        ]);
                        $joinedNow = true;
                    }
                }

                return ['error' => null, 'me' => $me, 'joined' => $joinedNow];
            });

            if ($result['error'] !== null) {
                return Inertia::render('Room', [
                    'mode' => 'join',
                    'room' => null,
                    'me' => null,
                    'roomError' => $result['error'],
                    'attemptedCode' => $code,
                    'canCreateRoom' => $canCreateRoom,
                ]);
            }

            $freshRoom = $room->fresh('players');
            if ($result['joined'] && $freshRoom) {
                $this->broadcaster->publishRoomUpdated($freshRoom, 'room.joined', $result['me']);
            }

            /** @var RoomPlayer $me */
            $me = $result['me'];
            $this->presence->touch($me);
            PlayerResume::remember($request, $me, $room->code);

            return $this->renderRoom(
                $me->is_host ? 'create' : 'lobby',
                $freshRoom,
                $me,
                $canCreateRoom,
            );
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

                $firstSeat = $created->allowedSeats()[0];

                RoomPlayer::create([
                    'room_id' => $created->id,
                    'player_token' => $token,
                    'user_id' => $request->user()?->id,
                    'name' => RoomController::defaultPlayerName($request, true),
                    'seat_color' => $firstSeat,
                    'character' => Room::DEFAULT_CHARACTER_BY_COLOR[$firstSeat] ?? 'ignivar',
                    'is_ready' => true,
                    'is_host' => true,
                    'last_seen_at' => now(),
                ]);

                return $created;
            });

            $request->session()->put('ludo_host_room_code', $room->code);
        }

        $freshRoom = $room->fresh('players');
        $me = $freshRoom ? PlayerResume::find($request, $freshRoom) : null;

        if ($me && $freshRoom) {
            $this->presence->touch($me);
            PlayerResume::remember($request, $me, $freshRoom->code);
        }

        return $this->renderRoom('create', $freshRoom, $me, true);
    }

    private function renderRoom(string $mode, ?Room $room, ?RoomPlayer $me, bool $canCreateRoom): Response
    {
        if (! $room) {
            return Inertia::render('Room', [
                'mode' => $mode,
                'room' => null,
                'me' => $me ? $this->playerPayload($me) : null,
                'roomError' => null,
                'canCreateRoom' => $canCreateRoom,
            ]);
        }

        $channel = new PrivateChannel('room.'.$room->code);

        return Inertia::render('Room', [
            'mode' => $mode,
            'room' => Inertia::live(
                fn () => $room->toLobbyPayload(),
                on: RoomUpdated::class,
                channel: $channel,
                throttle: 150,
            ),
            'me' => Inertia::live(
                fn () => $me ? $this->playerPayload($me) : null,
                on: RoomUpdated::class,
                channel: $channel,
                throttle: 150,
            ),
            'roomError' => null,
            'canCreateRoom' => $canCreateRoom,
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
            'character' => $player->character ?? ($player->seat_color ? (Room::DEFAULT_CHARACTER_BY_COLOR[$player->seat_color] ?? 'ignivar') : null),
            'is_ready' => $player->is_ready,
            'is_host' => $player->is_host,
            'name_confirmed' => $player->name_confirmed,
        ];
    }
}
