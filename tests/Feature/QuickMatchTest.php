<?php

namespace Tests\Feature;

use App\Models\QuickMatchQueue;
use App\Models\Room;
use App\Services\PlayerResume;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class QuickMatchTest extends TestCase
{
    use RefreshDatabase;

    public function test_quick_match_page_renders_for_guests(): void
    {
        $this->get(route('quick-match'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('QuickMatch')
                ->where('state', 'idle')
                ->where('pool', 4)
                ->has('name')
                ->has('token')
                ->where('waiting', 0));
    }

    public function test_quick_match_page_normalizes_an_unknown_pool(): void
    {
        $this->get(route('quick-match', ['players' => 7]))
            ->assertRedirect(route('quick-match', ['players' => 4]));
    }

    public function test_quick_match_page_resumes_a_waiting_search(): void
    {
        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-page'])
            ->postJson(route('quick-match.join'), ['players' => 4, 'name' => 'Ayu'])
            ->assertOk()
            ->assertJsonPath('state', 'waiting');

        $this->get(route('quick-match', ['players' => 4]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('QuickMatch')
                ->where('state', 'waiting')
                ->where('name', 'Ayu'));
    }

    public function test_joining_a_pool_creates_a_waiting_entry(): void
    {
        $this->postJson(route('quick-match.join'), ['players' => 4, 'name' => 'Rina'])
            ->assertOk()
            ->assertJsonPath('state', 'waiting');

        $this->assertDatabaseHas('quick_match_queue', [
            'name' => 'Rina',
            'players' => 4,
            'status' => QuickMatchQueue::WAITING,
        ]);
    }

    public function test_joining_twice_switches_pools_instead_of_duplicating(): void
    {
        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-switch']);

        $this->postJson(route('quick-match.join'), ['players' => 4, 'name' => 'Switch'])
            ->assertOk()->assertJsonPath('state', 'waiting');

        $this->postJson(route('quick-match.join'), ['players' => 2, 'name' => 'Switch'])
            ->assertOk()->assertJsonPath('state', 'waiting');

        $this->assertSame(1, QuickMatchQueue::count());
        $this->assertSame(2, (int) QuickMatchQueue::firstOrFail()->players);
    }

    public function test_a_full_pool_pairs_into_a_host_less_quick_room(): void
    {
        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-one']);
        $this->postJson(route('quick-match.join'), ['players' => 2, 'name' => 'Budi'])
            ->assertOk()->assertJsonPath('state', 'waiting');

        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-two']);
        $response = $this->postJson(route('quick-match.join'), ['players' => 2, 'name' => 'Rina'])
            ->assertOk()->assertJsonPath('state', 'matched');

        $room = Room::where('code', $response->json('room'))->firstOrFail();

        $this->assertTrue($room->is_quick);
        $this->assertFalse($room->host_advantage);
        $this->assertSame('started', $room->status);
        $this->assertSame(2, $room->players()->count());
        $this->assertFalse($room->players()->where('is_host', true)->exists());
        $this->assertTrue($room->players()->where('is_computer', false)->where('is_ready', true)->where('name_confirmed', true)->count() === 2);

        // Approved quick-match seating: 2 players sit in opposite quadrants.
        $this->assertSame(['red', 'yellow'], $room->players()->orderBy('id')->pluck('seat_color')->all());
        $this->assertSame(['red', 'yellow'], $room->match_state['colors']);
        $this->assertNotNull($room->match_state['turn']);
    }

    public function test_a_paired_player_who_missed_the_redirect_recovers_the_room(): void
    {
        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-one']);
        $this->postJson(route('quick-match.join'), ['players' => 2, 'name' => 'Budi'])
            ->assertOk();

        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-two']);
        $paired = $this->postJson(route('quick-match.join'), ['players' => 2, 'name' => 'Rina'])
            ->assertOk();
        $roomCode = $paired->json('room');

        // The first browser never saw the broadcast: its next quick-match
        // visit is sent straight to the running board.
        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-one']);
        $this->get(route('quick-match', ['players' => 2]))
            ->assertRedirect(route('play', ['room' => $roomCode]));
    }

    public function test_joining_while_a_match_is_running_returns_to_that_match(): void
    {
        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-busy']);
        $this->postJson(route('quick-match.join'), ['players' => 2, 'name' => 'Sibuk'])
            ->assertOk();

        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-busy-other']);
        $paired = $this->postJson(route('quick-match.join'), ['players' => 2, 'name' => 'Lain'])
            ->assertOk();
        $roomCode = $paired->json('room');

        $this->withCookie(PlayerResume::LAST_ROOM_COOKIE, $roomCode)
            ->withSession([PlayerResume::SESSION_TOKEN => 'token-busy'])
            ->postJson(route('quick-match.join'), ['players' => 4, 'name' => 'Sibuk'])
            ->assertOk()
            ->assertJsonPath('state', 'active')
            ->assertJsonPath('room', $roomCode);
    }

    public function test_filling_with_computers_starts_a_match_against_bots(): void
    {
        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-solo']);
        $this->postJson(route('quick-match.join'), ['players' => 2, 'name' => 'Sendiri'])
            ->assertOk()->assertJsonPath('state', 'waiting');

        $filled = $this->postJson(route('quick-match.fill'), ['players' => 2])
            ->assertOk()
            ->assertJsonPath('state', 'matched');

        $room = Room::where('code', $filled->json('room'))->firstOrFail();
        $this->assertSame('started', $room->status);
        $this->assertTrue($room->is_quick);
        $this->assertSame(1, $room->players()->where('is_computer', true)->count());
        $this->assertSame(1, $room->players()->where('is_computer', false)->count());
    }

    public function test_filling_requires_an_active_search(): void
    {
        $this->postJson(route('quick-match.fill'), ['players' => 2])
            ->assertStatus(422);
    }

    public function test_cancelling_removes_the_waiting_entry(): void
    {
        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-cancel']);
        $this->postJson(route('quick-match.join'), ['players' => 4, 'name' => 'Urung'])
            ->assertOk();

        $this->postJson(route('quick-match.cancel'))->assertOk();

        $this->assertDatabaseMissing('quick_match_queue', [
            'player_token' => 'token-cancel',
            'status' => QuickMatchQueue::WAITING,
        ]);
    }

    public function test_quick_room_settings_cannot_be_changed_by_its_players(): void
    {
        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-settings']);
        $this->postJson(route('quick-match.join'), ['players' => 2, 'name' => 'A'])
            ->assertOk();

        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-settings-two']);
        $paired = $this->postJson(route('quick-match.join'), ['players' => 2, 'name' => 'B'])
            ->assertOk();
        $roomCode = $paired->json('room');

        // No browser token matches the system host token, so the host gate
        // keeps every room control - including host_advantage - locked.
        $this->withSession([PlayerResume::SESSION_TOKEN => 'token-settings'])
            ->patch(route('rooms.settings', ['code' => $roomCode]), ['host_advantage' => true])
            ->assertForbidden();

        $room = Room::where('code', $roomCode)->firstOrFail();
        $this->assertFalse($room->host_advantage);
    }
}
