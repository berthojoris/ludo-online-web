<?php

use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function (User $user, int $id) {
    return (int) $user->id === $id;
});

Broadcast::channel('user.{userId}', function (User $user, int $userId) {
    return (int) $user->id === $userId;
});

// Defense in depth for the stock user-only broadcast endpoint. Guest-aware room
// authorization is the broadcasting.room-auth route in routes/web.php.
Broadcast::channel('room.{code}', function (User $user, string $code) {
    return Room::where('code', strtoupper($code))
        ->whereHas('players', fn ($query) => $query->where('user_id', $user->id))
        ->exists();
});

// Aktifkan setelah tabel matches dan match_players tersedia.
// Broadcast::channel('match.{matchId}', function (User $user, string $matchId) {
//     return $user->matchPlayers()->where('match_id', $matchId)->exists();
// });
