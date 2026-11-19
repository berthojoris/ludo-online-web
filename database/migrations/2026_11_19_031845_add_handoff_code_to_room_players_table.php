<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('room_players', function (Blueprint $table) {
            $table->string('handoff_code_hash', 64)->nullable()->after('resume_token');
            $table->timestamp('handoff_expires_at')->nullable()->after('handoff_code_hash');
            $table->index('handoff_code_hash');
        });
    }

    public function down(): void
    {
        Schema::table('room_players', function (Blueprint $table) {
            $table->dropIndex(['handoff_code_hash']);
            $table->dropColumn(['handoff_code_hash', 'handoff_expires_at']);
        });
    }
};
