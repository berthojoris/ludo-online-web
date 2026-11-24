<?php

use App\Services\CharacterSoundGenerator;
use App\Services\SpinWheelSoundGenerator;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('sfx:generate-characters {character? : Optional single character ID}', function (CharacterSoundGenerator $generator) {
    $character = $this->argument('character');

    if ($character) {
        $result = $generator->generateForCharacter((string) $character);
        $this->info("Generated {$result['path']} ({$result['size_bytes']} bytes)");

        return self::SUCCESS;
    }

    $summary = $generator->generateBatch();

    foreach ($summary['results'] as $item) {
        $this->info("Generated {$item['path']} ({$item['size_bytes']} bytes)");
    }

    foreach ($summary['errors'] as $error) {
        $this->error("Failed {$error['character']}: {$error['message']}");
    }

    return $summary['failed_count'] === 0 ? self::SUCCESS : self::FAILURE;
})->purpose('Generate 7 character sound effects via OpenRouter');

Artisan::command('sfx:generate-spin-wheel {track? : Optional spin-wheel track ID}', function (SpinWheelSoundGenerator $generator) {
    $track = $this->argument('track');

    if ($track) {
        $result = $generator->generate((string) $track);
        $this->info("Generated {$result['path']} ({$result['size_bytes']} bytes)");

        return self::SUCCESS;
    }

    $summary = $generator->generateBatch();

    foreach ($summary['results'] as $item) {
        $this->info("Generated {$item['path']} ({$item['size_bytes']} bytes)");
    }

    foreach ($summary['errors'] as $error) {
        $this->error("Failed {$error['track']}: {$error['message']}");
    }

    return $summary['failed_count'] === 0 ? self::SUCCESS : self::FAILURE;
})->purpose('Generate spin-the-wheel sound effects via OpenRouter');
