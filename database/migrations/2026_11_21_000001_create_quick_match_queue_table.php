<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quick_match_queue', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('players');
            $table->string('player_token', 64);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name', 32);
            $table->string('status', 16)->default('waiting');
            $table->string('room_code', 6)->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            // One live entry per status per browser: joining twice replaces
            // the waiting row, and pairing flips waiting into exactly one
            // matched row.
            $table->unique(['player_token', 'status']);
            $table->index(['players', 'status', 'last_seen_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quick_match_queue');
    }
};
