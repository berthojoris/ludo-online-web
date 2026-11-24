<?php

namespace App\Services;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class SpinWheelSoundGenerator
{
    public const SUPPORTED_FORMATS = ['mp3', 'pcm'];

    public const DIRECTORY = 'assets/sfx/spin-wheel';

    /**
     * Spin-the-wheel sound effects: one loop for the spinning phase and one
     * sting per result the wheel can land on.
     *
     * @return array<string, array{
     *     id: string,
     *     name: string,
     *     trigger: string,
     *     prompt: string
     * }>
     */
    public function definitions(): array
    {
        return [
            'spin-loop' => [
                'id' => 'spin-loop',
                'name' => 'Wheel Spin Loop',
                'trigger' => 'Plays while the wheel is still spinning.',
                'prompt' => implode("\n\n", [
                    'Generate a seamless looping tick sound effect for a mobile spin-the-wheel prize game.',
                    'Crisp plastic pointer clicks against evenly spaced metal pegs, one tick roughly every 0.14 seconds, dry and close-up, over a faint wooden wheel rumble and a soft airy whoosh.',
                    'Steady tempo and constant energy: no acceleration, no deceleration, no fade in, no fade out, so it loops perfectly.',
                    "Duration: 4 seconds.\nNo melody, no speech, no singing, no music.",
                ]),
            ],
            'spin-win' => [
                'id' => 'spin-win',
                'name' => 'Wheel Stop Win',
                'trigger' => 'Plays the moment the wheel stops on a prize.',
                'prompt' => implode("\n\n", [
                    'Generate a short, punchy prize-wheel win sting for a mobile board game.',
                    'A bright rising orchestral brass fanfare lands on one decisive wheel-stop click, then shimmering glockenspiel bells, a sparkling coin-and-gem chime cascade, and a warm reverb tail.',
                    'Joyful, triumphant, energetic, and premium sounding, with a clean modern game-show feel.',
                    "Duration: 4 seconds.\nInstrumental only, no speech, no singing, no full song, no long intro. Start immediately with no silence.",
                ]),
            ],
            'spin-jackpot' => [
                'id' => 'spin-jackpot',
                'name' => 'Wheel Stop Jackpot',
                'trigger' => 'Plays when the wheel stops on the grand prize.',
                'prompt' => implode("\n\n", [
                    'Generate an epic jackpot reveal sound effect for a mobile spin-the-wheel game.',
                    'A massive cinematic sub-bass impact and a thunderous taiko hit, then triumphant orchestral brass with choir-like pads but no vocals, a sparkling harp and bell glissando, and a shimmering coin shower tail.',
                    'Grand, heroic, and jaw-dropping, like landing on the biggest prize on the wheel.',
                    "Duration: 5 seconds.\nInstrumental only, no speech, no singing, no full song. Start immediately with no silence.",
                ]),
            ],
            'spin-lose' => [
                'id' => 'spin-lose',
                'name' => 'Wheel Stop Try Again',
                'trigger' => 'Plays when the wheel stops on a losing or empty slice.',
                'prompt' => implode("\n\n", [
                    'Generate a short, playful losing sting for a mobile spin-the-wheel game.',
                    'A soft wheel-stop click, then a comedic muted trombone "wah wah wah" descending phrase and a gentle low thud, with a light room reverb.',
                    'Cheerful and friendly rather than harsh, so players smile instead of feeling punished.',
                    "Duration: 3 seconds.\nInstrumental only, no speech, no singing, no full song. Start immediately with no silence.",
                ]),
            ],
        ];
    }

    /**
     * All spin-wheel tracks with their prompt and current generated file status.
     *
     * @return list<array<string, mixed>>
     */
    public function catalog(): array
    {
        $items = [];

        foreach ($this->definitions() as $trackId => $definition) {
            $relativePath = self::DIRECTORY."/{$trackId}.mp3";
            $fullPath = public_path($relativePath);
            $exists = File::exists($fullPath);

            $items[] = [
                ...$definition,
                'exists' => $exists,
                'url' => '/'.$relativePath,
                'size_bytes' => $exists ? File::size($fullPath) : null,
            ];
        }

        return $items;
    }

    /**
     * Current status of every spin-wheel sound effect.
     *
     * @return array<string, mixed>
     */
    public function status(): array
    {
        return [
            'model' => (string) config('services.openrouter.audio_model'),
            'configured' => filled(config('services.openrouter.api_key')),
            'directory' => self::DIRECTORY,
            'tracks' => $this->catalog(),
        ];
    }

    /**
     * Generate and persist one spin-wheel sound effect via OpenRouter.
     *
     * @return array<string, mixed>
     */
    public function generate(string $trackId, ?string $customPrompt = null, string $format = 'mp3'): array
    {
        $definitions = $this->definitions();

        if (! isset($definitions[$trackId])) {
            throw new RuntimeException("Unknown spin-wheel track '{$trackId}'.");
        }

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

        $definition = $definitions[$trackId];
        $prompt = trim((string) ($customPrompt ?? $definition['prompt']));

        $response = Http::timeout(120)
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
                "OpenRouter spin-wheel generation failed for '{$trackId}' (HTTP {$response->status()}): {$errorBody}"
            );
        }

        $binary = $response->body();

        if ($binary === '') {
            throw new RuntimeException("OpenRouter returned an empty audio payload for '{$trackId}'.");
        }

        $contentType = strtolower((string) $response->header('Content-Type'));
        if (str_contains($contentType, 'application/json')) {
            throw new RuntimeException(
                "OpenRouter returned JSON instead of audio for '{$trackId}': {$binary}"
            );
        }

        $directory = public_path(self::DIRECTORY);
        File::ensureDirectoryExists($directory);

        $filename = "{$trackId}.{$format}";
        File::put($directory.DIRECTORY_SEPARATOR.$filename, $binary);

        return [
            'track' => $trackId,
            'name' => $definition['name'],
            'trigger' => $definition['trigger'],
            'model' => $model,
            'format' => $format,
            'url' => '/'.self::DIRECTORY."/{$filename}",
            'path' => 'public/'.self::DIRECTORY."/{$filename}",
            'size_bytes' => strlen($binary),
            'prompt' => $prompt,
        ];
    }

    /**
     * Generate every spin-wheel track (or a requested subset).
     *
     * @param  list<string>|null  $trackIds
     * @return array{
     *     model: string,
     *     format: string,
     *     generated_count: int,
     *     failed_count: int,
     *     results: list<array<string, mixed>>,
     *     errors: list<array{track: string, message: string}>
     * }
     */
    public function generateBatch(?array $trackIds = null, string $format = 'mp3'): array
    {
        $targets = $trackIds !== null && $trackIds !== []
            ? $trackIds
            : array_keys($this->definitions());

        $results = [];
        $errors = [];

        foreach ($targets as $trackId) {
            try {
                $results[] = $this->generate($trackId, null, $format);
            } catch (RuntimeException $exception) {
                $errors[] = [
                    'track' => $trackId,
                    'message' => $exception->getMessage(),
                ];
            }
        }

        return [
            'model' => (string) config('services.openrouter.audio_model'),
            'format' => $format,
            'generated_count' => count($results),
            'failed_count' => count($errors),
            'results' => $results,
            'errors' => $errors,
        ];
    }
}
