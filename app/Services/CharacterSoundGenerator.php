<?php

namespace App\Services;

use App\Models\Room;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class CharacterSoundGenerator
{
    public const SUPPORTED_FORMATS = ['mp3', 'pcm'];

    /**
     * Character definitions and tailored sound-effect prompts matching the 7 game characters.
     *
     * @return array<string, array{
     *     id: string,
     *     name: string,
     *     element: string,
     *     type: string,
     *     skill: string,
     *     prompt: string
     * }>
     */
    public function definitions(): array
    {
        return [
            'ignivar' => [
                'id' => 'ignivar',
                'name' => 'Ignivar',
                'element' => 'Api',
                'type' => 'Mythical Fire Dragon',
                'skill' => 'Amukan Naga Api',
                'prompt' => implode("\n\n", [
                    'Generate a terrifying, earth-shaking roar of a gigantic mythical fire dragon.',
                    'Extremely deep, guttural, and aggressive, layered with crackling inferno flames and a fierce volcanic whoosh ending.',
                    "Duration: 5 seconds.\nNo speech, no music, no mechanical sounds.\nOnly the fire dragon's roar and flames.",
                ]),
            ],
            'frost_claw' => [
                'id' => 'frost_claw',
                'name' => 'Frostclaw',
                'element' => 'Es',
                'type' => 'Mythical Ice Wolf',
                'skill' => 'Cakar Es Abadi',
                'prompt' => implode("\n\n", [
                    'Generate a chilling, fierce howl and snarl of a gigantic mythical ice wolf.',
                    'Sharp, resonant, and predatory, layered with howling arctic blizzard wind and shattering crystal ice shards at the ending.',
                    "Duration: 5 seconds.\nNo speech, no music, no mechanical sounds.\nOnly the ice wolf's howl and glacial frost sounds.",
                ]),
            ],
            'solgarde' => [
                'id' => 'solgarde',
                'name' => 'Solgarde',
                'element' => 'Cahaya',
                'type' => 'Mythical Solar Lion',
                'skill' => 'Auman Surya',
                'prompt' => implode("\n\n", [
                    'Generate a terrifying roar of a gigantic mythical solar lion monster.',
                    'Extremely deep, powerful, aggressive, with heavy bass resonance and a thunderous ending.',
                    "Duration: 5 seconds.\nNo speech, no music, no mechanical sounds.\nOnly the monster lion's roar.",
                ]),
            ],
            'verdantor' => [
                'id' => 'verdantor',
                'name' => 'Verdantor',
                'element' => 'Alam',
                'type' => 'Ancient Forest Guardian Colossus',
                'skill' => 'Murka Rimba',
                'prompt' => implode("\n\n", [
                    'Generate a massive, primal bellow of a gigantic ancient forest guardian colossus.',
                    'Deep resonant wooden groans, heavy ground-shaking stomps, rustling canopy leaves, and a thunderous earthen rumble ending.',
                    "Duration: 5 seconds.\nNo speech, no music, no mechanical sounds.\nOnly the forest guardian's roar and nature sounds.",
                ]),
            ],
            'umrax' => [
                'id' => 'umrax',
                'name' => 'Umrax',
                'element' => 'Bayangan',
                'type' => 'Mythical Shadow Panther',
                'skill' => 'Terkaman Bayangan',
                'prompt' => implode("\n\n", [
                    'Generate a sinister, razor-sharp screech and predatory growl of a mythical shadow panther monster.',
                    'Eerie, ghostly, and swift, with dark echoing wind whooshes, sub-bass resonance, and a sudden ferocious pounce ending.',
                    "Duration: 5 seconds.\nNo speech, no music, no mechanical sounds.\nOnly the shadow beast's growl and dark wind.",
                ]),
            ],
            'aqualon' => [
                'id' => 'aqualon',
                'name' => 'Aqualon',
                'element' => 'Samudra',
                'type' => 'Deep-Sea Leviathan',
                'skill' => 'Gelombang Pasang',
                'prompt' => implode("\n\n", [
                    'Generate a colossal, echoing underwater roar of a gigantic deep-sea leviathan monster.',
                    'Heavy sub-bass abyssal groan, surging ocean tidal waves, powerful water blasts, and a crashing tsunami wave ending.',
                    "Duration: 5 seconds.\nNo speech, no music, no mechanical sounds.\nOnly the leviathan's roar and crashing ocean water.",
                ]),
            ],
            'zephyira' => [
                'id' => 'zephyira',
                'name' => 'Zephyira',
                'element' => 'Angin',
                'type' => 'Mythical Sky Griffin',
                'skill' => 'Badai Langit',
                'prompt' => implode("\n\n", [
                    'Generate a piercing, regal shriek and battle cry of a gigantic mythical sky griffin.',
                    'Sharp eagle-like screech blended with a fierce lion snarl, powerful wingbeats, and a roaring tempest wind gust ending.',
                    "Duration: 5 seconds.\nNo speech, no music, no mechanical sounds.\nOnly the griffin's cry and storm wind.",
                ]),
            ],
        ];
    }

    /**
     * List all 7 characters along with their prompt and current generated file status.
     *
     * @return list<array<string, mixed>>
     */
    public function catalog(): array
    {
        $definitions = $this->definitions();
        $items = [];

        foreach (Room::ALL_CHARACTERS as $characterId) {
            $definition = $definitions[$characterId];
            $relativePath = "assets/sfx/{$characterId}.mp3";
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
     * Generate and persist the sound effect for a single character via OpenRouter.
     *
     * @return array<string, mixed>
     */
    public function generateForCharacter(
        string $characterId,
        ?string $customPrompt = null,
        string $format = 'mp3',
    ): array {
        $definitions = $this->definitions();

        if (! isset($definitions[$characterId])) {
            throw new RuntimeException("Unknown character '{$characterId}'.");
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

        $definition = $definitions[$characterId];
        $prompt = trim((string) ($customPrompt ?? $definition['prompt']));

        $response = Http::timeout(90)
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
                "OpenRouter audio generation failed for '{$characterId}' (HTTP {$response->status()}): {$errorBody}"
            );
        }

        $binary = $response->body();

        if ($binary === '') {
            throw new RuntimeException("OpenRouter returned an empty audio payload for '{$characterId}'.");
        }

        $contentType = strtolower((string) $response->header('Content-Type'));
        if (str_contains($contentType, 'application/json')) {
            throw new RuntimeException(
                "OpenRouter returned JSON instead of audio for '{$characterId}': {$binary}"
            );
        }

        $directory = public_path('assets/sfx');
        File::ensureDirectoryExists($directory);

        $filename = "{$characterId}.{$format}";
        $fullPath = $directory.DIRECTORY_SEPARATOR.$filename;
        File::put($fullPath, $binary);

        return [
            'character' => $characterId,
            'name' => $definition['name'],
            'element' => $definition['element'],
            'type' => $definition['type'],
            'skill' => $definition['skill'],
            'model' => $model,
            'format' => $format,
            'url' => "/assets/sfx/{$filename}",
            'path' => "public/assets/sfx/{$filename}",
            'size_bytes' => strlen($binary),
            'prompt' => $prompt,
        ];
    }

    /**
     * Generate sound effects for all 7 characters (or a specified subset).
     *
     * @param  list<string>|null  $characterIds
     * @return array{
     *     model: string,
     *     format: string,
     *     generated_count: int,
     *     failed_count: int,
     *     results: list<array<string, mixed>>,
     *     errors: list<array{character: string, message: string}>
     * }
     */
    public function generateBatch(?array $characterIds = null, string $format = 'mp3'): array
    {
        $targets = $characterIds !== null && $characterIds !== []
            ? $characterIds
            : Room::ALL_CHARACTERS;

        $results = [];
        $errors = [];

        foreach ($targets as $characterId) {
            try {
                $results[] = $this->generateForCharacter($characterId, null, $format);
            } catch (RuntimeException $exception) {
                $errors[] = [
                    'character' => $characterId,
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
