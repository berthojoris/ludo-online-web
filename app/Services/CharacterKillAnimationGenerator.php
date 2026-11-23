<?php

namespace App\Services;

use App\Models\Room;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use RuntimeException;

class CharacterKillAnimationGenerator
{
    private const OUTPUT_DIRECTORY = 'assets/kill';

    /**
     * Character definitions, visual identity notes, and tailored kill-animation prompts
     * matching the 7 existing character illustrations in public/assets/char_*.webp.
     *
     * @return array<string, array{
     *     id: string,
     *     name: string,
     *     element: string,
     *     type: string,
     *     skill: string,
     *     reference_image: string,
     *     prompt: string
     * }>
     */
    public function definitions(): array
    {
        $sharedDirection = implode(' ', [
            'Create a smooth, dynamic, high-impact looping animated character attack/kill celebration sequence',
            'based strictly on the exact character design, proportions, colors, markings, armor, and stylized fantasy game-art style in the reference image.',
            'Keep the background 100% transparent (alpha channel, no solid background, no stage floor, no text, no UI).',
            'Center the full character cleanly inside the 1:1 square frame with generous padding so limbs, wings, and elemental effects never clip at the edges.',
            'Fluid 60fps-feel motion with clear anticipation, explosive peak action, and smooth follow-through.',
        ]);

        return [
            'ignivar' => [
                'id' => 'ignivar',
                'name' => 'Ignivar',
                'element' => 'Api',
                'type' => 'Mythical Fire Dragon',
                'skill' => 'Amukan Naga Api',
                'reference_image' => 'assets/char_ignivar.webp',
                'prompt' => implode("\n\n", [
                    $sharedDirection,
                    'Character details to preserve: crimson-red muscular fire dragon with cream plated underbelly, two curved golden-amber horns, glowing yellow-orange eyes, blazing flame mane, large red bat-like wings with golden wing-tip claws and glowing flame patterns on the wing membranes, flame markings on shoulders/forearms/thighs, sharp cream claws, and a flaming tail tip.',
                    'Kill animation motion ("Amukan Naga Api"): Ignivar rears back briefly, then lunges forward with a fierce wide-jawed roar, spreads its blazing wings wide, slams its clawed forearm forward, and unleashes swirling golden-crimson fire embers and inferno flames whipping around its body.',
                ]),
            ],
            'frost_claw' => [
                'id' => 'frost_claw',
                'name' => 'Frostclaw',
                'element' => 'Es',
                'type' => 'Mythical Ice Wolf',
                'skill' => 'Cakar Es Abadi',
                'reference_image' => 'assets/char_frost_claw.webp',
                'prompt' => implode("\n\n", [
                    $sharedDirection,
                    'Character details to preserve: snow-white muscular dire wolf with jagged glowing cyan-blue ice crystal spikes on its forehead, neck mane, shoulders, forearms, and back, glowing ice-blue eyes, blue frost markings on cheeks and thighs, dark blue-tipped ears, sharp icy-blue claws, fluffy white-and-blue tail with ice crest, and floating snowflakes/ice shards.',
                    'Kill animation motion ("Cakar Es Abadi"): Frostclaw crouches low and pounces forward with a ferocious slash of its giant glowing cyan-blue claws, exhaling a freezing burst of arctic frost mist while sharp ice shards and snowflakes burst outward and its crystal spikes gleam.',
                ]),
            ],
            'solgarde' => [
                'id' => 'solgarde',
                'name' => 'Solgarde',
                'element' => 'Cahaya',
                'type' => 'Mythical Solar Lion',
                'skill' => 'Auman Surya',
                'reference_image' => 'assets/char_solgarde.webp',
                'prompt' => implode("\n\n", [
                    $sharedDirection,
                    'Character details to preserve: regal golden-yellow and cream-white solar lion with a flowing radiant golden mane, a golden forehead crown with a glowing diamond gem, ornate golden chest armor with a blazing sun emblem, golden shoulder pauldrons and forearm/ankle bracers with diamond gems, golden claws, glowing amber eyes, and a fiery golden tail tip.',
                    'Kill animation motion ("Auman Surya"): Solgarde lifts its head and unleashes a triumphant solar roar as its chest sun-emblem blazes with radiant golden light, sending pulsing golden light ribbons and four-point starlight sparkles swirling around its rippling mane.',
                ]),
            ],
            'verdantor' => [
                'id' => 'verdantor',
                'name' => 'Verdantor',
                'element' => 'Alam',
                'type' => 'Ancient Forest Guardian Colossus',
                'skill' => 'Murka Rimba',
                'reference_image' => 'assets/char_verdantor.webp',
                'prompt' => implode("\n\n", [
                    $sharedDirection,
                    'Character details to preserve: emerald-green muscular forest guardian beast with glowing lime-green eyes, leafy green mane, forehead emerald diamond gem, massive branching wooden antlers wrapped in glowing green vines and leaves, carved wooden chest armor with a bright emerald gem, wooden forearm/shoulder/leg guards with glowing spiral runes, cream fur/fangs, sharp claws, and a bushy leaf-layered tail.',
                    'Kill animation motion ("Murka Rimba"): Verdantor stomps powerfully forward and roars as its wooden armor runes and chest emerald flash bright lime-green, summoning a swirling vortex of glowing vines and wind-swept forest leaves around its antlers and body.',
                ]),
            ],
            'umrax' => [
                'id' => 'umrax',
                'name' => 'Umrax',
                'element' => 'Bayangan',
                'type' => 'Mythical Shadow Panther',
                'skill' => 'Terkaman Bayangan',
                'reference_image' => 'assets/char_umrax.webp',
                'prompt' => implode("\n\n", [
                    $sharedDirection,
                    'Character details to preserve: dark obsidian-purple muscular winged panther with glowing neon-magenta/violet eyes, curved purple-banded horns, purple forehead crystal, white whiskers and sharp fangs, dark purple spiked mane, bat-like shadow wings with glowing violet edges, glowing magenta tribal markings on shoulders and thighs, lavender-purple chest scales, sharp pale claws, and a shadowy flame-tipped tail.',
                    'Kill animation motion ("Terkaman Bayangan"): Umrax coils into shadow and pounces swiftly forward, flaring its dark wings wide and slashing with glowing violet-aura claws while dark-violet shadow wisps and magenta energy crescents erupt around it.',
                ]),
            ],
            'aqualon' => [
                'id' => 'aqualon',
                'name' => 'Aqualon',
                'element' => 'Samudra',
                'type' => 'Deep-Sea Leviathan',
                'skill' => 'Gelombang Pasang',
                'reference_image' => 'assets/char_aqualon.webp',
                'prompt' => implode("\n\n", [
                    $sharedDirection,
                    'Character details to preserve: deep-cobalt-blue serpentine sea leviathan with a segmented white-silver armored belly, translucent glowing cyan fins along its head, spine, forearms, and twin-lobed tail, glowing aqua-cyan eyes, sharp white teeth, cyan tribal wave markings on its brow and shoulders, sharp white claws, and surging ocean water splashes.',
                    'Kill animation motion ("Gelombang Pasang"): Aqualon coils and surges upward through crashing ocean waves, thrashing its glowing cyan fins and sweeping its clawed arms forward as high-pressure water blasts and foaming droplets erupt around it.',
                ]),
            ],
            'zephyira' => [
                'id' => 'zephyira',
                'name' => 'Zephyira',
                'element' => 'Angin',
                'type' => 'Mythical Sky Griffin',
                'skill' => 'Badai Langit',
                'reference_image' => 'assets/char_zephyira.webp',
                'prompt' => implode("\n\n", [
                    $sharedDirection,
                    'Character details to preserve: pure white-and-sky-blue mythical griffin with large spread feathered wings (white upper feathers transitioning to bright azure-blue tips), flowing cyan-blue head crest feathers, golden-yellow beak, glowing blue eyes, ornate golden chest collar with a blue diamond gem, golden forearm and ankle bracers with blue gems, golden front eagle-talons with dark blue claws, white hind lion-paws, sky-blue thigh markings, and flowing azure tail feathers.',
                    'Kill animation motion ("Badai Langit"): Zephyira beats its massive azure-tipped wings powerfully, swooping forward with golden talons extended and beak open in a fierce battle cry as swirling pale-blue tempest wind gusts and floating feathers whip around it.',
                ]),
            ],
        ];
    }

    /**
     * List all 7 characters with their prompt, reference image, and generated animated WebP status.
     *
     * @return list<array<string, mixed>>
     */
    public function catalog(): array
    {
        $definitions = $this->definitions();
        $items = [];

        foreach (Room::ALL_CHARACTERS as $characterId) {
            $definition = $definitions[$characterId];
            $relativePath = self::OUTPUT_DIRECTORY."/kill_{$characterId}.webp";
            $fullPath = public_path($relativePath);
            $exists = File::exists($fullPath);

            $items[] = [
                ...$definition,
                'reference_url' => '/'.$definition['reference_image'],
                'exists' => $exists,
                'url' => '/'.$relativePath,
                'size_bytes' => $exists ? File::size($fullPath) : null,
            ];
        }

        return $items;
    }

    /**
     * Generate and persist the animated WebP kill animation for a single character via OpenRouter.
     *
     * @return array<string, mixed>
     */
    public function generateForCharacter(string $characterId, ?string $customPrompt = null): array
    {
        $definitions = $this->definitions();

        if (! isset($definitions[$characterId])) {
            throw new RuntimeException("Unknown character '{$characterId}'.");
        }

        $apiKey = (string) config('services.openrouter.api_key');
        $model = (string) config('services.openrouter.image_model', 'openai/gpt-image-2.6-sunburst');
        $baseUrl = rtrim((string) config('services.openrouter.base_url', 'https://openrouter.ai/api/v1'), '/');

        if ($apiKey === '') {
            throw new RuntimeException('OPENROUTER_API_KEY is not configured in .env.');
        }

        if ($model === '') {
            throw new RuntimeException('OPENROUTER_IMAGE_MODEL is not configured in .env.');
        }

        $definition = $definitions[$characterId];
        $prompt = trim((string) ($customPrompt ?? $definition['prompt']));
        $referenceDataUrl = $this->encodeReferenceImage($definition['reference_image']);

        $payload = [
            'model' => $model,
            'prompt' => $prompt,
            'aspect_ratio' => '1:1',
            'output_format' => 'gif',
            'background' => 'transparent',
            'quality' => 'high',
        ];

        if ($referenceDataUrl !== null) {
            $payload['input_references'] = [
                [
                    'type' => 'image_url',
                    'image_url' => [
                        'url' => $referenceDataUrl,
                    ],
                ],
            ];
        }

        $response = Http::timeout(180)
            ->withHeaders([
                'Authorization' => 'Bearer '.$apiKey,
                'HTTP-Referer' => (string) config('app.url', 'http://localhost:8000'),
                'X-Title' => (string) config('app.name', 'Ludo Arena'),
            ])
            ->acceptJson()
            ->post($baseUrl.'/images', $payload);

        if (! $response->successful()) {
            $errorBody = $response->json('error.message') ?? $response->body();
            throw new RuntimeException(
                "OpenRouter image generation failed for '{$characterId}' (HTTP {$response->status()}): {$errorBody}"
            );
        }

        $rawBinary = $this->extractImageBinary($response->json(), $characterId);

        $directory = public_path(self::OUTPUT_DIRECTORY);
        File::ensureDirectoryExists($directory);

        $filename = "kill_{$characterId}.webp";
        $outputPath = $directory.DIRECTORY_SEPARATOR.$filename;

        $this->persistAsAnimatedWebp($rawBinary, $outputPath, $characterId);

        return [
            'character' => $characterId,
            'name' => $definition['name'],
            'element' => $definition['element'],
            'type' => $definition['type'],
            'skill' => $definition['skill'],
            'model' => $model,
            'format' => 'webp',
            'url' => '/'.self::OUTPUT_DIRECTORY."/{$filename}",
            'path' => 'public/'.self::OUTPUT_DIRECTORY."/{$filename}",
            'size_bytes' => File::size($outputPath),
            'prompt' => $prompt,
        ];
    }

    /**
     * Generate animated kill WebPs for all 7 characters (or a specified subset).
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
    public function generateBatch(?array $characterIds = null): array
    {
        $targets = $characterIds !== null && $characterIds !== []
            ? $characterIds
            : Room::ALL_CHARACTERS;

        $results = [];
        $errors = [];

        foreach ($targets as $characterId) {
            try {
                $results[] = $this->generateForCharacter($characterId);
            } catch (RuntimeException $exception) {
                $errors[] = [
                    'character' => $characterId,
                    'message' => $exception->getMessage(),
                ];
            }
        }

        return [
            'model' => (string) config('services.openrouter.image_model', 'openai/gpt-image-2.6-sunburst'),
            'format' => 'webp',
            'generated_count' => count($results),
            'failed_count' => count($errors),
            'results' => $results,
            'errors' => $errors,
        ];
    }

    private function encodeReferenceImage(string $relativePath): ?string
    {
        $fullPath = public_path($relativePath);

        if (! File::exists($fullPath)) {
            return null;
        }

        $bytes = File::get($fullPath);
        if ($bytes === '') {
            return null;
        }

        $extension = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
        $mime = match ($extension) {
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            default => 'image/webp',
        };

        return 'data:'.$mime.';base64,'.base64_encode($bytes);
    }

    /**
     * Extract binary image bytes from OpenRouter's /images response (b64_json, data URI, or URL).
     *
     * @param  array<string, mixed>|null  $json
     */
    private function extractImageBinary(?array $json, string $characterId): string
    {
        if (! is_array($json)) {
            throw new RuntimeException("OpenRouter returned an invalid JSON response for '{$characterId}'.");
        }

        $b64 = data_get($json, 'data.0.b64_json');
        if (is_string($b64) && $b64 !== '') {
            $decoded = base64_decode($b64, true);
            if ($decoded !== false && $decoded !== '') {
                return $decoded;
            }
        }

        $candidateUrl = data_get($json, 'data.0.url')
            ?? data_get($json, 'images.0.image_url.url')
            ?? data_get($json, 'choices.0.message.images.0.image_url.url');

        if (! is_string($candidateUrl) || $candidateUrl === '') {
            throw new RuntimeException("OpenRouter did not return image data for '{$characterId}'.");
        }

        if (str_starts_with($candidateUrl, 'data:')) {
            $commaPos = strpos($candidateUrl, ',');
            if ($commaPos === false) {
                throw new RuntimeException("Malformed data URI returned for '{$characterId}'.");
            }
            $decoded = base64_decode(substr($candidateUrl, $commaPos + 1), true);
            if ($decoded === false || $decoded === '') {
                throw new RuntimeException("Failed to decode base64 image data for '{$characterId}'.");
            }

            return $decoded;
        }

        $this->assertSafeImageUrl($candidateUrl, $characterId);

        $download = Http::timeout(60)
            ->withOptions(['allow_redirects' => false])
            ->get($candidateUrl);
        $body = $download->body();

        if (! $download->successful() || $body === '') {
            throw new RuntimeException(
                "Failed to download generated animation from OpenRouter URL for '{$characterId}' (HTTP {$download->status()})."
            );
        }

        if (strlen($body) > 20 * 1024 * 1024) {
            throw new RuntimeException(
                "Downloaded animation for '{$characterId}' exceeds the 20 MB size limit."
            );
        }

        return $body;
    }

    /**
     * Reject non-HTTPS, credentialed, non-standard-port, or private/reserved IP URLs
     * returned by the image model before making an outbound fetch.
     */
    private function assertSafeImageUrl(string $url, string $characterId): void
    {
        $parts = parse_url($url);

        if (
            ! is_array($parts)
            || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            || empty($parts['host'])
            || isset($parts['user'])
            || isset($parts['pass'])
            || (isset($parts['port']) && (int) $parts['port'] !== 443)
        ) {
            throw new RuntimeException("Blocked unsafe image URL for '{$characterId}'.");
        }

        $host = trim((string) $parts['host'], '[]');
        $ips = filter_var($host, FILTER_VALIDATE_IP)
            ? [$host]
            : gethostbynamel($host);

        if (! is_array($ips) || $ips === []) {
            throw new RuntimeException("Could not resolve image host for '{$characterId}'.");
        }

        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                throw new RuntimeException("Blocked non-public image host IP for '{$characterId}'.");
            }
        }
    }

    /**
     * Save WebP directly if already WebP, or convert animated GIF/frames to animated WebP via ffmpeg.
     */
    private function persistAsAnimatedWebp(string $binary, string $outputPath, string $characterId): void
    {
        if (str_starts_with($binary, 'RIFF') && substr($binary, 8, 4) === 'WEBP') {
            File::put($outputPath, $binary);

            return;
        }

        $extension = str_starts_with($binary, 'GIF8') ? 'gif' : 'bin';
        $tempDir = storage_path('app/private/kill-tmp');
        File::ensureDirectoryExists($tempDir);

        $tempInput = $tempDir.DIRECTORY_SEPARATOR."{$characterId}_".uniqid('', true).".{$extension}";
        File::put($tempInput, $binary);

        try {
            $result = Process::timeout(120)->run([
                'ffmpeg',
                '-y',
                '-i',
                $tempInput,
                '-c:v',
                'libwebp_anim',
                '-lossless',
                '0',
                '-q:v',
                '85',
                '-loop',
                '0',
                '-pix_fmt',
                'yuva420p',
                '-an',
                $outputPath,
            ]);

            if (! $result->successful() || ! File::exists($outputPath) || File::size($outputPath) === 0) {
                $stderr = trim($result->errorOutput());
                throw new RuntimeException(
                    "Failed to convert '{$characterId}' animation to animated WebP via ffmpeg: {$stderr}"
                );
            }
        } finally {
            File::delete($tempInput);
        }
    }
}
