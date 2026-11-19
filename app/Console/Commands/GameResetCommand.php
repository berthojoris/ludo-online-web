<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;

class GameResetCommand extends Command
{
    protected $signature = 'game:reset
        {--force : Jalankan tanpa konfirmasi di environment production}';

    protected $description = 'Hapus semua tabel database (migrate:fresh), buat ulang dari migrasi, dan reset seluruh state game (cache, sesi, antrean)';

    public function handle(): int
    {
        if (! $this->option('force')
            && $this->getLaravel()->environment('production')
            && ! $this->confirm('PRODUCTION: semua tabel akan dihapus dan dibuat ulang, seluruh data (termasuk akun users) hilang. Lanjutkan?')) {
            $this->info('Dibatalkan. Tidak ada yang dihapus.');

            return self::SUCCESS;
        }

        $this->dropAllTablesAndMigrate();
        $this->clearRuntimeState();

        $this->newLine();
        $this->info('Game kembali bersih.');
        $this->line('Semua tabel dihapus dan dibuat ulang dari migrasi.');

        return self::SUCCESS;
    }

    /**
     * Hapus semua tabel di database (termasuk migrations dan users) lalu
     * jalankan seluruh migrasi dari awal, sehingga struktur database
     * konsisten kembali dengan file migrasi terbaru.
     */
    protected function dropAllTablesAndMigrate(): void
    {
        $this->info('Menghapus semua tabel dan menjalankan migrasi ulang...');

        Artisan::call('migrate:fresh', ['--force' => true]);
        $this->line(trim(Artisan::output()));
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
        }

        Artisan::call('optimize:clear');
        $this->line('Cache bootstrap (config/route/view/event) dibersihkan.');
    }
}
