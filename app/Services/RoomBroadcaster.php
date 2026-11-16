<?php

namespace App\Services;

use App\Events\MatchAction;
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
