<?php

namespace Tests\Feature;

use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class GamePagesTest extends TestCase
{
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
        $this->get('/room')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Room'));
    }
}
