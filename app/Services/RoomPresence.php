<?php

namespace App\Services;

use App\Models\Room;
use App\Models\RoomPlayer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Keeps track of which players still have the room open in a browser.
 *
 * Every seated client posts a heartbeat while its tab is alive, and every
 * room page load or match command refreshes the same stamp. When the host's
 * stamp goes stale the host is considered disconnected, so the first request
 * that notices closes the room and broadcasts the end so every remaining
 * player is sent back to the home page.
 */
class RoomPresence
{
    /**
     * A background tab throttles timers down to roughly one wake per minute,
     * so the heartbeat gaps can reach 60s. Anything below this threshold
     * still counts as "the host is here".
     */
    public const HOST_GONE_SECONDS = 90;

    /**
     * The lobby polls every 4s and the match every 5s, and the heartbeat
     * itself fires every 10s, so a stamp is only worth writing about once
     * every 15 seconds per player.
     */
    public const TOUCH_EVERY_SECONDS = 15;

    public function __construct(private RoomBroadcaster $broadcaster) {}

    /**
     * Refresh the requesting player's presence stamp, skipping the write
     * when the stored stamp is still fresh enough.
     */
    public function touch(RoomPlayer $player): void
    {
        $lastSeen = $player->last_seen_at;

        if ($lastSeen !== null && $lastSeen->gt(now()->subSeconds(self::TOUCH_EVERY_SECONDS))) {
            return;
        }

        $player->last_seen_at = now();
        $player->save();
    }

    /**
     * Close the room when the host's presence stamp has gone stale. Returns
     * true when this call was the one that closed it, so the caller can send
     * the requesting browser home. Rooms whose host never stamped (created
     * before presence tracking existed) are left alone.
     */
    public function closeIfHostGone(Room $room): bool
    {
        if (! in_array($room->status, ['waiting', 'started'], true)) {
            return false;
        }

        $host = $room->players()->where('is_host', true)->first();

        if (! $host || $host->last_seen_at === null) {
            return false;
        }

        if ($host->last_seen_at->gt(now()->subSeconds(self::HOST_GONE_SECONDS))) {
            return false;
        }

        $closed = DB::transaction(function () use ($room): bool {
            $locked = Room::whereKey($room->id)->lockForUpdate()->firstOrFail();

            if (! in_array($locked->status, ['waiting', 'started'], true)) {
                return false;
            }

            $locked->status = 'ended';
            $locked->save();

            return true;
        });

        if (! $closed) {
            return false;
        }

        $room->refresh()->load('players');

        $this->broadcaster->publishRoomUpdated($room, 'host.gone');
        $this->broadcaster->publishMatchAction($room, [
            'action_id' => (string) Str::uuid(),
            'type' => 'end',
            'player_id' => $host->id,
            'ended_by' => $host->name,
            'reason' => 'host_left',
        ], $host);

        PlayerResume::forget($room->code);

        return true;
    }
}
