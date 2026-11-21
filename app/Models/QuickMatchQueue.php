<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuickMatchQueue extends Model
{
    /** Pool sizes Quick Match offers. */
    public const POOLS = [2, 4];

    public const WAITING = 'waiting';

    public const MATCHED = 'matched';

    /**
     * A waiting entry whose stamp is older than this is no longer eligible
     * for pairing (the searching page polls every few seconds and refreshes
     * the stamp, so this only skips browsers that stopped polling).
     */
    public const ELIGIBLE_SECONDS = 60;

    /** A waiting entry older than this is swept as abandoned. */
    public const STALE_SECONDS = 120;

    protected $table = 'quick_match_queue';

    protected $fillable = [
        'players',
        'player_token',
        'user_id',
        'name',
        'status',
        'room_code',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'players' => 'integer',
            'status' => 'string',
            'last_seen_at' => 'datetime',
        ];
    }
}
