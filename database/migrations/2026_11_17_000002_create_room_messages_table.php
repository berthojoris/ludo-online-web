<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('room_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_player_id')->constrained()->cascadeOnDelete();
            $table->string('name', 32);
            $table->string('seat_color', 16);
            $table->string('message', 200);
            $table->timestamps();
            $table->index(['room_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_messages');
    }
};
