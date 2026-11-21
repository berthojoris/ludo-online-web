<?php

namespace App\Services;

use App\Models\Room;
use App\Models\RoomPlayer;
use Illuminate\Support\Collection;

class MatchStarter
{
    /**
     * Move a fully seated room into the started state with a fresh match.
     *
     * Shared by the host-driven private-room start and the automatic
     * quick-match room factory, so both flows produce identical matches:
     * random starting player, per-seat colors, board arms for the player
     * count, and the canonical initial match state.
     *
     * @param  Collection<RoomPlayer>  $players  seated players in turn order
     */
    public static function initialize(Room $room, Collection $players): void
    {
        $startingPlayer = $players->random();
        $seatColors = $players->pluck('seat_color')->all();
        $boardArms = MatchRules::defaultArms($players->count());

        $room->status = 'started';
        $room->starting_player_id = $startingPlayer->id;
        $room->match_state = MatchRules::initial(
            $players->search(fn (RoomPlayer $player) => $player->id === $startingPlayer->id),
            $seatColors,
            $boardArms,
        );
        $room->started_at = now();
        $room->save();
    }
}
