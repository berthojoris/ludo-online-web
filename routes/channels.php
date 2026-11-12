<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function (User $user, int $id) {
    return (int) $user->id === $id;
});

Broadcast::channel('user.{userId}', function (User $user, int $userId) {
    return (int) $user->id === $userId;
});

// Aktifkan setelah tabel matches dan match_players tersedia.
// Broadcast::channel('match.{matchId}', function (User $user, string $matchId) {
//     return $user->matchPlayers()->where('match_id', $matchId)->exists();
// });
