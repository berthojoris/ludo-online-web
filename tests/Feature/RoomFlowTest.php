<?php

namespace Tests\Feature;

use App\Events\MatchAction;
use App\Events\RoomUpdated;
use App\Models\Room;
use App\Services\MatchRules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RoomFlowTest extends TestCase
{
    public function test_host_advantage_defaults_off_and_only_host_can_change_it_before_start(): void
    {
        Event::fake([RoomUpdated::class]);
        $this->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $hostToken = session('ludo_player_token');
        $this->assertFalse($room->host_advantage);
        $this->patch("/rooms/{$room->code}/settings", ['host_advantage' => true])->assertRedirect();
        $this->assertTrue($room->fresh()->host_advantage);
        $this->flushSession();
        $this->get("/room?code={$room->code}")->assertOk();
        $this->patch("/rooms/{$room->code}/settings", ['host_advantage' => false])->assertForbidden();
        $this->withSession(['ludo_player_token' => $hostToken]);
        $this->patch("/rooms/{$room->code}/settings", ['host_advantage' => false])->assertRedirect();
        $this->assertFalse($room->fresh()->host_advantage);
        $room->update(['status' => 'started']);
        $this->patch("/rooms/{$room->code}/settings", ['host_advantage' => true])->assertSessionHasErrors('room');
    }

    public function test_capture_rolls_exclude_safe_squares_and_include_legal_targets(): void
    {
        $state = MatchRules::initial(0);
        $state['tokens'][0][0] = 10;
        $state['tokens'][1][0] = 39; // Blue 10 is absolute 49; green 39 is absolute 0 (safe).
        $state['tokens'][1][1] = 40; // Absolute 1, four squares ahead.
        $this->assertSame([4], MatchRules::captureRolls($state, 0));
    }

    use RefreshDatabase;

    public function test_host_room_capacity_and_joined_players_sync_across_sessions(): void
    {
        Event::fake([RoomUpdated::class]);

        // Host opens /room and creates a persistent room
        $this->get('/room')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Room')
                ->where('room.max_players', 4)
                ->has('room.players', 1)
                ->where('me.is_host', true)
                ->where('me.seat_color', 'red'));

        $room = Room::firstOrFail();

        // Host sets capacity to 2 players
        $this->patch("/rooms/{$room->code}/settings", ['max_players' => 2])
            ->assertRedirect();

        $this->assertSame(2, $room->fresh()->max_players);
        Event::assertDispatched(RoomUpdated::class, fn (RoomUpdated $event) => $event->room['code'] === $room->code && $event->room['max_players'] === 2);

        // Guest joins from another device/session via ?code=
        $this->flushSession();
        $this->get("/room?code={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Room')
                ->where('room.code', $room->code)
                ->where('room.max_players', 2)
                ->has('room.players', 2)
                ->where('me.is_host', false)
                ->where('me.seat_color', null));

        // Guest cannot mark ready before choosing a seat
        $this->post("/rooms/{$room->code}/ready")
            ->assertSessionHasErrors('ready');

        // Guest cannot take host's occupied seat ('red')
        $this->post("/rooms/{$room->code}/seat", ['seat_color' => 'red'])
            ->assertSessionHasErrors('seat_color');

        // Guest sits in 'yellow' and marks ready
        $this->post("/rooms/{$room->code}/seat", ['seat_color' => 'yellow'])
            ->assertRedirect();
        $this->post("/rooms/{$room->code}/ready")
            ->assertRedirect();

        $guest = $room->players()->where('is_host', false)->firstOrFail();
        $this->assertSame('yellow', $guest->seat_color);
        $this->assertTrue($guest->is_ready);

        // Non-host cannot start the match
        $this->post("/rooms/{$room->code}/start")
            ->assertForbidden();
    }

    public function test_host_can_start_match_only_when_all_players_are_seated_and_ready(): void
    {
        Event::fake([RoomUpdated::class]);

        $this->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $hostToken = session('ludo_player_token');

        $this->patch("/rooms/{$room->code}/settings", ['max_players' => 2]);

        // Host cannot start alone
        $this->post("/rooms/{$room->code}/start")
            ->assertSessionHasErrors('start');

        // Guest joins, sits in yellow, marks ready
        $this->flushSession();
        $this->get("/room?code={$room->code}")->assertOk();
        $this->post("/rooms/{$room->code}/seat", ['seat_color' => 'yellow'])->assertRedirect();
        $this->post("/rooms/{$room->code}/ready")->assertRedirect();

        // Switch back to host session
        $this->withSession([
            'ludo_player_token' => $hostToken,
            'ludo_host_room_code' => $room->code,
        ]);

        // Host hasn't marked ready yet -> cannot start
        $this->post("/rooms/{$room->code}/start")
            ->assertSessionHasErrors('start');

        // Host marks ready and starts
        $this->post("/rooms/{$room->code}/ready")->assertRedirect();
        $this->post("/rooms/{$room->code}/start")
            ->assertRedirect(route('play', ['room' => $room->code]));

        $freshRoom = $room->fresh('players');
        $this->assertSame('started', $freshRoom->status);
        $this->assertNotNull($freshRoom->starting_player_id);
        $this->assertContains($freshRoom->starting_player_id, $freshRoom->players->pluck('id')->all());

        // /play?room=CODE renders Play with room props including starting_player_id
        $this->get("/play?room={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Play')
                ->where('room.code', $room->code)
                ->where('room.starting_player_id', $freshRoom->starting_player_id)
                ->has('room.players', 2));

        // Roll & move broadcast MatchAction to all players in the room
        Event::fake([MatchAction::class, RoomUpdated::class]);

        $state = $freshRoom->match_state;
        $state['turn'] = 0;
        $freshRoom->update(['match_state' => $state]);

        $this->postJson("/rooms/{$room->code}/match/roll")
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('action.type', 'roll');

        Event::assertDispatched(MatchAction::class, fn (MatchAction $event) => $event->code === $room->code && $event->action['type'] === 'roll');

        $state = $room->fresh()->match_state;
        $state['turn'] = 0;
        $state['dice'] = 6;
        $room->update(['match_state' => $state]);

        $this->postJson("/rooms/{$room->code}/match/move", ['token_index' => 0])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('action.type', 'move');

        Event::assertDispatched(MatchAction::class, fn (MatchAction $event) => $event->code === $room->code && $event->action['type'] === 'move');

        // Ending the game updates status and broadcasts end action
        $this->post("/rooms/{$room->code}/end")
            ->assertRedirect(route('home'));

        $this->assertSame('ended', $room->fresh()->status);
        Event::assertDispatched(MatchAction::class, fn (MatchAction $event) => $event->code === $room->code && $event->action['type'] === 'end');
    }
}
