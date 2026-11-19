<?php

namespace Tests\Feature;

use App\Events\MatchAction;
use App\Events\RoomUpdated;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class RoomAutoCloseTest extends TestCase
{
    use RefreshDatabase;

    private function createRoomWithHost(): Room
    {
        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();

        return Room::firstOrFail();
    }

    private function joinAsGuest(Room $room): void
    {
        $this->flushSession();
        $this->withSession(['ludo_room_access' => true])
            ->get("/room?code={$room->code}")
            ->assertOk();
    }

    public function test_host_leave_closes_room_and_returns_home(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        $room = $this->createRoomWithHost();

        $this->post("/rooms/{$room->code}/leave")->assertRedirect(route('home'));

        $this->assertSame('ended', $room->fresh()->status);
        Event::assertDispatched(RoomUpdated::class);
        Event::assertDispatched(MatchAction::class);

        $this->post(route('rooms.start', ['code' => $room->code]))
            ->assertRedirect(route('home'));
        $this->post(route('rooms.leave', ['code' => $room->code]))
            ->assertRedirect(route('home'));
        Event::assertDispatchedTimes(MatchAction::class, 1);

        $this->get(route('room'))->assertOk();
        $this->assertDatabaseHas('rooms', ['code' => $room->code, 'status' => 'ended']);
        $this->assertSame(1, Room::where('status', 'waiting')->count());
    }

    public function test_host_leave_ends_a_running_match_and_blocks_guest_reentry(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        $room = $this->createRoomWithHost();
        $hostToken = $room->host_token;
        $this->joinAsGuest($room);
        $guestToken = session('ludo_player_token');
        $room->update(['status' => 'started']);

        $this->withSession(['ludo_player_token' => $hostToken])
            ->post(route('rooms.leave', ['code' => $room->code]))
            ->assertRedirect(route('home'));

        $this->withSession(['ludo_player_token' => $guestToken])
            ->post(route('rooms.heartbeat', ['code' => $room->code]))
            ->assertOk()
            ->assertJson(['room_status' => 'ended']);
        $this->get(route('play', ['room' => $room->code]))
            ->assertRedirect(route('home'));
        $this->get(route('room', ['code' => $room->code]))
            ->assertRedirect(route('home'));
    }

    public function test_guest_leave_keeps_room_open_and_returns_home(): void
    {
        Event::fake([RoomUpdated::class]);

        $room = $this->createRoomWithHost();
        $this->joinAsGuest($room);

        $this->post("/rooms/{$room->code}/leave")->assertRedirect(route('home'));

        $this->assertSame('waiting', $room->fresh()->status);
    }

    public function test_leave_is_rejected_for_non_participants(): void
    {
        $room = $this->createRoomWithHost();
        $this->flushSession();

        $this->post("/rooms/{$room->code}/leave")->assertForbidden();

        $this->assertSame('waiting', $room->fresh()->status);
    }

    public function test_heartbeat_refreshes_presence_and_keeps_room_open(): void
    {
        $room = $this->createRoomWithHost();

        $this->post("/rooms/{$room->code}/heartbeat")
            ->assertOk()
            ->assertJson(['ok' => true, 'room_status' => 'waiting']);

        $this->assertSame('waiting', $room->fresh()->status);
        $this->assertNotNull(
            $room->players()->where('is_host', true)->first()->last_seen_at,
        );
    }

    public function test_stale_host_presence_closes_room_on_guest_heartbeat(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        $room = $this->createRoomWithHost();
        $this->joinAsGuest($room);

        $room->players()
            ->where('is_host', true)
            ->update(['last_seen_at' => now()->subSeconds(120)]);

        $this->post("/rooms/{$room->code}/heartbeat")
            ->assertOk()
            ->assertJson(['ok' => true, 'room_status' => 'ended']);

        $this->assertSame('ended', $room->fresh()->status);
        Event::assertDispatched(RoomUpdated::class);
        Event::assertDispatched(MatchAction::class);
    }

    public function test_lobby_page_returns_home_when_host_has_gone(): void
    {
        Event::fake([RoomUpdated::class, MatchAction::class]);

        $room = $this->createRoomWithHost();
        $this->joinAsGuest($room);

        $room->players()
            ->where('is_host', true)
            ->update(['last_seen_at' => now()->subSeconds(120)]);

        $this->get("/room?code={$room->code}")->assertRedirect(route('home'));

        $this->assertSame('ended', $room->fresh()->status);
    }
}
