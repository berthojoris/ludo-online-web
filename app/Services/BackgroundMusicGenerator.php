<?php

namespace App\Services;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class BackgroundMusicGenerator
{
    public const SUPPORTED_FORMATS = ['mp3', 'pcm'];

    public const TRACK_ID = 'battle-arena';

    public const DIRECTORY = 'assets/music';

    public function defaultPrompt(): string
    {
        return 'Create an epic fantasy battle arena instrumental background music track for a competitive multiplayer monster board game. '
            .'Powerful tribal war drums, deep cinematic percussion, heroic orchestral brass, energetic rhythmic strings, subtle dark fantasy choir textures without vocals, and an atmosphere of warriors preparing for an epic battle. '
            .'Bold, thrilling, courageous, and highly motivating, with a steady driving rhythm at 115 BPM. '
            .'Maintain consistent energy throughout, with no long intro, no dramatic pauses, no sudden explosive transitions, and no ending climax. '
            .'Designed as seamless looping background music during gameplay. '
            .'Keep the arrangement balanced and leave sonic space for game sound effects, monster roars, dice rolls, and UI interactions. '
            .'Instrumental only, no singing, no spoken words. Target duration 90 seconds.';
    }

    /**
     * Current status of the gameplay background music file.
     *
     * @return array<string, mixed>
     */
    public function status(string $format = 'mp3'): array
    {
        $relativePath = self::DIRECTORY.'/'.self::TRACK_ID.'.'.$format;
        $fullPath = public_path($relativePath);
        $exists = File::exists($fullPath);

        return [
            'id' => self::TRACK_ID,
            'model' => (string) config('services.openrouter.audio_model'),
            'configured' => filled(config('services.openrouter.api_key')),
            'prompt' => $this->defaultPrompt(),
            'exists' => $exists,
            'url' => '/'.$relativePath,
            'size_bytes' => $exists ? File::size($fullPath) : null,
        ];
    }

    /**
     * Generate and persist the gameplay background music via OpenRouter.
     *
     * @return array<string, mixed>
     */
    public function generate(?string $customPrompt = null, string $format = 'mp3'): array
    {
        if (! in_array($format, self::SUPPORTED_FORMATS, true)) {
            throw new RuntimeException("Unsupported audio format '{$format}'.");
        }

        $apiKey = (string) config('services.openrouter.api_key');
        $model = (string) config('services.openrouter.audio_model');
        $baseUrl = rtrim((string) config('services.openrouter.base_url', 'https://openrouter.ai/api/v1'), '/');

        if ($apiKey === '') {
            throw new RuntimeException('OPENROUTER_API_KEY is not configured in .env.');
        }

        if ($model === '') {
            throw new RuntimeException('OPENROUTER_AUDIO_MODEL is not configured in .env.');
        }

        $prompt = trim((string) ($customPrompt ?? $this->defaultPrompt()));

        // A 90 second music track takes much longer to render than a 5 second SFX.
        $response = Http::timeout(300)
            ->connectTimeout(30)
            ->withHeaders([
                'Authorization' => 'Bearer '.$apiKey,
                'HTTP-Referer' => (string) config('app.url', 'http://localhost:8000'),
                'X-Title' => (string) config('app.name', 'Ludo Arena'),
            ])
            ->accept('*/*')
            ->post($baseUrl.'/audio/speech', [
                'model' => $model,
                'input' => $prompt,
                'response_format' => $format,
            ]);

        if (! $response->successful()) {
            $errorBody = $response->json('error.message') ?? $response->body();
            throw new RuntimeException(
                "OpenRouter background music generation failed (HTTP {$response->status()}): {$errorBody}"
            );
        }

        $binary = $response->body();

        if ($binary === '') {
            throw new RuntimeException('OpenRouter returned an empty audio payload for the background music.');
        }

        $contentType = strtolower((string) $response->header('Content-Type'));
        if (str_contains($contentType, 'application/json')) {
            throw new RuntimeException("OpenRouter returned JSON instead of audio: {$binary}");
        }

        $directory = public_path(self::DIRECTORY);
        File::ensureDirectoryExists($directory);

        $filename = self::TRACK_ID.'.'.$format;
        File::put($directory.DIRECTORY_SEPARATOR.$filename, $binary);

        return [
            'id' => self::TRACK_ID,
            'model' => $model,
            'format' => $format,
            'url' => '/'.self::DIRECTORY.'/'.$filename,
            'path' => 'public/'.self::DIRECTORY.'/'.$filename,
            'size_bytes' => strlen($binary),
            'prompt' => $prompt,
        ];
    }
}
