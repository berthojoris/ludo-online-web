<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class RoomPlayer extends Model
{
    protected static function booted(): void
    {
        static::creating(function (RoomPlayer $player) {
            if (! is_string($player->resume_token) || $player->resume_token === '') {
                $player->resume_token = Str::random(40);
            }
        });
    }

    protected function name(): Attribute
    {
        return Attribute::get(fn (string $value, array $attributes) => $value === 'Tuan Rumah' && ($attributes['is_host'] ?? false) && empty($attributes['user_id'])
                ? 'Host'
                : $value
        );
    }

    protected $fillable = [
        'room_id',
        'player_token',
        'resume_token',
        'user_id',
        'name',
        'seat_color',
        'character',
        'is_ready',
        'is_host',
    ];

    protected function casts(): array
    {
        return [
            'is_ready' => 'boolean',
            'is_host' => 'boolean',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
