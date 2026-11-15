<?php

use App\Models\RoomPlayer;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('room_players', function (Blueprint $table) {
            $table->string('resume_token', 64)->nullable()->after('player_token');
            $table->index('resume_token');
        });

        // Backfill so players already sitting in a room can still be re-attached
        // after their browser session expires.
        RoomPlayer::query()
            ->whereNull('resume_token')
            ->orderBy('id')
            ->each(function (RoomPlayer $player) {
                $player->forceFill(['resume_token' => Str::random(40)])->saveQuietly();
            });
    }

    public function down(): void
    {
        Schema::table('room_players', function (Blueprint $table) {
            $table->dropIndex(['resume_token']);
            $table->dropColumn('resume_token');
        });
    }
};
