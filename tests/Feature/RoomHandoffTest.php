<?php

namespace Tests\Feature;

use App\Events\RoomUpdated;
use App\Http\Controllers\RoomHandoffController;
use App\Models\Room;
use App\Models\RoomPlayer;
use App\Services\PlayerResume;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RoomHandoffTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{0: Room, 1: RoomPlayer}
     */
    private function hostRoom(): array
    {
        Event::fake([RoomUpdated::class]);

        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();

        $room = Room::firstOrFail();

        return [$room, $room->players()->firstOrFail()];
    }

    private function issueCode(Room $room): string
    {
        return $this->postJson("/rooms/{$room->code}/handoff")
            ->assertOk()
            ->assertJsonStructure(['pairing_code', 'expires_in', 'continue_url'])
            ->json('pairing_code');
    }

    public function test_continue_page_renders_for_a_new_device(): void
    {
        [$room] = $this->hostRoom();

        $this->flushSession();

        $this->get("/rooms/{$room->code}/continue")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Continue')
                ->where('roomCode', $room->code)
                ->where('roomError', null)
                ->where('codeLength', 6));
    }

    public function test_switch_page_renders_from_the_home_screen(): void
    {
        $this->get('/switch')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('SwitchDevice')
                ->where('codeLength', 6));
    }

    public function test_switch_page_binds_a_device_without_knowing_the_room(): void
    {
        [$room, $host] = $this->hostRoom();
        $room->forceFill(['status' => 'started', 'match_state' => ['turn' => 0]])->save();

        $code = $this->issueCode($room);

        $this->flushSession();

        $this->post('/switch', ['pairing_code' => $code])
            ->assertRedirect(route('play', ['room' => $room->code]))
            ->assertSessionHas(PlayerResume::SESSION_TOKEN, $host->player_token)
            ->assertSessionHas('ludo_host_room_code', $room->code)
            ->assertCookie(PlayerResume::cookieName($room->code), $host->resume_token);

        $this->assertNull($host->fresh()->handoff_code_hash);
        $this->assertSame(1, $room->players()->count());
    }

    public function test_switch_page_rejects_a_wrong_pairing_code(): void
    {
        [$room] = $this->hostRoom();
        $code = $this->issueCode($room);
        $wrong = $code === '000000' ? '111111' : '000000';

        $this->flushSession();

        $this->post('/switch', ['pairing_code' => $wrong])
            ->assertSessionHasErrors('pairing_code');

        $this->assertNull(session(PlayerResume::SESSION_TOKEN));
    }

    public function test_continue_page_reports_an_unknown_room(): void
    {
        $this->get('/rooms/ZZZZZZ/continue')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Continue')
                ->where('roomCode', 'ZZZZZZ')
                ->where('roomError', 'Ruang tidak ditemukan. Periksa kembali tautanmu.'));
    }

    public function test_seated_browser_opening_the_continue_link_goes_straight_to_the_room(): void
    {
        [$room] = $this->hostRoom();

        $this->get("/rooms/{$room->code}/continue")
            ->assertRedirect(route('room', ['code' => $room->code]));
    }

    public function test_only_a_seated_player_can_issue_a_pairing_code(): void
    {
        [$room] = $this->hostRoom();

        $this->flushSession();

        $this->postJson("/rooms/{$room->code}/handoff")->assertForbidden();
    }

    public function test_pairing_code_binds_another_device_to_the_same_seat(): void
    {
        [$room, $host] = $this->hostRoom();
        $room->forceFill(['status' => 'started', 'match_state' => ['turn' => 0]])->save();

        $code = $this->issueCode($room);
        $this->assertNotNull($host->fresh()->handoff_code_hash);

        $this->flushSession();

        $this->post("/rooms/{$room->code}/continue", ['pairing_code' => $code])
            ->assertRedirect(route('play', ['room' => $room->code]))
            ->assertSessionHas(PlayerResume::SESSION_TOKEN, $host->player_token)
            ->assertSessionHas('ludo_host_room_code', $room->code)
            ->assertCookie(PlayerResume::cookieName($room->code), $host->resume_token);

        $this->assertNull($host->fresh()->handoff_code_hash);
        $this->assertSame(1, $room->players()->count());
    }

    public function test_pairing_code_can_only_be_used_once(): void
    {
        [$room] = $this->hostRoom();

        $code = $this->issueCode($room);

        $this->flushSession();
        $this->post("/rooms/{$room->code}/continue", ['pairing_code' => $code])->assertRedirect();

        $this->flushSession();
        $this->post("/rooms/{$room->code}/continue", ['pairing_code' => $code])
            ->assertSessionHasErrors('pairing_code');
    }

    public function test_expired_or_wrong_pairing_code_is_rejected(): void
    {
        [$room, $host] = $this->hostRoom();

        $code = $this->issueCode($room);
        $host->forceFill(['handoff_expires_at' => now()->subSecond()])->save();

        $this->flushSession();

        $this->post("/rooms/{$room->code}/continue", ['pairing_code' => $code])
            ->assertSessionHasErrors('pairing_code');

        $wrong = $code === '000000' ? '111111' : '000000';

        $this->post("/rooms/{$room->code}/continue", ['pairing_code' => $wrong])
            ->assertSessionHasErrors('pairing_code');

        $this->assertNull(session(PlayerResume::SESSION_TOKEN));
    }

    public function test_too_many_wrong_codes_revoke_pending_codes_of_the_room(): void
    {
        [$room, $host] = $this->hostRoom();

        $code = $this->issueCode($room);
        $wrong = $code === '000000' ? '111111' : '000000';

        $this->flushSession();

        for ($attempt = 0; $attempt < RoomHandoffController::MAX_FAILED_ATTEMPTS; $attempt++) {
            $this->withoutMiddleware(ThrottleRequests::class)
                ->post("/rooms/{$room->code}/continue", ['pairing_code' => $wrong]);
        }

        $this->assertNull($host->fresh()->handoff_code_hash);

        $this->withoutMiddleware(ThrottleRequests::class)
            ->post("/rooms/{$room->code}/continue", ['pairing_code' => $code])
            ->assertSessionHasErrors('pairing_code');
    }
}
