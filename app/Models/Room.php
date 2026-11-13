<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Room extends Model
{
    public const SEATS_BY_COUNT = [
        2 => ['red', 'yellow'],
        3 => ['red', 'green', 'yellow'],
        4 => ['red', 'green', 'blue', 'yellow'],
    ];

    protected $fillable = [
        'code',
        'host_token',
        'max_players',
        'status',
        'starting_player_id',
        'started_at',
    ];

    protected function casts(): array
    {
        return [
            'max_players' => 'integer',
            'starting_player_id' => 'integer',
            'started_at' => 'datetime',
        ];
    }

    public function players(): HasMany
    {
        return $this->hasMany(RoomPlayer::class)->orderBy('id');
    }

    /**
     * @return list<string>
     */
    public function allowedSeats(): array
    {
        return self::SEATS_BY_COUNT[$this->max_players] ?? self::SEATS_BY_COUNT[4];
    }

    /**
     * @return array<string, mixed>
     */
    public function toLobbyPayload(): array
    {
        $this->loadMissing('players');

        return [
            'code' => $this->code,
            'max_players' => $this->max_players,
            'status' => $this->status,
            'starting_player_id' => $this->starting_player_id,
            'players' => $this->players->map(fn (RoomPlayer $player) => [
                'id' => $player->id,
                'name' => $player->name,
                'seat_color' => $player->seat_color,
                'is_ready' => $player->is_ready,
                'is_host' => $player->is_host,
            ])->values()->all(),
        ];
    }
}
