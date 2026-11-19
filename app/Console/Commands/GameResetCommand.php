<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class GameResetCommand extends Command
{
    /**
     * Tabel internal Laravel yang tidak ikut di-truncate.
     *
     * @var list<string>
     */
    protected const PRESERVED_TABLES = [
        'migrations',
    ];

    protected $signature = 'game:reset
        {--force : Jalankan tanpa konfirmasi di environment production}
        {--keep-users : Pertahankan tabel users (akun tidak ikut terhapus)}';

    protected $description = 'Truncate semua tabel database dan reset seluruh state game (rooms, players, chat, sesi, cache, antrean)';

    public function handle(): int
    {
        if (! $this->option('force')
            && $this->getLaravel()->environment('production')
            && ! $this->confirm('PRODUCTION: semua tabel akan di-truncate dan seluruh state game dihapus. Lanjutkan?')) {
            $this->info('Dibatalkan. Tidak ada yang dihapus.');

            return self::SUCCESS;
        }

        $preserved = self::PRESERVED_TABLES;
        if ($this->option('keep-users')) {
            $preserved[] = 'users';
        }

        $targets = array_values(array_diff(Schema::getTableListing(), $preserved));

        if ($targets === []) {
            $this->warn('Tidak ada tabel yang bisa di-truncate.');

            return self::SUCCESS;
        }

        $this->truncateTables($targets);
        $this->resetAutoIncrements($targets);
        $this->clearRuntimeState();

        $this->newLine();
        $this->info('Game kembali bersih.');
        $this->line(sprintf(
            'Truncate %d tabel: %s',
            count($targets),
            implode(', ', $targets),
        ));

        if ($this->option('keep-users')) {
            $this->line('Tabel users dipertahankan.');
        }

        return self::SUCCESS;
    }

    /**
     * @param  list<string>  $tables
     */
    protected function truncateTables(array $tables): void
    {
        $connection = DB::connection();
        $grammar = $connection->getQueryGrammar();
        $isSqlite = $connection->getDriverName() === 'sqlite';

        Schema::disableForeignKeyConstraints();

        try {
            foreach ($tables as $table) {
                try {
                    // SQLite tidak mendukung TRUNCATE; DELETE memakai grammar
                    // agar identifier di-quote sesuai driver.
                    if ($isSqlite) {
                        $connection->statement("DELETE FROM {$grammar->wrapTable($table)}");
                    } else {
                        $connection->statement("TRUNCATE TABLE {$grammar->wrapTable($table)}");
                    }

                    $this->line("Truncated: {$table}");
                } catch (\Throwable $e) {
                    $this->error("Gagal truncate {$table}: {$e->getMessage()}");
                }
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }
    }

    /**
     * Reset counter auto-increment agar ID kembali mulai dari 1.
     *
     * @param  list<string>  $tables
     */
    protected function resetAutoIncrements(array $tables): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            return; // TRUNCATE sudah me-reset AUTO_INCREMENT di MySQL/Postgres.
        }

        if (! Schema::hasTable('sqlite_sequence')) {
            return;
        }

        DB::table('sqlite_sequence')->whereIn('name', $tables)->delete();
    }

    /**
     * Bersihkan state game di luar tabel utama: cache (termasuk rate limiter),
     * sesi berbasis file, dan cache bootstrap (config/route/view/events).
     */
    protected function clearRuntimeState(): void
    {
        Cache::flush();
        $this->line('Cache store dibersihkan (termasuk rate limiter).');

        if (config('session.driver') === 'file') {
            foreach (glob(storage_path('framework/sessions/*')) ?: [] as $file) {
                if (is_file($file)) {
                    @unlink($file);
                }
            }

            $this->line('Sesi berbasis file dibersihkan.');
        } elseif (config('session.driver') === 'database') {
            $this->line('Sesi database di-truncate (semua login terhapus).');
        }

        Artisan::call('optimize:clear');
        $this->line('Cache bootstrap (config/route/view/event) dibersihkan.');
    }
}
