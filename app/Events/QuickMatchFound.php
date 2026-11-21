<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class QuickMatchFound implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $playerToken,
        public string $code,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('quick-match.'.$this->playerToken),
        ];
    }

    public function broadcastAs(): string
    {
        return 'match.found';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'room' => $this->code,
            'server_now' => now()->getTimestampMs(),
        ];
    }
}
