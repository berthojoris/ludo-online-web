<?php

namespace App\Events;

use App\Models\Room;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RoomUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @var array<string, mixed>
     */
    public array $room;

    public function __construct(Room $room)
    {
        $this->room = $room->toLobbyPayload();
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('room.'.$this->room['code']),
        ];
    }

    public function broadcastAs(): string
    {
        return 'room.updated';
    }
}
