<?php

namespace Tests\Feature;

use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;
use Tests\TestCase;

class GamePagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_page_renders_the_game_home(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Home'));
    }

    public function test_how_it_works_renders_the_home_page_with_the_guide_open(): void
    {
        $this->get('/how-it-works')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Home')
                ->where('howItWorksOpen', true));
    }

    public function test_practice_board_renders(): void
    {
        $this->get('/play')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Play'));
    }

    public function test_room_lobby_renders(): void
    {
        $this->withSession(['ludo_room_access' => true])
            ->get('/room')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Room'));
    }

    public function test_room_page_sends_visitors_home_when_room_creation_is_locked(): void
    {
        $this->get('/room')->assertRedirect(route('home'));

        $this->assertDatabaseCount('rooms', 0);
    }

    public function test_client_issue_is_logged_with_room_and_player_context(): void
    {
        $this->withSession(['ludo_room_access' => true])->get('/room')->assertOk();
        $room = Room::firstOrFail();
        $player = $room->players()->firstOrFail();

        Log::spy();

        $this->postJson(route('client-issues.store'), [
            'message' => "Move request failed\n502 Bad Gateway",
            'stack' => 'Error: request failed',
            'source' => 'game.move',
            'room_code' => strtolower($room->code),
            'action' => 'request',
            'page' => '/play',
            'client_timestamp' => '2026-11-16T05:35:10Z',
            'context' => [
                'connection' => 'disconnected',
                'http_status' => 502,
                'state_version' => 4,
            ],
        ])->assertNoContent();

        Log::shouldHaveReceived('log')->once()->with(
            'error',
            'Client application issue reported.',
            Mockery::on(fn (array $context): bool => $context['message'] === 'Move request failed 502 Bad Gateway'
                && $context['room_code'] === $room->code
                && $context['player_id'] === $player->id
                && $context['source'] === 'game.move'
                && $context['context']['http_status'] === 502
                && $context['context']['state_version'] === 4
                && ! array_key_exists('player_token', $context)
                && ! array_key_exists('resume_token', $context)),
        );
    }

    public function test_client_issue_payload_is_validated(): void
    {
        $this->postJson(route('client-issues.store'), [
            'message' => '',
            'source' => 'invalid source',
            'level' => 'debug',
            'context' => ['unexpected' => 'value'],
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'message',
            'source',
            'level',
            'context',
        ]);
    }
}
