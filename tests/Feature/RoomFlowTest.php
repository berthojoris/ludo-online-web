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
        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
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

    public function test_existing_default_host_name_is_displayed_as_host(): void
    {
        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $room->players()->update(['name' => 'Tuan Rumah']);

        $this->get("/room?code={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('room.players.0.name', 'Host')
                ->where('me.name', 'Host'));
    }

    public function test_new_room_does_not_reuse_old_players_or_guest_names(): void
    {
        Event::fake([RoomUpdated::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $oldRoom = Room::firstOrFail();
        $hostToken = session('ludo_player_token');
        $this->post("/rooms/{$oldRoom->code}/name", ['name' => 'Host Lama'])->assertRedirect();

        $this->flushSession();
        $this->get("/room?code={$oldRoom->code}")->assertOk();
        $guestToken = session('ludo_player_token');
        $this->post("/rooms/{$oldRoom->code}/name", ['name' => 'Pemain Lama'])->assertRedirect();
        $this->post("/rooms/{$oldRoom->code}/seat", ['seat_color' => 'green'])->assertRedirect();

        $this->withSession(['ludo_player_token' => $hostToken, 'ludo_player_name' => 'Host Lama']);
        $this->post(route('rooms.store'), ['max_players' => 3, 'password' => config('ludo.room_password')])->assertRedirect();
        $newRoom = Room::latest('id')->firstOrFail();
        $this->assertNotSame($oldRoom->code, $newRoom->code);
        $this->assertNull(session('ludo_player_name'));
        $this->get("/room?code={$newRoom->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('room.code', $newRoom->code)
                ->where('room.max_players', 3)
                ->has('room.players', 1)
                ->where('room.players.0.name', 'Host')
                ->where('room.players.0.is_ready', true));

        $this->withSession(['ludo_player_token' => $guestToken, 'ludo_player_name' => 'Pemain Lama']);
        $this->get("/room?code={$newRoom->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('room.players', 2)
                ->where('me.name', 'Tamu')
                ->where('me.seat_color', null)
                ->where('me.is_ready', false));

        $this->get("/room?code={$oldRoom->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('me.name', 'Pemain Lama'));
    }

    public function test_three_and_four_players_can_start_and_take_turns(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        foreach ([3, 4] as $count) {
            $this->flushSession();
            $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
            $room = Room::latest('id')->firstOrFail();
            $hostToken = session('ludo_player_token');
            $this->patch("/rooms/{$room->code}/settings", ['max_players' => $count]);
            $tokens = [$hostToken];
            $colors = array_slice($room->fresh()->allowedSeats(), 1);

            foreach ($colors as $color) {
                $this->flushSession();
                $this->get("/room?code={$room->code}")->assertOk();
                $tokens[] = session('ludo_player_token');
                $this->post("/rooms/{$room->code}/seat", ['seat_color' => $color])->assertRedirect();
            }

            $this->withSession(['ludo_player_token' => $hostToken]);
            $this->post("/rooms/{$room->code}/start")->assertRedirect(route('play', ['room' => $room->code]));
            $state = $room->fresh()->match_state;
            $this->assertCount($count, $state['tokens']);
            $this->assertSame($room->fresh()->allowedSeats(), $state['colors']);

            $state['turn'] = $count - 1;
            $room->update(['match_state' => $state]);
            $this->withSession(['ludo_player_token' => $tokens[$count - 1]]);
            $this->postJson("/rooms/{$room->code}/match/roll")->assertOk();

            // Each participant can move, and the final participant wraps to the host.
            foreach ($tokens as $index => $token) {
                $state = $room->fresh()->match_state;
                $state['turn'] = $index;
                $state['dice'] = 1;
                $state['tokens'][$index][0] = 0;
                $room->update(['match_state' => $state]);
                $this->withSession(['ludo_player_token' => $token]);
                $this->postJson("/rooms/{$room->code}/match/move", ['token_index' => 0])->assertOk();
                $this->assertSame(($index + 1) % $count, $room->fresh()->match_state['turn']);
            }
        }
    }

    public function test_capture_checks_every_opponent_using_seat_colors(): void
    {
        $state = MatchRules::initial(0, ['red', 'green', 'yellow', 'blue']);
        $state['tokens'][0][0] = 1;
        $state['tokens'][3][0] = 16; // Blue 16 and red 3 both land on track square 3.
        $this->assertContains(2, MatchRules::captureRolls($state, 0));
    }

    public function test_host_room_capacity_and_joined_players_sync_across_sessions(): void
    {
        Event::fake([RoomUpdated::class]);

        // Host opens /room and creates a persistent room
        $this->withSession(['ludo_room_access' => true])
            ->get('/room')
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

        // Guest sits in 'yellow'; taking a seat marks them ready automatically.
        $this->post("/rooms/{$room->code}/seat", ['seat_color' => 'yellow'])
            ->assertRedirect();

        $guest = $room->players()->where('is_host', false)->firstOrFail();
        $this->assertSame('yellow', $guest->seat_color);
        $this->assertTrue($guest->is_ready);

        // The guest can still opt back out of ready and back in.
        $this->post("/rooms/{$room->code}/ready", ['is_ready' => false])
            ->assertRedirect();
        $this->assertFalse($guest->fresh()->is_ready);
        $this->post("/rooms/{$room->code}/ready", ['is_ready' => true])
            ->assertRedirect();
        $this->assertTrue($guest->fresh()->is_ready);

        // Non-host cannot start the match
        $this->post("/rooms/{$room->code}/start")
            ->assertForbidden();
    }

    public function test_host_can_start_match_only_when_all_players_are_seated_and_ready(): void
    {
        Event::fake([RoomUpdated::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $hostToken = session('ludo_player_token');

        $this->patch("/rooms/{$room->code}/settings", ['max_players' => 2]);

        // Host cannot start alone
        $this->post("/rooms/{$room->code}/start")
            ->assertSessionHasErrors('start');

        // Guest joins and takes a seat, which marks them ready automatically
        $this->flushSession();
        $this->get("/room?code={$room->code}")->assertOk();
        $guestToken = session('ludo_player_token');
        $this->post("/rooms/{$room->code}/seat", ['seat_color' => 'yellow'])->assertRedirect();

        // Guest opts back out of ready -> the host still cannot start
        $this->post("/rooms/{$room->code}/ready", ['is_ready' => false])->assertRedirect();

        // Switch back to host session
        $this->withSession([
            'ludo_player_token' => $hostToken,
            'ludo_host_room_code' => $room->code,
        ]);

        $this->post("/rooms/{$room->code}/start")
            ->assertSessionHasErrors('start');

        // Guest is ready again; the host is ready from room creation, so start succeeds
        $this->withSession(['ludo_player_token' => $guestToken]);
        $this->post("/rooms/{$room->code}/ready", ['is_ready' => true])->assertRedirect();

        $this->withSession([
            'ludo_player_token' => $hostToken,
            'ludo_host_room_code' => $room->code,
        ]);
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

    public function test_only_the_host_can_end_the_match(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $hostToken = session('ludo_player_token');

        // Guest joins from another device/session while the room is still waiting
        $this->flushSession();
        $this->get("/room?code={$room->code}")->assertOk();

        $room->update([
            'status' => 'started',
            'started_at' => now(),
            'match_state' => MatchRules::initial(0, ['red', 'yellow']),
        ]);

        $this->post("/rooms/{$room->code}/end")->assertForbidden();
        $this->assertSame('started', $room->fresh()->status);
        Event::assertNotDispatched(MatchAction::class);

        // Host ends the match
        $this->withSession(['ludo_player_token' => $hostToken]);
        $this->post("/rooms/{$room->code}/end")->assertRedirect(route('home'));

        $this->assertSame('ended', $room->fresh()->status);
        Event::assertDispatched(MatchAction::class, fn (MatchAction $event) => $event->code === $room->code && $event->action['type'] === 'end');
    }

    public function test_room_creation_requires_the_static_access_password(): void
    {
        $this->post('/rooms', ['max_players' => 2])
            ->assertSessionHasErrors('password');
        $this->assertDatabaseCount('rooms', 0);

        $this->post('/rooms', ['max_players' => 2, 'password' => 'salah'])
            ->assertSessionHasErrors('password');
        $this->assertDatabaseCount('rooms', 0);

        $this->post('/rooms', ['max_players' => 2, 'password' => 'malaquena'])
            ->assertRedirect();

        $room = Room::firstOrFail();
        $this->assertSame(2, $room->max_players);
        $this->assertTrue(session('ludo_room_access'));

        // Once unlocked, the same session can create another room without the modal.
        $this->post('/rooms', ['max_players' => 4, 'password' => 'malaquena'])
            ->assertRedirect();
        $this->assertDatabaseCount('rooms', 2);
    }

    public function test_opening_fourth_roll_guarantees_six_after_three_misses_then_returns_to_random(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $hostToken = session('ludo_player_token');
        $host = $room->players()->firstOrFail();

        $this->flushSession();
        $this->get("/room?code={$room->code}")->assertOk();
        $this->post("/rooms/{$room->code}/seat", ['seat_color' => 'yellow'])->assertRedirect();

        $state = MatchRules::initial(0, ['red', 'yellow']);
        $state['stats'][0]['rolls'] = 3;
        $state['had_six'] = [false, false];

        $room->update([
            'status' => 'started',
            'starting_player_id' => $host->id,
            'started_at' => now(),
            'match_state' => $state,
        ]);

        // 4th roll after 3 misses at game start must be 6.
        $this->withSession(['ludo_player_token' => $hostToken]);
        $this->postJson("/rooms/{$room->code}/match/roll")
            ->assertOk()
            ->assertJsonPath('action.value', 6);

        $freshState = $room->fresh()->match_state;
        $this->assertSame(4, $freshState['stats'][0]['rolls']);
        $this->assertTrue($freshState['had_six'][0]);
        $this->assertFalse(MatchRules::shouldForceOpeningSix($freshState, 0));

        // After the 4th roll (or once a 6 has been rolled), subsequent rolls are random again
        // even if all tokens return to base.
        $alreadyHadSixState = MatchRules::initial(0, ['red', 'yellow']);
        $alreadyHadSixState['stats'][0]['rolls'] = 3;
        $alreadyHadSixState['had_six'][0] = true;
        $this->assertFalse(MatchRules::shouldForceOpeningSix($alreadyHadSixState, 0));

        $afterFourthState = MatchRules::initial(0, ['red', 'yellow']);
        $afterFourthState['stats'][0]['rolls'] = 4;
        $afterFourthState['had_six'][0] = true;
        $this->assertFalse(MatchRules::shouldForceOpeningSix($afterFourthState, 0));

        // Works with host_advantage enabled too: 4th roll after 3 misses still guarantees 6.
        $room->update(['host_advantage' => true]);
        $this->assertSame(6, MatchRules::rollDice($state, 0, true));
    }

    public function test_host_can_rename_any_player_in_the_room_and_guests_cannot(): void
    {
        Event::fake([RoomUpdated::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $hostToken = session('ludo_player_token');
        $host = $room->players()->firstOrFail();

        // Guest joins the room
        $this->flushSession();
        $this->get("/room?code={$room->code}")->assertOk();
        $guest = $room->players()->where('is_host', false)->firstOrFail();

        // Another room + player (to verify cross-room isolation / IDOR protection)
        $this->flushSession();
        $this->withSession(['ludo_room_access' => true])
            ->post('/rooms', ['max_players' => 2, 'password' => config('ludo.room_password')])
            ->assertRedirect();
        $otherRoom = Room::latest('id')->firstOrFail();
        $otherPlayer = $otherRoom->players()->firstOrFail();

        // Guest cannot rename host or other players
        $this->withSession(['ludo_player_token' => $guest->player_token]);
        $this->patch("/rooms/{$room->code}/players/{$host->id}/name", ['name' => 'Hacker'])
            ->assertForbidden();
        $this->assertSame('Host', $host->fresh()->name);

        // Host can rename guest (and whitespace is trimmed)
        $this->withSession(['ludo_player_token' => $hostToken]);
        $this->patch("/rooms/{$room->code}/players/{$guest->id}/name", ['name' => '  Budi Santoso  '])
            ->assertRedirect();
        $this->assertSame('Budi Santoso', $guest->fresh()->name);
        Event::assertDispatched(RoomUpdated::class, fn (RoomUpdated $event) => $event->room['code'] === $room->code);

        // Validation rejects empty/whitespace-only or overly long names
        $this->patch("/rooms/{$room->code}/players/{$guest->id}/name", ['name' => '   '])
            ->assertSessionHasErrors('name');
        $this->patch("/rooms/{$room->code}/players/{$guest->id}/name", ['name' => str_repeat('a', 25)])
            ->assertSessionHasErrors('name');
        $this->assertSame('Budi Santoso', $guest->fresh()->name);

        // Host cannot rename a player belonging to another room
        $this->patch("/rooms/{$room->code}/players/{$otherPlayer->id}/name", ['name' => 'CrossRoom'])
            ->assertNotFound();
    }

    public function test_five_six_and_seven_players_can_start_and_take_turns_with_dynamic_board_rules(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        foreach ([5, 6, 7] as $count) {
            $this->flushSession();
            $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
            $room = Room::latest('id')->firstOrFail();
            $hostToken = session('ludo_player_token');

            $this->patch("/rooms/{$room->code}/settings", ['max_players' => $count])
                ->assertRedirect();
            $this->assertSame($count, $room->fresh()->max_players);

            $allowedSeats = $room->fresh()->allowedSeats();
            $this->assertCount($count, $allowedSeats);

            $tokens = [$hostToken];
            foreach (array_slice($allowedSeats, 1) as $color) {
                $this->flushSession();
                $this->get("/room?code={$room->code}")->assertOk();
                $tokens[] = session('ludo_player_token');
                $this->post("/rooms/{$room->code}/seat", ['seat_color' => $color])
                    ->assertRedirect();
            }

            $this->withSession(['ludo_player_token' => $hostToken]);
            $this->post("/rooms/{$room->code}/start")
                ->assertRedirect(route('play', ['room' => $room->code]));

            $freshRoom = $room->fresh();
            $state = $freshRoom->match_state;
            $this->assertSame($count, $state['arms']);
            $this->assertCount($count, $state['tokens']);
            $this->assertSame($allowedSeats, $state['colors']);

            $expectedFinish = $count * 11 + 3;
            $this->assertSame($expectedFinish, MatchRules::finishPosition($allowedSeats, $count));

            // Last participant moves and wraps turn back to index 0.
            $lastIndex = $count - 1;
            $state['turn'] = $lastIndex;
            $state['dice'] = 2;
            $state['tokens'][$lastIndex][0] = 0;
            $freshRoom->update(['match_state' => $state]);

            $this->withSession(['ludo_player_token' => $tokens[$lastIndex]]);
            $this->postJson("/rooms/{$room->code}/match/move", ['token_index' => 0])->assertOk();
            $this->assertSame(0, $freshRoom->fresh()->match_state['turn']);

            // Verify capture and finish rules on the dynamic radial track.
            $captureState = MatchRules::initial(0, $allowedSeats, $count);
            $captureState['tokens'][0][0] = 1; // Red at absolute 1; rolling 1 lands on absolute 2.
            $captureState['tokens'][$lastIndex][0] = 13; // Last player starts at ($count-1)*11; +13 wraps to absolute 2.
            $this->assertContains(1, MatchRules::captureRolls($captureState, 0));

            // Reaching exact finish position records player 0 in winners while match continues.
            $winState = $freshRoom->fresh()->match_state;
            $winState['turn'] = 0;
            $winState['dice'] = 1;
            $winState['tokens'][0] = [
                $expectedFinish,
                $expectedFinish,
                $expectedFinish,
                $expectedFinish - 1,
            ];
            $freshRoom->update(['match_state' => $winState]);

            $this->withSession(['ludo_player_token' => $hostToken]);
            $this->postJson("/rooms/{$room->code}/match/move", ['token_index' => 3])->assertOk();
            $afterFirstWin = $freshRoom->fresh()->match_state;
            $this->assertSame([0], $afterFirstWin['winners']);
            $this->assertNull($afterFirstWin['winner']);
            $this->assertSame(1, $afterFirstWin['turn']);
        }
    }

    public function test_match_continues_after_first_player_finishes_and_ends_when_one_player_remains(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $hostToken = session('ludo_player_token');
        $this->patch("/rooms/{$room->code}/settings", ['max_players' => 3])->assertRedirect();

        $tokens = [$hostToken];
        foreach (['green', 'yellow'] as $color) {
            $this->flushSession();
            $this->get("/room?code={$room->code}")->assertOk();
            $tokens[] = session('ludo_player_token');
            $this->post("/rooms/{$room->code}/seat", ['seat_color' => $color])->assertRedirect();
        }

        $this->withSession(['ludo_player_token' => $hostToken]);
        $this->post("/rooms/{$room->code}/start")->assertRedirect(route('play', ['room' => $room->code]));

        // Set up: player 0 is 1 step away from finishing all 4 tokens.
        $state = MatchRules::initial(0, ['red', 'green', 'yellow']);
        $state['tokens'] = [
            [56, 56, 56, 55],
            [56, 56, 56, 55],
            [56, 56, 56, 50],
        ];
        $state['turn'] = 0;
        $state['dice'] = 1;
        $room->update(['match_state' => $state]);

        // Player 0 finishes 1st: game continues, winner stays null, turn advances to 1.
        $this->withSession(['ludo_player_token' => $tokens[0]]);
        $this->postJson("/rooms/{$room->code}/match/move", ['token_index' => 3])->assertOk();
        $afterFirst = $room->fresh()->match_state;
        $this->assertSame([0], $afterFirst['winners']);
        $this->assertNull($afterFirst['winner']);
        $this->assertSame(1, $afterFirst['turn']);

        // Already-finished player 0 cannot roll.
        $this->postJson("/rooms/{$room->code}/match/roll")->assertStatus(422);

        // When player 2 has no legal moves on a roll, turn skips finished player 0 and goes to player 1.
        $afterFirst['turn'] = 2;
        $afterFirst['dice'] = null;
        $afterFirst['tokens'][2] = [-1, -1, -1, -1];
        $afterFirst['stats'][2]['rolls'] = 0;
        $afterFirst['had_six'][2] = false;
        $room->update(['match_state' => $afterFirst]);
        $this->withSession(['ludo_player_token' => $tokens[2]]);
        $rollRes = $this->postJson("/rooms/{$room->code}/match/roll")->assertOk()->json('action.value');
        if ($rollRes !== 6) {
            $this->assertSame(1, $room->fresh()->match_state['turn']);
        }

        // Player 2 finishes 2nd: only player 1 remains, so the match ends with player 1 in last place.
        $midState = $room->fresh()->match_state;
        $midState['tokens'][2] = [56, 56, 56, 50];
        $midState['turn'] = 2;
        $midState['dice'] = 6;
        $room->update(['match_state' => $midState]);
        $this->postJson("/rooms/{$room->code}/match/move", ['token_index' => 3])->assertOk();
        $finalState = $room->fresh()->match_state;
        $this->assertSame([0, 2, 1], $finalState['winners']);
        $this->assertSame(0, $finalState['winner']);

        // The remaining player can no longer roll once the match is over.
        $finalState['turn'] = 1;
        $room->update(['match_state' => $finalState]);
        $this->withSession(['ludo_player_token' => $tokens[1]]);
        $this->postJson("/rooms/{$room->code}/match/roll")->assertStatus(422);
    }

    public function test_invitation_link_joins_the_waiting_room_without_typing_the_code(): void
    {
        Event::fake([RoomUpdated::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();

        $this->flushSession();
        $this->get("/room?code={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Room')
                ->where('mode', 'lobby')
                ->where('room.code', $room->code)
                ->where('me.is_host', false)
                ->has('room.players', 2));
    }

    public function test_invitation_link_takes_over_an_idle_guest_slot_in_a_full_room(): void
    {
        Event::fake([RoomUpdated::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $this->patch("/rooms/{$room->code}/settings", ['max_players' => 2]);

        // Guest A opens the invitation but never takes a colour.
        $this->flushSession();
        $this->get("/room?code={$room->code}")->assertOk();
        $idleGuest = $room->players()->where('is_host', false)->firstOrFail();

        // Guest B opens the same invitation while the room is full.
        $this->flushSession();
        $this->get("/room?code={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Room')
                ->where('mode', 'lobby')
                ->where('room.code', $room->code)
                ->where('me.id', $idleGuest->id)
                ->has('room.players', 2));

        $this->assertSame(2, $room->players()->count());
        $this->assertNotSame($idleGuest->player_token, $idleGuest->fresh()->player_token);
    }

    public function test_invitation_link_to_a_full_room_of_seated_players_explains_the_error(): void
    {
        Event::fake([RoomUpdated::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $this->patch("/rooms/{$room->code}/settings", ['max_players' => 2]);

        $this->flushSession();
        $this->get("/room?code={$room->code}")->assertOk();
        $this->post("/rooms/{$room->code}/seat", ['seat_color' => 'yellow'])->assertRedirect();

        $this->flushSession();
        $this->get("/room?code={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Room')
                ->where('mode', 'join')
                ->where('room', null)
                ->where('roomError', 'Ruang sudah penuh.')
                ->where('attemptedCode', $room->code));
    }

    public function test_invitation_link_to_a_started_room_explains_that_the_match_has_started(): void
    {
        Event::fake([RoomUpdated::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $room->update(['status' => 'started', 'started_at' => now()]);

        $this->flushSession();
        $this->get("/room?code={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Room')
                ->where('mode', 'join')
                ->where('roomError', 'Permainan di ruang ini sudah dimulai.')
                ->where('attemptedCode', $room->code));
    }

    public function test_players_can_select_and_change_characters_when_sitting_in_a_room(): void
    {
        Event::fake([RoomUpdated::class]);

        $this->withSession(['ludo_room_access' => true])
            ->get('/room')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Room')
                ->where('me.seat_color', 'red')
                ->where('me.character', 'ignivar')
                ->where('room.players.0.character', 'ignivar'));

        $room = Room::firstOrFail();
        $hostToken = session('ludo_player_token');

        // Host can change character while keeping red seat
        $this->post("/rooms/{$room->code}/seat", [
            'seat_color' => 'red',
            'character' => 'solgarde',
        ])->assertRedirect();

        $this->assertSame('solgarde', $room->players()->where('is_host', true)->value('character'));

        // Guest joins and picks seat + character from the 7 assets
        $this->flushSession();
        $this->get("/room?code={$room->code}")->assertOk();

        // Invalid character is rejected
        $this->post("/rooms/{$room->code}/seat", [
            'seat_color' => 'green',
            'character' => 'unknown_dragon',
        ])->assertSessionHasErrors('character');

        // A character already used by another player cannot be picked again
        $this->post("/rooms/{$room->code}/seat", [
            'seat_color' => 'green',
            'character' => 'solgarde',
        ])->assertSessionHasErrors('character');
        $this->assertNull($room->players()->where('is_host', false)->value('seat_color'));

        // Sitting on a seat whose default character is taken falls back to a free one
        $this->post("/rooms/{$room->code}/seat", [
            'seat_color' => 'yellow',
        ])->assertRedirect();
        $guest = $room->players()->where('is_host', false)->firstOrFail();
        $this->assertSame('yellow', $guest->seat_color);
        $this->assertNotSame('solgarde', $guest->character);

        foreach (array_diff(Room::ALL_CHARACTERS, ['solgarde']) as $character) {
            $this->post("/rooms/{$room->code}/seat", [
                'seat_color' => 'green',
                'character' => $character,
            ])->assertRedirect();

            $guest = $room->players()->where('is_host', false)->firstOrFail();
            $this->assertSame('green', $guest->seat_color);
            $this->assertSame($character, $guest->character);
            $this->assertTrue($guest->is_ready);
        }

        // Standing up clears seat_color and character
        $this->post("/rooms/{$room->code}/seat", [
            'seat_color' => null,
        ])->assertRedirect();

        $guest = $room->players()->where('is_host', false)->firstOrFail();
        $this->assertNull($guest->seat_color);
        $this->assertNull($guest->character);
        $this->assertFalse($guest->is_ready);

        // Sitting down again with zephyira and starting match passes character to Play page
        $this->post("/rooms/{$room->code}/seat", [
            'seat_color' => 'yellow',
            'character' => 'zephyira',
        ])->assertRedirect();

        $this->withSession([
            'ludo_player_token' => $hostToken,
            'ludo_host_room_code' => $room->code,
        ]);
        $this->post("/rooms/{$room->code}/start")
            ->assertRedirect(route('play', ['room' => $room->code]));

        $this->get("/play?room={$room->code}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Play')
                ->where('room.players.0.character', 'solgarde')
                ->where('room.players.1.character', 'zephyira'));
    }
}
