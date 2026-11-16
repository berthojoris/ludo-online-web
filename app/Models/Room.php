<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Room extends Model
{
    public const ALL_COLORS = [
        'red',
        'green',
        'yellow',
        'blue',
        'purple',
        'orange',
        'teal',
    ];

    public const ALL_CHARACTERS = [
        'ignivar',
        'frost_claw',
        'solgarde',
        'verdantor',
        'umrax',
        'aqualon',
        'zephyira',
    ];

    public const DEFAULT_CHARACTER_BY_COLOR = [
        'red' => 'ignivar',
        'green' => 'verdantor',
        'yellow' => 'solgarde',
        'blue' => 'frost_claw',
        'purple' => 'umrax',
        'orange' => 'zephyira',
        'teal' => 'aqualon',
    ];

    public const SEATS_BY_COUNT = [
        2 => ['red', 'yellow'],
        3 => ['red', 'green', 'yellow'],
        4 => ['red', 'green', 'blue', 'yellow'],
        5 => ['red', 'green', 'yellow', 'blue', 'purple'],
        6 => ['red', 'green', 'yellow', 'blue', 'purple', 'orange'],
        7 => ['red', 'green', 'yellow', 'blue', 'purple', 'orange', 'teal'],
    ];

    protected $fillable = [
        'code',
        'host_token',
        'max_players',
        'status',
        'starting_player_id',
        'started_at',
        'host_advantage',
        'match_state',
    ];

    protected function casts(): array
    {
        return [
            'max_players' => 'integer',
            'starting_player_id' => 'integer',
            'started_at' => 'datetime',
            'host_advantage' => 'boolean',
            'match_state' => 'array',
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
            'host_advantage' => $this->host_advantage,
            'status' => $this->status,
            'starting_player_id' => $this->starting_player_id,
            'started_at' => $this->started_at?->toIso8601String(),
            'match_state' => $this->match_state,
            'players' => $this->players->map(fn (RoomPlayer $player) => [
                'id' => $player->id,
                'name' => $player->name,
                'seat_color' => $player->seat_color,
                'character' => $player->character ?? ($player->seat_color ? (self::DEFAULT_CHARACTER_BY_COLOR[$player->seat_color] ?? 'ignivar') : null),
                'is_ready' => $player->is_ready,
                'is_host' => $player->is_host,
                'is_computer' => $player->is_computer,
            ])->values()->all(),
        ];
    }
}
