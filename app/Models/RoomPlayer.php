<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomPlayer extends Model
{
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
        'user_id',
        'name',
        'seat_color',
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
