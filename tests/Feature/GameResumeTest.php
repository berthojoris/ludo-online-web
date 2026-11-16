<?php

namespace Tests\Feature;

use App\Events\MatchAction;
use App\Events\RoomUpdated;
use App\Models\Room;
use App\Models\RoomPlayer;
use App\Services\MatchRules;
use App\Services\PlayerResume;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request as Psr7Request;
use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Contracts\Broadcasting\Broadcaster;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;
use Tests\TestCase;

class GameResumeTest extends TestCase
{
    use RefreshDatabase;

    private function hostRoom(): array
    {
        Event::fake([RoomUpdated::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();

        $room = Room::firstOrFail();
        $host = $room->players()->firstOrFail();

        return [$room, $host, session('ludo_player_token')];
    }

    private function addGuest(Room $room, string $token = 'guest-player-token'): RoomPlayer
    {
        return RoomPlayer::create([
            'room_id' => $room->id,
            'player_token' => $token,
            'name' => 'Tamu',
            'seat_color' => 'yellow',
            'is_ready' => true,
            'is_host' => false,
        ]);
    }

    public function test_every_player_gets_a_resume_token_and_a_resume_cookie(): void
    {
        [$room, $host] = $this->hostRoom();

        $this->assertNotNull($host->resume_token);
        $this->assertSame(40, strlen($host->resume_token));

        $this->get("/room?code={$room->code}")->assertOk();

        $this->assertNotNull($host->fresh()->resume_token);

        $this->get("/room?code={$room->code}")
            ->assertCookie(
                PlayerResume::cookieName($room->code),
                $host->resume_token,
            );
    }

    public function test_browser_reclaims_its_seat_when_the_session_is_lost(): void
    {
        [$room, $host, $hostToken] = $this->hostRoom();
        $guest = $this->addGuest($room);

        $this->assertSame(2, $room->players()->count());

        // Simulate a closed browser / expired session: the session token is gone
        // but the resume cookie stays behind.
        $this->flushSession();

        $this->withCookie(PlayerResume::cookieName($room->code), $guest->resume_token)
            ->get("/room?code={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Room')
                ->where('room.code', $room->code)
                ->where('me.id', $guest->id)
                ->where('me.name', 'Tamu')
                ->where('me.seat_color', 'yellow')
                ->has('room.players', 2));

        // No duplicate player row was created and the session points at the
        // original identity again.
        $this->assertSame(2, $room->players()->count());
        $this->assertSame($guest->player_token, session('ludo_player_token'));
        $this->assertNotSame($guest->player_token, $hostToken);
    }

    public function test_refreshing_a_running_match_returns_the_saved_board_state(): void
    {
        [$room, $host] = $this->hostRoom();
        $guest = $this->addGuest($room);

        $state = MatchRules::initial(1, ['red', 'yellow']);
        $state['tokens'][0] = [12, 30, -1, 56];
        $state['tokens'][1] = [4, -1, -1, 52];
        $state['turn'] = 1;
        $state['dice'] = 3;
        $state['stats'][0] = ['rolls' => 7, 'captures' => 2];
        $state['stats'][1] = ['rolls' => 6, 'captures' => 1];
        $state['total_moves'] = 13;

        $room->update([
            'status' => 'started',
            'starting_player_id' => $guest->id,
            'started_at' => '2026-11-14 10:00:00',
            'match_state' => $state,
        ]);

        $this->flushSession();

        $this->withCookie(PlayerResume::cookieName($room->code), $host->resume_token)
            ->get("/play?room={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Play')
                ->where('room.code', $room->code)
                ->where('room.status', 'started')
                ->where('room.started_at', '2026-11-14T10:00:00+00:00')
                ->where('me.id', $host->id)
                ->where('room.match_state.turn', 1)
                ->where('room.match_state.dice', 3)
                ->where('room.match_state.total_moves', 13)
                ->where('room.match_state.tokens.0.0', 12)
                ->where('room.match_state.tokens.1.0', 4)
                ->where('room.match_state.stats.0.rolls', 7)
                ->where('room.match_state.stats.1.captures', 1)
                ->has('room.players', 2));
    }

    public function test_strangers_cannot_take_a_seat_in_a_running_match(): void
    {
        [$room] = $this->hostRoom();
        $this->addGuest($room);

        $room->update([
            'status' => 'started',
            'started_at' => now(),
            'match_state' => MatchRules::initial(0, ['red', 'yellow']),
        ]);

        $this->flushSession();

        $this->get("/play?room={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Play')
                ->where('me', null)
                ->where('room.code', $room->code)
                ->where('roomNotice', 'Kamu belum duduk di ruang ini. Minta kode undangan ke host untuk ikut bermain.'));

        $this->get("/room?code={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Room')
                ->where('roomError', 'Permainan di ruang ini sudah dimulai.'));

        $this->assertSame(2, $room->players()->count());
    }

    public function test_play_redirects_players_that_are_still_in_the_lobby_or_already_finished(): void
    {
        [$room] = $this->hostRoom();

        $this->get("/play?room={$room->code}")
            ->assertRedirect(route('room', ['code' => $room->code]));

        $room->update(['status' => 'ended']);

        $this->get("/play?room={$room->code}")->assertRedirect(route('home'));
    }

    public function test_opening_the_room_entry_point_resumes_a_running_match(): void
    {
        [$room] = $this->hostRoom();
        $this->addGuest($room);

        $room->update([
            'status' => 'started',
            'started_at' => now(),
            'match_state' => MatchRules::initial(0, ['red', 'yellow']),
        ]);

        $this->flushSession();

        $this->withCookie(PlayerResume::LAST_ROOM_COOKIE, $room->code)
            ->withCookie(
                PlayerResume::cookieName($room->code),
                $room->players()->where('is_host', true)->value('resume_token'),
            )
            ->get('/room')
            ->assertRedirect(route('play', ['room' => $room->code]));
    }

    public function test_rolls_and_moves_are_counted_in_the_persisted_match_state(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        [$room, $host] = $this->hostRoom();
        $this->addGuest($room);

        $state = MatchRules::initial(0, ['red', 'yellow']);
        $room->update(['status' => 'started', 'starting_player_id' => $host->id, 'match_state' => $state]);
        $room->update([
            'match_state' => array_merge($room->fresh()->match_state, [
                'turn' => 0,
                'dice' => 6,
                'tokens' => [[0, -1, -1, -1], [-1, -1, -1, -1]],
            ]),
        ]);

        $this->postJson("/rooms/{$room->code}/match/move", ['token_index' => 0])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $state = $room->fresh()->match_state;
        $this->assertSame(1, $state['total_moves']);
        $this->assertSame(0, $state['stats'][0]['captures']);
        $this->assertSame(6, $state['tokens'][0][0]);
        $this->assertSame(1, $state['state_version']);

        $this->postJson("/rooms/{$room->code}/match/roll")->assertOk();

        $state = $room->fresh()->match_state;
        $this->assertSame(1, $state['stats'][0]['rolls']);
        $this->assertSame(2, $state['state_version']);
    }

    public function test_roll_records_the_rolled_value_in_the_persisted_match_state(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        [$room, $host] = $this->hostRoom();
        $this->addGuest($room);

        $room->update([
            'status' => 'started',
            'starting_player_id' => $host->id,
            'match_state' => MatchRules::initial(0, ['red', 'yellow']),
        ]);

        $response = $this->postJson("/rooms/{$room->code}/match/roll")->assertOk();

        $state = $room->fresh()->match_state;
        $this->assertSame([
            'player' => 0,
            'value' => $response->json('action.value'),
            'state_version' => 1,
        ], $state['last_roll']);
        $this->assertSame($state['last_roll'], $response->json('action.match_state.last_roll'));
    }

    public function test_move_succeeds_and_logs_context_when_broadcast_returns_502(): void
    {
        [$room, $host] = $this->hostRoom();
        $this->addGuest($room);

        $state = MatchRules::initial(0, ['red', 'yellow']);
        $state['dice'] = 6;
        $state['tokens'][0] = [0, -1, -1, -1];
        $room->update([
            'status' => 'started',
            'starting_player_id' => $host->id,
            'match_state' => $state,
        ]);

        $broadcaster = Mockery::mock(Broadcaster::class);
        $broadcaster->shouldReceive('broadcast')
            ->once()
            ->andThrow(new BroadcastException('Pusher error: 502 Bad Gateway'));
        Broadcast::extend('failing', fn () => $broadcaster);
        config()->set('broadcasting.default', 'failing');
        config()->set('broadcasting.connections.failing', ['driver' => 'failing']);
        Log::spy();

        $response = $this->postJson("/rooms/{$room->code}/match/move", ['token_index' => 0])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('action.type', 'move')
            ->assertJsonPath('action.state_version', 1)
            ->assertJsonPath('action.match_state.state_version', 1)
            ->assertJsonPath('action.match_state.tokens.0.0', 6);

        $state = $room->fresh()->match_state;
        $this->assertSame(1, $state['total_moves']);
        $this->assertSame(1, $state['state_version']);
        $this->assertSame(6, $state['tokens'][0][0]);
        $this->assertNull($state['dice']);
        $this->assertSame($state, $response->json('action.match_state'));

        $actionId = $response->json('action.action_id');
        Log::shouldHaveReceived('error')->once()->with(
            'Realtime broadcast failed after the room state was committed.',
            Mockery::on(fn (array $context): bool => $context['room_code'] === $room->code
                && $context['operation'] === 'match.move'
                && $context['player_id'] === $host->id
                && $context['action_id'] === $actionId
                && $context['state_version'] === 1
                && $context['token_index'] === 0
                && $context['exception'] instanceof BroadcastException),
        );
    }

    public function test_roll_succeeds_and_logs_context_when_broadcast_returns_502(): void
    {
        [$room, $host] = $this->hostRoom();
        $this->addGuest($room);

        $room->update([
            'status' => 'started',
            'starting_player_id' => $host->id,
            'match_state' => MatchRules::initial(0, ['red', 'yellow']),
        ]);

        $broadcaster = Mockery::mock(Broadcaster::class);
        $broadcaster->shouldReceive('broadcast')
            ->once()
            ->andThrow(new BroadcastException('Pusher error: 502 Bad Gateway'));
        Broadcast::extend('failing', fn () => $broadcaster);
        config()->set('broadcasting.default', 'failing');
        config()->set('broadcasting.connections.failing', ['driver' => 'failing']);
        Log::spy();

        $response = $this->postJson("/rooms/{$room->code}/match/roll")
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('action.type', 'roll')
            ->assertJsonPath('action.state_version', 1)
            ->assertJsonPath('action.match_state.state_version', 1);

        $state = $room->fresh()->match_state;
        $this->assertSame(1, $state['stats'][0]['rolls']);
        $this->assertSame(1, $state['state_version']);
        $this->assertSame($state, $response->json('action.match_state'));

        $actionId = $response->json('action.action_id');
        Log::shouldHaveReceived('error')->once()->with(
            'Realtime broadcast failed after the room state was committed.',
            Mockery::on(fn (array $context): bool => $context['room_code'] === $room->code
                && $context['operation'] === 'match.roll'
                && $context['player_id'] === $host->id
                && $context['action_id'] === $actionId
                && $context['state_version'] === 1
                && $context['dice_value'] === $response->json('action.value')
                && $context['exception'] instanceof BroadcastException),
        );
    }

    public function test_roll_succeeds_when_broadcast_connection_times_out(): void
    {
        [$room, $host] = $this->hostRoom();
        $this->addGuest($room);

        $room->update([
            'status' => 'started',
            'starting_player_id' => $host->id,
            'match_state' => MatchRules::initial(0, ['red', 'yellow']),
        ]);

        $broadcaster = Mockery::mock(Broadcaster::class);
        $broadcaster->shouldReceive('broadcast')
            ->once()
            ->andThrow(new ConnectException(
                'Connection timed out',
                new Psr7Request('POST', 'https://reverb.test/events'),
            ));
        Broadcast::extend('failing', fn () => $broadcaster);
        config()->set('broadcasting.default', 'failing');
        config()->set('broadcasting.connections.failing', ['driver' => 'failing']);
        Log::spy();

        $this->postJson("/rooms/{$room->code}/match/roll")
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('action.state_version', 1)
            ->assertJsonPath('action.match_state.state_version', 1);

        $this->assertSame(1, $room->fresh()->match_state['stats'][0]['rolls']);
        Log::shouldHaveReceived('error')->once()->with(
            'Realtime broadcast failed after the room state was committed.',
            Mockery::on(fn (array $context): bool => $context['room_code'] === $room->code
                && $context['operation'] === 'match.roll'
                && $context['player_id'] === $host->id
                && $context['exception'] instanceof ConnectException),
        );
    }
}
