<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('code', 6)->unique();
            $table->string('host_token', 64);
            $table->unsignedTinyInteger('max_players')->default(4);
            $table->string('status', 20)->default('waiting');
            $table->timestamp('started_at')->nullable();
            $table->timestamps();
        });

        Schema::create('room_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained('rooms')->cascadeOnDelete();
            $table->string('player_token', 64);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name', 32);
            $table->string('seat_color', 16)->nullable();
            $table->boolean('is_ready')->default(false);
            $table->boolean('is_host')->default(false);
            $table->timestamps();

            $table->unique(['room_id', 'player_token']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_players');
        Schema::dropIfExists('rooms');
    }
};
