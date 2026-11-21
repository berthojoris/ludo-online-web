<?php

namespace App\Services;

use App\Events\MatchAction;
use App\Events\QuickMatchFound;
use App\Events\RoomUpdated;
use App\Models\Room;
use App\Models\RoomPlayer;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Support\Facades\Log;
use Pusher\PusherException;
use Throwable;

class RoomBroadcaster
{
    public function publishRoomUpdated(Room $room, string $operation, ?RoomPlayer $player = null): void
    {
        try {
            broadcast(new RoomUpdated($room));
        } catch (BroadcastException|GuzzleException|PusherException $exception) {
            $this->reportFailure($exception, array_filter([
                'room_code' => $room->code,
                'operation' => $operation,
                'player_id' => $player?->id,
            ], fn (mixed $value): bool => $value !== null));
        }
    }

    /**
     * Tell one waiting browser its quick match was paired so it can jump
     * straight to the board. Like the room broadcasts this is best effort:
     * every searching client also polls, so a failed broadcast is only
     * logged and never blocks the pairing.
     */
    public function publishQuickMatchFound(string $playerToken, string $code): void
    {
        try {
            broadcast(new QuickMatchFound($playerToken, $code));
        } catch (BroadcastException|GuzzleException|PusherException $exception) {
            $this->reportFailure($exception, [
                'channel' => 'quick-match',
                'player_token' => $playerToken,
                'room_code' => $code,
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $action
     */
    public function publishMatchAction(Room $room, array $action, ?RoomPlayer $player = null): void
    {
        try {
            broadcast(new MatchAction($room->code, $action));
        } catch (BroadcastException|GuzzleException|PusherException $exception) {
            $this->reportFailure($exception, array_filter([
                'room_code' => $room->code,
                'operation' => 'match.'.$action['type'],
                'player_id' => $player?->id ?? ($action['player_id'] ?? null),
                'action_id' => $action['action_id'] ?? null,
                'state_version' => $action['state_version'] ?? null,
                'token_index' => $action['token_index'] ?? null,
                'dice_value' => $action['value'] ?? null,
            ], fn (mixed $value): bool => $value !== null));
        }
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function reportFailure(Throwable $exception, array $context): void
    {
        Log::error('Realtime broadcast failed after the room state was committed.', [
            ...$context,
            'broadcast_connection' => config('broadcasting.default'),
            'exception' => $exception,
        ]);
    }
}
