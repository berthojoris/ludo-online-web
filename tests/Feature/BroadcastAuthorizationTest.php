<?php

namespace Tests\Feature;

use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class BroadcastAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => 'test-app',
        ]);
    }

    public function test_non_members_cannot_authorize_a_private_room_channel(): void
    {
        $room = Room::create([
            'code' => 'ABC234',
            'host_token' => Str::random(40),
            'max_players' => 4,
            'status' => 'waiting',
        ]);

        $this->post(route('broadcasting.room-auth'), [
            'socket_id' => '1000.1',
            'channel_name' => "private-room.{$room->code}",
        ])->assertForbidden();
    }

    public function test_a_room_member_receives_a_pusher_auth_signature(): void
    {
        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();

        $response = $this->post(route('broadcasting.room-auth'), [
            'socket_id' => '1000.1',
            'channel_name' => "private-room.{$room->code}",
        ]);

        $response->assertOk()->assertJsonStructure(['auth']);
        $this->assertSame(
            'test-key:'.hash_hmac('sha256', '1000.1:private-room.'.$room->code, 'test-secret'),
            $response->json('auth'),
        );
    }

    public function test_unknown_channel_names_are_rejected(): void
    {
        $this->post(route('broadcasting.room-auth'), [
            'socket_id' => '1000.1',
            'channel_name' => 'private-room.not-a-room',
        ])->assertForbidden();
    }
}
