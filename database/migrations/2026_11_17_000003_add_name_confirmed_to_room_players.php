<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('room_players', function (Blueprint $table) {
            $table->boolean('name_confirmed')->default(false);
        });

        DB::table('room_players')
            ->whereRaw("LOWER(TRIM(name)) NOT IN (?, ?, ?, ?)", ['', 'host', 'tamu', 'tuan rumah'])
            ->update(['name_confirmed' => true]);
    }

    public function down(): void
    {
        Schema::table('room_players', function (Blueprint $table) {
            $table->dropColumn('name_confirmed');
        });
    }
};
